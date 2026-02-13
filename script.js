// ===== КОНФИГУРАЦИЯ =====
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const AVAILABLE_YEARS = [2023, 2024, 2025, 2026];

let currentSeason = parseInt(localStorage.getItem('f1_season') || '2026');

// ===== ОЧКИ =====
const POINTS_TABLE        = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS_TABLE = [8, 7, 6, 5, 4, 3, 2, 1];

function getPointsForPosition(pos)       { return POINTS_TABLE[pos - 1]        || 0; }
function getSprintPointsForPosition(pos) { return SPRINT_POINTS_TABLE[pos - 1] || 0; }

// ===== СПРИНТ: раунды по годам =====
const SPRINT_ROUNDS = {
    2026: new Set([2, 6, 7, 11, 14, 18]),  // Китай, Майами, Канада, GB, Нидерланды, Сингапур
    2025: new Set([2, 6, 13, 19, 21, 23]), // Китай, Майами, Бельгия, Остин, Бразилия, Катар
    2024: new Set([5, 6, 11, 19, 21, 23]), // Китай, Майами, Австрия, Остин, Бразилия, Катар
    2023: new Set([4, 9, 12, 17, 18, 21]), // Баку, Австрия, Бельгия, Катар, Остин, Бразилия
};

// Jolpica: set of round numbers that have sprints (текущий сезон)
let sprintRoundSet = new Set();

// ===== ФОРМАТИРОВАНИЕ =====
function formatDriverName(name) {
    if (!name) return 'Неизвестно';
    return name.split(' ')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
}

// ===== ПЕРЕКЛЮЧЕНИЕ СЕКЦИЙ =====
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('active');
    }
    
    // Загружаем данные для секции, если они ещё не загружены
    const now = Date.now();
    if (sectionId === 'races' && (!dataCache.races || !dataCache.lastUpdate.races || 
        (now - dataCache.lastUpdate.races) >= CACHE_LIFETIME)) {
        loadRaces();
    } else if (sectionId === 'drivers' && (!dataCache.drivers || !dataCache.lastUpdate.drivers || 
        (now - dataCache.lastUpdate.drivers) >= CACHE_LIFETIME)) {
        loadDrivers();
    } else if (sectionId === 'constructors' && (!dataCache.constructors || !dataCache.lastUpdate.constructors || 
        (now - dataCache.lastUpdate.constructors) >= CACHE_LIFETIME)) {
        loadConstructors();
    }
}

// ===== СМЕНА СЕЗОНА =====
function changeSeason(year) {
    if (!AVAILABLE_YEARS.includes(year)) return;
    currentSeason = year;
    localStorage.setItem('f1_season', year);
    sprintRoundSet = new Set();
    
    // Очищаем кэш данных при смене сезона
    dataCache.races = null;
    dataCache.drivers = null;
    dataCache.constructors = null;
    dataCache.lastUpdate.races = null;
    dataCache.lastUpdate.drivers = null;
    dataCache.lastUpdate.constructors = null;
    console.log('[CACHE] Кэш данных очищен при смене сезона');

    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.year) === year);
    });

    document.getElementById('racesHeading').textContent        = `Расписание гонок — Сезон ${year}`;
    document.getElementById('driversHeading').textContent      = `Личный зачёт — Сезон ${year}`;
    document.getElementById('constructorsHeading').textContent = `Кубок конструкторов — Сезон ${year}`;
    document.getElementById('footerText').textContent =
        `© 2026 F1 Visualization Project — Сезон ${year} | Данные: Jolpica/Ergast API`;

    refreshData();
}

// ===== СТАТУС API =====
function setApiStatus(source) {
    const el = document.getElementById('apiStatus');
    const labels = {
        jolpica:  '✓ Данные: Jolpica/Ergast API',
        fallback: '! Данные: резервная база (API недоступен)',
    };
    el.className = source === 'jolpica' ? 'openf1' : source;
    el.textContent = labels[source] || '';
}

// ===== FALLBACK ДАННЫЕ =====

