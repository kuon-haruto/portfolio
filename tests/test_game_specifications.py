import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "documents/specifications/specifications.json").read_text(encoding="utf-8"))


class GameSpecificationsTest(unittest.TestCase):
    def test_all_playable_games_have_specs_and_verified_team_sizes(self):
        teams = {
            "sliding-space-parking": 4, "v-link-battle": 8, "futago": 6,
            "bug-hunter": 1, "line-boundary": 4,
            "hanten-assassination": 4, "teruteru-wars": 4,
        }
        games = DATA["games"]
        self.assertEqual({g["id"]: g["team"] for g in games}, teams)
        self.assertEqual(len(games), len(teams))
        section = (ROOT / "src/sections/specifications.html").read_text(encoding="utf-8")
        for game in games:
            self.assertTrue((ROOT / "files" / game["pdf"]).is_file())
            self.assertTrue((ROOT / "files/game-icons" / game["icon"]).is_file())
            self.assertTrue((ROOT / "files/images" / game["image"]).is_file())
            self.assertIn(f'href="files/{game["pdf"]}"', section)
            self.assertEqual(section.count(f'href="files/{game["pdf"]}"'), 1)

    def test_change_history_explains_decisions_without_requiring_git(self):
        identifiers = set()
        for game in DATA["games"]:
            self.assertTrue(game["scope"])
            self.assertTrue(game["open"])
            self.assertTrue(game["sources"])
            self.assertNotIn("制作期間", json.dumps(game, ensure_ascii=False))
            for change in game["changes"]:
                self.assertNotIn(change["id"], identifiers)
                identifiers.add(change["id"])
                for key in ["title", "status", "before", "reason", "after", "impact", "evidence"]:
                    self.assertTrue(change[key].strip(), f'{game["id"]}: {key}')

    def test_pdfs_have_complete_pages_and_change_records(self):
        try:
            from pypdf import PdfReader
            import pdfplumber
        except ImportError:
            self.skipTest("Use the bundled Python runtime for PDF verification")
        for game in DATA["games"]:
            path = ROOT / "files" / game["pdf"]
            reader = PdfReader(path)
            self.assertEqual(len(reader.pages), 3)
            text = "\n".join(p.extract_text() for p in reader.pages)
            self.assertIn(f'制作人数 {game["team"]}人', text)
            self.assertNotIn("制作期間", text)
            self.assertIn("変更前", text)
            self.assertIn("背景・理由", text)
            self.assertIn("変更後", text)
            self.assertIn("影響範囲", text)
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    self.assertGreater(len(page.extract_text()), 350)
                    for char in page.chars:
                        self.assertGreaterEqual(char["x0"], 39, str(path))
                        self.assertLessEqual(char["x1"], page.width - 39, str(path))
                        self.assertGreaterEqual(char["top"], 25, str(path))
                        self.assertLessEqual(char["bottom"], page.height - 15, str(path))


if __name__ == "__main__":
    unittest.main()
