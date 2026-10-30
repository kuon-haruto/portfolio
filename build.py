#!/usr/bin/env python3
"""src/ のテンプレート・セクション・企画データから公開HTMLを生成する。

使い方:
  python build.py          # 1回だけビルド
  python build.py --watch  # src/ の変更を監視して自動ビルド
"""
import re
import json
from html import escape
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


def render_ideas():
    records = json.loads((SRC / 'idea-catalog.json').read_text(encoding='utf-8'))
    stages = {
        'idea': ('構想中', 'ゲーム本体は未制作です。'),
        'unknown': ('実装状況は未確認', '企画資料をもとに掲載しています。現在の実装状況は未確認です。'),
        'validation': ('検証中', ''),
        'developing': ('制作中', ''),
        'implemented': ('制作へ進んだ企画', ''),
    }
    records.sort(key=lambda record: list(stages).index(record['stage']))
    cards = []
    for record in records:
        stage, note = stages[record['stage']]
        e = lambda key: escape(record[key], quote=True)
        image = ''
        if record['image']:
            image = f'''<figure class="idea-art">
          <a href="files/idea-images/{e('id')}.webp" target="_blank" rel="noopener" aria-label="{e('title')}の画面イメージ案を拡大（別タブ）"><img src="files/idea-images/{e('id')}.webp" alt="{e('title')}の画面イメージ案" width="960" height="640" loading="lazy" decoding="async" /></a>
          <figcaption>画面イメージ案 / AI生成・実装画面ではありません</figcaption>
        </figure>'''
        rows = ''.join(f'<div><dt>{label}</dt><dd>{e(key)}</dd></div>' for key, label in (
            ('intent', '面白さの狙い'), ('scene', '考えている一場面'),
            ('questions', '検討中の点'), ('next', '確かめたいこと'),
        ))
        state_note = escape(record.get('stateNote', note))
        cards.append(f'''      <article class="idea-card" id="idea-{e('id')}" data-stage="{e('stage')}" aria-labelledby="title-{e('id')}">
        {image}
        <div class="idea-card-body">
          <p class="idea-meta"><span class="idea-stage">{stage}</span><span>{e('genre')}</span></p>
          <h3 id="title-{e('id')}">{e('title')}</h3>
          <p class="idea-hook">{e('hook')}</p>
          <p class="idea-core">{e('core')}</p>
          <details class="idea-note"><summary>企画の中身を見る<span class="visually-hidden">：{e('title')}</span></summary>
            <div class="idea-content"><dl>{rows}</dl><p class="idea-state-note">{state_note}</p><a class="idea-permalink" href="#idea-{e('id')}">この企画へのリンク</a></div>
          </details>
        </div>
      </article>''')
    template = (SRC / 'ideas-template.html').read_text(encoding='utf-8')
    return template.replace('<!-- idea-catalog -->', '\n'.join(cards)).replace('<!-- idea-count -->', f'{len(records)}件')


def build():
    template = TEMPLATE.read_text(encoding='utf-8')

    def replace(match):
        rel_path = match.group(1).strip()
        part_path = SRC / rel_path
        return part_path.read_text(encoding='utf-8').rstrip('\n')

    output = INCLUDE_RE.sub(replace, template)
    OUTPUT.write_text(GENERATED_NOTICE + output, encoding='utf-8')
    print(f'built {OUTPUT.relative_to(ROOT)}')
    (ROOT / 'ideas.html').write_text(GENERATED_NOTICE + render_ideas(), encoding='utf-8')
    print('built ideas.html')


def watch():
    build()
    mtimes = {}

    def snapshot():
        files = [*SRC.rglob('*.html'), SRC / 'idea-catalog.json']
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
