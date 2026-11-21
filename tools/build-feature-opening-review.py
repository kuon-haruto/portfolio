"""A4 landscape opening-page proofs; the portfolio master is untouched."""
from pathlib import Path
import subprocess
import sys

from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

root = Path(__file__).resolve().parents[1]
out = root / "launcher/test-output/portfolio-booklet/design-review"
out.mkdir(parents=True, exist_ok=True)
for key, suffix in (("regular", ""), ("bold", "b")):
    pdfmetrics.registerFont(TTFont(key, f"C:/Windows/Fonts/meiryo{suffix}.ttc"))
w, h = 297 * 72 / 25.4, 210 * 72 / 25.4
pdf = Canvas(str(out / "feature-openings.pdf"), pagesize=(w, h))
ink, gray = "#17272C", "#485D64"


def text(value, x, y, size, color=ink, bold=False):
    pdf.setFont("bold" if bold else "regular", size)
    pdf.setFillColor(color)
    pdf.drawString(x, h-y-size, value)


def box(x, y, width, height, color):
    pdf.setFillColor(color)
    pdf.rect(x, h-y-height, width, height, fill=1, stroke=0)


def picture(name, x, y, width):
    im = ImageReader(str(root / "files/images" / name))
    iw, ih = im.getSize()
    height = width * ih / iw
    pdf.drawImage(im, x, h-y-height, width, height)
    return height


teal = "#006B60"
text("01   /   代表作", 37, 31, 12, teal, True)
box(37, 55, 768, 2, teal)
text("すべる宇宙駐車場", 37, 68, 36, ink, True)
text("慣性で滑る船を、逆噴射で駐車する。", 37, 121, 19, teal, True)
box(643, 79, 162, 31, "#E2F0ED")
text("App Store 公開", 655, 85, 14, teal, True)
height = picture("sliding-space-parking-store-gameplay.jpg", 37, 168, 541)
text("公開版の実画面", 37, 176+height, 10, gray)
box(599, 168, 206, 3, teal)
text("私の担当", 599, 184, 14, teal, True)
text("企画立案・整理", 599, 215, 22, ink, True)
text("画像作成・SE", 599, 251, 18)
text("4人制作   /   Unity", 599, 292, 12, gray)
text("次のページで見る設計判断", 599, 338, 12, teal, True)
text("枠に着く前に、", 599, 363, 16, ink, True)
text("いつ減速するか。", 599, 389, 16, ink, True)
for i, title in enumerate(("噴射して進む", "慣性で滑る", "逆噴射で減速")):
    x = 37 + i*259
    box(x, 468, 248, 66, "#E9F3F0")
    text(f"0{i+1}", x+12, 482, 19, teal, True)
    text(title, x+58, 486, 16, ink, True)
text("PORTFOLIO   /   島本 善太", 37, 552, 9, gray)
pdf.showPage()

pink = "#96255F"
text("02   /   代表作", 37, 31, 12, pink, True)
box(37, 55, 768, 2, pink)
text("V-Link Battle", 37, 66, 42, ink, True)
text("VTuberの配信文化を題材にした3D対戦アクション", 37, 127, 17, pink, True)
text("神ゲーエボリューション2025", 584, 76, 12, gray)
text("1次審査通過", 584, 97, 17, pink, True)
box(37, 174, 490, 27, "#382137")
text("MATCH   /   公開版の対戦画面", 49, 179, 11, "#FFFFFF", True)
picture("v-link-battle.jpg", 37, 201, 490)
box(552, 174, 253, 3, pink)
text("私の担当   /   8人制作", 552, 187, 14, pink, True)
text("企画・仕様・システム設計", 552, 215, 17, ink, True)
text("タスク振り分け", 552, 250, 15)
text("3D素材・エフェクト", 552, 279, 15)
text("アニメーション", 552, 306, 15)
box(552, 351, 253, 125, "#F4EAF0")
text("企画時の選択", 566, 366, 13, pink, True)
text("先に攻撃するか、", 566, 393, 17, ink, True)
text("隙を見てアピールするか。", 566, 422, 16, ink, True)
text("左の対戦画像はアピールの場面ではありません。", 37, 491, 12, gray)
text("PORTFOLIO   /   島本 善太", 37, 552, 9, gray)
pdf.showPage()
pdf.save()
subprocess.run([sys.argv[1], "-scale-to", "1440", "-png",
                str(out/"feature-openings.pdf"), str(out/"feature-opening")], check=True)
with Image.open(out/"feature-opening-1.png") as a, Image.open(out/"feature-opening-2.png") as b:
    thumb = (720, round(a.height/2))
    sheet = Image.new("RGB", (1476, thumb[1]+24), "#DEE5E6")
    for i, page in enumerate((a, b)):
        sheet.paste(page.resize(thumb, Image.Resampling.LANCZOS), (12+i*732, 12))
    sheet.save(out/"feature-openings.png")
