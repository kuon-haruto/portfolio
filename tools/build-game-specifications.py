"""Build the canonical game specifications; reject overflowing pages before publishing."""

import argparse
import json
import shutil
import subprocess
from html import escape
from pathlib import Path

from PIL import Image, ImageOps
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "documents/specifications/specifications.json"
OUTPUT = ROOT / "launcher/test-output/specifications"
W, H = A4
MARGIN = 40
WIDTH = W - MARGIN * 2
INK = colors.HexColor("#202D36")
MUTED = colors.HexColor("#52636C")
TEAL = colors.HexColor("#087E83")
LINE = colors.HexColor("#CCDADE")


def register_fonts():
    pdfmetrics.registerFont(TTFont("Meiryo", "C:/Windows/Fonts/meiryo.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("MeiryoBold", "C:/Windows/Fonts/meiryob.ttc", subfontIndex=0))
    pdfmetrics.registerFontFamily("Meiryo", normal="Meiryo", bold="MeiryoBold")


def para(text, size=10.2, bold=False, color=INK):
    return Paragraph(escape(text), ParagraphStyle(
        "text", fontName="MeiryoBold" if bold else "Meiryo",
        fontSize=size, leading=size * 1.48, textColor=color,
        wordWrap="CJK", alignment=TA_LEFT, splitLongWords=True,
    ))


class Page:
    def __init__(self, pdf, game, number, heading, reviewed):
        self.pdf = pdf
        self.game = game
        self.number = number
        self.y = H - 40
        pdf.setFillColor(TEAL)
        pdf.rect(0, H - 9, W, 9, fill=1, stroke=0)
        self.text("ゲーム仕様書  /  " + game["title"], size=10, color=MUTED, gap=8)
        self.text(heading, size=22, bold=True, gap=12)
        pdf.setStrokeColor(LINE)
        pdf.line(MARGIN, self.y, W - MARGIN, self.y)
        self.y -= 13
        pdf.setFont("Meiryo", 8)
        pdf.setFillColor(MUTED)
        pdf.drawString(MARGIN, 28, f"資料確認日 {reviewed}  |  制作人数 {game['team']}人")
        pdf.drawRightString(W - MARGIN, 28, f"{number} / 3")

    def room(self, height):
        if self.y - height < 53:
            raise ValueError(f"Page overflow: {self.game['id']} p{self.number} ({height:.1f}pt at {self.y:.1f})")

    def text(self, text, size=10.2, bold=False, color=INK, gap=6):
        block = para(text, size, bold, color)
        # Reserve room for Japanese hanging punctuation at the right edge.
        _, height = block.wrap(WIDTH - 10, H)
        self.room(height)
        block.drawOn(self.pdf, MARGIN, self.y - height)
        self.y -= height + gap

    def heading(self, text):
        self.text(text, size=12, bold=True, color=TEAL, gap=7)

    def table(self, rows, label_width=118, size=10.0):
        blocks = [[para(a, size, True), para(b, size)] for a, b in rows]
        table = Table(blocks, colWidths=[label_width, WIDTH - label_width])
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EDF4F4")),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        _, height = table.wrap(WIDTH, H)
        self.room(height)
        table.drawOn(self.pdf, MARGIN, self.y - height)
        self.y -= height + 12

    def overview(self):
        game = self.game
        image_path = ROOT / "files/images" / game["image"]
        icon_path = ROOT / "files/game-icons" / game["icon"]
        iw, ih = Image.open(image_path).size
        image_w = 222
        image_h = min(132, image_w * ih / iw)
        image_w = image_h * iw / ih
        description = para(game["intent"], 10.8)
        column = 244
        _, th = description.wrap(WIDTH - column, H)
        row_h = max(image_h, 48 + th)
        self.room(row_h)
        self.pdf.drawImage(str(image_path), MARGIN, self.y - image_h,
                           image_w, image_h, preserveAspectRatio=True, mask="auto")
        self.pdf.drawImage(str(icon_path), MARGIN + column, self.y - 38, 38, 38,
                           preserveAspectRatio=True, anchor="c", mask="auto")
        label = para(game["genre"], 10, True)
        _, lh = label.wrap(WIDTH - column - 48, H)
        label.drawOn(self.pdf, MARGIN + column + 48, self.y - lh - 4)
        description.drawOn(self.pdf, MARGIN + column, self.y - 48 - th)
        self.y -= row_h + 12

    def finish(self):
        self.pdf.showPage()


def build_game(game, reviewed):
    path = OUTPUT / game["pdf"]
    pdf = canvas.Canvas(str(path), pagesize=A4)
    pdf.setTitle(game["title"] + " ゲーム仕様書")
    pdf.setAuthor("島本善太")
    pdf.setSubject("現行ルール・確認項目・仕様変更の経緯と引き継ぎ")

    p = Page(pdf, game, 1, "01  遊び方と現行ルール", reviewed)
    p.text(game["title"], size=18, bold=True, gap=5)
    p.text(f"制作人数 {game['team']}人  |  {game['platform']}", size=9.5, color=MUTED, gap=12)
    p.overview()
    p.text(game["scope"], size=9, color=MUTED, gap=10)
    p.heading("進行の流れ")
    p.text(game["flow"], gap=10)
    p.table(game["inputs"], label_width=96)
    p.heading("基本ルール")
    p.table(game["rules"], label_width=112)
    p.finish()

    p = Page(pdf, game, 2, "02  判定・データ・確認項目", reviewed)
    p.heading("実装・資料で確認した条件")
    p.table(game["details"])
    p.heading("変更時に確認すること")
    p.table(game["checks"])
    p.heading("未確定・追加確認")
    for item in game["open"]:
        p.text("・" + item, size=10)
    p.finish()

    p = Page(pdf, game, 3, "03  変更の経緯と引き継ぎ", reviewed)
    p.text("変更前・背景・変更後・影響範囲を記録する。更新時も過去の判断を消さずに追記し、理由が未確認の変更は区別する。", size=9.5, color=MUTED, gap=10)
    for change in game["changes"]:
        p.heading(change["id"] + "  " + change["title"])
        p.text(change["status"], size=8.7, color=MUTED, gap=5)
        p.table([(label, change[key]) for label, key in [
            ("変更前", "before"), ("背景・理由", "reason"),
            ("変更後", "after"), ("影響範囲", "impact"),
        ]], label_width=89, size=9.5)
        p.text("確認根拠：" + change["evidence"], size=8, color=MUTED, gap=9)
    p.heading("次の担当者へ")
    p.text(game["handoff"], size=9.5, gap=8)
    p.text("参照した資料", size=9, bold=True, gap=3)
    for source in game["sources"]:
        p.text(source, size=8, color=MUTED, gap=2)
    p.finish()
    pdf.save()
    reader = PdfReader(path)
    if len(reader.pages) != 3:
        raise ValueError(f"Unexpected page count: {path}")
    for index, page in enumerate(reader.pages):
        text = page.extract_text()
        if len(text) < 350 or "制作期間" in text:
            raise ValueError(f"Incomplete or invalid content: {path} p{index + 1}")
    return path


def render_review(paths, poppler):
    for path in paths:
        prefix = OUTPUT / path.stem
        subprocess.run([poppler, "-scale-to", "1100", "-png", str(path), str(prefix)], check=True)
        sheet = Image.new("RGB", (2370, 1120), "#dce1e3")
        for index in range(3):
            with Image.open(OUTPUT / f"{path.stem}-{index + 1}.png") as page:
                image = ImageOps.contain(page.convert("RGB"), (770, 1100))
                sheet.paste(image, (10 + index * 790, 10))
        sheet.save(OUTPUT / f"{path.stem}-review.jpg", quality=92)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true", help="Update canonical local PDFs after validation")
    parser.add_argument("--render", metavar="PDFTOPPM", help="Render pages and review sheets with Poppler")
    args = parser.parse_args()
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    register_fonts()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    paths = [build_game(game, data["reviewedOn"]) for game in data["games"]]
    if args.render:
        render_review(paths, args.render)
    if args.publish:
        for path in paths:
            shutil.copyfile(path, ROOT / "files" / path.name)
    print(f"Validated {len(paths)} documents / {len(paths) * 3} pages. "
          + ("Canonical local PDFs updated." if args.publish else "Drafts ready for visual review."))


if __name__ == "__main__":
    main()