const SEASON_DATA = {

    // ── 2026 ──────────────────────────────────────────────
    2026: {
        races: [
            { round: 1,  date: '08-03', country: 'Австралия',         circuit: 'Мельбурн',       winner: 'Не проведена', sprint: null },
            { round: 2,  date: '15-03', country: 'Китай',             circuit: 'Шанхай',          winner: 'Не проведена', sprint: 'Не проведена' },
            { round: 3,  date: '29-03', country: 'Япония',            circuit: 'Судзука',         winner: 'Не проведена', sprint: null },
            { round: 4,  date: '12-04', country: 'Бахрейн',           circuit: 'Сахир',           winner: 'Не проведена', sprint: null },
            { round: 5,  date: '19-04', country: 'Саудовская Аравия', circuit: 'Джидда',          winner: 'Не проведена', sprint: null },
            { round: 6,  date: '03-05', country: 'США',               circuit: 'Майами',          winner: 'Не проведена', sprint: 'Не проведена' },
            { round: 7,  date: '24-05', country: 'Канада',            circuit: 'Монреаль',        winner: 'Не проведена', sprint: 'Не проведена' },
            { round: 8,  date: '07-06', country: 'Монако',            circuit: 'Монако',          winner: 'Не проведена', sprint: null },
            { round: 9,  date: '14-06', country: 'Испания',           circuit: 'Барселона',       winner: 'Не проведена', sprint: null },
            { round: 10, date: '28-06', country: 'Австрия',           circuit: 'Шпильберг',       winner: 'Не проведена', sprint: null },
            { round: 11, date: '05-07', country: 'Великобритания',    circuit: 'Сильверстоун',    winner: 'Не проведена', sprint: 'Не проведена' },
            { round: 12, date: '19-07', country: 'Бельгия',           circuit: 'Спа-Франкоршам',  winner: 'Не проведена', sprint: null },
            { round: 13, date: '26-07', country: 'Венгрия',           circuit: 'Хунгароринг',     winner: 'Не проведена', sprint: null },
            { round: 14, date: '23-08', country: 'Нидерланды',        circuit: 'Зандворт',        winner: 'Не проведена', sprint: 'Не проведена' },
            { round: 15, date: '06-09', country: 'Италия',            circuit: 'Монца',           winner: 'Не проведена', sprint: null },
            { round: 16, date: '13-09', country: 'Испания',           circuit: 'Мадрид (НОВАЯ)',  winner: 'Не проведена', sprint: null },
            { round: 17, date: '26-09', country: 'Азербайджан',       circuit: 'Баку',            winner: 'Не проведена', sprint: null },
            { round: 18, date: '11-10', country: 'Сингапур',          circuit: 'Сингапур',        winner: 'Не проведена', sprint: 'Не проведена' },
            { round: 19, date: '25-10', country: 'США',               circuit: 'Остин',           winner: 'Не проведена', sprint: null },
            { round: 20, date: '01-11', country: 'Мексика',           circuit: 'Мехико-Сити',     winner: 'Не проведена', sprint: null },
            { round: 21, date: '08-11', country: 'Бразилия',          circuit: 'Сан-Паулу',       winner: 'Не проведена', sprint: null },
            { round: 22, date: '21-11', country: 'США',               circuit: 'Лас-Вегас',       winner: 'Не проведена', sprint: null },
            { round: 23, date: '29-11', country: 'Катар',             circuit: 'Лусаил',          winner: 'Не проведена', sprint: null },
            { round: 24, date: '06-12', country: 'ОАЭ',               circuit: 'Яс-Марина',       winner: 'Не проведена', sprint: null },
        ],
        drivers: [
            { position: 1,  givenName: 'Ландо',     familyName: 'Норрис',      nationality: 'Великобритания', constructor: 'McLaren',      points: 0 },
            { position: 2,  givenName: 'Оскар',     familyName: 'Пиастри',     nationality: 'Австралия',      constructor: 'McLaren',      points: 0 },
            { position: 3,  givenName: 'Макс',      familyName: 'Ферстаппен',  nationality: 'Нидерланды',     constructor: 'Red Bull',     points: 0 },
            { position: 4,  givenName: 'Чарльз',    familyName: 'Леклер',      nationality: 'Монако',         constructor: 'Ferrari',      points: 0 },
            { position: 5,  givenName: 'Льюис',     familyName: 'Хэмилтон',    nationality: 'Великобритания', constructor: 'Ferrari',      points: 0 },
            { position: 6,  givenName: 'Джордж',    familyName: 'Расселл',     nationality: 'Великобритания', constructor: 'Mercedes',     points: 0 },
            { position: 7,  givenName: 'Карлос',    familyName: 'Сайнс',       nationality: 'Испания',        constructor: 'Williams',     points: 0 },
            { position: 8,  givenName: 'Фернандо',  familyName: 'Алонсо',      nationality: 'Испания',        constructor: 'Aston Martin', points: 0 },
            { position: 9,  givenName: 'Исак',      familyName: 'Хаджар',      nationality: 'Франция',        constructor: 'Red Bull',     points: 0 },
            { position: 10, givenName: 'Кими',      familyName: 'Антонелли',   nationality: 'Италия',         constructor: 'Mercedes',     points: 0 },
            { position: 11, givenName: 'Лиам',      familyName: 'Лоусон',      nationality: 'Новая Зеландия', constructor: 'Racing Bulls', points: 0 },
            { position: 12, givenName: 'Серхио',    familyName: 'Перес',       nationality: 'Мексика',        constructor: 'Cadillac',     points: 0 },
            { position: 13, givenName: 'Пьер',      familyName: 'Гасли',       nationality: 'Франция',        constructor: 'Alpine',       points: 0 },
            { position: 14, givenName: 'Нико',      familyName: 'Хюлькенберг', nationality: 'Германия',       constructor: 'Audi',         points: 0 },
            { position: 15, givenName: 'Эстебан',   familyName: 'Окон',        nationality: 'Франция',        constructor: 'Haas',         points: 0 },
            { position: 16, givenName: 'Александр', familyName: 'Элбон',       nationality: 'Таиланд',        constructor: 'Williams',     points: 0 },
            { position: 17, givenName: 'Франко',    familyName: 'Колапинто',   nationality: 'Аргентина',      constructor: 'Alpine',       points: 0 },
            { position: 18, givenName: 'Габриэль',  familyName: 'Бортолето',   nationality: 'Бразилия',       constructor: 'Audi',         points: 0 },
            { position: 19, givenName: 'Оливер',    familyName: 'Беарман',     nationality: 'Великобритания', constructor: 'Haas',         points: 0 },
            { position: 20, givenName: 'Арвид',     familyName: 'Линдблад',    nationality: 'Швеция',         constructor: 'Racing Bulls', points: 0 },
            { position: 21, givenName: 'Лэнс',      familyName: 'Стролл',      nationality: 'Канада',         constructor: 'Aston Martin', points: 0 },
            { position: 22, givenName: 'Валттери',  familyName: 'Боттас',      nationality: 'Финляндия',      constructor: 'Cadillac',     points: 0 },
        ],
        constructors: [
            { position: 1,  name: 'McLaren',      points: 0 },
            { position: 2,  name: 'Ferrari',      points: 0 },
            { position: 3,  name: 'Mercedes',     points: 0 },
            { position: 4,  name: 'Red Bull',     points: 0 },
            { position: 5,  name: 'Williams',     points: 0 },
            { position: 6,  name: 'Racing Bulls', points: 0 },
            { position: 7,  name: 'Aston Martin', points: 0 },
            { position: 8,  name: 'Haas',         points: 0 },
            { position: 9,  name: 'Alpine',       points: 0 },
            { position: 10, name: 'Audi',         points: 0 },
            { position: 11, name: 'Cadillac',     points: 0 },
        ],
    },

    // ── 2025 ──────────────────────────────────────────────
    2025: {
        races: [
            { round: 1,  date: '14-03', country: 'Австралия',         circuit: 'Мельбурн',       winner: 'Карлос Сайнс',     sprint: null },
            { round: 2,  date: '21-03', country: 'Китай',             circuit: 'Шанхай',          winner: 'Макс Ферстаппен',  sprint: 'Льюис Хэмилтон' },
            { round: 3,  date: '04-04', country: 'Япония',            circuit: 'Судзука',         winner: 'Ландо Норрис',     sprint: null },
            { round: 4,  date: '11-04', country: 'Бахрейн',           circuit: 'Сахир',           winner: 'Чарльз Леклер',    sprint: null },
            { round: 5,  date: '18-04', country: 'Саудовская Аравия', circuit: 'Джидда',          winner: 'Ландо Норрис',     sprint: null },
            { round: 6,  date: '02-05', country: 'США',               circuit: 'Майами',          winner: 'Макс Ферстаппен',  sprint: 'Макс Ферстаппен' },
            { round: 7,  date: '09-05', country: 'Италия',            circuit: 'Имола',           winner: 'Оскар Пиастри',    sprint: null },
            { round: 8,  date: '23-05', country: 'Монако',            circuit: 'Монако',          winner: 'Чарльз Леклер',    sprint: null },
            { round: 9,  date: '30-05', country: 'Испания',           circuit: 'Барселона',       winner: 'Ландо Норрис',     sprint: null },
            { round: 10, date: '13-06', country: 'Канада',            circuit: 'Монреаль',        winner: 'Макс Ферстаппен',  sprint: null },
            { round: 11, date: '27-06', country: 'Австрия',           circuit: 'Шпильберг',       winner: 'Джордж Расселл',   sprint: null },
            { round: 12, date: '04-07', country: 'Великобритания',    circuit: 'Сильверстоун',    winner: 'Льюис Хэмилтон',   sprint: null },
            { round: 13, date: '18-07', country: 'Бельгия',           circuit: 'Спа-Франкоршам',  winner: 'Оскар Пиастри',    sprint: 'Ландо Норрис' },
            { round: 14, date: '25-07', country: 'Венгрия',           circuit: 'Хунгароринг',     winner: 'Ландо Норрис',     sprint: null },
            { round: 15, date: '29-08', country: 'Нидерланды',        circuit: 'Зандворт',        winner: 'Макс Ферстаппен',  sprint: null },
            { round: 16, date: '05-09', country: 'Италия',            circuit: 'Монца',           winner: 'Чарльз Леклер',    sprint: null },
            { round: 17, date: '19-09', country: 'Азербайджан',       circuit: 'Баку',            winner: 'Оскар Пиастри',    sprint: null },
            { round: 18, date: '03-10', country: 'Сингапур',          circuit: 'Сингапур',        winner: 'Ландо Норрис',     sprint: null },
            { round: 19, date: '17-10', country: 'США',               circuit: 'Остин',           winner: 'Джордж Расселл',   sprint: 'Чарльз Леклер' },
            { round: 20, date: '24-10', country: 'Мексика',           circuit: 'Мехико-Сити',     winner: 'Льюис Хэмилтон',   sprint: null },
            { round: 21, date: '07-11', country: 'Бразилия',          circuit: 'Сан-Паулу',       winner: 'Оскар Пиастри',    sprint: 'Ландо Норрис' },
            { round: 22, date: '20-11', country: 'США',               circuit: 'Лас-Вегас',       winner: 'Ландо Норрис',     sprint: null },
            { round: 23, date: '28-11', country: 'Катар',             circuit: 'Лусаил',          winner: 'Оскар Пиастри',    sprint: 'Оскар Пиастри' },
            { round: 24, date: '05-12', country: 'ОАЭ',               circuit: 'Яс-Марина',       winner: 'Ландо Норрис',     sprint: null },
        ],
        drivers: [
            { position: 1,  givenName: 'Ландо',    familyName: 'Норрис',      nationality: 'Великобритания', constructor: 'McLaren',      points: 407 },
            { position: 2,  givenName: 'Оскар',    familyName: 'Пиастри',     nationality: 'Австралия',      constructor: 'McLaren',      points: 356 },
            { position: 3,  givenName: 'Макс',     familyName: 'Ферстаппен',  nationality: 'Нидерланды',     constructor: 'Red Bull',     points: 321 },
            { position: 4,  givenName: 'Джордж',   familyName: 'Расселл',     nationality: 'Великобритания', constructor: 'Mercedes',     points: 265 },
            { position: 5,  givenName: 'Чарльз',   familyName: 'Леклер',      nationality: 'Монако',         constructor: 'Ferrari',      points: 214 },
            { position: 6,  givenName: 'Льюис',    familyName: 'Хэмилтон',    nationality: 'Великобритания', constructor: 'Ferrari',      points: 198 },
            { position: 7,  givenName: 'Карлос',   familyName: 'Сайнс',       nationality: 'Испания',        constructor: 'Williams',     points: 125 },
            { position: 8,  givenName: 'Фернандо', familyName: 'Алонсо',      nationality: 'Испания',        constructor: 'Aston Martin', points: 69  },
            { position: 9,  givenName: 'Серхио',   familyName: 'Перес',       nationality: 'Мексика',        constructor: 'Red Bull',     points: 25  },
            { position: 10, givenName: 'Нико',     familyName: 'Хюлькенберг', nationality: 'Германия',       constructor: 'Haas',         points: 22  },
        ],
        constructors: [
            { position: 1,  name: 'McLaren',      points: 763 },
            { position: 2,  name: 'Ferrari',      points: 412 },
            { position: 3,  name: 'Mercedes',     points: 355 },
            { position: 4,  name: 'Red Bull',     points: 346 },
            { position: 5,  name: 'Williams',     points: 139 },
            { position: 6,  name: 'Racing Bulls', points: 72  },
            { position: 7,  name: 'Aston Martin', points: 69  },
            { position: 8,  name: 'Haas',         points: 41  },
            { position: 9,  name: 'Alpine',       points: 13  },
            { position: 10, name: 'Kick Sauber',  points: 6   },
        ],
    },

    // ── 2024, 2023: данные только из API ──
    2024: { races: [], drivers: [], constructors: [] },
    2023: { races: [], drivers: [], constructors: [] },
};

