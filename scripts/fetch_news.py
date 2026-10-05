"""Собирает свежие заголовки F1 из RSS в data/news.json для нового вида сайта.

Сохраняются только заголовок, ссылка на источник, дата и картинка-превью — тексты статей не копируются.
Если все источники недоступны, предыдущая лента остаётся без изменений.
"""
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

OUTPUT = Path(__file__).resolve().parents[1] / 'data' / 'news.json'
SOURCES = [
    ('F1News', 'https://www.f1news.ru/export/news.xml', 'ru'),
    ('Motorsport', 'https://ru.motorsport.com/rss/f1/news/', 'ru'),
    ('Autosport', 'https://www.autosport.com/rss/f1/news/', 'en'),
]
PER_SOURCE = 16
RUSSIAN_LIMIT = 18
ENGLISH_LIMIT = 6


def clean_text(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', value or ''))).strip()


def valid_url(value):
    """https-ссылка с нормальным хостом (в RSS встречаются склеенные адреса вида https://a.ruhttps://...)."""
    value = (value or '').strip()
    parsed = urlparse(value)
    if parsed.scheme != 'https' or not parsed.netloc or '://' in value[8:]:
        return ''
    if not re.fullmatch(r'[A-Za-z0-9.-]+(:\d+)?', parsed.netloc):
        return ''
    return value


def category(title):
    text = title.lower()
    if re.search(r'двигател|аэродинам|регламент|технич|шасси|шин|power unit|engine|technical|aero|upgrade|tyre', text):
        return 'tech'
    if re.search(r'гран.при|квалифик|гонк|практик|спринт|заезд|grand prix|qualifying|race|sprint|practice| gp', text):
        return 'racing'
    return 'teams'


def find_image(item):
    for node in item.iter():
        tag = node.tag.split('}')[-1]
        if tag not in ('thumbnail', 'content', 'enclosure'):
            continue
        if tag == 'enclosure' and not node.attrib.get('type', '').startswith('image'):
            continue
        url = valid_url(node.attrib.get('url'))
        if url:
            return url
    return ''


def collect(source):
    name, feed, language = source
    request = Request(feed, headers={'User-Agent': 'F1-Apex/1.0 (+RSS headlines)', 'Accept': 'application/rss+xml, application/xml, text/xml'})
    try:
        with urlopen(request, timeout=20) as response:
            root = ET.fromstring(response.read(3_000_000))
    except Exception as error:  # сеть, XML — источник просто пропускаем
        print(f'{name}: недоступен ({type(error).__name__})')
        return []
    articles = []
    for item in root.findall('.//item')[:PER_SOURCE]:
        title = clean_text(item.findtext('title'))
        url = valid_url(item.findtext('link'))
        if not title or not url:
            continue
        try:
            published = parsedate_to_datetime(item.findtext('pubDate') or '').astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            continue
        articles.append({
            'title': title, 'url': url, 'source': name, 'language': language,
            'publishedAt': published, 'category': category(title), 'image': find_image(item),
        })
    print(f'{name}: {len(articles)} заголовков')
    return articles


def main():
    with ThreadPoolExecutor(max_workers=len(SOURCES)) as pool:
        batches = list(pool.map(collect, SOURCES))
    unique = {a['url']: a for batch in batches for a in batch}
    if not unique:
        if OUTPUT.exists():
            print('Все источники недоступны — оставляем прежнюю ленту.')
            return
        raise SystemExit('Нет ни одного доступного источника новостей.')
    newest = sorted(unique.values(), key=lambda a: a['publishedAt'], reverse=True)
    chosen = [a for a in newest if a['language'] == 'ru'][:RUSSIAN_LIMIT] + [a for a in newest if a['language'] == 'en'][:ENGLISH_LIMIT]
    chosen.sort(key=lambda a: a['publishedAt'], reverse=True)
    OUTPUT.parent.mkdir(exist_ok=True)
    payload = {'updatedAt': datetime.now(timezone.utc).isoformat(), 'articles': chosen}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Сохранено {len(chosen)} заголовков в {OUTPUT.relative_to(OUTPUT.parents[1])}')


if __name__ == '__main__':
    main()
