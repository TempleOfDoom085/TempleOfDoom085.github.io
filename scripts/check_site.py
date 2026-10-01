#!/usr/bin/env python3
"""Static checks for the site. Standard library only, so it runs anywhere.

    python3 scripts/check_site.py                  # all checks
    python3 scripts/check_site.py --base origin/main   # also check the SW cache bump

Checks:
  links     every local href/src in an HTML page points at a file that exists
  sw        every PRECACHE_URLS entry in sw.js exists (one 404 breaks the SW install)
  sw-bump   with --base: if a precached file changed, CACHE_VERSION changed too
  sitemap   every public page is listed, every listed page exists, and each
            <lastmod> is not older than the page's last change in git
  pages     every page has <html lang>, <title>, a meta description and a CSP
"""
import argparse
import datetime
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://templeofdoom085.github.io'
# Pages that exist on purpose but shouldn't be in the sitemap.
SITEMAP_EXCLUDE = {'404.html'}
SKIP_DIRS = {'.git', 'node_modules', 'vendor', 'docs', 'scripts', '.github'}

errors = []


def err(check, msg):
    errors.append(f'[{check}] {msg}')


def html_pages():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.'))
        for f in sorted(filenames):
            if f.endswith('.html'):
                yield os.path.relpath(os.path.join(dirpath, f), ROOT).replace(os.sep, '/')


def resolve(page, url):
    """Map a URL found in `page` to a repo path, or None if it isn't a local file ref."""
    if not url or url.startswith(('#', 'mailto:', 'tel:', 'data:', 'javascript:', 'blob:', '//')):
        return None
    if '${' in url or '{{' in url or "'" in url or '+' in url:
        return None  # built at runtime
    parts = urlsplit(url)
    if parts.scheme or parts.netloc:
        if parts.netloc == SITE.split('//')[1]:
            path = parts.path
        else:
            return None
    else:
        path = parts.path
    if not path:
        return None
    path = unquote(path)
    if path.startswith('/'):
        rel = path.lstrip('/')
    else:
        rel = os.path.normpath(os.path.join(os.path.dirname(page), path)).replace(os.sep, '/')
    if rel in ('', '.') or rel.endswith('/'):
        rel = (rel.rstrip('/') + '/index.html').lstrip('/')
    return rel