function getFallback(key) {
    return SEASON_DATA[currentSeason]?.[key] || SEASON_DATA[2026][key] || [];
}

// Есть ли спринт в этом раунде (для fallback-режима)
function fallbackHasSprint(round) {
    const s = SPRINT_ROUNDS[currentSeason];
    return s ? s.has(round) : false;
}

// ===== ЗАГРУЗКА ГОНОК =====

async function loadRaces() {
    const errorDiv  = document.getElementById('racesError');
    const tableBody = document.getElementById('racesTableBody');
    
    // Проверяем кэш
    const now = Date.now();
    if (dataCache.races && dataCache.lastUpdate.races && 
        (now - dataCache.lastUpdate.races) < CACHE_LIFETIME) {
        console.log('[CACHE] Используем кэшированные данные о гонках');
        tableBody.innerHTML = dataCache.races;
        errorDiv.style.display = 'none';
        return;
    }
    
    errorDiv.style.display = 'none';
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;opacity:0.6;">Загрузка...</td></tr>';

    // Jolpica/Ergast API
    try {
        await loadRacesFromJolpica(tableBody);
        setApiStatus('jolpica');
        
        // Сохраняем в кэш
        dataCache.races = tableBody.innerHTML;
        dataCache.lastUpdate.races = Date.now();
        console.log('[CACHE] Данные о гонках сохранены в кэш');
        return;
    } catch (e) {
        console.warn('Jolpica error:', e.message);
    }

    // Fallback
    const fallbackRaces = getFallback('races');
    if (fallbackRaces.length > 0) {
        buildRacesTableFromFallback(tableBody, fallbackRaces);
    } else {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;opacity:0.6;">
            Нет данных для ${currentSeason}.</td></tr>`;
    }
    setApiStatus('fallback');
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'API недоступен. Показаны статичные данные.';
    
    // Сохраняем fallback в кэш
    dataCache.races = tableBody.innerHTML;
    dataCache.lastUpdate.races = Date.now();
}

async function loadRacesFromJolpica(tableBody) {
    const [sResp, wResp, sprintResp] = await Promise.all([
        fetch(`${JOLPICA_BASE}/${currentSeason}.json`),
        fetch(`${JOLPICA_BASE}/${currentSeason}/results/1.json`),
        fetch(`${JOLPICA_BASE}/${currentSeason}/sprint.json?limit=200`).catch(() => null),
    ]);
    if (!sResp.ok) throw new Error(`Jolpica schedule: ${sResp.status}`);

    const races = (await sResp.json()).MRData.RaceTable.Races;

    // Победители гонок
    const winnersMap = {};
    if (wResp.ok) {
        const wd = await wResp.json();
        (wd.MRData.RaceTable.Races || []).forEach(r => {
            if (r.Results?.[0]) {
                const d = r.Results[0].Driver;
                winnersMap[r.round] = `${d.givenName} ${d.familyName}`;
            }
        });
    }

    // Победители спринтов
    const sprintWinnersMap = {};
    sprintRoundSet = new Set();
    if (sprintResp && sprintResp.ok) {
        const sd = await sprintResp.json();
        (sd.MRData.RaceTable.Races || []).forEach(r => {
            sprintRoundSet.add(parseInt(r.round));
            if (r.SprintResults?.[0]) {
                const d = r.SprintResults[0].Driver;
                sprintWinnersMap[r.round] = `${d.givenName} ${d.familyName}`;
            }
        });
    }
    // Дополняем хардкоженными раундами: API может не вернуть все спринты
    // (пагинация, будущий сезон, отсутствие данных в БД)
    if (SPRINT_ROUNDS[currentSeason]) {
        SPRINT_ROUNDS[currentSeason].forEach(r => sprintRoundSet.add(r));
    }

    // Для раундов из хардкода, у которых нет победителя от batch-запроса,
    // делаем индивидуальные запросы (Jolpica иногда не включает последние спринты в bulk)
    const missingRounds = [];
    if (SPRINT_ROUNDS[currentSeason]) {
        SPRINT_ROUNDS[currentSeason].forEach(r => {
            if (!sprintWinnersMap[r]) missingRounds.push(r);
        });
    }
    if (missingRounds.length > 0) {
        await Promise.all(missingRounds.map(async r => {
            try {
                const resp = await fetch(`${JOLPICA_BASE}/${currentSeason}/${r}/sprint.json`);
                if (!resp.ok) return;
                const data = await resp.json();
                const sr = data.MRData?.RaceTable?.Races?.[0]?.SprintResults?.[0];
                if (sr) {
                    sprintWinnersMap[r] = `${sr.Driver.givenName} ${sr.Driver.familyName}`;
                }
            } catch (_) { /* игнорируем ошибки отдельных запросов */ }
        }));
    }

    tableBody.innerHTML = '';
    races.forEach(race => {
        const round     = race.round;
        const hasSprint = sprintRoundSet.has(parseInt(round));
        const winner    = winnersMap[round] || 'Не проведена';
        let   sprintCell = '—';

        if (hasSprint) {
            const sw = sprintWinnersMap[round];
            sprintCell = sw
                ? `${sw} <span class="sprint-badge">S</span>`
                : `Не проведена <span class="sprint-badge">S</span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${round}</td>
            <td>${formatDate(race.date)}</td>
            <td>${race.Circuit?.Location?.country || '—'}</td>
            <td>${race.Circuit?.circuitName || '—'}
                <span class="race-source-badge badge-jolpica">Jolpica</span></td>
            <td>${winner}</td>
            <td>${sprintCell}</td>`;

        if (winnersMap[round]) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', () =>
                openRaceModal(round, hasSprint ? round : null, race.raceName, 'jolpica')
            );
        }
        tableBody.appendChild(row);
    });
}

function buildRacesTableFromFallback(tableBody, races) {
    tableBody.innerHTML = '';
    races.forEach(r => {
        const hasSprint  = r.sprint !== null;
        const sprintCell = hasSprint
            ? `${r.sprint || 'Не проведена'} <span class="sprint-badge">S</span>`
            : '—';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${r.round}</td>
            <td>${r.date}</td>
            <td>${r.country}</td>
            <td>${r.circuit}</td>
            <td>${r.winner}</td>
            <td>${sprintCell}</td>`;
        tableBody.appendChild(row);
    });
}

