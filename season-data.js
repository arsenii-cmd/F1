// Shared season data for both visual modes. Jolpica remains the source of truth.
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const AVAILABLE_YEARS = [2023, 2024, 2025, 2026];
const CACHE_LIFETIME = 5 * 60 * 1000;
const preferences = {
    get(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
};
let currentSeason = Number(preferences.get('f1_season', '2026'));
if (!AVAILABLE_YEARS.includes(currentSeason)) currentSeason = 2026;
const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS_TABLE = [8, 7, 6, 5, 4, 3, 2, 1];
function getPointsForPosition(pos) { return POINTS_TABLE[pos - 1] || 0; }
function getSprintPointsForPosition(pos) { return SPRINT_POINTS_TABLE[pos - 1] || 0; }

const SPRINT_ROUNDS = {
    2026: new Set([2, 6, 7, 11, 14, 18]),  // Китай, Майами, Канада, GB, Нидерланды, Сингапур
    2025: new Set([2, 6, 13, 19, 21, 23]), // Китай, Майами, Бельгия, Остин, Бразилия, Катар
    2024: new Set([5, 6, 11, 19, 21, 23]), // Китай, Майами, Австрия, Остин, Бразилия, Катар
    2023: new Set([4, 9, 12, 17, 18, 21]), // Баку, Австрия, Бельгия, Катар, Остин, Бразилия
};


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
