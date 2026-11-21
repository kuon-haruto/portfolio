from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "launcher/test-output/portfolio-booklet/design-review"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 960, 540
FONT = "C:/Windows/Fonts/meiryo.ttc"
pdfmetrics.registerFont(TTFont("J", FONT))
pdfmetrics.registerFont(TTFont("JB", "C:/Windows/Fonts/meiryob.ttc"))
shot = ImageReader(str(ROOT / "files/images/sliding-space-parking-store-gameplay.jpg"))
pdf = canvas.Canvas(str(OUT / "comparison.pdf"), pagesize=(W, H))


def rect(x, y, w, h, fill):
    pdf.setFillColor(fill)
    pdf.rect(x, H-y-h, w, h, fill=1, stroke=0)


def txt(s, x, y, size, fill, bold=False):
    pdf.setFillColor(fill)
    pdf.setFont("JB" if bold else "J", size)
    pdf.drawString(x, H-y-size, s)


def picture(x, y, w):
    sw, sh = shot.getSize()
    h = w * sh / sw
    pdf.drawImage(shot, x, H-y-h, w, h)
    return h


def heading(code, ink, accent):
    txt(code + "  /  SELECTED WORK", 42, 27, 12, accent, True)
    txt("すべる宇宙駐車場", 42, 49, 34, ink, True)


dark, white, cyan = "#101A23", "#F3F8FC", "#8AE8D4"
ink, teal, gray = "#17272C", "#086F64", "#445D61"

rect(0, 0, W, H, dark)
heading("A", white, cyan)
txt("慣性で滑る船を、逆噴射で駐車する。", 42, 100, 20, cyan, True)
h = picture(42, 143, 704)
txt("App Store掲載のゲーム画面", 42, 148+h, 11, "#BBD0DB")
rect(768, 143, 2, 326, cyan)
txt("App Store公開", 790, 160, 16, cyan, True)
txt("制作人数", 790, 207, 13, white)
txt("4人", 790, 228, 38, white, True)
txt("私の担当", 790, 303, 15, cyan, True)
for i, line in enumerate(("企画立案・整理", "画像作成・SE")):
    txt(line, 790, 333+i*27, 16, white)
txt("噴射で進む  →  逆噴射で減速  →  枠内で止める", 42, 497, 15, cyan)
pdf.showPage()

rect(0, 0, W, H, "#F6F8F7")
heading("B", ink, teal)
txt("慣性で滑る船を、逆噴射で駐車する。", 42, 100, 20, teal, True)
for i, (title, desc) in enumerate((("噴射で進む", "入力を離しても船は滑る"), ("逆噴射で減速", "枠の手前から速度を落とす"), ("枠内で止める", "最後は小さく位置を調整"))):
    x = 42+i*295
    rect(x, 150, 270, 3, teal)
    txt(f"0{i+1}", x, 169, 16, teal, True)
    txt(title, x+41, 162, 23, ink, True)
    txt(desc, x, 204, 15, gray)
    if i < 2:
        txt("→", x+271, 168, 17, teal)
h = picture(42, 256, 510)
txt("App Store掲載のゲーム画面", 42, 262+h, 11, gray)
txt("私の担当", 587, 267, 16, teal, True)
txt("企画立案・整理", 587, 299, 24, ink, True)
txt("画像作成・SE", 587, 334, 20, ink)
txt("制作人数：4人 / App Store公開", 587, 408, 16, gray)
pdf.showPage()

rect(0, 0, W, H, "#F8F7F3")
rect(375, 0, 585, 540, "#E8F0EE")
heading("C", ink, teal)
txt("私の担当", 42, 151, 16, teal, True)
txt("企画立案・整理", 42, 183, 31, ink, True)
txt("画像作成・SE", 42, 229, 25, ink)
rect(42, 294, 282, 1, "#A0B6B2")
txt("制作人数：4人", 42, 319, 17, ink)
txt("App Store公開", 42, 351, 17, teal, True)
txt("慣性で滑る船を、逆噴射で駐車する。", 406, 96, 22, ink, True)
h = picture(406, 153, 513)
txt("App Store掲載のゲーム画面", 406, 159+h, 11, gray)
for i, line in enumerate(("01   噴射で進む", "02   逆噴射で減速", "03   枠内で止める")):
    txt(line, 406, 426+i*27, 16, teal, True)
pdf.showPage()
pdf.save()

pdf = canvas.Canvas(str(OUT / "a-revised.pdf"), pagesize=(W, H))
rect(0, 0, W, H, dark)
heading("A", white, cyan)
txt("慣性で滑る船を、逆噴射で駐車する。", 42, 100, 20, cyan, True)
h = picture(42, 143, 704)
txt("App Store掲載のゲーム画面", 42, 148+h, 11, "#BBD0DB")
rect(768, 143, 2, 326, cyan)
txt("私の担当", 790, 160, 17, cyan, True)
txt("企画立案・整理", 790, 196, 19, white, True)
txt("画像作成・SE", 790, 230, 18, white, True)
rect(790, 285, 128, 1, "#57717A")
txt("制作人数：4人", 790, 307, 15, white)
txt("App Store公開", 790, 346, 15, cyan)
txt("噴射で進む  →  逆噴射で減速  →  枠内で止める", 42, 497, 15, cyan)
pdf.save()

subprocess.run([sys.argv[1], "-scale-to", "1440", "-png",
                str(OUT / "comparison.pdf"), str(OUT / "option")], check=True)
sheet = Image.new("RGB", (1512, 330), "#E4E9E8")
draw = ImageDraw.Draw(sheet)
for i, name in enumerate("ABC", 1):
    with Image.open(OUT / f"option-{i}.png") as page:
        sheet.paste(page.resize((480, 270), Image.Resampling.LANCZOS), (18+(i-1)*498, 44))
    draw.text((18+(i-1)*498, 9), name, font=ImageFont.truetype(FONT, 24), fill=ink)
sheet.save(OUT / "overview.png")

subprocess.run([sys.argv[1], "-singlefile", "-scale-to", "1440", "-png",
                str(OUT / "a-revised.pdf"), str(OUT / "a-revised")], check=True)
sheet = Image.new("RGB", (1512, 468), "#E4E9E8")
draw = ImageDraw.Draw(sheet)
for i, (name, label) in enumerate((("option-1", "元のA案"), ("a-revised", "修正後のA案"))):
    x = 18+i*747
    with Image.open(OUT / f"{name}.png") as page:
        sheet.paste(page.resize((729, 410), Image.Resampling.LANCZOS), (x, 44))
    draw.text((x, 9), label, font=ImageFont.truetype(FONT, 23), fill=ink)
sheet.save(OUT / "a-before-after.png")
