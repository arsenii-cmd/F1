"""Build a small static headline feed for GitHub Pages, with no browser RSS proxy."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import html
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'news.json'
SOURCES = [
    ('F1News', 'https://www.f1news.ru/export/news.xml', 'ru'),
    ('Motorsport', 'https://ru.motorsport.com/rss/f1/news/', 'ru'),
    ('Autosport', 'https://www.autosport.com/rss/f1/news/', 'en'),
]

def clean(text):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', text or ''))).strip()

def category(title):
    text = title.lower()
    if re.search(r'двигател|аэродинами|регламент|технолог|шасси|power unit|engine|technical|aero|rules', text):
        return 'tech'
    if re.search(r'гран.при|квалифика|гонк|практик|спринт|grand prix|qualifying|race|sprint|practice', text):
        return 'racing'
    return 'teams'

def collect(source):
    name, feed, language = source
    request = Request(feed, headers={'User-Agent': 'F1GRID/1.0 RSS reader', 'Accept': 'application/rss+xml, application/xml, text/xml'})
    try:
        with urlopen(request, timeout=20) as response:
            root = ET.fromstring(response.read(2_000_000))
        articles = []
        for item in root.findall('.//item')[:16]:
            title = clean(item.findtext('title'))
            url = (item.findtext('link') or '').strip()
            if not title or urlparse(url).scheme not in ('http', 'https'):
                continue
            date_text = item.findtext('pubDate') or ''
            try:
                date = parsedate_to_datetime(date_text).astimezone(timezone.utc).isoformat()
            except (ValueError, TypeError):
                continue
            image = ''
            for node in item.iter():
                if node.tag.split('}')[-1] in ('thumbnail', 'content', 'enclosure'):
                    candidate = node.attrib.get('url', '')
                    if urlparse(candidate).scheme == 'https' and (node.attrib.get('type', '').startswith('image') or node.tag.split('}')[-1] != 'enclosure'):
                        image = candidate
                        break
            articles.append({'title': title, 'url': url, 'source': name, 'language': language, 'publishedAt': date, 'category': category(title), 'image': image})
        print(f'{name}: {len(articles)} headlines')
        return articles
    except Exception as error:
        print(f'{name}: unavailable ({type(error).__name__})')
        return []

def main():
    with ThreadPoolExecutor(max_workers=3) as pool:
        batches = list(pool.map(collect, SOURCES))
    articles = {item['url']: item for batch in batches for item in batch}
    if not articles:
        if OUTPUT.exists():
            print('Keeping the previous feed; all sources are unavailable.')
            return
        raise SystemExit('No news feed is available.')
    # Prefer Russian headlines, retain an English source for a broader view.
    sorted_articles = sorted(articles.values(), key=lambda item: item['publishedAt'], reverse=True)
    russian = [item for item in sorted_articles if item['language'] == 'ru'][:18]
    english = [item for item in sorted_articles if item['language'] == 'en'][:6]
    chosen = sorted(russian + english, key=lambda item: item['publishedAt'], reverse=True)
    payload = {'updatedAt': datetime.now(timezone.utc).isoformat(), 'articles': chosen or sorted_articles[:24]}
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Saved {len(payload["articles"])} headlines to data/news.json')

if __name__ == '__main__':
    main()
