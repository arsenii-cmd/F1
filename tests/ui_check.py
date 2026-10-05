"""Проверка интерфейса в браузере: три варианта (Старый, Codex, Claude), переключатель, данные, окно результатов, адаптивность.

Ответы Jolpica подменяются предсказуемыми данными, поэтому тест не зависит от сети.

    pip install playwright && python -m playwright install chromium
    python -m http.server 4173            # в корне репозитория
    python tests/ui_check.py              # в другом терминале

Переменные окружения: F1_TEST_BASE (адрес сервера), F1_CHROMIUM (путь к Chromium),
F1_TEST_SHOTS (папка для скриншотов), F1_TEST_OFFLINE=1 (дополнительно проверить режим без API).
"""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get('F1_TEST_BASE', 'http://localhost:4173/')
SHOTS = Path(os.environ.get('F1_TEST_SHOTS', 'test-shots'))
NOW = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)

CIRCUITS = [
    ('Australian Grand Prix', 'Albert Park Grand Prix Circuit', 'Melbourne', 'Australia'),
    ('Chinese Grand Prix', 'Shanghai International Circuit', 'Shanghai', 'China'),
    ('Japanese Grand Prix', 'Suzuka Circuit', 'Suzuka', 'Japan'),
    ('Bahrain Grand Prix', 'Bahrain International Circuit', 'Sakhir', 'Bahrain'),
    ('Saudi Arabian Grand Prix', 'Jeddah Corniche Circuit', 'Jeddah', 'Saudi Arabia'),
    ('Miami Grand Prix', 'Miami International Autodrome', 'Miami', 'USA'),
    ('Canadian Grand Prix', 'Circuit Gilles Villeneuve', 'Montreal', 'Canada'),
    ('Monaco Grand Prix', 'Circuit de Monaco', 'Monte Carlo', 'Monaco'),
    ('Barcelona-Catalunya Grand Prix', 'Circuit de Barcelona-Catalunya', 'Barcelona', 'Spain'),
    ('Austrian Grand Prix', 'Red Bull Ring', 'Spielberg', 'Austria'),
    ('British Grand Prix', 'Silverstone Circuit', 'Silverstone', 'UK'),
    ('Belgian Grand Prix', 'Circuit de Spa-Francorchamps', 'Spa', 'Belgium'),
    ('Hungarian Grand Prix', 'Hungaroring', 'Budapest', 'Hungary'),
    ('Dutch Grand Prix', 'Circuit Park Zandvoort', 'Zandvoort', 'Netherlands'),
    ('Italian Grand Prix', 'Autodromo Nazionale di Monza', 'Monza', 'Italy'),
    ('Spanish Grand Prix', 'Madring', 'Madrid', 'Spain'),
    ('Azerbaijan Grand Prix', 'Baku City Circuit', 'Baku', 'Azerbaijan'),
    ('Singapore Grand Prix', 'Marina Bay Street Circuit', 'Marina Bay', 'Singapore'),
    ('United States Grand Prix', 'Circuit of the Americas', 'Austin', 'USA'),
    ('Mexico City Grand Prix', 'Autódromo Hermanos Rodríguez', 'Mexico City', 'Mexico'),
    ('São Paulo Grand Prix', 'Autódromo José Carlos Pace', 'São Paulo', 'Brazil'),
    ('Las Vegas Grand Prix', 'Las Vegas Strip Street Circuit', 'Las Vegas', 'USA'),
    ('Qatar Grand Prix', 'Losail International Circuit', 'Lusail', 'Qatar'),
    ('Abu Dhabi Grand Prix', 'Yas Marina Circuit', 'Yas Island', 'UAE'),
]
SPRINTS = {2, 6, 7, 11, 14, 18}
DRIVERS = [
    ('norris', 'Lando', 'Norris', 'NOR', '4', 'British', 'McLaren'),
    ('max_verstappen', 'Max', 'Verstappen', 'VER', '3', 'Dutch', 'Red Bull'),
    ('piastri', 'Oscar', 'Piastri', 'PIA', '81', 'Australian', 'McLaren'),
    ('russell', 'George', 'Russell', 'RUS', '63', 'British', 'Mercedes'),
    ('leclerc', 'Charles', 'Leclerc', 'LEC', '16', 'Monegasque', 'Ferrari'),
    ('antonelli', 'Andrea Kimi', 'Antonelli', 'ANT', '12', 'Italian', 'Mercedes'),
    ('hamilton', 'Lewis', 'Hamilton', 'HAM', '44', 'British', 'Ferrari'),
    ('albon', 'Alexander', 'Albon', 'ALB', '23', 'Thai', 'Williams'),
    ('hadjar', 'Isack', 'Hadjar', 'HAD', '6', 'French', 'Red Bull'),
    ('sainz', 'Carlos', 'Sainz', 'SAI', '55', 'Spanish', 'Williams'),
    ('alonso', 'Fernando', 'Alonso', 'ALO', '14', 'Spanish', 'Aston Martin'),
    ('lawson', 'Liam', 'Lawson', 'LAW', '30', 'New Zealander', 'RB F1 Team'),
    ('bearman', 'Oliver', 'Bearman', 'BEA', '87', 'British', 'Haas F1 Team'),
    ('gasly', 'Pierre', 'Gasly', 'GAS', '10', 'French', 'Alpine F1 Team'),
    ('hulkenberg', 'Nico', 'Hülkenberg', 'HUL', '27', 'German', 'Audi'),
    ('ocon', 'Esteban', 'Ocon', 'OCO', '31', 'French', 'Haas F1 Team'),
    ('lindblad', 'Arvid', 'Lindblad', 'LIN', '41', 'British', 'RB F1 Team'),
    ('bortoleto', 'Gabriel', 'Bortoleto', 'BOR', '5', 'Brazilian', 'Audi'),
    ('stroll', 'Lance', 'Stroll', 'STR', '18', 'Canadian', 'Aston Martin'),
    ('colapinto', 'Franco', 'Colapinto', 'COL', '43', 'Argentine', 'Alpine F1 Team'),
    ('perez', 'Sergio', 'Pérez', 'PER', '11', 'Mexican', 'Cadillac F1 Team'),
    ('bottas', 'Valtteri', 'Bottas', 'BOT', '77', 'Finnish', 'Cadillac F1 Team'),
]
POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]


