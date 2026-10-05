// One data layer powers the classic app and the new experience.
const f1State = { season: currentSeason, races: [], drivers: [], constructors: [], sources: {}, updatedAt: null };
window.F1Data = f1State;
const dataCache = {};
const pendingLoads = new Map();
let refreshSequence = 0;
let modalSequence = 0;
let modalState = { raceId: null, sprintId: null, activeTab: 'race' };
let modalOpener = null;

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function formatDate(value) {
    if (!value) return '—';
    const [, month, day] = value.split('-');
    return `${day}-${month}`;
}
function teamColor(name = '') {
    const colors = { mclaren: '#ff903e', ferrari: '#ff5369', mercedes: '#5be0cb', 'red bull': '#7295ff', williams: '#65b7ff', 'racing bulls': '#a6b4ff', aston: '#64bf97', haas: '#c1c9d3', alpine: '#fc9ac8', audi: '#ff6464', sauber: '#9bdf67', stake: '#9bdf67', cadillac: '#c5bbab' };
    return Object.entries(colors).find(([key]) => name.toLowerCase().includes(key))?.[1] || '#a6a6b0';
}
function notifyData(type) {
    f1State.updatedAt = new Date().toISOString();
    document.dispatchEvent(new CustomEvent('f1:data', { detail: { type, state: f1State } }));
    setApiStatus();
}
function setApiStatus() {
    const el = document.getElementById('apiStatus');
    const sources = Object.values(f1State.sources);
    const fallback = sources.includes('fallback');
    el.className = fallback ? 'fallback' : 'jolpica';
    el.textContent = fallback ? '! Часть данных из резервной базы · API недоступен' : '✓ Данные: Jolpica/Ergast API';
}
async function apiFetch(path, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 10000);
    try {
        const response = await fetch(`${JOLPICA_BASE}/${path}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}
async function requestDataset(type, season) {
    if (type === 'races') {
        const [schedule, winners, sprints] = await Promise.all([
            apiFetch(`${season}.json?limit=100`),
            apiFetch(`${season}/results/1.json?limit=100`).catch(() => null),
            apiFetch(`${season}/sprint.json?limit=200`).catch(() => null),
        ]);
        const races = schedule.MRData?.RaceTable?.Races;
        if (!Array.isArray(races) || !races.length) throw new Error('Расписание пока недоступно');
        const winnerMap = new Map((winners?.MRData?.RaceTable?.Races || []).map(r => [r.round, r.Results?.[0]?.Driver]));
        const sprintMap = new Map((sprints?.MRData?.RaceTable?.Races || []).map(r => [r.round, r.SprintResults?.[0]?.Driver]));
        return races.map(r => {
            const winner = winnerMap.get(r.round);
            const sprintWinner = sprintMap.get(r.round);
            return { round: Number(r.round), date: r.date, time: r.time || '00:00:00Z', country: r.Circuit?.Location?.country || '—', circuit: r.Circuit?.circuitName || '—', name: r.raceName || r.Circuit?.circuitName, winner: winner ? `${winner.givenName} ${winner.familyName}` : null, hasSprint: Boolean(r.Sprint || sprintWinner), sprint: sprintWinner ? `${sprintWinner.givenName} ${sprintWinner.familyName}` : null, source: 'jolpica' };
        });
    }
    const drivers = type === 'drivers';
    const data = await apiFetch(`${season}/${drivers ? 'driver' : 'constructor'}Standings.json?limit=100`);
    const rows = data.MRData?.StandingsTable?.StandingsLists?.[0]?.[drivers ? 'DriverStandings' : 'ConstructorStandings'];
    if (!Array.isArray(rows) || !rows.length) throw new Error('Зачёт пока недоступен');
    return rows.map(s => drivers
        ? { position: Number(s.position), givenName: s.Driver.givenName, familyName: s.Driver.familyName, nationality: s.Driver.nationality || '—', constructor: s.Constructors?.[0]?.name || '—', number: s.Driver.permanentNumber || '', points: Number(s.points), wins: Number(s.wins || 0) }
        : { position: Number(s.position), name: s.Constructor.name, points: Number(s.points), wins: Number(s.wins || 0) });
}
function fallbackDataset(type, season) {
    const rows = SEASON_DATA[season]?.[type] || [];
    return rows.map(row => type === 'races' ? { ...row, date: `${season}-${row.date.slice(3)}-${row.date.slice(0, 2)}`, time: '00:00:00Z', name: row.circuit, winner: row.winner === 'Не проведена' ? null : row.winner, sprint: row.sprint === 'Не проведена' ? null : row.sprint, hasSprint: row.sprint !== null, source: 'fallback' } : { ...row });
}
function renderDataset(type, rows, source) {
    const body = document.getElementById(`${type}TableBody`);
    const error = document.getElementById(`${type}Error`);
    error.style.display = source === 'fallback' ? 'block' : 'none';
    error.textContent = rows.length ? 'API недоступен. Показаны резервные данные; они могут быть устаревшими.' : 'Данные этого сезона сейчас недоступны. Попробуйте обновить позже.';
    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="${type === 'races' ? 6 : type === 'drivers' ? 5 : 3}" class="empty-state">Данных пока нет. Выберите другой сезон или обновите страницу.</td></tr>`;
        return;
    }
    const maxPoints = Math.max(1, ...rows.map(r => Number(r.points) || 0));
    body.innerHTML = rows.map(row => {
        if (type === 'races') {
            const sprint = row.hasSprint ? `${escapeHTML(row.sprint || 'Не проведена')} <span class="sprint-badge">S</span>` : '—';
            return `<tr data-round="${row.round}" data-race-name="${escapeHTML(row.name)}" data-sprint="${row.hasSprint}" data-source="${source}" ${row.winner && source === 'jolpica' ? 'tabindex="0" role="button" aria-label="' + escapeHTML('Результаты: ' + row.name) + '"' : ''}>
                <td><span class="round-index">${String(row.round).padStart(2, '0')}</span></td>
                <td><time datetime="${escapeHTML(row.date)}">${formatDate(row.date)}</time></td>
                <td class="country-cell">${escapeHTML(row.country)}</td>
                <td><span class="circuit-name">${escapeHTML(row.circuit)}</span><span class="race-source-badge badge-jolpica">${source === 'jolpica' ? 'Jolpica' : 'Резерв'}</span></td>
                <td><span class="${row.winner ? 'winner-name' : 'upcoming-label'}">${escapeHTML(row.winner || 'Не проведена')}</span></td>
                <td>${sprint}</td></tr>`;
        }
        const team = type === 'drivers' ? row.constructor : row.name;
        const color = teamColor(team);
        const points = Number(row.points) || 0;
        const pointCell = `<td class="points-cell"><span>${points}</span><i class="points-bar modern-only" style="--points-width:${(points / maxPoints) * 100}%;--team-color:${color}" aria-hidden="true"></i></td>`;
        return `<tr style="--team-color:${color}"><td><span class="position-index ${row.position <= 3 ? 'position-top' : ''}">${String(row.position).padStart(2, '0')}</span></td>${type === 'drivers' ? `<td><span class="driver-name">${escapeHTML(row.givenName)} <strong>${escapeHTML(row.familyName)}</strong></span></td><td class="col-nationality">${escapeHTML(row.nationality)}</td><td><span class="team-chip">${escapeHTML(team)}</span></td>` : `<td><span class="team-chip team-chip-large">${escapeHTML(team)}</span></td>`}${pointCell}</tr>`;
    }).join('');
}
async function loadDataset(type, force = false) {
    const season = currentSeason;
    const cache = dataCache[type];
    if (!force && cache?.season === season && Date.now() - cache.updatedAt < CACHE_LIFETIME) {
        renderDataset(type, cache.rows, cache.source);
        return;
    }
    const key = `${season}:${type}`;
    if (pendingLoads.has(key)) return pendingLoads.get(key);
    const task = (async () => {
        const body = document.getElementById(`${type}TableBody`);
        body.innerHTML = `<tr><td colspan="${type === 'races' ? 6 : type === 'drivers' ? 5 : 3}" class="loading-state"><span class="loading-dot"></span> Загрузка данных сезона ${season}…</td></tr>`;
        let rows, source;
        try { rows = await requestDataset(type, season); source = 'jolpica'; }
        catch (_) { rows = fallbackDataset(type, season); source = 'fallback'; }
        if (currentSeason !== season) return;
        dataCache[type] = { season, rows, source, updatedAt: Date.now() };
        f1State[type] = rows;
        f1State.sources[type] = source;
        renderDataset(type, rows, source);
        notifyData(type);
    })();
    pendingLoads.set(key, task);
    try { await task; } finally { pendingLoads.delete(key); }
}
function loadRaces() { return loadDataset('races'); }
function loadDrivers() { return loadDataset('drivers'); }
function loadConstructors() { return loadDataset('constructors'); }
function showSection(id, updateHash = true) {
    const section = document.getElementById(id);
    if (!section?.classList.contains('section')) return;
    document.querySelectorAll('.section').forEach(s => { s.classList.add('hidden'); s.classList.remove('active'); });
    section.classList.remove('hidden');
    section.classList.add('active');
    if (updateHash && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    document.querySelectorAll('nav [data-section]').forEach(button => {
        const active = button.dataset.section === id;
        button.classList.toggle('nav-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    if (['races', 'drivers', 'constructors'].includes(id)) loadDataset(id);
    document.dispatchEvent(new CustomEvent('f1:section', { detail: id }));
}
function syncSeason() {
    f1State.season = currentSeason;
    document.querySelectorAll('.year-btn').forEach(btn => {
        const active = Number(btn.dataset.year) === currentSeason;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
    for (const [id, title] of Object.entries({ racesHeading: 'Расписание гонок', driversHeading: 'Личный зачёт', constructorsHeading: 'Кубок конструкторов' })) document.getElementById(id).textContent = `${title} — Сезон ${currentSeason}`;
    document.getElementById('footerText').textContent = `© ${new Date().getFullYear()} F1 Visualization Project — Сезон ${currentSeason} | Данные: Jolpica/Ergast API`;
    document.dispatchEvent(new CustomEvent('f1:season', { detail: currentSeason }));
}
function changeSeason(year) {
    if (!AVAILABLE_YEARS.includes(year) || currentSeason === year) return;
    currentSeason = year;
    preferences.set('f1_season', year);
    Object.keys(dataCache).forEach(key => delete dataCache[key]);
    f1State.races = []; f1State.drivers = []; f1State.constructors = []; f1State.sources = {};
    closeModal();
    syncSeason();
    refreshData();
}
async function refreshData(force = true) {
    const sequence = ++refreshSequence;
    const button = document.getElementById('refreshButton');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Обновление…';
    try { await Promise.all(['races', 'drivers', 'constructors'].map(type => loadDataset(type, force))); }
    finally {
        if (sequence === refreshSequence) {
            button.disabled = false;
            button.setAttribute('aria-busy', 'false');
            button.textContent = 'Обновить данные';
        }
    }
}
async function openRaceModal(raceId, sprintId, raceName, source = 'jolpica') {
    modalOpener = document.activeElement;
    modalState = { raceId, sprintId, source, activeTab: 'race', season: currentSeason };
    document.getElementById('modalTitle').textContent = `${raceName} (${currentSeason})`;
    document.getElementById('modalTabs').style.display = sprintId ? 'flex' : 'none';
    document.getElementById('sprintResultsTableBody').innerHTML = '';
    document.getElementById('raceResultsModal').classList.add('active');
    document.body.classList.add('modal-open');
    document.querySelector('.close-button').focus();
    await switchModalTab('race');
}
async function switchModalTab(tab) {
    const sequence = ++modalSequence;
    modalState.activeTab = tab;
    const isSprint = tab === 'sprint';
    document.getElementById('tabRace').classList.toggle('active', !isSprint);
    document.getElementById('tabSprint').classList.toggle('active', isSprint);
    document.getElementById('raceResultsContainer').style.display = isSprint ? 'none' : 'block';
    document.getElementById('sprintResultsContainer').style.display = isSprint ? 'block' : 'none';
    const body = document.getElementById(isSprint ? 'sprintResultsTableBody' : 'raceResultsTableBody');
    const error = document.getElementById(isSprint ? 'sprintModalError' : 'modalError');
    error.style.display = 'none';
    body.innerHTML = '<tr><td colspan="4" class="loading-state"><span class="loading-dot"></span> Загружаем результаты…</td></tr>';
    try {
        const data = await apiFetch(`${modalState.season}/${isSprint ? modalState.sprintId : modalState.raceId}/${isSprint ? 'sprint' : 'results'}.json?limit=100`);
        if (sequence !== modalSequence) return;
        const results = data.MRData?.RaceTable?.Races?.[0]?.[isSprint ? 'SprintResults' : 'Results'] || [];
        body.innerHTML = results.map(r => `<tr style="--team-color:${teamColor(r.Constructor?.name)}"><td>${escapeHTML(r.position)}</td><td>${escapeHTML(r.Driver.givenName)} <strong>${escapeHTML(r.Driver.familyName)}</strong></td><td><span class="team-chip">${escapeHTML(r.Constructor?.name || '—')}</span></td><td class="points-cell">${escapeHTML(r.points || 0)}</td></tr>`).join('');
        if (!results.length) { error.style.display = 'block'; error.textContent = 'Результаты ещё не опубликованы.'; }
    } catch (_) {
        if (sequence !== modalSequence) return;
        body.innerHTML = '';
        error.style.display = 'block'; error.textContent = 'Не удалось загрузить результаты. Попробуйте открыть гонку ещё раз.';
    }
}
function closeModal() {
    ++modalSequence;
    const modal = document.getElementById('raceResultsModal');
    if (!modal?.classList.contains('active')) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    modalOpener?.focus();
}
async function clearAllCaches() {
    // Only clear this app's caches; other GitHub Pages apps share this origin.
    if ('caches' in window) {
        const keys = await caches.keys();
        const prefix = 'f1-grid-' + new URL('./', location.href).pathname + '-';
        await Promise.all(keys.filter(key => key.startsWith(prefix)).map(key => caches.delete(key)));
    }
    Object.keys(dataCache).forEach(key => delete dataCache[key]);
    await refreshData();
}
window.clearAllCaches = clearAllCaches;
window.debugCache = () => console.table(Object.fromEntries(Object.entries(dataCache).map(([key, value]) => [key, { season: value.season, source: value.source, ageSeconds: Math.round((Date.now() - value.updatedAt) / 1000) }])));
document.addEventListener('DOMContentLoaded', () => {
    syncSeason();
    const requestedSection = location.hash.slice(1);
    showSection(['races', 'drivers', 'constructors', 'broadcasts', 'news'].includes(requestedSection) && !(requestedSection === 'news' && document.documentElement.dataset.design === 'classic') ? requestedSection : 'races', false);
    refreshData(false);
    const activateRace = event => {
        const row = event.target.closest('tr[data-round][role="button"]');
        if (row) openRaceModal(Number(row.dataset.round), row.dataset.sprint === 'true' ? Number(row.dataset.round) : null, row.dataset.raceName, row.dataset.source);
    };
    document.getElementById('racesTableBody').addEventListener('click', activateRace);
    document.getElementById('racesTableBody').addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateRace(event); }
    });
    document.getElementById('raceResultsModal').addEventListener('click', event => { if (event.target.id === 'raceResultsModal') closeModal(); });
    document.addEventListener('keydown', event => {
        const modal = document.getElementById('raceResultsModal');
        if (!modal.classList.contains('active')) return;
        if (event.key === 'Escape') closeModal();
        if (event.key === 'Tab') {
            const nodes = [...modal.querySelectorAll('button, [href], [tabindex="0"]')].filter(el => el.getClientRects().length);
            if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
        }
    });
});