// ===== ЛИЧНЫЙ ЗАЧЁТ =====

async function loadDrivers() {
    const errorDiv  = document.getElementById('driversError');
    const tableBody = document.getElementById('driversTableBody');
    
    // Проверяем кэш
    const now = Date.now();
    if (dataCache.drivers && dataCache.lastUpdate.drivers && 
        (now - dataCache.lastUpdate.drivers) < CACHE_LIFETIME) {
        console.log('[CACHE] Используем кэшированные данные о пилотах');
        tableBody.innerHTML = dataCache.drivers;
        errorDiv.style.display = 'none';
        return;
    }
    
    errorDiv.style.display = 'none';
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.6;">Загрузка...</td></tr>';

    try {
        const resp = await fetch(`${JOLPICA_BASE}/${currentSeason}/driverStandings.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const list = data.MRData?.StandingsTable?.StandingsLists;
        if (!list || list.length === 0) throw new Error('Нет данных');

        tableBody.innerHTML = '';
        list[0].DriverStandings.forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${s.position}</td>
                <td>${s.Driver.givenName} ${s.Driver.familyName}</td>
                <td>${s.Driver.nationality || '—'}</td>
                <td>${s.Constructors[0]?.name || '—'}</td>
                <td>${s.points}</td>`;
            tableBody.appendChild(row);
        });
        
        // Сохраняем в кэш
        dataCache.drivers = tableBody.innerHTML;
        dataCache.lastUpdate.drivers = Date.now();
        console.log('[CACHE] Данные о пилотах сохранены в кэш');
        return;
    } catch (e) {
        console.warn('Jolpica drivers error:', e.message);
    }

    errorDiv.style.display = 'block';
    const fallback = getFallback('drivers');
    if (fallback.length > 0) {
        errorDiv.textContent = `API недоступен. ${currentSeason === 2026
            ? 'Показан стартовый состав 2026 (очки начнутся с 8 марта).'
            : 'Показаны приблизительные данные.'}`;
        tableBody.innerHTML = '';
        fallback.forEach(d => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${d.position}</td>
                <td>${d.givenName} ${d.familyName}</td>
                <td>${d.nationality}</td>
                <td>${d.constructor}</td>
                <td>${d.points}</td>`;
            tableBody.appendChild(row);
        });
        
        // Сохраняем fallback в кэш
        dataCache.drivers = tableBody.innerHTML;
        dataCache.lastUpdate.drivers = Date.now();
    } else {
        errorDiv.textContent = `Нет данных для ${currentSeason}. Попробуйте обновить позже.`;
        tableBody.innerHTML = '';
    }
}

// ===== КУБОК КОНСТРУКТОРОВ =====

async function loadConstructors() {
    const errorDiv  = document.getElementById('constructorsError');
    const tableBody = document.getElementById('constructorsTableBody');
    
    // Проверяем кэш
    const now = Date.now();
    if (dataCache.constructors && dataCache.lastUpdate.constructors && 
        (now - dataCache.lastUpdate.constructors) < CACHE_LIFETIME) {
        console.log('[CACHE] Используем кэшированные данные о конструкторах');
        tableBody.innerHTML = dataCache.constructors;
        errorDiv.style.display = 'none';
        return;
    }
    
    errorDiv.style.display = 'none';
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;opacity:0.6;">Загрузка...</td></tr>';

    try {
        const resp = await fetch(`${JOLPICA_BASE}/${currentSeason}/constructorStandings.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const list = data.MRData?.StandingsTable?.StandingsLists;
        if (!list || list.length === 0) throw new Error('Нет данных');

        tableBody.innerHTML = '';
        list[0].ConstructorStandings.forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${s.position}</td>
                <td>${s.Constructor.name}</td>
                <td>${s.points}</td>`;
            tableBody.appendChild(row);
        });
        
        // Сохраняем в кэш
        dataCache.constructors = tableBody.innerHTML;
        dataCache.lastUpdate.constructors = Date.now();
        console.log('[CACHE] Данные о конструкторах сохранены в кэш');
        return;
    } catch (e) {
        console.warn('Jolpica constructors error:', e.message);
    }

    errorDiv.style.display = 'block';
    const fallback = getFallback('constructors');
    if (fallback.length > 0) {
        errorDiv.textContent = `API недоступен. ${currentSeason === 2026
            ? 'Показан стартовый состав команд 2026.'
            : 'Показаны приблизительные данные.'}`;
        tableBody.innerHTML = '';
        fallback.forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${c.position}</td>
                <td>${c.name}</td>
                <td>${c.points}</td>`;
            tableBody.appendChild(row);
        });
        
        // Сохраняем fallback в кэш
        dataCache.constructors = tableBody.innerHTML;
        dataCache.lastUpdate.constructors = Date.now();
    } else {
        errorDiv.textContent = `Нет данных для ${currentSeason}. Попробуйте обновить позже.`;
        tableBody.innerHTML = '';
    }
}