def driver_json(d):
    return {'driverId': d[0], 'givenName': d[1], 'familyName': d[2], 'code': d[3], 'permanentNumber': d[4], 'nationality': d[5]}


def team_json(name):
    return {'constructorId': re.sub(r'\W+', '_', name.lower()), 'name': name, 'nationality': 'British'}


def race_dates(season):
    start = datetime(season, 3, 8, 4, 0, tzinfo=timezone.utc)
    return [start + timedelta(days=11 * i) for i in range(len(CIRCUITS))]


def schedule(season):
    races = []
    for i, (name, circuit, city, country) in enumerate(CIRCUITS):
        rnd = i + 1
        day = race_dates(season)[i]
        race = {
            'season': str(season), 'round': str(rnd), 'raceName': name,
            'Circuit': {'circuitId': f'c{rnd}', 'circuitName': circuit, 'Location': {'locality': city, 'country': country}},
            'date': day.strftime('%Y-%m-%d'), 'time': day.strftime('%H:%M:%SZ'),
            'FirstPractice': {'date': (day - timedelta(days=2)).strftime('%Y-%m-%d'), 'time': '01:30:00Z'},
            'Qualifying': {'date': (day - timedelta(days=1)).strftime('%Y-%m-%d'), 'time': '05:00:00Z'},
        }
        if rnd in SPRINTS:
            race['SprintQualifying'] = {'date': (day - timedelta(days=2)).strftime('%Y-%m-%d'), 'time': '05:30:00Z'}
            race['Sprint'] = {'date': (day - timedelta(days=1)).strftime('%Y-%m-%d'), 'time': '01:00:00Z'}
        else:
            race['SecondPractice'] = {'date': (day - timedelta(days=2)).strftime('%Y-%m-%d'), 'time': '05:00:00Z'}
            race['ThirdPractice'] = {'date': (day - timedelta(days=1)).strftime('%Y-%m-%d'), 'time': '01:30:00Z'}
        races.append(race)
    return races


def finished_rounds(season):
    return [i + 1 for i, d in enumerate(race_dates(season)) if d < NOW]


def classification(season, rnd, sprint=False):
    order = DRIVERS[rnd % 4:] + DRIVERS[:rnd % 4]
    scale = [8, 7, 6, 5, 4, 3, 2, 1] if sprint else POINTS
    rows = []
    for i, d in enumerate(order):
        rows.append({
            'number': d[4], 'position': str(i + 1), 'positionText': str(i + 1), 'points': str(scale[i] if i < len(scale) else 0),
            'Driver': driver_json(d), 'Constructor': team_json(d[6]), 'grid': str((i + 3) % 20 + 1), 'laps': '57',
            'status': 'Finished' if i < 18 else '+1 Lap',
            **({'Time': {'time': '1:31:44.742' if i == 0 else f'+{i * 2.317:.3f}'}} if i < 18 else {}),
            **({'FastestLap': {'rank': '1', 'lap': '44'}} if i == 2 else {}),
        })
    return rows


