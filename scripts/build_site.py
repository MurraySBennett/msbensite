"""Build the public static site from the small, reviewed source allowlist."""

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import html
import json
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

from markdown_it import MarkdownIt


CORE_PAGES = ('index.html', 'research.html', 'cv.html', 'teaching.html',
              'tools.html', '404.html', 'project-detail.html')
SCRIPTS = ('components.js', 'dark-mode-toggle.js', 'cv.js', 'orcid-sync.js',
           'dpad.js', 'activate-pixel-chaser.js', 'activate-konami.js',
           'activate-snake.js', 'activate-pong.js', 'steal-the-doi.js')
FANTASY_FILES = ('index.html', 'methods.html', 'app.mjs', 'style.css',
                 'decision.mjs', 'scenarios.mjs', 'state.mjs', 'evaluation.mjs')
BASE_IMAGES = (
    'assets/images/murray_small.png',
    'assets/images/sprites/seeing-eye.gif',
    'assets/images/sprites/web-design-worker.gif',
    'assets/images/sprites/declaration-of-independence.gif',
    'assets/images/sprites/raincloud.gif',
    *(f'assets/images/button-icons/button-{name}.png' for name in ('up', 'down', 'left', 'right', 'a', 'b')),
)
DOMAIN = 'https://murraysbennett.com'
STATUS_LABELS = {'published': 'Published', 'under-review': 'Under Review',
                 'in-progress': 'In Progress'}
STATUS_CLASSES = {'published': 'status-published', 'under-review': 'status-review',
                  'in-progress': 'status-progress'}
LINK_LABELS = {'osf': 'OSF Project', 'interactive_demo': 'Open Tool',
               'publication': 'Read the Paper'}


def esc(value):
    return html.escape(str(value), quote=True)


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def copy_file(source, output, relative):
    src = source / relative
    if not src.is_file():
        raise FileNotFoundError(f'missing publish input: {relative}')
    dst = output / relative
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_reviewed_outcomes(source, output):
    """Only explicitly reviewed, hashed outcome files enter the site artifact."""
    selection = read_json(source / 'data/fantasy-outcomes-publish.json')
    if selection.get('schema_version') != 1 or not isinstance(selection.get('files'), list):
        raise ValueError('invalid outcome publish allowlist')
    files = selection['files']
    if not files:
        return
    if not selection.get('reviewed_at') or not selection.get('reviewer'):
        raise ValueError('outcome publish allowlist needs review attribution')
    forecasts = {}
    forecast_paths = selection.get('forecast_manifests')
    if not isinstance(forecast_paths, list) or not forecast_paths:
        raise ValueError('outcome publish allowlist needs approved forecast manifests')
    for entry in forecast_paths:
        path, digest = entry.get('path'), entry.get('sha256')
        if not isinstance(path, str) or not re.fullmatch(
                r'tools/fantasy-lineup/versions/[a-f0-9]{20}/manifest\.json', path) or\
                not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest) or\
                digest in forecasts:
            raise ValueError('invalid approved forecast manifest')
        content = (source / path).read_bytes()
        if sha256(content).hexdigest() != digest:
            raise ValueError('approved forecast manifest checksum mismatch')
        forecast = json.loads(content)
        if forecast.get('schema_version') != 1 or not isinstance(forecast.get('games'), dict):
            raise ValueError('invalid approved forecast manifest')
        forecasts[digest] = forecast
    allowed = re.compile(r'tools/fantasy-lineup/outcomes/(?:current\.json|versions/[a-f0-9]{20}/(?:manifest|week-\d{4}-(?:[1-9]|1[0-8]))\.json)\Z')
    hashes = {}
    for entry in files:
        path, digest = entry.get('path'), entry.get('sha256')
        if not isinstance(path, str) or not allowed.fullmatch(path) or path in hashes or\
                not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest):
            raise ValueError(f'invalid or duplicate reviewed outcome path: {path}')
        content = (source / path).read_bytes()
        if sha256(content).hexdigest() != digest:
            raise ValueError(f'reviewed outcome checksum mismatch: {path}')
        hashes[path] = digest
    prefix = 'tools/fantasy-lineup/outcomes/'
    pointer_path = prefix + 'current.json'
    if pointer_path not in hashes:
        raise ValueError('reviewed outcomes omit current pointer')
    pointer = read_json(source / pointer_path)
    manifest_path = prefix + pointer['manifest']
    if (pointer.get('schema_version') != 1 or manifest_path not in hashes or
            hashes[manifest_path] != pointer.get('manifest_sha256')):
        raise ValueError('reviewed outcomes omit or mismatch current manifest')
    manifest = read_json(source / manifest_path)
    if manifest.get('schema_version') != 1 or not isinstance(manifest.get('weeks'), dict):
        raise ValueError('invalid reviewed outcome manifest')
    for key, descriptor in manifest['weeks'].items():
        path = prefix + descriptor['path']
        if path not in hashes or hashes[path] != descriptor.get('sha256'):
            raise ValueError(f'reviewed outcomes omit or mismatch week: {path}')
        week = read_json(source / path)
        forecast_hash = week.get('forecast_manifest_sha256', '')
        public_source = week.get('source')
        source_fields = {'name', 'url', 'retrieved_at', 'licence', 'raw_sha256', 'status'}
        if (not isinstance(public_source, dict) or set(public_source) != source_fields or
                public_source['status'] != 'final' or
                not public_source['url'].startswith('https://') or
                not re.fullmatch(r'[a-f0-9]{64}', public_source['raw_sha256'])):
            raise ValueError(f'outcome week lacks public final-source evidence: {path}')
        if not re.fullmatch(
                r'[a-f0-9]{64}', forecast_hash):
            raise ValueError(f'unfinalized or unlinked outcome week: {path}')
        forecast = forecasts.get(forecast_hash)
        if not forecast:
            raise ValueError(f'outcome week has no approved forecast: {path}')
        observed_ids = set(week.get('players', {}))
        missing_ids = week.get('missing_player_ids', [])
        if not isinstance(missing_ids, list) or len(missing_ids) != len(set(missing_ids)) or\
                observed_ids & set(missing_ids):
            raise ValueError(f'contradictory missing outcome players: {path}')
        if (key != f'{week.get("season")}-{week.get("week")}:{forecast_hash}' or
                (forecast.get('season'), forecast.get('week')) !=
                (week.get('season'), week.get('week')) or
                set(forecast['games']) != observed_ids | set(missing_ids)):
            raise ValueError(f'outcome week differs from approved forecast pool: {path}')
    for path in hashes:
        copy_file(source, output, path)


