import json
import sys
import unittest
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

from test_portfolio import Document

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from build import GENERATED_NOTICE, render_ideas


class IdeaCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / 'ideas.html').read_text(encoding='utf-8')
        cls.document = Document(cls.source)
        cls.records = json.loads((ROOT / 'src/idea-catalog.json').read_text(encoding='utf-8'))

    def test_generated_markup_and_ids(self):
        self.assertEqual(self.source, GENERATED_NOTICE + render_ideas())
        self.assertEqual(self.document.errors, [])
        self.assertEqual(self.document.stack, [])
        ids = [attrs['id'] for _, attrs in self.document.elements if 'id' in attrs]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(sum(tag == 'h1' for tag, _ in self.document.elements), 1)

    def test_local_links_and_images_resolve(self):
        ids = {attrs['id'] for _, attrs in self.document.elements if 'id' in attrs}
        for tag, attrs in self.document.elements:
            for attribute in ('href', 'src'):
                url = attrs.get(attribute)
                if not url:
                    continue
                target = urlsplit(url)
                self.assertEqual(target.scheme, '', url)
                if target.path:
                    self.assertTrue((ROOT / target.path).is_file(), url)
                elif target.fragment:
                    self.assertIn(target.fragment, ids)
            if tag == 'img':
                self.assertIn('イメージ案', attrs['alt'])
                self.assertGreater(int(attrs['width']), 0)
                self.assertGreater(int(attrs['height']), 0)

    def test_complete_catalog_and_truthful_states(self):
        self.assertEqual(len(self.records), 24)
        self.assertEqual(len({r['id'] for r in self.records}), 24)
        self.assertEqual(Counter(r['stage'] for r in self.records), {
            'idea': 13, 'unknown': 3, 'validation': 3, 'developing': 4, 'implemented': 1,
        })
        for record in self.records:
            for key in ('core', 'intent', 'scene', 'questions', 'next'):
                self.assertGreater(len(record[key]), 20)
            if record['stage'] in ('validation', 'developing', 'implemented'):
                self.assertTrue(record['stateNote'])
        titles = {r['title'] for r in self.records}
        self.assertTrue({'閉店確認', '戸締まりが大事', '巨獣と旅する家', '冒険者ショップ'} <= titles)
        self.assertFalse({'一発調色', 'ドアをつくる鬼ごっこ'} & titles)
        self.assertNotRegex(self.source, r'codex:|D:/|元チャット|制作期間')

    def test_images_stay_lightweight(self):
        images = list((ROOT / 'files/idea-images').glob('*.webp'))
        self.assertEqual(len(images), 19)
        self.assertLess(sum(image.stat().st_size for image in images), 3 * 1024 * 1024)


if __name__ == '__main__':
    unittest.main()