class Collector(HTMLParser):
    ATTRS = {'href', 'src', 'poster'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.lang = None
        self.has_title = False
        self.metas = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'html':
            self.lang = a.get('lang')
        if tag == 'title':
            self.has_title = True
        if tag == 'meta':
            key = (a.get('name') or a.get('http-equiv') or a.get('property') or '').lower()
            if key:
                self.metas[key] = a.get('content') or ''
        # <link rel=preconnect/dns-prefetch> point at origins, not files.
        if tag == 'link' and (a.get('rel') or '').lower() in ('preconnect', 'dns-prefetch'):
            return
        for k in self.ATTRS:
            if a.get(k):
                self.refs.append((self.getpos()[0], a[k].strip()))


def check_pages():
    for page in html_pages():
        with open(os.path.join(ROOT, page), encoding='utf-8') as f:
            src = f.read()
        c = Collector()
        c.feed(src)
        for line, url in c.refs:
            rel = resolve(page, url)
            if rel and not os.path.isfile(os.path.join(ROOT, rel)):
                err('links', f'{page}:{line} -> {url} (no file {rel})')
        if not c.lang:
            err('pages', f'{page}: <html> has no lang attribute')
        if not c.has_title:
            err('pages', f'{page}: missing <title>')
        if not c.metas.get('description'):
            err('pages', f'{page}: missing meta description')
        if 'content-security-policy' not in c.metas:
            err('pages', f'{page}: missing Content-Security-Policy meta')


def precache_urls(sw_src):
    m = re.search(r'PRECACHE_URLS\s*=\s*\[(.*?)\];', sw_src, re.S)
    if not m:
        return None
    body = re.sub(r'//[^\n]*', '', m.group(1))
    return re.findall(r"['\"]([^'\"]+)['\"]", body)


def precache_path(url):
    return 'index.html' if url == '/' else url.lstrip('/')


def cache_version(sw_src):
    m = re.search(r"CACHE_VERSION\s*=\s*['\"]([^'\"]+)['\"]", sw_src)
    return m.group(1) if m else None


def check_sw():
    with open(os.path.join(ROOT, 'sw.js'), encoding='utf-8') as f:
        sw = f.read()
    urls = precache_urls(sw)
    if urls is None:
        err('sw', 'could not find PRECACHE_URLS in sw.js')
        return
    seen = set()
    for u in urls:
        if u in seen:
            err('sw', f'duplicate precache entry {u}')
        seen.add(u)
        if not os.path.isfile(os.path.join(ROOT, precache_path(u))):
            err('sw', f'precache entry {u} does not exist (cache.addAll would reject the install)')


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def check_sw_bump(base):
    try:
        merge_base = git('merge-base', base, 'HEAD').strip()
        old_sw = git('show', f'{merge_base}:sw.js')
    except subprocess.CalledProcessError as e:
        err('sw-bump', f'could not compare against {base}: {e.stderr.strip()}')
        return
    with open(os.path.join(ROOT, 'sw.js'), encoding='utf-8') as f:
        new_sw = f.read()
    if cache_version(old_sw) != cache_version(new_sw):
        return
    changed = set(git('diff', '--name-only', merge_base, '--').split())
    # Uncommitted edits count too when running locally.
    changed |= set(git('diff', '--name-only', 'HEAD', '--').split())
    cached = {precache_path(u) for u in (precache_urls(new_sw) or [])}
    hit = sorted(changed & cached)
    list_changed = precache_urls(old_sw) != precache_urls(new_sw)
    if hit or list_changed:
        why = ', '.join(hit[:8]) + (' …' if len(hit) > 8 else '') if hit else 'the PRECACHE_URLS list'
        err('sw-bump', f"CACHE_VERSION is still '{cache_version(new_sw)}' but {why} changed; "
                       'bump it in sw.js so returning visitors get the new files')


def last_changed(path):
    """Date the file last changed: today if it has uncommitted edits, else its last commit."""
    if git('status', '--porcelain', '--', path).strip():
        return datetime.date.today()
    out = git('log', '-1', '--format=%as', '--', path).strip()
    return datetime.date.fromisoformat(out) if out else None


def sitemap_entries():
    with open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8') as f:
        xml = f.read()
    for block in re.findall(r'<url>(.*?)</url>', xml, re.S):
        loc = re.search(r'<loc>\s*([^<\s]+)\s*</loc>', block)
        mod = re.search(r'<lastmod>\s*([^<\s]+)\s*</lastmod>', block)
        if loc:
            yield loc.group(1), (mod.group(1) if mod else None)


def loc_to_path(loc):
    path = loc[len(SITE):].lstrip('/') if loc.startswith(SITE) else None
    if path is None:
        return None
    return path + 'index.html' if path == '' or path.endswith('/') else path


def check_sitemap():
    listed = {}
    for loc, mod in sitemap_entries():
        path = loc_to_path(loc)
        if path is None:
            err('sitemap', f'{loc} is not on {SITE}')
            continue
        if not os.path.isfile(os.path.join(ROOT, path)):
            err('sitemap', f'{loc} has no file {path}')
            continue
        listed[path] = mod
        changed = last_changed(path)
        if not mod:
            err('sitemap', f'{loc} has no <lastmod>')
        elif changed and datetime.date.fromisoformat(mod) < changed:
            err('sitemap', f'{loc} lastmod {mod} is older than its last change {changed}; '
                           'run python3 scripts/update_sitemap.py')
    for page in html_pages():
        if page not in listed and page not in SITEMAP_EXCLUDE:
            err('sitemap', f'{page} is not in sitemap.xml')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--base', help='git ref to compare against for the sw-bump check (e.g. origin/main)')
    args = ap.parse_args()

    check_pages()
    check_sw()
    if args.base:
        check_sw_bump(args.base)
    check_sitemap()

    if errors:
        print(f'{len(errors)} problem(s):')
        for e in errors:
            print('  ' + e)
        sys.exit(1)
    print('All site checks passed.')


if __name__ == '__main__':
    main()
