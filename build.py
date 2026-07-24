#!/usr/bin/env python3
"""src/ 配下の template.html と sections/*.html を結合して index.html を生成する。

使い方:
  python build.py          # 1回だけビルド
  python build.py --watch  # src/ の変更を監視して自動ビルド
"""
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
TEMPLATE = SRC / 'template.html'
OUTPUT = ROOT / 'index.html'

INCLUDE_RE = re.compile(r'<!--\s*include:(.+?)\s*-->')

GENERATED_NOTICE = (
    '<!-- このファイルは自動生成されます。直接編集せず src/ 配下を編集して '
    'python build.py を実行してください。 -->\n'
)


def build():
    template = TEMPLATE.read_text(encoding='utf-8')

    def replace(match):
        rel_path = match.group(1).strip()
        part_path = SRC / rel_path
        return part_path.read_text(encoding='utf-8').rstrip('\n')

    output = INCLUDE_RE.sub(replace, template)
    OUTPUT.write_text(GENERATED_NOTICE + output, encoding='utf-8')
    print(f'built {OUTPUT.relative_to(ROOT)}')


def watch():
    build()
    mtimes = {}

    def snapshot():
        files = [TEMPLATE, *SRC.rglob('*.html')]
        return {f: f.stat().st_mtime for f in files}

    mtimes = snapshot()
    print('watching src/ for changes... (Ctrl+C で終了)')
    try:
        while True:
            time.sleep(0.5)
            current = snapshot()
            if current != mtimes:
                mtimes = current
                build()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    if '--watch' in sys.argv:
        watch()
    else:
        build()
