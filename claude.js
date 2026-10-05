// ===== F1 APEX — ВАРИАНТ CLAUDE =====
// Свой слой данных (Jolpica/Ergast) + отрисовка. Старый вид (script.js) запускается только при переключении.
(() => {
    'use strict';

    const API = 'https://api.jolpi.ca/ergast/f1';
    const YEARS = [2023, 2024, 2025, 2026];
    const CACHE_MS = 5 * 60 * 1000;
    const root = document.documentElement;
    const $ = id => document.getElementById(id);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const storage = {
        get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} },
    };

    const initialSeason = parseInt(storage.get('f1_season'), 10);
    const state = {
        season: YEARS.includes(initialSeason) ? initialSeason : 2026,
        races: [], drivers: [], teams: [],
        source: { races: 'api', drivers: 'api', teams: 'api' },
        updatedAt: null,
        raceFilter: 'all', raceQuery: '',
        news: null, newsFilter: 'all',
    };
    let started = false;
    let loadToken = 0;

    // ---------- Справочники ----------
    const COUNTRIES = {
        'Australia': ['AUS', 'Австралия'], 'China': ['CHN', 'Китай'], 'Japan': ['JPN', 'Япония'],
        'Bahrain': ['BHR', 'Бахрейн'], 'Saudi Arabia': ['KSA', 'Саудовская Аравия'], 'USA': ['USA', 'США'],
        'United States': ['USA', 'США'], 'Italy': ['ITA', 'Италия'], 'Monaco': ['MON', 'Монако'],
        'Spain': ['ESP', 'Испания'], 'Canada': ['CAN', 'Канада'], 'Austria': ['AUT', 'Австрия'],
        'UK': ['GBR', 'Великобритания'], 'United Kingdom': ['GBR', 'Великобритания'], 'Belgium': ['BEL', 'Бельгия'],
        'Hungary': ['HUN', 'Венгрия'], 'Netherlands': ['NED', 'Нидерланды'], 'Azerbaijan': ['AZE', 'Азербайджан'],
        'Singapore': ['SGP', 'Сингапур'], 'Mexico': ['MEX', 'Мексика'], 'Brazil': ['BRA', 'Бразилия'],
        'Qatar': ['QAT', 'Катар'], 'UAE': ['UAE', 'ОАЭ'], 'United Arab Emirates': ['UAE', 'ОАЭ'],
        'Malaysia': ['MAS', 'Малайзия'], 'France': ['FRA', 'Франция'], 'Portugal': ['POR', 'Португалия'],
        'Turkey': ['TUR', 'Турция'], 'Germany': ['GER', 'Германия'], 'Russia': ['RUS', 'Россия'],
        'Argentina': ['ARG', 'Аргентина'], 'South Africa': ['RSA', 'ЮАР'], 'Korea': ['KOR', 'Корея'],
        'India': ['IND', 'Индия'], 'Vietnam': ['VIE', 'Вьетнам'], 'Thailand': ['THA', 'Таиланд'],
    };
    const RU_TO_CODE = {};
    Object.values(COUNTRIES).forEach(([code, ru]) => { RU_TO_CODE[ru] = code; });

    const NATIONALITIES = {
        British: 'Великобритания', Dutch: 'Нидерланды', Monegasque: 'Монако', Australian: 'Австралия',
        Spanish: 'Испания', Mexican: 'Мексика', German: 'Германия', French: 'Франция', Finnish: 'Финляндия',
        Canadian: 'Канада', Thai: 'Таиланд', Japanese: 'Япония', Chinese: 'Китай', Danish: 'Дания',
        American: 'США', Italian: 'Италия', 'New Zealander': 'Новая Зеландия', Argentine: 'Аргентина',
        Argentinian: 'Аргентина', Brazilian: 'Бразилия', Swedish: 'Швеция', Swiss: 'Швейцария', Austrian: 'Австрия',
        Polish: 'Польша', Russian: 'Россия', Belgian: 'Бельгия', Indian: 'Индия', Irish: 'Ирландия',
    };

    const TEAMS = [
        { key: 'mclaren', color: '#ff8000', url: 'https://www.mclaren.com/racing/formula-1/', label: 'McLaren' },
        { key: 'ferrari', color: '#e8002d', url: 'https://www.ferrari.com/en-EN/formula1', label: 'Ferrari' },
        { key: 'mercedes', color: '#27f4d2', url: 'https://www.mercedesamgf1.com/', label: 'Mercedes' },
        { key: 'red bull', color: '#3671c6', url: 'https://www.redbullracing.com/', label: 'Red Bull Racing' },
        { key: 'williams', color: '#64c4ff', url: 'https://www.williamsf1.com/', label: 'Williams' },
        { key: 'racing bulls', color: '#6c98ff', url: 'https://www.visacashapprb.com/', label: 'Racing Bulls' },
        { key: 'rb f1', color: '#6c98ff', url: 'https://www.visacashapprb.com/', label: 'Racing Bulls' },
        { key: 'alphatauri', color: '#5e8faa', url: 'https://www.visacashapprb.com/', label: 'AlphaTauri' },
        { key: 'aston', color: '#229971', url: 'https://www.astonmartinf1.com/', label: 'Aston Martin' },
        { key: 'haas', color: '#b6babd', url: 'https://www.haasf1team.com/', label: 'Haas' },
        { key: 'alpine', color: '#ff87bc', url: 'https://www.alpinef1.com/', label: 'Alpine' },
        { key: 'audi', color: '#ff2d4b', url: 'https://www.audimotorsport.com/', label: 'Audi' },
        { key: 'sauber', color: '#52e252', url: 'https://www.sauber-group.com/', label: 'Sauber' },
        { key: 'alfa', color: '#c92d4b', url: 'https://www.sauber-group.com/', label: 'Alfa Romeo' },
        { key: 'cadillac', color: '#d6b46a', url: 'https://www.cadillacf1team.com/', label: 'Cadillac' },
    ];
    // Названия Гран-при по-русски (по ключевому слову из английского названия)
    const GP_NAMES = [
        ['Australian', 'Австралии'], ['Chinese', 'Китая'], ['Japanese', 'Японии'], ['Bahrain', 'Бахрейна'],
        ['Saudi Arabian', 'Саудовской Аравии'], ['Miami', 'Майами'], ['Emilia Romagna', 'Эмилии-Романьи'],
        ['Monaco', 'Монако'], ['Barcelona', 'Барселоны'], ['Spanish', 'Испании'], ['Canadian', 'Канады'],
        ['Austrian', 'Австрии'], ['Styrian', 'Штирии'], ['British', 'Великобритании'], ['70th Anniversary', '70-летия Ф1'],
        ['Belgian', 'Бельгии'], ['Hungarian', 'Венгрии'], ['Dutch', 'Нидерландов'], ['Italian', 'Италии'],
        ['Tuscan', 'Тосканы'], ['Azerbaijan', 'Азербайджана'], ['Singapore', 'Сингапура'], ['United States', 'США'],
        ['Mexico City', 'Мехико'], ['Mexican', 'Мексики'], ['São Paulo', 'Сан-Паулу'], ['Sao Paulo', 'Сан-Паулу'],
        ['Brazilian', 'Бразилии'], ['Las Vegas', 'Лас-Вегаса'], ['Qatar', 'Катара'], ['Abu Dhabi', 'Абу-Даби'],
        ['Portuguese', 'Португалии'], ['Turkish', 'Турции'], ['Russian', 'России'], ['French', 'Франции'],
        ['German', 'Германии'], ['Eifel', 'Айфеля'], ['Sakhir', 'Сахира'], ['Malaysian', 'Малайзии'],
    ];
    const raceNameRu = name => {
        const hit = GP_NAMES.find(([key]) => String(name).includes(key));
        return hit ? `Гран-при ${hit[1]}` : name;
    };

    const teamInfo = name => TEAMS.find(t => String(name || '').toLowerCase().includes(t.key)) ||
        { color: '#9aa0ad', url: 'https://www.formula1.com/en/teams', label: name };
    const teamColor = name => teamInfo(name).color;

    // ---------- Утилиты ----------
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = (date, options) => new Intl.DateTimeFormat('ru-RU', options).format(date);
    const pad = n => String(n).padStart(2, '0');
    const num = value => { const n = parseFloat(value); return Number.isFinite(n) ? n : 0; };
    const plural = (n, one, few, many) => {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
        return many;
    };
    const countryInfo = name => COUNTRIES[name] || [RU_TO_CODE[name] || String(name || '—').slice(0, 3).toUpperCase(), name || '—'];
    const sessionDate = s => s && s.date ? new Date(`${s.date}T${s.time || '12:00:00Z'}`) : null;
    const initials = (first, last) => `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();

    function withTransition(update) {
        if (document.startViewTransition && !reducedMotion.matches) document.startViewTransition(update);
        else update();
    }

    // ---------- Сеть ----------
    const memo = new Map();
    function getJSON(path, fresh) {
        const url = `${API}/${path}`;
        const hit = memo.get(url);
        if (!fresh && hit && Date.now() - hit.time < CACHE_MS) return hit.promise;
        const promise = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } finally { clearTimeout(timer); }
        })();
        memo.set(url, { time: Date.now(), promise });
        promise.catch(() => memo.delete(url));
        return promise;
    }

    // Jolpica отдаёт максимум 100 строк за запрос — догружаем страницы.
    async function getAllRaces(path, fresh) {
        const first = await getJSON(`${path}${path.includes('?') ? '&' : '?'}limit=100`, fresh);
        const total = num(first.MRData?.total);
        const races = [...(first.MRData?.RaceTable?.Races || [])];
        const pages = [];
        for (let offset = 100; offset < total && offset < 400; offset += 100) {
            pages.push(getJSON(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`, fresh));
        }
        (await Promise.all(pages)).forEach(page => races.push(...(page.MRData?.RaceTable?.Races || [])));
        return races;
    }

    // ---------- Загрузка сезона ----------
    const fallbackFor = key => (typeof SEASON_DATA !== 'undefined' && SEASON_DATA[state.season]?.[key]) || [];
    const sprintFallback = round => typeof SPRINT_ROUNDS !== 'undefined' && !!SPRINT_ROUNDS[state.season]?.has(round);

    async function loadSeason(fresh = false) {
        const token = ++loadToken;
        const season = state.season;
        root.classList.add('mx-loading');
        setStatus('loading');

        const [schedule, winners, sprints, driverSt, teamSt] = await Promise.allSettled([
            getJSON(`${season}.json?limit=100`, fresh),
            getAllRaces(`${season}/results/1.json`, fresh),
            getAllRaces(`${season}/sprint.json`, fresh),
            getJSON(`${season}/driverStandings.json?limit=100`, fresh),
            getJSON(`${season}/constructorStandings.json?limit=100`, fresh),
        ]);
        if (token !== loadToken) return; // пользователь уже выбрал другой сезон

        // Гонки
        const apiRaces = schedule.status === 'fulfilled' ? schedule.value.MRData?.RaceTable?.Races || [] : [];
        if (apiRaces.length) {
            const winnerMap = new Map();
            if (winners.status === 'fulfilled') winners.value.forEach(r => r.Results?.[0] && winnerMap.set(+r.round, r.Results[0]));
            const sprintMap = new Map();
            if (sprints.status === 'fulfilled') sprints.value.forEach(r => {
                const best = (r.SprintResults || []).find(x => x.position === '1') || r.SprintResults?.[0];
                if (best) sprintMap.set(+r.round, best);
            });
            state.races = apiRaces.map(r => {
                const round = +r.round;
                const win = winnerMap.get(round);
                const spr = sprintMap.get(round);
                return {
                    round, name: raceNameRu(r.raceName), nameEn: r.raceName, circuit: r.Circuit?.circuitName || '—',
                    locality: r.Circuit?.Location?.locality || '', country: r.Circuit?.Location?.country || '',
                    start: sessionDate(r), sprint: !!r.Sprint || sprintMap.has(round) || sprintFallback(round),
                    sessions: [
                        ['Практика 1', r.FirstPractice], ['Практика 2', r.SecondPractice], ['Практика 3', r.ThirdPractice],
                        ['Квалиф. спринта', r.SprintQualifying || r.SprintShootout], ['Спринт', r.Sprint],
                        ['Квалификация', r.Qualifying], ['Гонка', r],
                    ].map(([label, s]) => ({ label, date: sessionDate(s) })).filter(s => s.date),
                    winner: win ? { first: win.Driver.givenName, last: win.Driver.familyName, team: win.Constructor?.name } : null,
                    sprintWinner: spr ? { first: spr.Driver.givenName, last: spr.Driver.familyName, team: spr.Constructor?.name } : null,
                    live: true,
                };
            });
            state.source.races = 'api';
        } else {
            state.races = fallbackFor('races').map(r => {
                const [dd, mm] = String(r.date).split('-');
                const won = r.winner && r.winner !== 'Не проведена';
                return {
                    round: r.round, name: `Гран-при: ${r.country}`, circuit: r.circuit, locality: r.circuit, country: r.country,
                    start: new Date(`${season}-${mm}-${dd}T13:00:00Z`), sprint: r.sprint !== null && r.sprint !== undefined,
                    sessions: [], winner: won ? { first: '', last: r.winner, team: '' } : null,
                    sprintWinner: r.sprint && r.sprint !== 'Не проведена' ? { first: '', last: r.sprint, team: '' } : null,
                    live: false,
                };
            });
            state.source.races = 'fallback';
        }

        // Личный зачёт
        const dList = driverSt.status === 'fulfilled' ? driverSt.value.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings : null;
        if (dList && dList.length) {
            state.drivers = dList.map(s => ({
                pos: +s.position || +s.positionText || 0, points: num(s.points), wins: num(s.wins),
                first: s.Driver.givenName, last: s.Driver.familyName, code: s.Driver.code || s.Driver.familyName.slice(0, 3).toUpperCase(),
                number: s.Driver.permanentNumber || '', nat: NATIONALITIES[s.Driver.nationality] || s.Driver.nationality || '—',
                team: s.Constructors?.[s.Constructors.length - 1]?.name || '—',
            }));
            state.source.drivers = 'api';
        } else {
            state.drivers = fallbackFor('drivers').map(d => ({
                pos: d.position, points: num(d.points), wins: 0, first: d.givenName, last: d.familyName,
                code: d.familyName.slice(0, 3).toUpperCase(), number: '', nat: d.nationality, team: d.constructor,
            }));
            state.source.drivers = 'fallback';
        }

        // Кубок конструкторов
        const cList = teamSt.status === 'fulfilled' ? teamSt.value.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings : null;
        if (cList && cList.length) {
            state.teams = cList.map(s => ({ pos: +s.position || 0, name: s.Constructor.name, points: num(s.points), wins: num(s.wins) }));
            state.source.teams = 'api';
        } else {
            state.teams = fallbackFor('constructors').map(c => ({ pos: c.position, name: c.name, points: num(c.points), wins: 0 }));
            state.source.teams = 'fallback';
        }

        state.updatedAt = new Date();
        root.classList.remove('mx-loading');
        renderAll();
    }

    // ---------- Статус ----------
    function setStatus(mode) {
        const el = $('mxStatus');
        if (mode === 'loading') {
            el.className = 'mx-status is-loading';
            el.innerHTML = `<span class="mx-spinner"></span> Загружаем сезон ${state.season}…`;
            return;
        }
        const fallback = Object.values(state.source).includes('fallback');
        el.className = `mx-status ${fallback ? 'is-fallback' : 'is-live'}`;
        el.innerHTML = fallback
            ? `<span class="mx-status-dot"></span> API недоступен — показаны резервные данные сезона ${state.season}`
            : `<span class="mx-status-dot"></span> Данные Jolpica · обновлено в ${fmt(state.updatedAt, { hour: '2-digit', minute: '2-digit' })}`;
    }

    // ---------- Отрисовка ----------
    function renderAll() {
        setStatus();
        renderSeasonText();
        renderHero();
        renderRaces();
        renderStandings();
        renderTeams();
        renderTeamLinks();
        track.setCars(state.drivers.slice(0, 5));
        observeReveals();
    }

    function renderSeasonText() {
        document.querySelectorAll('#claude [data-season]').forEach(el => { el.textContent = state.season; });
        document.querySelectorAll('.mx-season button').forEach(btn => {
            const active = +btn.dataset.year === state.season;
            btn.setAttribute('aria-checked', String(active));
            btn.tabIndex = active ? 0 : -1;
        });
        moveThumb(document.querySelector('.mx-season'), document.querySelector('.mx-season [aria-checked="true"]'), '.mx-season-thumb');
    }

    function moveThumb(group, active, thumbSelector) {
        if (!group || !active) return;
        const thumb = group.querySelector(thumbSelector);
        if (!thumb) return;
        thumb.style.setProperty('--x', `${active.offsetLeft}px`);
        thumb.style.setProperty('--w', `${active.offsetWidth}px`);
    }

    // --- Герой: следующая гонка, обратный отсчёт, пульс, лидер ---
    let countdownTarget = null;
    function nextRace() {
        const now = Date.now();
        // Гонка считается текущей ещё 3 часа после старта
        return state.races.find(r => r.start && r.start.getTime() + 3 * 3600e3 > now) || null;
    }
    const isDone = r => !!r.winner || (r.start && r.start.getTime() + 3 * 3600e3 < Date.now());

    function renderHero() {
        const next = nextRace();
        const total = state.races.length;
        const done = state.races.filter(isDone).length;

        if (next) {
            const [code, ru] = countryInfo(next.country);
            $('mxNextLabel').textContent = next.start.getTime() < Date.now() ? 'Идёт сейчас' : 'Следующий этап';
            $('mxNextRound').textContent = `R${pad(next.round)} · ${code}`;
            $('mxNextName').textContent = next.name;
            $('mxNextCircuit').textContent = `${next.circuit} · ${next.locality && next.locality !== ru ? next.locality + ', ' : ''}${ru}`;
            countdownTarget = next.start;
            const now = Date.now();
            $('mxWeekend').innerHTML = next.sessions.map(s => `
                <li class="${s.date.getTime() < now ? 'is-past' : ''} ${s.label === 'Гонка' ? 'is-race' : ''}">
                    <span>${esc(s.label)}</span>
                    <time datetime="${s.date.toISOString()}">${esc(fmt(s.date, { weekday: 'short', day: 'numeric', month: 'short' }))}
                    <b>${esc(fmt(s.date, { hour: '2-digit', minute: '2-digit' }))}</b></time>
                </li>`).join('') || `<li><span>Старт гонки</span><time><b>${esc(fmt(next.start, { day: 'numeric', month: 'long' }))}</b></time></li>`;
        } else {
            const last = state.races[state.races.length - 1];
            $('mxNextLabel').textContent = total ? 'Сезон завершён' : 'Нет данных';
            $('mxNextRound').textContent = total ? `${total} этапов` : 'R—';
            $('mxNextName').textContent = total ? `Сезон ${state.season} позади` : 'Календарь недоступен';
            $('mxNextCircuit').textContent = last ? `Финал: ${last.name}` : 'Попробуйте обновить данные';
            $('mxWeekend').innerHTML = state.drivers[0] ? `<li class="is-race"><span>Чемпион</span><time><b>${esc(state.drivers[0].first)} ${esc(state.drivers[0].last)}</b></time></li>` : '';
            countdownTarget = null;
        }
        tickCountdown();

        // Пульс сезона
        const ring = $('mxRing');
        ring.style.setProperty('--p', total ? Math.round(done / total * 100) : 0);
        animateNumber($('mxRingValue'), done);
        $('mxRingCaption').textContent = `из ${total} ${plural(total, 'этапа', 'этапов', 'этапов')}`;
        animateNumber($('mxStatDrivers'), state.drivers.length);
        animateNumber($('mxStatTeams'), state.teams.length);
        animateNumber($('mxStatSprints'), state.races.filter(r => r.sprint).length);

        // Лидер
        const [p1, p2] = state.drivers;
        const card = $('mxLeaderCard');
        if (p1) {
            card.style.setProperty('--team', teamColor(p1.team));
            $('mxLeaderNum').textContent = p1.number || p1.code;
            $('mxLeaderFirst').textContent = p1.first;
            $('mxLeaderLast').textContent = p1.last;
            $('mxLeaderTeam').textContent = `${p1.team} · ${p1.wins} ${plural(p1.wins, 'победа', 'победы', 'побед')}`;
            animateNumber($('mxLeaderPoints'), p1.points);
            $('mxLeaderGap').textContent = p2 ? (p1.points - p2.points > 0
                ? `+${p1.points - p2.points} над ${p2.last}` : `Делит лидерство с ${p2.last}`) : '';
            $('mxLeaderRace').innerHTML = state.drivers.slice(0, 3).map(d => `
                <li style="--c:${teamColor(d.team)}"><b>${esc(d.code)}</b><span><i style="--fill:${p1.points ? d.points / p1.points : 0}"></i></span><em>${d.points}</em></li>`).join('');
        } else {
            $('mxLeaderRace').innerHTML = '';
            $('mxLeaderLast').textContent = 'Нет данных';
        }
    }

    function tickCountdown() {
        const box = $('mxCountdown');
        if (!countdownTarget) { box.classList.add('is-idle'); return; }
        box.classList.remove('is-idle');
        let diff = Math.max(0, countdownTarget.getTime() - Date.now());
        const d = Math.floor(diff / 864e5); diff -= d * 864e5;
        const h = Math.floor(diff / 36e5); diff -= h * 36e5;
        const m = Math.floor(diff / 6e4); diff -= m * 6e4;
        const s = Math.floor(diff / 1e3);
        [['d', d], ['h', h], ['m', m], ['s', s]].forEach(([key, value]) => {
            const el = box.querySelector(`[data-cd="${key}"]`);
            const text = pad(value);
            if (el.textContent !== text) {
                el.textContent = text;
                el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
            }
        });
    }

    function animateNumber(el, to) {
        const from = parseFloat(el.dataset.value || '0') || 0;
        el.dataset.value = to;
        if (reducedMotion.matches || from === to) { el.textContent = Math.round(to); return; }
        const t0 = performance.now(), dur = 900;
        const step = now => {
            const k = Math.min(1, (now - t0) / dur);
            const e = 1 - Math.pow(1 - k, 4);
            el.textContent = Math.round(from + (to - from) * e);
            if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    // --- Календарь ---
    function renderRaces() {
        const list = $('mxRaces');
        const next = nextRace();
        const total = state.races.length;
        const done = state.races.filter(isDone).length;
        $('mxTimelineFill').parentElement.style.setProperty('--progress', total ? done / total : 0);

        list.innerHTML = state.races.map((r, i) => {
            const status = r === next ? 'next' : isDone(r) ? 'done' : 'upcoming';
            const [code, ru] = countryInfo(r.country);
            const color = r.winner ? teamColor(r.winner.team) : 'var(--red)';
            const clickable = r.live && r.winner;
            const tag = clickable ? 'button' : 'div';
            const winner = r.winner
                ? `<span class="mx-win"><i style="--c:${color}"></i><span>${esc(r.winner.first)} <b>${esc(r.winner.last)}</b></span></span>`
                : `<span class="mx-win is-empty">${status === 'next' ? 'Следующая гонка' : status === 'done' ? 'Результат ожидается' : 'Впереди'}</span>`;
            const sprint = r.sprint
                ? `<span class="mx-sprint" title="Спринт-уикенд">S${r.sprintWinner ? ` · ${esc(r.sprintWinner.last)}` : ''}</span>` : '';
            return `<li class="mx-race is-${status}" style="--i:${i};--c:${color}" data-status="${status}" data-sprint="${r.sprint}"
                    data-search="${esc(`${r.name} ${r.nameEn || ''} ${r.circuit} ${r.locality} ${r.country} ${ru} ${r.winner ? r.winner.first + ' ' + r.winner.last : ''}`.toLowerCase())}">
                <${tag} class="mx-race-card glass" ${clickable ? `type="button" data-round="${r.round}" aria-label="Результаты: ${esc(r.name)}"` : ''}>
                    <span class="mx-race-top">
                        <span class="mx-race-round">R${pad(r.round)}</span>
                        <span class="mx-race-code">${esc(code)}</span>
                        ${sprint}
                    </span>
                    <span class="mx-race-date">${r.start ? `<b>${fmt(r.start, { day: 'numeric' })}</b> ${esc(fmt(r.start, { month: 'short' }).replace('.', ''))}` : '—'}</span>
                    <span class="mx-race-name">${esc(r.name)}</span>
                    <span class="mx-race-circuit">${esc(r.circuit)} · ${esc(ru)}</span>
                    ${winner}
                    ${clickable ? '<span class="mx-race-open" aria-hidden="true">Результаты →</span>' : ''}
                </${tag}>
            </li>`;
        }).join('');
        applyRaceFilter();
    }

    function applyRaceFilter() {
        const q = state.raceQuery.trim().toLowerCase();
        let visible = 0;
        document.querySelectorAll('#mxRaces .mx-race').forEach(li => {
            const f = state.raceFilter;
            const ok = (f === 'all' || (f === 'done' && li.dataset.status === 'done') ||
                (f === 'next' && li.dataset.status !== 'done') || (f === 'sprint' && li.dataset.sprint === 'true')) &&
                (!q || li.dataset.search.includes(q));
            li.hidden = !ok;
            if (ok) visible++;
        });
        $('mxRacesEmpty').hidden = visible > 0 || !state.races.length;
        if (!state.races.length) {
            $('mxRaces').innerHTML = '<li class="mx-empty-card glass">Календарь сезона пока недоступен.</li>';
        }
    }

    // --- Личный зачёт ---
    function renderStandings() {
        const drivers = state.drivers;
        const leader = drivers[0]?.points || 0;
        const top = drivers.slice(0, 3);
        const order = [top[1], top[0], top[2]].filter(Boolean);
        $('mxPodium').innerHTML = order.map(d => `
            <article class="mx-pod mx-pod-${d.pos} glass" data-tilt style="--team:${teamColor(d.team)}">
                <span class="mx-pod-num" aria-hidden="true">${esc(d.number || d.pos)}</span>
                <span class="mx-pod-pos">P${d.pos}</span>
                <span class="mx-pod-avatar" aria-hidden="true">${esc(initials(d.first, d.last))}</span>
                <p class="mx-pod-first">${esc(d.first)}</p>
                <h3 class="mx-pod-last">${esc(d.last)}</h3>
                <p class="mx-pod-team">${esc(d.team)}</p>
                <p class="mx-pod-points"><b>${d.points}</b> очк.</p>
                <span class="mx-pod-step" aria-hidden="true"></span>
            </article>`).join('');

        $('mxDrivers').innerHTML = drivers.map((d, i) => `
            <div class="mx-tr" role="row" style="--team:${teamColor(d.team)};--fill:${leader ? d.points / leader : 0};--i:${i}">
                <span role="cell" class="mx-pos ${d.pos <= 3 ? 'is-top' : ''}">${pad(d.pos)}</span>
                <span role="cell" class="mx-driver"><i class="mx-team-bar"></i><span><small>${esc(d.first)}</small> <b>${esc(d.last)}</b></span><em>${esc(d.code)}</em></span>
                <span role="cell" class="mx-col-nat">${esc(d.nat)}</span>
                <span role="cell" class="mx-col-team"><span class="mx-team-chip">${esc(d.team)}</span></span>
                <span role="cell" class="mx-col-bar"><span class="mx-bar"><span></span></span><small>${i ? `−${leader - d.points}` : 'лидер'}</small></span>
                <span role="cell" class="mx-pts">${d.points}</span>
            </div>`).join('') || '<div class="mx-tr"><span>Нет данных для этого сезона.</span></div>';
    }

    // --- Кубок конструкторов ---
    function renderTeams() {
        const max = state.teams[0]?.points || 0;
        $('mxTeams').innerHTML = state.teams.map((t, i) => {
            const roster = state.drivers.filter(d => teamInfo(d.team).label === teamInfo(t.name).label).slice(0, 3)
                .map(d => esc(d.last)).join(' · ');
            return `<article class="mx-team glass" style="--team:${teamColor(t.name)};--fill:${max ? t.points / max : 0};--i:${i}">
                <span class="mx-team-pos">${pad(t.pos)}</span>
                <div class="mx-team-main">
                    <h3>${esc(t.name)}</h3>
                    <p>${roster || '&nbsp;'}</p>
                    <span class="mx-team-meter"><span></span></span>
                </div>
                <div class="mx-team-pts"><b>${t.points}</b><small>${t.wins ? `${t.wins} ${plural(t.wins, 'победа', 'победы', 'побед')}` : 'очков'}</small></div>
            </article>`;
        }).join('') || '<p class="mx-empty-card glass">Нет данных для этого сезона.</p>';
    }

    function renderTeamLinks() {
        const names = state.teams.length ? state.teams.map(t => t.name) :
            ['McLaren', 'Ferrari', 'Mercedes', 'Red Bull', 'Williams', 'Racing Bulls', 'Aston Martin', 'Haas', 'Alpine', 'Audi', 'Cadillac'];
        $('mxTeamLinks').innerHTML = names.map(n => {
            const t = teamInfo(n);
            return `<a class="mx-teamlink glass" href="${esc(t.url)}" target="_blank" rel="noopener" style="--team:${t.color}">
                <i></i><span>${esc(n)}</span><small>${esc(new URL(t.url).hostname.replace('www.', ''))}</small></a>`;
        }).join('');
    }

    // ---------- Окно результатов ----------
    const dialog = $('mxDialog');
    let dialogRace = null;
    let dialogToken = 0;
    let dialogOpener = null;

    function openResults(round) {
        const race = state.races.find(r => r.round === round);
        if (!race) return;
        dialogRace = race;
        dialogOpener = document.activeElement;
        const [, ru] = countryInfo(race.country);
        $('mxDialogTitle').textContent = race.name;
        $('mxDialogMeta').textContent = `Этап ${race.round} · ${ru} · ${race.start ? fmt(race.start, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`;
        const tabs = $('mxDialogTabs');
        tabs.hidden = !race.sprint;
        if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
        root.classList.add('mx-dialog-open');
        selectSession('race');
    }

    function selectSession(session) {
        const tabs = $('mxDialogTabs');
        tabs.querySelectorAll('[role="tab"]').forEach(b => {
            const on = b.dataset.session === session;
            b.setAttribute('aria-selected', String(on));
            b.tabIndex = on ? 0 : -1;
        });
        requestAnimationFrame(() => moveThumb(tabs, tabs.querySelector('[aria-selected="true"]'), '.mx-tabs-thumb'));
        loadResults(session);
    }

    async function loadResults(session) {
        const token = ++dialogToken;
        const race = dialogRace;
        const box = $('mxResults');
        box.innerHTML = '<div class="mx-results-loading"><span class="mx-spinner"></span> Загружаем результаты…</div>';
        try {
            const data = await getJSON(`${state.season}/${race.round}/${session === 'sprint' ? 'sprint' : 'results'}.json?limit=100`);
            if (token !== dialogToken) return;
            const rows = session === 'sprint'
                ? data.MRData?.RaceTable?.Races?.[0]?.SprintResults || []
                : data.MRData?.RaceTable?.Races?.[0]?.Results || [];
            if (!rows.length) {
                box.innerHTML = `<p class="mx-results-empty">Результаты ${session === 'sprint' ? 'спринта' : 'гонки'} ещё не опубликованы.</p>`;
                return;
            }
            box.innerHTML = `<div class="mx-res-head"><span>Поз.</span><span>Пилот</span><span class="mx-col-team">Команда</span><span class="mx-res-time">Время / статус</span><span>Очки</span></div>` +
                rows.map((r, i) => {
                    const grid = parseInt(r.grid, 10);
                    const pos = parseInt(r.position, 10);
                    const delta = grid > 0 && pos > 0 ? grid - pos : 0;
                    const fastest = r.FastestLap?.rank === '1';
                    return `<div class="mx-res-row ${pos <= 3 ? `is-p${pos}` : ''}" style="--team:${teamColor(r.Constructor?.name)};--i:${i}">
                        <span class="mx-res-pos">${esc(r.positionText || r.position)}</span>
                        <span class="mx-res-driver"><i></i><span>${esc(r.Driver.givenName)} <b>${esc(r.Driver.familyName)}</b></span>
                            ${delta ? `<em class="${delta > 0 ? 'up' : 'down'}" title="Изменение относительно старта">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</em>` : ''}
                            ${fastest ? '<em class="fl" title="Быстрейший круг">FL</em>' : ''}</span>
                        <span class="mx-col-team">${esc(r.Constructor?.name || '—')}</span>
                        <span class="mx-res-time">${esc(r.Time?.time || r.status || '—')}</span>
                        <span class="mx-res-pts">${esc(r.points || '0')}</span>
                    </div>`;
                }).join('');
        } catch (_) {
            if (token !== dialogToken) return;
            box.innerHTML = '<p class="mx-results-empty">Не удалось загрузить результаты. Проверьте подключение и попробуйте ещё раз.</p>';
        }
    }

    function closeResults() {
        if (dialog.open) {
            if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
        }
        root.classList.remove('mx-dialog-open');
        if (dialogOpener && document.contains(dialogOpener)) dialogOpener.focus({ preventScroll: true });
    }

    // ---------- Живая трасса ----------
    const track = (() => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const path = $('mxCircuitPath');
        const layer = $('mxCars');
        const scene = document.querySelector('.mx-track');
        let length = 0;
        let cars = [];
        let playing = !reducedMotion.matches;
        let speed = 1;
        let visible = false;
        let last = 0;
        let raf = 0;

        // Точки трассы считаем один раз: getPointAtLength на каждом кадре дорогой.
        const STEP = 2;
        const TRAIL = 90;
        let points = null;
        function pointAt(dist) {
            const i = Math.floor((((dist % length) + length) % length) / STEP);
            return points[i] || points[0];
        }
        function setCars(drivers) {
            if (!length) {
                length = path.getTotalLength();
                points = [];
                for (let d = 0; d <= length; d += STEP) {
                    const p = path.getPointAtLength(d);
                    points.push([p.x, p.y]);
                }
            }
            const list = drivers.length ? drivers : [
                { code: 'MCL', team: 'McLaren', last: 'McLaren' }, { code: 'FER', team: 'Ferrari', last: 'Ferrari' },
                { code: 'RBR', team: 'Red Bull', last: 'Red Bull' }, { code: 'MER', team: 'Mercedes', last: 'Mercedes' },
                { code: 'AMR', team: 'Aston Martin', last: 'Aston Martin' }];
            layer.textContent = '';
            lastOrder = '';
            cars = list.map((d, i) => {
                const color = teamColor(d.team);
                const trail = document.createElementNS(svgNS, 'use');
                trail.setAttribute('href', '#mxCircuitPath');
                trail.setAttribute('class', 'mx-trail');
                trail.style.stroke = color;
                const g = document.createElementNS(svgNS, 'g');
                g.setAttribute('class', 'mx-car-top');
                g.style.color = color;
                g.innerHTML = `<circle r="15" class="mx-car-halo"/><use href="#carTop" x="-20" y="-9" width="40" height="18"/>`;
                trail.style.strokeDasharray = `${TRAIL} ${length}`;
                const label = document.createElementNS(svgNS, 'text');
                label.setAttribute('class', 'mx-car-label');
                label.textContent = d.code;
                layer.append(trail, g, label);
                return {
                    driver: d, color, trail, g, label,
                    dist: length * (1 - i * 0.035),
                    base: 118 - i * 1.6,
                    phase: Math.random() * Math.PI * 2,
                    wobble: 7 + Math.random() * 5,
                };
            });
            draw(0);
            renderOrder();
        }

        function draw(dt) {
            cars.forEach(c => {
                if (dt) {
                    c.phase += dt * 0.6;
                    c.dist += dt * speed * (c.base + Math.sin(c.phase) * c.wobble);
                }
                const at = c.dist % length;
                const [x, y] = pointAt(at);
                const [x2, y2] = pointAt(at + 6);
                const angle = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
                c.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)})`);
                c.label.setAttribute('transform', `translate(${(x + 14).toFixed(1)} ${(y - 14).toFixed(1)})`);
                c.trail.style.strokeDashoffset = `${-(at - TRAIL)}`;
            });
        }

        let orderTimer = 0;
        const gauge = document.querySelector('.mx-gauge');
        function renderGauge(leader) {
            if (!leader || !gauge) return;
            const kmh = Math.round(205 + (leader.base + Math.sin(leader.phase) * leader.wobble - 105) * 4.2 + (playing ? 0 : -205));
            const value = Math.max(0, Math.min(345, kmh));
            gauge.style.setProperty('--p', Math.round(value / 360 * 100));
            $('mxKmh').textContent = value;
            $('mxGear').textContent = value ? `${Math.min(8, Math.max(1, Math.ceil(value / 44)))}-я передача` : 'N';
        }
        let lastOrder = '';
        function renderOrder() {
            const sorted = [...cars].sort((a, b) => b.dist - a.dist);
            const key = sorted.map(c => c.driver.code).join();
            const leader = sorted[0];
            renderGauge(leader);
            $('mxLap').textContent = leader ? Math.max(1, Math.floor(leader.dist / length)) : 1;
            // Пересобираем список, только если сменился порядок; иначе обновляем отставания.
            if (key === lastOrder) {
                $('mxOrder').querySelectorAll('small').forEach((el, i) => {
                    el.textContent = i ? `+${((leader.dist - sorted[i].dist) / 118).toFixed(3)}` : 'Лидер';
                });
                return;
            }
            lastOrder = key;
            $('mxOrder').innerHTML = sorted.map((c, i) => {
                const gap = i ? `+${((leader.dist - c.dist) / 118).toFixed(3)}` : 'Лидер';
                return `<li style="--team:${c.color}"><span class="mx-order-pos">${i + 1}</span><i></i><b>${esc(c.driver.code)}</b><span class="mx-order-name">${esc(c.driver.last)}</span><small>${gap}</small></li>`;
            }).join('');
        }

        function loop(now) {
            raf = 0;
            if (!playing || !visible || document.hidden) { last = 0; return; }
            const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
            last = now;
            draw(dt);
            orderTimer += dt;
            if (orderTimer > 0.5) { orderTimer = 0; renderOrder(); }
            raf = requestAnimationFrame(loop);
        }
        function kick() { if (!raf && playing && visible) raf = requestAnimationFrame(loop); }

        function setPlaying(on) {
            playing = on;
            const btn = $('mxPlay');
            btn.setAttribute('aria-pressed', String(on));
            btn.textContent = on ? 'Пауза' : 'Старт';
            scene.classList.toggle('is-paused', !on);
            if (cars.length) renderOrder();
            kick();
        }

        $('mxPlay').addEventListener('click', () => setPlaying(!playing));
        $('mxSpeed').addEventListener('input', e => {
            speed = parseFloat(e.target.value) || 1;
            $('mxSpeedOut').textContent = `${speed}×`;
            scene.style.setProperty('--speed', speed);
        });
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            kick();
        }).observe(scene);
        document.addEventListener('visibilitychange', kick);
        setPlaying(playing);

        return { setCars };
    })();

    // ---------- Новости ----------
    const CATEGORY = { racing: 'Гонки', teams: 'Команды', tech: 'Техника' };

    async function loadNews() {
        try {
            const response = await fetch('data/news.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            state.news = { updatedAt: data.updatedAt ? new Date(data.updatedAt) : null, articles: data.articles || [] };
        } catch (_) {
            state.news = { updatedAt: null, articles: [] };
        }
        renderNews();
    }

    function safeUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && !url.hostname.includes('https') ? url.href : '';
        } catch (_) { return ''; }
    }

    function timeAgo(date) {
        const diff = (date.getTime() - Date.now()) / 1000;
        const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
        const abs = Math.abs(diff);
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
        if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
        return fmt(date, { day: 'numeric', month: 'long' });
    }

    function renderNews() {
        const grid = $('mxNewsGrid');
        const { updatedAt, articles } = state.news;
        $('mxNewsUpdated').textContent = updatedAt
            ? `Свежие заголовки из паддока · лента обновлена ${timeAgo(updatedAt)}`
            : 'Свежие заголовки из паддока';
        const list = articles.filter(a => state.newsFilter === 'all' || a.category === state.newsFilter).slice(0, 13);
        if (!list.length) {
            grid.innerHTML = `<p class="mx-empty-card glass">${articles.length ? 'В этой категории пока нет новостей.' : 'Лента новостей сейчас недоступна.'}</p>`;
            return;
        }
        grid.innerHTML = list.map((a, i) => {
            const url = safeUrl(a.url);
            if (!url) return '';
            const image = safeUrl(a.image);
            const date = a.publishedAt ? new Date(a.publishedAt) : null;
            return `<a class="mx-news-card glass ${i === 0 ? 'is-lead' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="--i:${i}" data-cat="${esc(a.category)}">
                <span class="mx-news-media">
                    ${image ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}
                    <span class="mx-news-art" aria-hidden="true"></span>
                    <span class="mx-news-cat">${esc(CATEGORY[a.category] || 'Паддок')}</span>
                </span>
                <span class="mx-news-body">
                    <span class="mx-news-meta"><b>${esc(a.source)}</b>${a.language === 'en' ? '<em>EN</em>' : ''}${date && !isNaN(date) ? `<time datetime="${esc(a.publishedAt)}">${esc(timeAgo(date))}</time>` : ''}</span>
                    <span class="mx-news-title">${esc(a.title)}</span>
                    <span class="mx-news-more">Читать в источнике ↗</span>
                </span>
            </a>`;
        }).join('');
        grid.querySelectorAll('img').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
        decorate(grid);
    }

    // ---------- Интерактив: стекло, наклон, появление ----------
    function decorate(scope) {
        scope.querySelectorAll('.glass:not([data-lit])').forEach(el => {
            el.dataset.lit = '';
            let frame = 0;
            el.addEventListener('pointermove', e => {
                if (frame) return;
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    const r = el.getBoundingClientRect();
                    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
                    el.style.setProperty('--my', `${e.clientY - r.top}px`);
                });
            });
        });
        if (reducedMotion.matches || !window.matchMedia('(hover: hover)').matches) return;
        scope.querySelectorAll('[data-tilt]:not([data-tilted])').forEach(el => {
            el.dataset.tilted = '';
            let frame = 0;
            el.addEventListener('pointermove', e => {
                if (frame) return;
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    const r = el.getBoundingClientRect();
                    const x = (e.clientX - r.left) / r.width - 0.5;
                    const y = (e.clientY - r.top) / r.height - 0.5;
                    el.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
                    el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
                });
            });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
        });
    }

    let revealObserver = null;
    function observeReveals() {
        const modern = $('claude');
        decorate(modern);
        const targets = modern.querySelectorAll('.reveal:not(.in), .mx-race:not(.in), .mx-tr:not(.in), .mx-team:not(.in), .mx-pod:not(.in), .mx-news-card:not(.in)');
        if (!('IntersectionObserver' in window) || reducedMotion.matches) { targets.forEach(el => el.classList.add('in')); return; }
        revealObserver ||= new IntersectionObserver(entries => entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('in'); revealObserver.unobserve(entry.target); }
        }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        targets.forEach(el => revealObserver.observe(el));
    }

    // ---------- Навигация ----------
    function setupNav() {
        const links = [...document.querySelectorAll('.mx-nav-links a')];
        const indicator = document.querySelector('.mx-nav-indicator');
        const place = link => {
            links.forEach(l => l.classList.toggle('is-active', l === link));
            if (!link) { indicator.style.opacity = '0'; return; }
            indicator.style.opacity = '1';
            indicator.style.setProperty('--x', `${link.offsetLeft}px`);
            indicator.style.setProperty('--w', `${link.offsetWidth}px`);
        };
        const sections = links.map(l => $(l.dataset.spy)).filter(Boolean);
        const spy = new IntersectionObserver(entries => {
            entries.forEach(entry => { entry.target.dataset.visible = entry.isIntersecting ? '1' : ''; });
            const current = sections.find(s => s.dataset.visible === '1');
            place(current ? links.find(l => l.dataset.spy === current.id) : null);
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(s => spy.observe(s));

        const nav = document.querySelector('.mx-nav-wrap');
        let scrolled = null;
        const onScroll = () => {
            const now = window.scrollY > 24;
            if (now !== scrolled) { scrolled = now; nav.classList.toggle('is-scrolled', now); }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        // Сезоны
        const group = document.querySelector('.mx-season');
        YEARS.forEach(year => {
            const b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.dataset.year = year;
            b.textContent = year;
            group.appendChild(b);
        });
        group.addEventListener('click', e => {
            const b = e.target.closest('button[data-year]');
            if (b) changeSeasonModern(+b.dataset.year);
        });
        group.addEventListener('keydown', e => {
            if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            const i = YEARS.indexOf(state.season) + (e.key === 'ArrowRight' ? 1 : -1);
            if (YEARS[i]) { changeSeasonModern(YEARS[i]); group.querySelector(`[data-year="${YEARS[i]}"]`).focus(); }
        });

        document.querySelector('.mx-refresh').addEventListener('click', async e => {
            const b = e.currentTarget;
            b.classList.add('is-spinning');
            b.disabled = true;
            try { await loadSeason(true); } finally { b.disabled = false; b.classList.remove('is-spinning'); }
        });

        window.addEventListener('resize', () => {
            renderSeasonText();
            place(links.find(l => l.classList.contains('is-active')) || null);
            const tabs = document.querySelector('#mx-standings .mx-tabs');
            moveThumb(tabs, tabs.querySelector('[aria-selected="true"]'), '.mx-tabs-thumb');
        });
    }

    function changeSeasonModern(year) {
        if (!YEARS.includes(year) || year === state.season) return;
        state.season = year;
        storage.set('f1_season', year);
        renderSeasonText();
        loadSeason();
    }

    function setupControls() {
        // Фильтры гонок
        document.querySelector('#mx-calendar .mx-filters').addEventListener('click', e => {
            const b = e.target.closest('button[data-filter]');
            if (!b) return;
            b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
            state.raceFilter = b.dataset.filter;
            applyRaceFilter();
        });
        $('mxSearch').addEventListener('input', e => { state.raceQuery = e.target.value; applyRaceFilter(); });
        $('mxRaces').addEventListener('click', e => {
            const b = e.target.closest('button[data-round]');
            if (b) openResults(+b.dataset.round);
        });

        // Вкладки зачёта
        const tabs = document.querySelector('#mx-standings .mx-tabs');
        const tabButtons = [...tabs.querySelectorAll('[role="tab"]')];
        const selectTab = (btn, focus) => {
            tabButtons.forEach(b => {
                const on = b === btn;
                b.setAttribute('aria-selected', String(on));
                b.tabIndex = on ? 0 : -1;
                $(b.getAttribute('aria-controls')).hidden = !on;
            });
            moveThumb(tabs, btn, '.mx-tabs-thumb');
            if (focus) btn.focus();
            observeReveals();
        };
        tabs.addEventListener('click', e => { const b = e.target.closest('[role="tab"]'); if (b) selectTab(b); });
        tabs.addEventListener('keydown', e => {
            if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            const i = tabButtons.findIndex(b => b.getAttribute('aria-selected') === 'true');
            selectTab(tabButtons[(i + (e.key === 'ArrowRight' ? 1 : tabButtons.length - 1)) % tabButtons.length], true);
        });
        requestAnimationFrame(() => moveThumb(tabs, tabButtons[0], '.mx-tabs-thumb'));

        // Новости
        $('mxNewsFilters').addEventListener('click', e => {
            const b = e.target.closest('button[data-news]');
            if (!b || !state.news) return;
            b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
            state.newsFilter = b.dataset.news;
            renderNews(); observeReveals();
        });

        // Диалог
        $('mxDialogClose').addEventListener('click', closeResults);
        dialog.addEventListener('close', () => { root.classList.remove('mx-dialog-open'); });
        dialog.addEventListener('click', e => { if (e.target === dialog) closeResults(); });
        $('mxDialogTabs').addEventListener('click', e => {
            const b = e.target.closest('[role="tab"]');
            if (b && b.getAttribute('aria-selected') !== 'true') selectSession(b.dataset.session);
        });
    }

    // ---------- Переключение «Старый» ↔ «Claude» (вызывается из switch.js) ----------
    function applyDesign(design) {
        withTransition(() => {
            root.dataset.design = design;
            root.dataset.variant = design;
            $('classicCss').disabled = design === 'claude';
            $('claudeCss').disabled = design !== 'claude';
            if (window.F1SyncSwitch) window.F1SyncSwitch();
            if (design === 'claude') {
                const saved = parseInt(storage.get('f1_season'), 10);
                if (started && YEARS.includes(saved) && saved !== state.season) { state.season = saved; loadSeason(); }
                startModern();
            } else if (typeof window.initClassic === 'function') {
                // Старый вид подхватывает сезон, выбранный в варианте Claude.
                /* global currentSeason, changeSeason, classicStarted */
                if (typeof classicStarted !== 'undefined' && classicStarted) {
                    if (currentSeason !== state.season) changeSeason(state.season);
                } else {
                    currentSeason = state.season;
                    window.initClassic();
                }
            }
            window.scrollTo(0, 0);
        });
    }
    window.F1SetDesign = applyDesign;

    // Анимации первого экрана, фона и бегущей строки не крутятся, когда их не видно.
    function pauseOffscreen() {
        if (!('IntersectionObserver' in window)) return;
        const hero = document.querySelector('.mx-hero');
        const marquee = document.querySelector('.mx-marquee');
        const backdrop = document.querySelector('.mx-backdrop');
        new IntersectionObserver(entries => entries.forEach(entry => {
            entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
            if (entry.target === hero) backdrop.classList.toggle('is-paused', !entry.isIntersecting);
        })).observe(hero);
        new IntersectionObserver(([entry]) => marquee.classList.toggle('is-offscreen', !entry.isIntersecting)).observe(marquee);
    }

    // ---------- Старт ----------
    function startModern() {
        if (started) return;
        started = true;
        pauseOffscreen();
        setupNav();
        setupControls();
        renderSeasonText();
        observeReveals();
        loadSeason();
        loadNews();
        setInterval(() => { if (root.dataset.design === 'claude' && !document.hidden) tickCountdown(); }, 1000);
        // Раз в 10 минут тихо обновляем данные, пока вкладка открыта.
        setInterval(() => { if (root.dataset.design === 'claude' && !document.hidden) loadSeason(true); }, 10 * 60 * 1000);
    }

    if (root.dataset.design === 'claude') startModern();
})();