def mrdata(table_key, table, total=None):
    count = len(table.get('Races', table.get('StandingsLists', [])))
    return {'MRData': {'limit': '100', 'offset': '0', 'total': str(total if total is not None else count), table_key: table}}


def driver_standings(season):
    done = len(finished_rounds(season))
    rows = []
    for i, d in enumerate(DRIVERS):
        rows.append({'position': str(i + 1), 'positionText': str(i + 1), 'points': str(max(0, done * 19 - i * 23 - i * i)),
                     'wins': str(max(0, 6 - i)), 'Driver': driver_json(d), 'Constructors': [team_json(d[6])]})
    return mrdata('StandingsTable', {'season': str(season), 'StandingsLists': [{'season': str(season), 'round': str(done), 'DriverStandings': rows}]})


def constructor_standings(season):
    done = len(finished_rounds(season))
    teams = []
    for d in DRIVERS:
        if d[6] not in teams:
            teams.append(d[6])
    rows = [{'position': str(i + 1), 'positionText': str(i + 1), 'points': str(max(0, done * 33 - i * 41)), 'wins': str(max(0, 8 - 2 * i)),
             'Constructor': team_json(t)} for i, t in enumerate(teams)]
    return mrdata('StandingsTable', {'season': str(season), 'StandingsLists': [{'season': str(season), 'round': str(done), 'ConstructorStandings': rows}]})


def api_response(url):
    path = url.split('/ergast/f1/', 1)[1]
    clean = path.split('?')[0].removesuffix('.json')
    parts = clean.split('/')
    season = int(parts[0])
    races = schedule(season)
    done = finished_rounds(season)
    if len(parts) == 1:
        return mrdata('RaceTable', {'season': str(season), 'Races': races})
    if parts[1:] == ['results', '1']:
        rows = [{**races[r - 1], 'Results': classification(season, r)[:1]} for r in done]
        return mrdata('RaceTable', {'season': str(season), 'Races': rows})
    if parts[1:] == ['sprint']:
        rows = [{**races[r - 1], 'SprintResults': classification(season, r, True)} for r in done if r in SPRINTS]
        return mrdata('RaceTable', {'season': str(season), 'Races': rows})
    if parts[1:] == ['driverStandings']:
        return driver_standings(season)
    if parts[1:] == ['constructorStandings']:
        return constructor_standings(season)
    if len(parts) == 3 and parts[2] in ('results', 'sprint'):
        rnd = int(parts[1])
        if rnd not in done or (parts[2] == 'sprint' and rnd not in SPRINTS):
            return mrdata('RaceTable', {'season': str(season), 'Races': []})
        key = 'SprintResults' if parts[2] == 'sprint' else 'Results'
        return mrdata('RaceTable', {'season': str(season), 'Races': [{**races[rnd - 1], key: classification(season, rnd, parts[2] == 'sprint')}]})
    return mrdata('RaceTable', {'Races': []})


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def new_page(browser, width, height=900, api=True, reduced=False):
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                  reduced_motion='reduce' if reduced else 'no-preference', service_workers='block',
                                  ignore_https_errors=True)
    context.add_init_script(f"""(() => {{
        const fixed = {int(NOW.timestamp() * 1000)};
        const RealDate = Date;
        class FakeDate extends RealDate {{
            constructor(...a) {{ super(...(a.length ? a : [fixed + (performance.now() | 0)])); }}
            static now() {{ return fixed + (performance.now() | 0); }}
        }}
        window.Date = FakeDate;
    }})();""")
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'net::' not in m.text and 'Failed to load resource' not in m.text and errors.append(m.text))

    def handle(route):
        if api:
            route.fulfill(status=200, content_type='application/json', body=json.dumps(api_response(route.request.url)),
                          headers={'Access-Control-Allow-Origin': '*'})
        else:
            route.abort()
    page.route('https://api.jolpi.ca/**', handle)
    # Внешние картинки и видео не нужны для проверки
    page.route(re.compile(r'https://(?!fonts\.)(?!api\.jolpi).*\.(png|jpe?g|webp|gif)(\?.*)?$'), lambda r: r.abort())
    page.route('https://i.vimeocdn.com/**', lambda r: r.abort())
    return context, page, errors


def no_overflow(page, label):
    width = page.evaluate('document.documentElement.scrollWidth')
    view = page.evaluate('window.innerWidth')
    check(width <= view, f'{label}: горизонтальная прокрутка {width} > {view}')