def metadata(title, description, path):
    canonical = f'{DOMAIN}{path}'
    return (f'<meta name="description" content="{esc(description)}" />\n'
            f'<link rel="canonical" href="{esc(canonical)}" />\n'
            f'<meta property="og:type" content="website" />\n'
            f'<meta property="og:title" content="{esc(title)}" />\n'
            f'<meta property="og:description" content="{esc(description)}" />\n'
            f'<meta property="og:url" content="{esc(canonical)}" />')


def insert_metadata(page, title, description, path):
    if '<!-- site-metadata -->' not in page:
        raise ValueError(f'missing metadata marker: {path}')
    return page.replace('<!-- site-metadata -->', metadata(title, description, path))


def render_tile(meta):
    project_id = esc(meta['id'])
    status = meta['status']
    if status not in STATUS_LABELS:
        raise ValueError(f'invalid status: {status}')
    thumbnail = meta.get('thumbnail')
    image = (f'<img src="{esc(thumbnail)}" alt="{esc(meta.get("thumbnail_alt") or meta["title"])}" '
             'class="tile-thumbnail" loading="lazy" />') if thumbnail else '<div class="tile-thumbnail-placeholder"></div>'
    return (f'<a href="/projects/{project_id}.html" class="research-tile">{image}'
            f'<div class="tile-body"><div class="tile-header"><h3>{esc(meta["title"])}</h3>'
            f'<span class="status-badge {STATUS_CLASSES[status]}">{STATUS_LABELS[status]}</span></div>'
            f'<p>{esc(meta["summary"])}</p></div></a>')


def render_publications(meta, publications):
    related = [publications[pid] for pid in meta.get('publications', [])]
    if not related:
        return ''
    items = []
    for publication in related:
        year = 'In Press' if publication.get('status') == 'in-press' else publication.get('year') or 'n.d.'
        venue = publication.get('journal') or publication.get('venue') or publication.get('status') or ''
        if venue == 'under-review':
            venue = 'Under Review'
        doi = publication.get('doi') or ''
        link = f' <a href="https://doi.org/{esc(doi)}" class="doi-link">DOI</a>' if doi else ''
        items.append(f'<li class="pub-entry">{esc(publication["authors"])} '
                     f'(<strong>{esc(year)}</strong>). {esc(publication["title"])}. '
                     f'<em>{esc(venue)}</em>.{link}</li>')
    return '<section class="project-publications"><h2>Related Publications</h2><ul class="pub-list">' + ''.join(items) + '</ul></section>'


