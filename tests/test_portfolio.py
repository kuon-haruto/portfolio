import re
import unittest
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.stack = []
        self.errors = []
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"Unexpected closing tag: {tag}")
        else:
            self.stack.pop()


class PortfolioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.document = Document(cls.html)

    def test_balanced_markup(self):
        self.assertEqual(self.document.errors, [])
        self.assertEqual(self.document.stack, [])

    def test_unique_ids_and_one_primary_heading(self):
        ids = Counter(attrs["id"] for _, attrs in self.document.elements if "id" in attrs)
        self.assertFalse([key for key, count in ids.items() if count > 1])
        self.assertEqual(sum(tag == "h1" for tag, _ in self.document.elements), 1)
        self.assertNotIn("title-screen", ids)

    def test_fragment_links_resolve(self):
        ids = {attrs["id"] for _, attrs in self.document.elements if "id" in attrs}
        for tag, attrs in self.document.elements:
            href = attrs.get("href", "")
            if tag == "a" and href.startswith("#"):
                with self.subTest(href=href):
                    self.assertIn(href[1:], ids)

    def test_local_media_and_styles_exist(self):
        for tag, attrs in self.document.elements:
            targets = [attrs.get("src"), attrs.get("poster")]
            if tag == "link" and attrs.get("rel") == "stylesheet":
                targets.append(attrs.get("href"))
            if tag == "a" and attrs.get("href", "").startswith("files/"):
                targets.append(attrs["href"])
            for target in filter(None, targets):
                if not target.startswith(("http:", "https:", "data:")):
                    with self.subTest(asset=target):
                        self.assertTrue((ROOT / target).is_file())

    def test_images_have_alternative_text_and_dimensions(self):
        for tag, attrs in self.document.elements:
            if tag == "img":
                with self.subTest(image=attrs.get("src")):
                    self.assertIn("alt", attrs)
                    self.assertGreater(int(attrs["width"]), 0)
                    self.assertGreater(int(attrs["height"]), 0)

    def test_generated_page_matches_sources(self):
        template = (ROOT / "src/template.html").read_text(encoding="utf-8")
        output = re.sub(
            r"<!--\s*include:(.+?)\s*-->",
            lambda match: (ROOT / "src" / match[1].strip()).read_text(
                encoding="utf-8"
            ).rstrip("\n"),
            template,
        )
        self.assertEqual(self.html.split("\n", 1)[1], output)

    def test_game_jam_story_and_individual_tool_experience(self):
        self.assertIn("自主的に3日間のゲームジャム", self.html)
        skills = (ROOT / "src/sections/skills.html").read_text(encoding="utf-8")
        self.assertIn("<span>Excel</span></span><small>2年</small>", skills)
        self.assertIn("<span>Googleスプレッドシート</span></span><small>2年</small>", skills)

    def test_browser_library_is_primary_action(self):
        for section in ("hero", "works"):
            source = (ROOT / f"src/sections/{section}.html").read_text(encoding="utf-8")
            links = [
                attrs for tag, attrs in Document(source).elements
                if tag == "a" and "browser-play-link" in attrs.get("class", "").split()
            ]
            with self.subTest(section=section):
                self.assertEqual(len(links), 1)
                self.assertEqual(links[0]["href"], "https://kuon-haruto.github.io/portfolio/play/")
                self.assertIn("Web版5作品", source)
                self.assertIn("PC", source)
                self.assertIn("ブラウザーでプレイ", source)

    def test_installer_is_still_available_as_an_alternative(self):
        links = [
            attrs for tag, attrs in self.document.elements
            if tag == "a" and "launcher-install-link" in attrs.get("class", "").split()
        ]
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0]["href"], (
            "https://github.com/kuon-haruto/portfolio/releases/download/"
            "launcher-v0.2.0/AppInstaller-Setup-0.2.0.exe"
        ))
        self.assertIn("アプリインストーラー", self.html)
        self.assertNotIn("Zenta Game Library", self.html)

    def test_download_descriptions_resolve(self):
        ids = {attrs["id"] for _, attrs in self.document.elements if "id" in attrs}
        for tag, attrs in self.document.elements:
            if tag == "a" and "launcher-download-link" in attrs.get("class", "").split():
                descriptions = attrs.get("aria-describedby", "").split()
                self.assertTrue(descriptions)
                for description in descriptions:
                    self.assertIn(description, ids)
        self.assertIn("未署名のアプリ", self.html)

    def test_five_games_have_direct_browser_links(self):
        self.assertNotIn("unityroom.com/games/", self.html)
        self.assertNotIn("プレイURL", self.html)
        links = [
            attrs["href"] for tag, attrs in self.document.elements
            if tag == "a" and "work-play-link" in attrs.get("class", "").split()
        ]
        self.assertEqual(set(links), {
            f"https://kuon-haruto.github.io/portfolio/play/{game}/" for game in
            ("line-boundary", "hanten-assassination", "teruteru-wars", "futago", "v-link-battle")
        })
        for file in ("index.html", "scripts/main.js", "scripts/profile-data.js"):
            with self.subTest(file=file):
                source = (ROOT / file).read_text(encoding="utf-8")
                self.assertNotIn("ゲームを遊ぶ", source)

    def test_gallery_contains_five_distinct_games_and_no_hero_screenshot(self):
        hero = (ROOT / "src/sections/hero.html").read_text(encoding="utf-8")
        document = Document(hero)
        links = [
            attrs["href"] for tag, attrs in document.elements
            if tag == "a" and attrs.get("class") == "game-icon-link"
        ]
        self.assertEqual(len(set(links)), 5)
        self.assertIn("#featured-works", links)
        self.assertIn("files/game-icons/v-link-battle.png", hero)
        self.assertNotIn("hero-scene", hero)
        self.assertNotIn("v-link-battle.jpg", hero)


if __name__ == "__main__":
    unittest.main()