// ===== МОДАЛЬНОЕ ОКНО =====

// Текущее состояние модала
let modalState = { raceId: null, sprintId: null, source: null, activeTab: 'race' };

async function openRaceModal(raceId, sprintId, raceName, source) {
    const modal = document.getElementById('raceResultsModal');
    const title = document.getElementById('modalTitle');
    const tabs  = document.getElementById('modalTabs');

    modalState = { raceId, sprintId, source, activeTab: 'race' };

    title.textContent = `${raceName || '—'} (${currentSeason})`;

    // Показываем вкладки только если есть спринт
    if (sprintId !== null && sprintId !== undefined) {
        tabs.style.display = 'flex';
        document.getElementById('tabRace').classList.add('active');
        document.getElementById('tabSprint').classList.remove('active');
    } else {
        tabs.style.display = 'none';
    }

    // Сбрасываем контейнеры
    document.getElementById('raceResultsContainer').style.display = 'block';
    document.getElementById('sprintResultsContainer').style.display = 'none';
    document.getElementById('modalError').style.display = 'none';
    document.getElementById('sprintModalError').style.display = 'none';

    modal.classList.add('active');

    // Загружаем результаты гонки
    await loadResultsIntoTable(raceId, source, false);
}

async function switchModalTab(tab) {
    modalState.activeTab = tab;

    document.getElementById('tabRace').classList.toggle('active', tab === 'race');
    document.getElementById('tabSprint').classList.toggle('active', tab === 'sprint');
    document.getElementById('raceResultsContainer').style.display   = tab === 'race'   ? 'block' : 'none';
    document.getElementById('sprintResultsContainer').style.display = tab === 'sprint' ? 'block' : 'none';

    // Загружаем спринт только при первом переключении
    if (tab === 'sprint') {
        const body = document.getElementById('sprintResultsTableBody');
        if (body.innerHTML === '') {
            await loadResultsIntoTable(modalState.sprintId, modalState.source, true);
        }
    }
}