def render_project(template, meta, content, publications):
    project_id = meta['id']
    if not re.fullmatch(r'[a-z0-9-]+', project_id):
        raise ValueError(f'invalid project id: {project_id}')
    status = meta['status']
    if status not in STATUS_LABELS:
        raise ValueError(f'invalid status for {project_id}: {status}')
    markdown = MarkdownIt('commonmark', {'html': False})
    for token in markdown.parse(content):
        if token.type == 'link_open':
            href = token.attrGet('href') or ''
            if urlparse(href).scheme not in ('', 'http', 'https', 'mailto'):
                raise ValueError(f'unsafe Markdown link in {project_id}: {href}')
    body = markdown.render(content)
    image = (f'<img src="{esc(meta["thumbnail"])}" alt="{esc(meta.get("thumbnail_alt") or meta["title"])}" '
             'class="project-thumbnail" />') if meta.get('thumbnail') else ''
    links = []
    for key, label in LINK_LABELS.items():
        href = (meta.get('links') or {}).get(key)
        if href:
            parsed = urlparse(href)
            if parsed.scheme not in ('http', 'https'):
                raise ValueError(f'unsafe project link in {project_id}: {href}')
            links.append(f'<a href="{esc(href)}" class="button" target="_blank" rel="noopener noreferrer">{label}</a>')
    values = {
        'TITLE': esc(meta['title']), 'SUMMARY': esc(meta['summary']),
        'STATUS': esc(STATUS_LABELS[status]), 'STATUS_CLASS': STATUS_CLASSES[status],
        'TAGS': ''.join(f'<span class="tag">{esc(tag)}</span>' for tag in meta.get('tags', [])),
        'IMAGE': image, 'LINKS': ''.join(links), 'CONTENT': body,
        'PUBLICATIONS': render_publications(meta, publications),
    }
    page = template
    for key, value in values.items():
        page = page.replace('{{' + key + '}}', value)
    return insert_metadata(page, f'{meta["title"]} — Murray S. Bennett', meta['summary'],
                           f'/projects/{project_id}.html')


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value and not value.startswith('//'):
                parsed = urlparse(value)
                if not parsed.scheme and parsed.path:
                    self.references.append(parsed.path)


def validate(output):
    root = output.resolve()
    for page in output.rglob('*.html'):
        parser = LocalReferences()
        parser.feed(page.read_text(encoding='utf-8'))
        for reference in parser.references:
            target = (root / reference.lstrip('/')) if reference.startswith('/') else (page.parent / reference)
            target = target.resolve()
            if not target.is_relative_to(root) or not (target / 'index.html' if target.is_dir() else target).is_file():
                raise FileNotFoundError(f'{page.relative_to(output)} references missing {reference}')


def inline_components(output, source):
    nav = (source / 'components/nav.html').read_text(encoding='utf-8')
    footer = (source / 'components/footer.html').read_text(encoding='utf-8')
    footer = footer.replace('<span class="current-year"></span>',
                            f'<span class="current-year">{datetime.now(timezone.utc).year}</span>')
    pages = [output / name for name in CORE_PAGES if name not in ('404.html', 'project-detail.html')]
    pages += sorted((output / 'projects').glob('*.html'))
    pages += [output / 'tools/fantasy-lineup' / name for name in ('index.html', 'methods.html')]
    for path in pages:
        page = path.read_text(encoding='utf-8')
        match = re.search(r'<body data-page="([a-z-]+)"', page)
        if not match:
            raise ValueError(f'missing page navigation identity: {path.name}')
        active = match.group(1)
        page_nav = nav.replace(f'data-nav="{active}"', f'data-nav="{active}" class="active" aria-current="page"')
        if '<div id="nav-placeholder"></div>' not in page or '<div id="footer-placeholder"></div>' not in page:
            raise ValueError(f'missing shared component placeholder: {path.name}')
        page = page.replace('<div id="nav-placeholder"></div>', page_nav)
        page = page.replace('<div id="footer-placeholder"></div>', footer)
        path.write_text(page, encoding='utf-8')


