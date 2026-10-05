import json
import re
import os
import shutil
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('F1_TEST_ARTIFACTS', str(ROOT.parent / 'F1-preview')))
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('F1_TEST_BASE', 'http://127.0.0.1:4173/')
NAMES = [('Lando','Norris','McLaren'),('Oscar','Piastri','McLaren'),('Max','Verstappen','Red Bull Racing'),('George','Russell','Mercedes'),('Charles','Leclerc','Ferrari'),('Lewis','Hamilton','Ferrari'),('Andrea Kimi','Antonelli','Mercedes'),('Carlos','Sainz','Williams'),('Fernando','Alonso','Aston Martin'),('Lance','Stroll','Aston Martin'),('Pierre','Gasly','Alpine'),('Franco','Colapinto','Alpine'),('Alex','Albon','Williams'),('Oliver','Bearman','Haas F1 Team'),('Esteban','Ocon','Haas F1 Team'),('Liam','Lawson','Racing Bulls'),('Isack','Hadjar','Red Bull Racing'),('Arvid','Lindblad','Racing Bulls'),('Nico','Hulkenberg','Audi'),('Gabriel','Bortoleto','Audi'),('Sergio','Perez','Cadillac'),('Valtteri','Bottas','Cadillac')]
RACES = [('Australia','Albert Park Grand Prix Circuit','03-08'),('China','Shanghai International Circuit','03-15'),('Japan','Suzuka Circuit','03-29'),('USA','Miami International Autodrome','05-03'),('Canada','Circuit Gilles Villeneuve','05-24'),('Monaco','Circuit de Monaco','06-07'),('Spain','Circuit de Barcelona-Catalunya','06-14'),('Austria','Red Bull Ring','06-28'),('UK','Silverstone Circuit','07-05'),('Belgium','Circuit de Spa-Francorchamps','07-19'),('Hungary','Hungaroring','07-26'),('Netherlands','Circuit Zandvoort','08-23'),('Italy','Autodromo Nazionale di Monza','09-06'),('Azerbaijan','Baku City Circuit','09-26'),('Singapore','Marina Bay Street Circuit','10-11'),('USA','Circuit of the Americas','10-25'),('Mexico','Autodromo Hermanos Rodriguez','11-01'),('Brazil','Autodromo Jose Carlos Pace','11-08'),('USA','Las Vegas Strip Circuit','11-21'),('Qatar','Lusail International Circuit','11-29'),('UAE','Yas Marina Circuit','12-06')]
STANDINGS = [{'position':str(i+1),'points':str(max(0,312-i*17)),'wins':str(6 if i==0 else 1),'Driver':{'givenName':a,'familyName':b,'nationality':'British' if i%2==0 else 'Australian','permanentNumber':str([4,81,1,63,16,44][i%6])},'Constructors':[{'name':team}]} for i,(a,b,team) in enumerate(NAMES)]
TEAMS=list(dict.fromkeys(n[2] for n in NAMES))
CONSTRUCTORS=[{'position':str(i+1),'points':str(590-i*47),'wins':'1','Constructor':{'name':team}} for i,team in enumerate(TEAMS)]

def fixture(url):
    path=urlparse(url).path
    year=re.search(r'/f1/(\d{4})',path).group(1)
    rounds=[{'round':str(i+1),'raceName':country+' Grand Prix','date':year+'-'+date,'time':'14:00:00Z','Circuit':{'circuitName':circuit,'Location':{'country':country}},**({'Sprint':{'date':year+'-'+date}} if i in [1,3,4,8,11,14] else {})} for i,(country,circuit,date) in enumerate(RACES)]
    if 'driverStandings' in path:
        return {'MRData':{'StandingsTable':{'StandingsLists':[{'DriverStandings':STANDINGS}]}}}
    if 'constructorStandings' in path:
        return {'MRData':{'StandingsTable':{'StandingsLists':[{'ConstructorStandings':CONSTRUCTORS}]}}}
    if path.endswith('/results/1.json'):
        return {'MRData':{'RaceTable':{'Races':[{**race,'Results':[{'Driver':STANDINGS[i%3]['Driver']}]} for i,race in enumerate(rounds[:12])]}}}
    if path.endswith('/sprint.json') and re.search(r'/\d{4}/sprint',path):
        return {'MRData':{'RaceTable':{'Races':[{**rounds[i],'SprintResults':[{'Driver':STANDINGS[0]['Driver']}]} for i in [1,3,4,8,11]]}}}
    if path.endswith('/results.json') or path.endswith('/sprint.json'):
        sprint=path.endswith('/sprint.json')
        rows=[{'position':s['position'],'points':str(max(0,(8 if sprint else 25)-i*2)),'Driver':s['Driver'],'Constructor':s['Constructors'][0]} for i,s in enumerate(STANDINGS[:8] if sprint else STANDINGS)]
        return {'MRData':{'RaceTable':{'Races':[{('SprintResults' if sprint else 'Results'):rows}]}}}
    return {'MRData':{'RaceTable':{'Races':rounds}}}