async function loadResultsIntoTable(id, source, isSprint) {
    const bodyId = isSprint ? 'sprintResultsTableBody' : 'raceResultsTableBody';
    const errId  = isSprint ? 'sprintModalError'       : 'modalError';
    const tableBody = document.getElementById(bodyId);
    const errDiv    = document.getElementById(errId);

    errDiv.style.display = 'none';
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:0.6;">Загрузка...</td></tr>';

    try {
        let results = [];

        if (source === 'openf1') {
            results = await getOpenF1Results(id, isSprint);
        } else {
            // Jolpica: id = round number
            const endpoint = isSprint
                ? `${JOLPICA_BASE}/${currentSeason}/${id}/sprint.json`
                : `${JOLPICA_BASE}/${currentSeason}/${id}/results.json`;
            const resp = await fetch(endpoint);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            const rawResults = isSprint
                ? (data.MRData?.RaceTable?.Races[0]?.SprintResults || []).slice(0, 8)
                : (data.MRData?.RaceTable?.Races[0]?.Results       || []).slice(0, 10);

            results = rawResults.map(r => ({
                position: r.position,
                name:     `${r.Driver.givenName} ${r.Driver.familyName}`,
                team:     r.Constructor?.name || '—',
                points:   r.points || 0,
            }));
        }

        tableBody.innerHTML = '';
        if (results.length === 0) {
            errDiv.style.display = 'block';
            errDiv.textContent = isSprint
                ? 'Результаты спринта ещё не опубликованы.'
                : 'Результаты гонки ещё не опубликованы.';
            return;
        }
        results.forEach(r => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${r.position}</td>
                <td>${r.name}</td>
                <td>${r.team}</td>
                <td>${r.points}</td>`;
            tableBody.appendChild(row);
        });
    } catch (e) {
        tableBody.innerHTML = '';
        errDiv.style.display = 'block';
        errDiv.textContent = e.message === 'LIVE_SESSION'
            ? 'Сессия в прямом эфире — данные временно недоступны.'
            : 'Ошибка загрузки. Попробуйте позже.';
    }
}

function closeModal() {
    document.getElementById('raceResultsModal').classList.remove('active');
    // Сбрасываем спринт-результаты чтобы подгрузились заново при следующем открытии
    document.getElementById('sprintResultsTableBody').innerHTML = '';
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [, month, day] = dateStr.split('-');
    return `${day}-${month}`;
}

// ===== ОБНОВЛЕНИЕ ДАННЫХ =====

// Функция для очистки всех кэшей (для мобильных устройств)
async function clearAllCaches() {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[CACHE] Все кэши очищены');
        
        // Очищаем также кэш данных
        dataCache.races = null;
        dataCache.drivers = null;
        dataCache.constructors = null;
        dataCache.lastUpdate.races = null;
        dataCache.lastUpdate.drivers = null;
        dataCache.lastUpdate.constructors = null;
        
        // Перезагружаем страницу
        window.location.reload(true);
    }
}

// Добавляем функцию в глобальную область для вызова из консоли
window.clearAllCaches = clearAllCaches;

async function refreshData() {
    const btn = document.getElementById('refreshButton');
    btn.disabled = true;
    btn.textContent = 'Обновление...';
    
    // Очищаем все кэши при принудительном обновлении
    dataCache.races = null;
    dataCache.drivers = null;
    dataCache.constructors = null;
    dataCache.lastUpdate.races = null;
    dataCache.lastUpdate.drivers = null;
    dataCache.lastUpdate.constructors = null;
    console.log('[REFRESH] Все кэши очищены');
    
    try {
        await Promise.all([loadRaces(), loadDrivers(), loadConstructors()]);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Обновить данные';
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

// Функция для просмотра состояния кэша
window.debugCache = function() {
    console.log('=== CACHE STATUS ===');
    
    const now = Date.now();
    console.log('Data cache:');
    console.log('- Races:', dataCache.races ? 'cached' : 'empty', 
        dataCache.lastUpdate.races ? `(${Math.round((now - dataCache.lastUpdate.races) / 1000)}s ago)` : '');
    console.log('- Drivers:', dataCache.drivers ? 'cached' : 'empty',
        dataCache.lastUpdate.drivers ? `(${Math.round((now - dataCache.lastUpdate.drivers) / 1000)}s ago)` : '');
    console.log('- Constructors:', dataCache.constructors ? 'cached' : 'empty',
        dataCache.lastUpdate.constructors ? `(${Math.round((now - dataCache.lastUpdate.constructors) / 1000)}s ago)` : '');
    
    console.log('\nCache lifetime:', CACHE_LIFETIME / 1000, 'seconds');
    console.log('=== END CACHE STATUS ===');
};

window.onload = async () => {
    document.getElementById('raceResultsModal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });

    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.year) === currentSeason);
    });

    document.getElementById('racesHeading').textContent        = `Расписание гонок — Сезон ${currentSeason}`;
    document.getElementById('driversHeading').textContent      = `Личный зачёт — Сезон ${currentSeason}`;
    document.getElementById('constructorsHeading').textContent = `Кубок конструкторов — Сезон ${currentSeason}`;
    document.getElementById('footerText').textContent =
        `© 2026 F1 Visualization Project — Сезон ${currentSeason} | Данные: Jolpica/Ergast API`;

    await refreshData();
    showSection('races');
};