def build(source: Path, output: Path):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == source or source.is_relative_to(output):
        raise ValueError(f'unsafe build output: {output} contains source {source}')
    if output.exists() and output != source / 'dist':
        raise ValueError(f'unsafe build output: existing nonstandard directory {output}')
    index = read_json(source / 'data/projects-index.json')
    if not index or len({item['id'] for item in index}) != len(index):
        raise ValueError('publish index must contain unique projects')
    publications_json = read_json(source / 'data/publications.json')
    publications = {item['id']: item for group in ('journal', 'under_review', 'conference', 'in_preparation')
                    for item in publications_json.get(group, [])}
    projects = []
    for item in index:
        project_id = item['id']
        if not re.fullmatch(r'[a-z0-9-]+', project_id):
            raise ValueError(f'invalid project id: {project_id}')
        folder = source / 'data/projects' / project_id
        if not (folder / 'meta.json').is_file() or not (folder / 'content.md').is_file():
            raise FileNotFoundError(f'missing project metadata or content: {project_id}')
        meta = read_json(folder / 'meta.json')
        content = (folder / 'content.md').read_text(encoding='utf-8')
        if meta['id'] != project_id or meta['category'] != item['category'] or meta['status'] != item['status']:
            raise ValueError(f'index/meta mismatch: {project_id}')
        for pid in meta.get('publications', []):
            if pid not in publications:
                raise ValueError(f'unknown publication {pid} in {project_id}')
        thumbnail = meta.get('thumbnail')
        if thumbnail and (not thumbnail.startswith('/assets/images/') or '..' in Path(thumbnail).parts):
            raise ValueError(f'invalid thumbnail path: {project_id}')
        projects.append((meta, content))

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    for name in CORE_PAGES:
        copy_file(source, output, name)
    for name in SCRIPTS:
        copy_file(source, output, f'js/{name}')
    for name in FANTASY_FILES:
        copy_file(source, output, f'tools/fantasy-lineup/{name}')
    copy_reviewed_outcomes(source, output)
    for name in ('css/style.css', 'data/publications.json', 'assets/documents/MurrayBennettCV.pdf',
                 'assets/audio/steal.mp3'):
        copy_file(source, output, name)
    for name in BASE_IMAGES:
        copy_file(source, output, name)
    for meta, _ in projects:
        if meta.get('thumbnail'):
            copy_file(source, output, meta['thumbnail'].lstrip('/'))

    page_info = {
        'index.html': ('Murray S. Bennett — Cognitive Psychologist', 'Research in cognitive psychology, computational modeling, perception, and human–AI collaboration.'),
        'research.html': ('Research — Murray S. Bennett', 'Published and ongoing research in decision science, human–AI collaboration, and perception.'),
        'cv.html': ('CV — Murray S. Bennett', 'Curriculum vitae, research experience, publications, teaching, and professional service.'),
        'teaching.html': ('Teaching — Murray S. Bennett', 'Teaching experience and approach in psychology, research methods, and quantitative modeling.'),
        'tools.html': ('Research Tools — Murray S. Bennett', 'Available research software, including GRIN for General Recognition Theory inference.'),
    }
    for name, (title, description) in page_info.items():
        page_path = output / name
        page_path.write_text(insert_metadata(page_path.read_text(encoding='utf-8'), title, description,
                                             '/' if name == 'index.html' else '/' + name), encoding='utf-8')
    for name, title, description in (
        ('index.html', 'Fantasy lineup pilot — Murray S. Bennett', 'Private preview of a dated NFL fantasy lineup decision tool.'),
        ('methods.html', 'Fantasy lineup methods and evidence — Murray S. Bennett', 'Methods, evidence status, privacy and limitations for the fantasy lineup pilot.'),
    ):
        path = output / 'tools/fantasy-lineup' / name
        canonical = '/tools/fantasy-lineup/' if name == 'index.html' else '/tools/fantasy-lineup/methods.html'
        path.write_text(insert_metadata(path.read_text(encoding='utf-8'), title, description, canonical), encoding='utf-8')

    legacy = output / 'project-detail.html'
    legacy_script = ('<script>const publishedProjects = new Set(' + json.dumps([item['id'] for item in index]) + ');'
                     'const id = new URLSearchParams(location.search).get("id");'
                     'if (publishedProjects.has(id)) location.replace("/projects/" + id + ".html");</script>')
    legacy.write_text(legacy.read_text(encoding='utf-8').replace('<!-- legacy-project-redirect -->', legacy_script), encoding='utf-8')

    research = output / 'research.html'
    text = research.read_text(encoding='utf-8')
    for category in {item['category'] for item in index}:
        tiles = ''.join(render_tile(meta) for meta, _ in projects if meta['category'] == category)
        pattern = re.compile(r'(<div class="research-grid" data-category="' + re.escape(category) + r'">).*?(</div>)', re.S)
        text, count = pattern.subn(lambda match: match.group(1) + tiles + match.group(2), text, count=1)
        if count != 1:
            raise ValueError(f'missing Research grid: {category}')
    research.write_text(text, encoding='utf-8')

    template = (source / 'templates/project.html').read_text(encoding='utf-8')
    for meta, content in projects:
        path = output / 'projects' / f'{meta["id"]}.html'
        path.parent.mkdir(exist_ok=True)
        path.write_text(render_project(template, meta, content, publications), encoding='utf-8')
    (output / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        ''.join(f'  <url><loc>{DOMAIN}{path}</loc></url>\n' for path in
                ['/', '/research.html', '/cv.html', '/teaching.html', '/tools.html'] +
                [f'/projects/{item["id"]}.html' for item in index]) + '</urlset>\n', encoding='utf-8')
    (output / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: ' + DOMAIN + '/sitemap.xml\n', encoding='utf-8')
    inline_components(output, source)
    validate(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('dist'))
    args = parser.parse_args()
    build(Path(__file__).resolve().parents[1], args.output)
    print(f'Built {args.output}')
