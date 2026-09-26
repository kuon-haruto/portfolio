import hashlib
import json
import unittest
from pathlib import Path

from test_portfolio import Document


ROOT = Path(__file__).resolve().parents[1]
PLAY = ROOT / "play"


class WebGameTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.games = json.loads((PLAY / "games.json").read_text(encoding="utf-8"))["games"]

    def test_five_pinned_games(self):
        sources = json.loads((ROOT / "launcher/data/game-sources.json").read_text(encoding="utf-8"))["games"]
        self.assertEqual(len(self.games), 5)
        self.assertEqual({g["id"]: g["sourceCommit"] for g in self.games},
                         {g["id"]: g["commit"] for g in sources})
        self.assertTrue((ROOT / ".nojekyll").is_file())
        for game in self.games:
            if game["id"] in ("teruteru-wars", "futago", "v-link-battle"):
                self.assertGreater(game["build"].get("simplifiedEffects", 0), 0)
            if game["id"] == "v-link-battle":
                self.assertIn("ウィンドウ", game["browserNotice"])
                self.assertEqual(game["icon"], "../files/game-icons/v-link-battle.png")

    def test_build_integrity_and_github_file_limits(self):
        for game in self.games:
            with self.subTest(game=game["id"]):
                folder = (PLAY / game["build"]["loaderUrl"]).parent
                self.assertEqual({file.name for file in folder.iterdir()}, {file["file"] for file in game["integrity"]})
                self.assertEqual(game["downloadBytes"], sum(f["bytes"] for f in game["integrity"]))
                for asset in game["integrity"]:
                    data = (folder / asset["file"]).read_bytes()
                    self.assertEqual(len(data), asset["bytes"])
                    self.assertLess(len(data), 100 * 1024 ** 2)
                    self.assertEqual(hashlib.sha256(data).hexdigest(), asset["sha256"])
                for key in ("dataUrl", "frameworkUrl", "codeUrl"):
                    if key == "dataUrl" and game["build"].get("dataParts"):
                        parts = game["build"]["dataParts"]
                        self.assertEqual(len({part["url"] for part in parts}), len(parts))
                        self.assertGreater(len(parts), 1)
                        for part in parts:
                            data = (PLAY / part["url"]).read_bytes()
                            self.assertEqual(len(data), part["bytes"])
                            self.assertEqual(hashlib.sha256(data).hexdigest(), part["sha256"])
                        data = (PLAY / parts[0]["url"]).read_bytes()
                    else:
                        data = (PLAY / game["build"][key]).read_bytes()
                    self.assertEqual(data[:2], b"\x1f\x8b")
                self.assertTrue((PLAY / game["icon"]).is_file())

    def test_pages_match_template_and_local_assets(self):
        template = (ROOT / "tools/web-player.html").read_text(encoding="utf-8")
        for game in [{"id": "", "title": "ゲームライブラリ"}] + self.games:
            with self.subTest(game=game["id"]):
                folder = PLAY / game["id"]
                html = (folder / "index.html").read_text(encoding="utf-8")
                escaped = game["title"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")
                expected = template.replace("{{PREFIX}}", "../" if game["id"] else "./").replace("{{GAME_ID}}", game["id"]).replace("{{TITLE}}", escaped)
                self.assertEqual(html, expected)
                document = Document(html)
                self.assertEqual(document.errors, [])
                self.assertEqual(document.stack, [])
                for tag, attrs in document.elements:
                    target = attrs.get("src") or (attrs.get("href") if tag == "link" else None)
                    if target and not target.startswith(("http:", "https:")):
                        self.assertTrue((folder / target).is_file(), target)
                self.assertIn(f'data-game="{game["id"]}"', html)


if __name__ == "__main__":
    unittest.main()
