import re
import unittest
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
BOOKLET = ROOT / 'documents/portfolio/portfolio'
NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}


class PortfolioBookletTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pdf = PdfReader(BOOKLET.with_suffix('.pdf'))
        cls.text = [re.sub(r'\s+', '', page.extract_text()) for page in cls.pdf.pages]
        cls.page_numbers = {page.indirect_reference.idnum: i
                            for i, page in enumerate(cls.pdf.pages)}

    def test_pages_and_contents_destinations(self):
        self.assertEqual(len(self.pdf.pages), 22)
        self.assertEqual(len(self.pdf.outline), 22)
        for i, item in enumerate(self.pdf.outline):
            self.assertEqual(self.pdf.get_destination_page_number(item), i)
            self.assertGreater(len(self.text[i]), 40)
            self.assertNotIn('\ufffd', self.text[i])
        targets = [self.page_numbers[ref.get_object()['/Dest'][0].idnum]
                   for ref in self.pdf.pages[1]['/Annots']]
        self.assertEqual(targets, [2, 3, 6, 10, 17, 19, 20])

    def test_team_sizes_and_honest_responsibility(self):
        for page, count in [(7, 8), (11, 6), (13, 4), (15, 5), (16, 1)]:
            self.assertIn(f'制作人数：{count}人', self.text[page - 1])
        self.assertIn('制作人数：4人', self.text[3])
        for index in (3, 6):
            self.assertLess(self.text[index].index('私の担当'), self.text[index].index('制作人数'))
        self.assertIn('制作人数：各4人', self.text[13])
        self.assertIn('プログラムは自作ではなく、AIによる実装支援を利用。', self.text[15])
        self.assertIn('改善前後の比較は今後の課題。', self.text[15])
        self.assertIn('制作人数：7人', self.text[16])
        self.assertIn('未公開', self.text[16])
        self.assertIn('実際のプレイ画面ではありません。', self.text[18])
        self.assertNotRegex(''.join(self.text), r'制作期間|3日間|三日間')

    def test_links_and_local_published_targets(self):
        annotations = [ref.get_object() for page in self.pdf.pages
                       for ref in page.get('/Annots', [])]
        self.assertGreater(len(annotations), 1)
        urls = {str(a['/A']['/URI']) for a in annotations
                if a.get('/A', {}).get('/S') == '/URI'}
        self.assertEqual(urls, {'https://kuon-haruto.github.io/portfolio/', 'https://kuon-haruto.github.io/portfolio/#proposals'})
        for url in urls:
            parsed = urlsplit(url)
            if parsed.netloc == 'kuon-haruto.github.io':
                relative = unquote(parsed.path).removeprefix('/portfolio/')
                self.assertTrue((ROOT / relative).exists(), url)
        for annotation in annotations:
            if '/Dest' in annotation:
                self.assertIn(annotation['/Dest'][0].idnum, self.page_numbers)

    def test_powerpoint_is_editable_and_keeps_native_skills_table(self):
        with zipfile.ZipFile(BOOKLET.with_suffix('.pptx')) as archive:
            slides = [p for p in archive.namelist()
                      if re.fullmatch(r'ppt/slides/slide\d+\.xml', p)]
            self.assertEqual(len(slides), 22)
            for name in slides:
                xml = ET.fromstring(archive.read(name))
                self.assertGreaterEqual(len(xml.findall('.//a:t', NS)), 3)
            skills = ET.fromstring(archive.read('ppt/slides/slide20.xml'))
            self.assertEqual(len(skills.findall('.//a:tbl', NS)), 1)
            self.assertEqual(len(skills.findall('.//a:tbl/a:tr', NS)), 9)

    def test_evidence_and_implementation_are_distinguished(self):
        self.assertIn('ゲーム内の宇宙船素材', self.text[5])
        self.assertIn('タッチ操作の実装・テストはチームの開発内容', self.text[5])
        self.assertIn('画像・音には生成ツールも使用', self.text[5])
        self.assertIn('作品索引', self.text[20])
        self.assertNotIn('次のページへ', ''.join(self.text))
        self.assertIn('公開版での実装を示すものではありません', self.text[7])
        self.assertIn('企画上の判断', self.text[7])
        self.assertIn('現行コードもDamage/Buffの2種。', self.text[11])
        self.assertIn('QA記録', self.text[15])
        self.assertIn('PolyHavenのCC0', self.text[15])

    def test_print_pages_are_a4_landscape_and_links_have_dark_ink(self):
        for page in self.pdf.pages:
            self.assertAlmostEqual(float(page.mediabox.width) * 25.4 / 72, 297, places=2)
            self.assertAlmostEqual(float(page.mediabox.height) * 25.4 / 72, 210, places=2)
        with zipfile.ZipFile(BOOKLET.with_suffix('.pptx')) as archive:
            for number in [22]:
                xml = ET.fromstring(archive.read(f'ppt/slides/slide{number}.xml'))
                linked_runs = [run for run in xml.findall('.//a:r', NS)
                               if run.find('a:rPr/a:hlinkClick', NS) is not None]
                self.assertTrue(linked_runs)
                for run in linked_runs:
                    color = run.find('a:rPr/a:solidFill/a:srgbClr', NS)
                    self.assertIsNotNone(color)
                    self.assertEqual(color.get('val'), '225DAD')

    def test_editable_text_is_retained_in_pdf(self):
        with zipfile.ZipFile(BOOKLET.with_suffix('.pptx')) as archive:
            for number in range(1, 23):
                xml = ET.fromstring(archive.read(f'ppt/slides/slide{number}.xml'))
                for node in xml.findall('.//a:t', NS):
                    content = re.sub(r'\s+', '', node.text or '')
                    self.assertIn(content, self.text[number - 1], f'Page {number}: {content}')


if __name__ == '__main__':
    unittest.main()
