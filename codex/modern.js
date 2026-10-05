// F1 GRID: presentation, personal preference, editorial feed and motion.
(() => {
    const root = document.documentElement;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const categoryNames = { racing: 'НА ТРАССЕ', teams: 'КОМАНДЫ', tech: 'ТЕХНОЛОГИИ' };
    const countries = { Australia: ['Австралия', '🇦🇺'], China: ['Китай', '🇨🇳'], Japan: ['Япония', '🇯🇵'], Bahrain: ['Бахрейн', '🇧🇭'], 'Saudi Arabia': ['Саудовская Аравия', '🇸🇦'], USA: ['США', '🇺🇸'], 'United States': ['США', '🇺🇸'], Canada: ['Канада', '🇨🇦'], Monaco: ['Монако', '🇲🇨'], Spain: ['Испания', '🇪🇸'], Austria: ['Австрия', '🇦🇹'], UK: ['Великобритания', '🇬🇧'], 'Great Britain': ['Великобритания', '🇬🇧'], Belgium: ['Бельгия', '🇧🇪'], Hungary: ['Венгрия', '🇭🇺'], Netherlands: ['Нидерланды', '🇳🇱'], Italy: ['Италия', '🇮🇹'], Azerbaijan: ['Азербайджан', '🇦🇿'], Singapore: ['Сингапур', '🇸🇬'], Mexico: ['Мексика', '🇲🇽'], Brazil: ['Бразилия', '🇧🇷'], Qatar: ['Катар', '🇶🇦'], UAE: ['ОАЭ', '🇦🇪'], 'United Arab Emirates': ['ОАЭ', '🇦🇪'] };
    let raceFilter = 'all';
    let articles = [];
    let nextRace = null;
    let newsStarted = false;
    let motionPlaying = !reducedMotion.matches;
    let trackVisible = true;
    const $ = id => document.getElementById(id);
    const modern = () => root.dataset.design === 'modern';
    const safeURL = value => {
        try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; }
    };
    const seasonDate = value => new Date(`${value.date}T${value.time || '00:00:00Z'}`);
    function scrollToCenter() { $('raceCenter').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' }); }

    function applyDesign(design) {
        const isModern = design === 'modern';
        root.dataset.design = design;
        preferences.set('f1_design', design);
        $('designToggle').checked = isModern;
        const years = document.querySelector('.year-selector');
        const refresh = $('refreshButton');
        if (isModern) {
            $('modernSeasonSlot').append(years);
            $('modernRefreshSlot').append(refresh);
            loadNews();
        } else {
            $('classicControls').append(years);
            document.querySelector('nav').append(refresh);
            if (!$('news').classList.contains('hidden')) showSection('races');
            $('raceSearch').value = '';
            raceFilter = 'all';
            document.querySelectorAll('[data-race-filter]').forEach(button => {
                button.classList.toggle('active', button.dataset.raceFilter === 'all');
                button.setAttribute('aria-pressed', String(button.dataset.raceFilter === 'all'));
            });
        }
        applyRaceFilters();
        updateMotion();
        document.querySelector('meta[name="theme-color"]').content = isModern ? '#0c0d11' : '#cc0000';
    }
    function setDesign(design) {
        if (document.startViewTransition && !reducedMotion.matches) document.startViewTransition(() => applyDesign(design));
        else applyDesign(design);
    }
    function updateSeasonLabels() { document.querySelectorAll('[data-season]').forEach(node => { node.textContent = currentSeason; }); }

    function renderOverview() {
        const state = window.F1Data;
        updateSeasonLabels();
        $('statRaces').textContent = state.races.length || '—';
        $('statDrivers').textContent = state.drivers.length || '—';
        $('statTeams').textContent = state.constructors.length || '—';
        const finished = state.races.filter(race => race.winner).length;
        const percentage = state.races.length ? Math.round(finished / state.races.length * 100) : 0;
        $('seasonProgress').style.width = `${percentage}%`;
        $('completedCaption').textContent = state.races.length ? `${finished} из ${state.races.length} этапов завершено` : 'Загружаем календарь';
        $('seasonPercent').textContent = `${percentage}%`;
        nextRace = state.races.find(race => seasonDate(race).getTime() > Date.now()) || null;
        if (nextRace) {
            $('nextRaceLabel').textContent = 'СЛЕДУЮЩАЯ ГОНКА';
            $('nextRaceName').textContent = countries[nextRace.country]?.[0] || nextRace.country;
            $('nextRaceCircuit').textContent = nextRace.circuit;
            $('nextRaceDate').textContent = seasonDate(nextRace).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' · местное время';
            $('raceCountdown').hidden = false;
        } else if (state.races.length) {
            const last = state.races.at(-1);
            $('nextRaceLabel').textContent = 'СЕЗОН В ДЕТАЛЯХ';
            $('nextRaceName').textContent = `Сезон ${currentSeason}`;
            $('nextRaceCircuit').textContent = 'Календарь, результаты и главные моменты';
            $('nextRaceDate').textContent = `${state.races.length} этапов · последний: ${countries[last.country]?.[0] || last.country}`;
            $('raceCountdown').hidden = true;
        } else {
            $('nextRaceLabel').textContent = 'НА ГОРИЗОНТЕ';
            $('nextRaceName').textContent = `Сезон ${currentSeason}`;
            $('nextRaceCircuit').textContent = 'Ждём календарь гонок';
            $('nextRaceDate').textContent = 'Данные появятся после загрузки';
            $('raceCountdown').hidden = true;
        }
        updateCountdown();
        const leader = state.drivers[0];
        $('leaderName').textContent = leader ? `${leader.givenName} ${leader.familyName}` : `Сезон ${currentSeason}`;
        $('leaderTeam').textContent = leader?.constructor || 'Личный зачёт';
        $('leaderInitials').textContent = leader ? `${leader.givenName[0]}${leader.familyName[0]}` : 'F1';
        $('leaderPoints').textContent = leader ? leader.points : '—';
        $('leaderNote').textContent = state.sources.drivers === 'fallback' ? 'Резервные данные · не текущий зачёт' : leader?.points > 0 ? 'Лидер личного зачёта' : 'Стартовый состав · борьба впереди';
        $('leaderName').style.color = leader ? teamColor(leader.constructor) : '';
        $('lastUpdated').textContent = state.updatedAt ? 'Обновлено ' + new Date(state.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
        $('driverPodium').innerHTML = state.drivers.slice(0,3).map((driver, index) => `<article class="podium-card" data-number="${escapeHTML(driver.number || String(index + 1).padStart(2,'0'))}" style="--team-color:${teamColor(driver.constructor)}"><span class="podium-rank">P${index + 1} / ЛИЧНЫЙ ЗАЧЁТ</span><h3>${escapeHTML(driver.familyName)}</h3><p>${escapeHTML(driver.givenName)} · ${escapeHTML(driver.constructor)}</p><div class="podium-points">${driver.points}<small>ОЧКОВ</small></div></article>`).join('');
        const max = Math.max(1,...state.constructors.map(team => team.points));
        $('constructorCards').innerHTML = state.constructors.slice(0,3).map((team, index) => `<article class="constructor-card" style="--team-color:${teamColor(team.name)};--points-width:${team.points/max*100}%"><span class="podium-rank">P${index + 1} / КУБОК КОНСТРУКТОРОВ</span><h3>${escapeHTML(team.name)}</h3><div class="constructor-meter"><span></span></div><p>${team.points} очков</p></article>`).join('');
        if (state.constructors.length) $('teamTicker').innerHTML = state.constructors.map(team => `<span>${escapeHTML(team.name)}</span>`).join('');
    }
    function updateCountdown() {
        if (!nextRace || !modern() || document.hidden) return;
        const seconds = Math.max(0, Math.floor((seasonDate(nextRace).getTime() - Date.now()) / 1000));
        const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
        ['cdDays', 'cdHours', 'cdMinutes', 'cdSeconds'].forEach((id, index) => { $(id).textContent = String(values[index]).padStart(2,'0'); });
        if (seconds === 0) { nextRace = null; renderOverview(); }
    }
    function applyRaceFilters() {
        const term = $('raceSearch').value.trim().toLocaleLowerCase('ru');
        let visible = 0;
        const races = window.F1Data.races;
        document.querySelectorAll('#racesTableBody tr[data-round]').forEach(row => {
            const race = races.find(item => item.round === Number(row.dataset.round));
            if (!race) return;
            const matchFilter = raceFilter === 'all' || (raceFilter === 'finished' && race.winner) || (raceFilter === 'upcoming' && !race.winner) || (raceFilter === 'sprint' && race.hasSprint);
            const haystack = [race.name, race.country, countries[race.country]?.[0], race.circuit].join(' ').toLocaleLowerCase('ru');
            row.hidden = modern() && (!matchFilter || !haystack.includes(term));
            if (!row.hidden) visible++;
        });
        $('raceCount').textContent = races.length;
        $('raceFilterEmpty').hidden = visible > 0 || !races.length || !modern();
    }
    function enhanceCountries() {
        document.querySelectorAll('#racesTableBody .country-cell').forEach(cell => {
            const country = cell.textContent.trim();
            if (!countries[country]) return;
            const [name, flag] = countries[country];
            cell.innerHTML = `<span class="classic-only">${escapeHTML(country)}</span><span class="modern-only"><span class="country-flag" aria-hidden="true">${flag}</span> ${escapeHTML(name)}</span>`;
        });
    }

    function articleCard(article, index) {
        const url = safeURL(article.url);
        if (!url) return '';
        const image = safeURL(article.image) || `assets/news-${article.category === 'tech' ? 'tech' : article.category === 'racing' ? 'track' : 'paddock'}.svg`;
        const date = new Date(article.publishedAt);
        const displayDate = Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
        return `<a class="news-card" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" style="--news-index:${index}"><div class="news-image"><img src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-news-fallback="assets/news-${article.category === 'tech' ? 'tech' : article.category === 'racing' ? 'track' : 'paddock'}.svg"><span class="news-category">${categoryNames[article.category] || 'ИЗ ПАДДОКА'}</span></div><div class="news-card-copy"><div class="news-meta"><span>${escapeHTML(article.source)}</span>${article.language === 'en' ? '<span>· EN</span>' : ''}<time datetime="${escapeHTML(article.publishedAt)}">${displayDate}</time></div><h3>${escapeHTML(article.title)}</h3><div class="news-read"><span>Читать в источнике</span><svg class="icon"><use href="#i-external"/></svg></div></div></a>`;
    }
    function bindImageFallbacks(container) {
        container.querySelectorAll('[data-news-fallback]').forEach(image => image.addEventListener('error', () => { image.src = image.dataset.newsFallback; }, { once: true }));
    }
    function renderNews(category = 'all') {
        const visible = category === 'all' ? articles : articles.filter(article => article.category === category);
        $('newsGrid').innerHTML = visible.length ? visible.map(articleCard).join('') : '<p class="news-placeholder glass-card">В этой категории пока нет публикаций. Посмотрите все новости.</p>';
        $('newsTeaserGrid').innerHTML = articles.slice(0,3).map(articleCard).join('');
        bindImageFallbacks($('newsGrid')); bindImageFallbacks($('newsTeaserGrid'));
    }
    async function loadNews() {
        if (newsStarted) return;
        newsStarted = true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch('../data/news.json', { signal: controller.signal });
            if (!response.ok) throw new Error('News feed unavailable');
            const feed = await response.json();
            if (!Array.isArray(feed.articles) || !feed.articles.length) throw new Error('Empty news feed');
            articles = feed.articles.filter(article => safeURL(article.url) && article.title).slice(0,24);
            const updated = new Date(feed.updatedAt);
            const stale = Date.now() - updated.getTime() > 24*60*60*1000;
            $('newsUpdated').textContent = `${stale ? 'Архив ленты' : 'Лента обновлена'} · ${updated.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
            renderNews();
        } catch (_) {
            const message = '<div class="news-placeholder glass-card">Не удалось загрузить ленту. <a class="text-link" href="https://www.f1news.ru/" target="_blank" rel="noopener noreferrer">Открыть новости на F1News ↗</a></div>';
            $('newsGrid').innerHTML = message; $('newsTeaserGrid').innerHTML = message;
            $('newsUpdated').textContent = 'Лента временно недоступна';
            newsStarted = false;
        } finally { clearTimeout(timer); }
    }
    function updateMotion() {
        const running = motionPlaying && modern() && trackVisible && !document.hidden;
        document.querySelector('.track-scene').classList.toggle('is-paused', !running);
        $('motionToggle').setAttribute('aria-pressed', String(motionPlaying));
        $('motionToggle').innerHTML = `<svg class="icon"><use href="#i-${motionPlaying ? 'pause' : 'play'}"/></svg><span>${motionPlaying ? 'Пауза' : 'Старт'}</span>`;
        $('motionStatus').textContent = motionPlaying ? 'ON TRACK' : 'IN THE PITS';
    }
    document.addEventListener('DOMContentLoaded', () => {
        applyDesign(root.dataset.design);
        renderOverview();
        $('designToggle').addEventListener('change', event => setDesign(event.target.checked ? 'modern' : 'classic'));
        document.querySelector('nav').addEventListener('click', event => { if (modern() && event.target.closest('[data-section]')) scrollToCenter(); });
        const goTo = id => { showSection(id); scrollToCenter(); };
        $('exploreSeason').addEventListener('click', () => goTo('races'));
        $('exploreNews').addEventListener('click', () => goTo('news'));
        $('allNewsButton').addEventListener('click', () => goTo('news'));
        $('showStandings').addEventListener('click', () => goTo('drivers'));
        document.querySelectorAll('.brand[href="#"]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' }); }));
        $('raceSearch').addEventListener('input', applyRaceFilters);
        document.querySelectorAll('[data-race-filter]').forEach(button => button.addEventListener('click', () => {
            raceFilter = button.dataset.raceFilter;
            document.querySelectorAll('[data-race-filter]').forEach(node => { const active = node === button; node.classList.toggle('active', active); node.setAttribute('aria-pressed', String(active)); });
            applyRaceFilters();
        }));
        document.querySelectorAll('[data-news-filter]').forEach(button => button.addEventListener('click', () => {
            document.querySelectorAll('[data-news-filter]').forEach(node => { const active = node === button; node.classList.toggle('active', active); node.setAttribute('aria-pressed', String(active)); });
            renderNews(button.dataset.newsFilter);
        }));
        $('motionToggle').addEventListener('click', () => { motionPlaying = !motionPlaying; root.dataset.motionOptIn = String(motionPlaying); updateMotion(); });
        $('motionSpeed').addEventListener('input', event => { const speed = Number(event.target.value); root.style.setProperty('--motion-time', `${12/speed}s`); $('speedValue').value = `${speed}×`; });
        if ('IntersectionObserver' in window) new IntersectionObserver(entries => { trackVisible = entries[0].isIntersecting; updateMotion(); }, { threshold: .05 }).observe(document.querySelector('.track-scene'));
        const syncMotionPreference = () => { motionPlaying = !reducedMotion.matches; root.dataset.motionOptIn = 'false'; updateMotion(); };
        if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', syncMotionPreference);
        else reducedMotion.addListener(syncMotionPreference);
        document.addEventListener('visibilitychange', updateMotion);
        const hero = document.querySelector('.race-hero');
        if (matchMedia('(hover: hover)').matches && !reducedMotion.matches) {
            hero.addEventListener('pointermove', event => { const box = hero.getBoundingClientRect(); hero.style.setProperty('--hero-x', `${((event.clientX-box.left)/box.width-.5)*9}px`); hero.style.setProperty('--hero-y', `${((event.clientY-box.top)/box.height-.5)*7}px`); });
            hero.addEventListener('pointerleave', () => { hero.style.setProperty('--hero-x','0px'); hero.style.setProperty('--hero-y','0px'); });
            document.querySelectorAll('.glass-card').forEach(card => card.addEventListener('pointermove', event => { const box = card.getBoundingClientRect(); card.style.setProperty('--glow-x', `${event.clientX-box.left}px`); card.style.setProperty('--glow-y', `${event.clientY-box.top}px`); }));
        }
        setInterval(updateCountdown, 1000);
        setInterval(() => { if (modern() && !document.hidden && nextRace && seasonDate(nextRace).getTime() <= Date.now()) renderOverview(); }, 60000);
    });
    document.addEventListener('f1:data', event => {
        renderOverview();
        if (event.detail.type === 'races') { enhanceCountries(); applyRaceFilters(); }
    });
    document.addEventListener('f1:season', () => {
        renderOverview(); raceFilter = 'all'; $('raceSearch').value = '';
        document.querySelectorAll('[data-race-filter]').forEach(button => {
            const active = button.dataset.raceFilter === 'all';
            button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
        });
    });
    document.addEventListener('f1:section', event => { $('paddockTeaser').hidden = event.detail === 'news'; if (event.detail === 'races') { enhanceCountries(); applyRaceFilters(); } });
})();
