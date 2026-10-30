import json
import re
import unittest
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


class GameProposalsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.decks = json.loads((ROOT / "documents/proposals/manifest.json").read_text(encoding="utf-8"))

    def test_three_missing_proposals_have_editable_six_page_decks(self):
        self.assertEqual({d["id"] for d in self.decks}, {"v-link-battle", "sliding-space-parking", "sanshoku-bunki"})
        for deck in self.decks:
            with self.subTest(deck=deck["id"]), zipfile.ZipFile(ROOT / deck["pptx"]) as archive:
                slides = [name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)]
                self.assertEqual(len(slides), 6)
                for name in slides:
                    xml = ET.fromstring(archive.read(name))
                    self.assertGreater(len(xml.findall(".//a:t", NS)), 4, "Pages must retain editable text")
                images = [name for name in archive.namelist() if name.startswith("ppt/media/")]
                self.assertGreaterEqual(len(images), 4)

    def test_pdf_page_count_text_team_and_clickable_destinations(self):
        teams = {"v-link-battle": 8, "sliding-space-parking": 4, "sanshoku-bunki": 5}
        for deck in self.decks:
            with self.subTest(deck=deck["id"]):
                pdf = PdfReader(ROOT / deck["pdf"])
                self.assertEqual(len(pdf.pages), deck["pages"])
                all_text = "".join(p.extract_text() for p in pdf.pages)
                compact = re.sub(r"\s+", "", all_text)
                self.assertIn(f'制作人数：{teams[deck["id"]]}人', compact)
                self.assertNotRegex(compact, r"制作期間|3日間|三日間|プロトタイプ|試作")
                for i, page in enumerate(pdf.pages):
                    self.assertGreater(len(page.extract_text().strip()), 40)
                    self.assertAlmostEqual(float(page.mediabox.width) / float(page.mediabox.height), 16 / 9)
                    self.assertIn(re.sub(r"\s+", "", deck["titles"][i]), re.sub(r"\s+", "", page.extract_text()))
                urls = {str(ref.get_object()["/A"]["/URI"]) for page in pdf.pages for ref in page.get("/Annots", []) if ref.get_object().get("/A", {}).get("/S") == "/URI"}
                self.assertEqual(urls, {item["url"] for item in deck["links"]})
                if deck["id"] == "v-link-battle":
                    self.assertIn("企画上の構想", compact)
                    self.assertIn("無効", compact)

    def test_published_links_use_canonical_paths(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        for deck in self.decks:
            self.assertIn(f'href="{deck["pdf"]}"', html)
            self.assertIn(f'href="{deck["pptx"]}"', html)
        for stem in ["line-boundary_proposal", "hantenansatsu_proposal", "teruteruwars_proposal", "futago_proposal", "mushi-shooting"]:
            self.assertIn(f'href="files/{stem}.pdf"', html)
            self.assertTrue((ROOT / "files" / f"{stem}.pdf").is_file())


if __name__ == "__main__":
    unittest.main()