def routes(route):
    url=route.request.url
    if 'api.jolpi.ca' in url:
        route.fulfill(status=200,content_type='application/json',body=json.dumps(fixture(url)))
    elif url.startswith(BASE):
        route.continue_()
    elif route.request.resource_type=='image':
        route.fulfill(status=200,content_type='image/svg+xml',body=(ROOT/'assets/news-paddock.svg').read_text())
    else:
        route.abort()

def layout(page, label):
    result=page.evaluate('''() => ({width: innerWidth, doc: document.documentElement.scrollWidth, fonts: document.fonts.status, missing: [...document.images].filter(i => i.getClientRects().length && i.complete && !i.naturalWidth).map(i=>i.src)})''')
    assert result['doc'] <= result['width']+1, (label,'horizontal overflow',result)
    assert result['fonts']=='loaded', (label,'fonts not loaded')
    print(label,result,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('F1_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1050},device_scale_factor=1,service_workers='block')
    context.route('**/*',routes)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle')
    page.evaluate('document.fonts.ready')
    expect(page.locator('#racesTableBody tr[data-round]')).to_have_count(len(RACES))
    expect(page.locator('#designToggle')).to_be_checked()
    assert page.locator('html').get_attribute('data-design')=='modern'
    expect(page.locator('#statDrivers')).to_have_text('22')
    expect(page.locator('#newsTeaserGrid .news-card')).to_have_count(3)
    assert page.locator('#newsGrid .news-card').count()>=10
    layout(page,'desktop modern')
    page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
    page.screenshot(path=str(OUT/'desktop-first-screen.png'))
    page.locator('nav [data-section="races"]').click()
    page.locator('#racesTableBody tr[data-round="2"]').click()
    expect(page.locator('#raceResultsModal')).to_have_class(re.compile('active'))
    expect(page.locator('#raceResultsTableBody tr')).to_have_count(22)
    page.locator('#tabSprint').click()
    expect(page.locator('#sprintResultsTableBody tr')).to_have_count(8)
    page.keyboard.press('Escape')
    expect(page.locator('#raceResultsModal')).not_to_have_class(re.compile('active'))
    page.locator('nav [data-section="drivers"]').click()
    expect(page.locator('#driverPodium .podium-card')).to_have_count(3)
    expect(page.locator('#driversTableBody tr')).to_have_count(22)
    page.screenshot(path=str(OUT/'drivers.png'))
    page.locator('nav [data-section="constructors"]').click()
    expect(page.locator('#constructorsTableBody tr')).to_have_count(11)
    expect(page.locator('#constructorCards .constructor-card')).to_have_count(3)
    page.locator('nav [data-section="races"]').click()
    page.locator('#raceSearch').fill('Канада')
    expect(page.locator('#racesTableBody tr[data-round]:visible')).to_have_count(1)
    page.locator('#raceSearch').fill('zzzzzz')
    expect(page.locator('#raceFilterEmpty')).to_be_visible()
    page.locator('#raceSearch').fill('')
    page.locator('[data-race-filter="finished"]').click()
    expect(page.locator('#racesTableBody tr[data-round]:visible')).to_have_count(12)
    page.locator('[data-race-filter="upcoming"]').click()
    expect(page.locator('#racesTableBody tr[data-round]:visible')).to_have_count(9)
    page.locator('#designToggle').uncheck()
    page.wait_for_timeout(450)
    assert page.locator('html').get_attribute('data-design')=='classic'
    expect(page.locator('#racesTableBody tr[data-round]:visible')).to_have_count(len(RACES))
    expect(page.locator('.race-hero')).not_to_be_visible()
    assert page.locator('nav button:visible').count()==5
    page.reload(wait_until='networkidle')
    assert page.locator('html').get_attribute('data-design')=='classic'
    page.locator('#racesTableBody tr[data-round="2"]').click()
    expect(page.locator('#raceResultsTableBody tr')).to_have_count(22)
    page.locator('.close-button').click()
    page.locator('nav [data-section="drivers"]').click()
    expect(page.locator('#driversTableBody tr')).to_have_count(22)
    page.locator('#designToggle').check()
    page.wait_for_timeout(450)
    page.locator('[data-year="2023"]').click()
    expect(page.locator('#driversHeading')).to_contain_text('2023')
    page.wait_for_function('F1Data.season===2023 && F1Data.races.length>0 && F1Data.races[0].date.startsWith("2023")')
    page.locator('[data-year="2026"]').click()
    page.wait_for_function('F1Data.season===2026 && F1Data.races.length>0 && F1Data.races[0].date.startsWith("2026")')
    page.locator('nav [data-section="broadcasts"]').click()
    expect(page.locator('#broadcasts')).to_be_visible()
    assert page.locator('#broadcasts a[href="https://www.formula1.com/"]').count()==1
    page.locator('nav [data-section="news"]').click()
    expect(page.locator('#news')).to_be_visible()
    page.locator('[data-news-filter="tech"]').click()
    expected=len([a for a in json.loads((ROOT/'data/news.json').read_text())['articles'] if a['category']=='tech'])
    expect(page.locator('#newsGrid .news-card')).to_have_count(expected)
    page.locator('[data-news-filter="all"]').click()
    assert all(page.locator('#newsGrid .news-card').nth(i).get_attribute('href').startswith('http') for i in range(page.locator('#newsGrid .news-card').count()))
    page.locator('#motionToggle').scroll_into_view_if_needed()
    page.locator('#motionToggle').click()
    assert page.locator('#motionToggle').get_attribute('aria-pressed')=='false'
    page.locator('#motionToggle').click()
    page.locator('#motionSpeed').fill('2')
    expect(page.locator('#speedValue')).to_have_text('2×')
    assert not errors, errors
    print('PASS desktop: data, cache, modal, sprint, seasons, filters, saved design, news, motion',flush=True)
    for width in [390,360,768]:
        page.set_viewport_size({'width':width,'height':844})
        page.locator('nav [data-section="races"]').click()
        page.evaluate('window.scrollTo(0,0)')
        page.wait_for_timeout(500)
        page.evaluate('document.fonts.ready')
        layout(page,f'modern {width}px')
        if width < 700:
            box=page.locator('nav').bounding_box()
            assert box['y']>700,(width,'mobile nav misplaced',box)
        page.screenshot(path=str(OUT/f'mobile-{width}.png'),full_page=True)
        if width==390:
            page.screenshot(path=str(OUT/'mobile-first-screen.png'))
            page.locator('#designToggle').uncheck()
            page.wait_for_timeout(500)
            page.evaluate('window.scrollTo(0,0)')
            layout(page,'mobile classic')
            page.wait_for_timeout(1400)
            page.screenshot(path=str(OUT/'classic-mobile.png'),full_page=True)
            page.locator('#designToggle').check()
            page.wait_for_timeout(500)
    reduced=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
    reduced.route('**/*',routes)
    quiet=reduced.new_page()
    quiet.goto(BASE,wait_until='networkidle')
    assert quiet.locator('#motionToggle').get_attribute('aria-pressed')=='false'
    assert quiet.locator('.hero-car').evaluate('(el)=>getComputedStyle(el).animationName')=='none'
    print('PASS responsive and reduced-motion; screenshots in '+str(OUT),flush=True)
    browser.close()
