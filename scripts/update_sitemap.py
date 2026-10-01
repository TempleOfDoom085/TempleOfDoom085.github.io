#!/usr/bin/env python3
"""Set every <lastmod> in sitemap.xml to the date its page last changed.

Uses the page's last git commit, or today if it has uncommitted edits, so run
it right before committing page changes:

    python3 scripts/update_sitemap.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_site import ROOT, last_changed, loc_to_path  # noqa: E402

SITEMAP = os.path.join(ROOT, 'sitemap.xml')


def main():
    with open(SITEMAP, encoding='utf-8') as f:
        xml = f.read()

    updated = 0

    def fix(m):
        nonlocal updated
        block = m.group(0)
        loc = re.search(r'<loc>\s*([^<\s]+)\s*</loc>', block)
        path = loc_to_path(loc.group(1)) if loc else None
        if not path or not os.path.isfile(os.path.join(ROOT, path)):
            return block
        date = last_changed(path)
        if not date:
            return block
        new = re.sub(r'<lastmod>[^<]*</lastmod>', f'<lastmod>{date.isoformat()}</lastmod>', block)
        if new != block:
            updated += 1
        return new

    xml = re.sub(r'<url>.*?</url>', fix, xml, flags=re.S)
    with open(SITEMAP, 'w', encoding='utf-8') as f:
        f.write(xml)
    print(f'Updated {updated} <lastmod> entr{"y" if updated == 1 else "ies"}.')


if __name__ == '__main__':
    main()