def run(browser):
    SHOTS.mkdir(parents=True, exist_ok=True)

    # --- Новый вид, десктоп ---
    context, page, errors = new_page(browser, 1440)
    page.goto(BASE, wait_until='networkidle')
    check(page.evaluate('document.documentElement.dataset.design') == 'claude', 'по умолчанию должен открываться вариант Claude')
    check(page.locator('#classic').is_hidden(), 'старый вид должен быть скрыт')
    page.wait_for_function("document.querySelectorAll('#mxRaces .mx-race').length === 24")
    page.wait_for_function("document.querySelectorAll('#mxDrivers .mx-tr').length === 22")
    check(page.locator('#mxTeams .mx-team').count() == 11, 'должно быть 11 команд')
    check(page.locator('#mxRaces .mx-race.is-next').count() == 1, 'должен быть ровно один следующий этап')
    check('Norris' in page.locator('#mxLeaderLast').text_content(), 'лидер — Norris')
    check(page.locator('#mxNextName').inner_text() != 'Загружаем календарь…', 'следующая гонка должна загрузиться')
    check(page.locator('#mxNewsGrid .mx-news-card').count() >= 5, 'должны показаться новости')
    check(page.locator('#mxOrder li').count() == 5, 'на трассе пять болидов')
    page.wait_for_timeout(1400)
    page.screenshot(path=str(SHOTS / 'modern-hero.png'))
    page.screenshot(path=str(SHOTS / 'modern-full.png'), full_page=True)
    no_overflow(page, 'modern 1440')

    # Фильтры и поиск
    page.click('#mx-calendar [data-filter="sprint"]')
    page.wait_for_function("[...document.querySelectorAll('#mxRaces .mx-race')].filter(li => !li.hidden).length === 6")
    page.click('#mx-calendar [data-filter="all"]')
    page.wait_for_function("[...document.querySelectorAll('#mxRaces .mx-race')].filter(li => !li.hidden).length === 24")
    page.fill('#mxSearch', 'monza')
    page.wait_for_function("[...document.querySelectorAll('#mxRaces .mx-race')].filter(li => !li.hidden).length === 1")
    page.fill('#mxSearch', '')

    # Окно результатов со спринтом
    page.locator('#mxRaces button[data-round="2"]').scroll_into_view_if_needed()
    page.click('#mxRaces button[data-round="2"]')
    page.wait_for_selector('#mxDialog[open] .mx-res-row')
    check(page.locator('#mxResults .mx-res-row').count() == 22, 'в результатах гонки 22 строки')
    check(page.locator('#mxDialogTabs').is_visible(), 'для спринт-уикенда видна вкладка спринта')
    page.wait_for_timeout(700)
    page.screenshot(path=str(SHOTS / 'modern-dialog.png'))
    page.click('#mxDialogTabs [data-session="sprint"]')
    page.wait_for_function("document.querySelector('#mxResults .mx-res-row .mx-res-pts')?.textContent.trim() === '8'")
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    check(not page.evaluate('document.getElementById("mxDialog").open'), 'Escape закрывает окно')

    # Вкладка конструкторов
    page.click('#mxTabTeams')
    page.wait_for_function("!document.getElementById('mxPanelTeams').hidden")
    check(page.locator('#mxPanelTeams').is_visible() and page.locator('#mxPanelDrivers').is_hidden(), 'переключение на Кубок конструкторов')
    page.locator('#mxPanelTeams').scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    page.screenshot(path=str(SHOTS / 'modern-teams.png'))
    page.click('#mxTabDrivers')

    # Смена сезона
    page.click('.mx-season [data-year="2025"]')
    page.wait_for_function("document.querySelector('#mxCalTitle em').textContent === '2025'")
    page.wait_for_function("!document.documentElement.classList.contains('mx-loading')")
    check(page.locator('#mxRaces .mx-race.is-done').count() == 24, 'в 2025 все этапы завершены')
    check(page.evaluate("localStorage.getItem('f1_season')") == '2025', 'сезон сохраняется')

    # Переключение на старый вид
    page.click('[data-variant-choice="classic"]')
    page.wait_for_function("document.documentElement.dataset.design === 'classic'")
    check(page.locator('#claude').is_hidden() and page.locator('#classic').is_visible(), 'видим только старый вид')
    page.wait_for_function("document.querySelectorAll('#racesTableBody tr').length === 24")
    check('2025' in page.locator('#racesHeading').inner_text(), 'старый вид получил выбранный сезон')
    check(page.evaluate("document.getElementById('claudeCss').disabled"), 'стили нового вида отключены в старом')
    page.click("nav button:has-text('Личный зачёт')")
    page.wait_for_function("document.querySelectorAll('#driversTableBody tr').length === 22")
    page.wait_for_timeout(900)
    page.screenshot(path=str(SHOTS / 'classic.png'))
    page.reload(wait_until='networkidle')
    check(page.evaluate('document.documentElement.dataset.design') == 'classic', 'выбор варианта сохраняется после перезагрузки')
    page.wait_for_function("document.querySelectorAll('#racesTableBody tr').length === 24")
    page.click('[data-variant-choice="claude"]')
    page.wait_for_function("document.querySelectorAll('#mxRaces .mx-race').length === 24")
    check(page.evaluate("document.getElementById('classicCss').disabled"), 'стили старого вида отключены в новом')

    # Вариант Codex — отдельная страница codex/
    page.click('[data-variant-choice="codex"]')
    page.wait_for_url(re.compile(r'/codex/'))
    page.wait_for_load_state('networkidle')
    check(page.evaluate("localStorage.getItem('f1_variant')") == 'codex', 'выбор Codex сохраняется')
    page.wait_for_function("document.querySelectorAll('#racesTableBody tr').length === 24")
    check(page.locator('.hero-car').is_visible(), 'у варианта Codex свой первый экран')
    page.wait_for_function("document.querySelectorAll('#newsTeaserGrid .news-card').length > 0")
    page.wait_for_timeout(800)
    page.screenshot(path=str(SHOTS / 'codex.png'))
    no_overflow(page, 'codex 1440')
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_url(re.compile(r'/codex/'))
    check(True, 'главная перенаправляет на выбранный Codex')
    page.click('[data-variant-choice="claude"]')
    page.wait_for_url(re.compile(r'/$'))
    page.wait_for_function("document.querySelectorAll('#mxRaces .mx-race').length === 24")
    check(page.evaluate('document.documentElement.dataset.variant') == 'claude', 'возврат на Claude')
    check(not errors, f'ошибки в консоли: {errors}')
    context.close()
    print('PASS desktop: данные, фильтры, поиск, результаты, спринт, сезоны, переключатель Старый/Codex/Claude')

    # --- Мобильные размеры ---
    for width in (360, 390, 768, 1024):
        context, page, errors = new_page(browser, width, 844)
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_function("document.querySelectorAll('#mxDrivers .mx-tr').length === 22")
        page.wait_for_timeout(1200)
        no_overflow(page, f'modern {width}')
        page.screenshot(path=str(SHOTS / f'modern-{width}.png'))
        if width == 390:
            page.screenshot(path=str(SHOTS / 'modern-390-full.png'), full_page=True)
            page.click('[data-variant-choice="classic"]')
            page.wait_for_function("document.documentElement.dataset.design === 'classic'")
            page.wait_for_function("document.querySelectorAll('#racesTableBody tr').length === 24")
            no_overflow(page, 'classic 390')
        check(not errors, f'{width}px: ошибки в консоли: {errors}')
        context.close()
    print('PASS адаптивность: 360/390/768/1024 без горизонтальной прокрутки')

    # --- Уменьшение движения ---
    context, page, errors = new_page(browser, 1280, reduced=True)
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function("document.querySelectorAll('#mxRaces .mx-race').length === 24")
    check(page.evaluate("getComputedStyle(document.querySelector('.mx-race')).opacity") == '1', 'карточки видны без анимации')
    check(not errors, f'reduced motion: {errors}')
    context.close()
    print('PASS prefers-reduced-motion')

    # --- API недоступен ---
    context, page, errors = new_page(browser, 1280, api=False)
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_selector('.mx-status.is-fallback', timeout=20000)
    page.wait_for_function("document.querySelectorAll('#mxRaces .mx-race').length === 24")
    check(page.locator('#mxDrivers .mx-tr').count() == 22, 'резервный личный зачёт')
    check(not errors, f'offline: {errors}')
    context.close()
    print('PASS резервные данные при недоступном API')


def main():
    with sync_playwright() as p:
        launch = {'executable_path': os.environ['F1_CHROMIUM']} if os.environ.get('F1_CHROMIUM') else {}
        proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
        if proxy:
            launch['proxy'] = {'server': proxy, 'bypass': 'localhost,127.0.0.1'}
        browser = p.chromium.launch(**launch)
        try:
            run(browser)
        finally:
            browser.close()
    print(f'Скриншоты: {SHOTS.resolve()}')


if __name__ == '__main__':
    try:
        main()
    except AssertionError as error:
        print(f'FAIL: {error}')
        sys.exit(1)
