from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

root = Path(__file__).resolve().parents[1]
out = root / "launcher/test-output/portfolio-booklet/design-review"
out.mkdir(parents=True, exist_ok=True)
original = root / "documents/portfolio/島本善太_ポートフォリオ.pdf"
font = "C:/Windows/Fonts/meiryo.ttc"
pdfmetrics.registerFont(TTFont("J", font))
pdfmetrics.registerFont(TTFont("B", "C:/Windows/Fonts/meiryob.ttc"))
c = Canvas(str(out / "planner-samples.pdf"), pagesize=(960, 540))
ink, teal, muted = "#182528", "#086F64", "#425B61"


def box(x, y, w, h, fill):
    c.setFillColor(fill)
    c.rect(x, 540-y-h, w, h, fill=1, stroke=0)


def word(value, x, y, size=18, color=ink, bold=False):
    face = "B" if bold else "J"
    assert x + pdfmetrics.stringWidth(value, face, size) <= 925, value
    c.setFont(face, size)
    c.setFillColor(color)
    c.drawString(x, 540-y-size, value)


def head(page, title, game):
    box(0, 0, 960, 540, "#F6F8F7")
    word(f"P{page:02} / {game}", 38, 27, 14, teal, True)
    word(title, 38, 53, 30, ink, True)
    box(38, 112, 884, 2, teal)


def picture(im, x, y, w, h):
    c.drawImage(ImageReader(im), x, 540-y-h, w, h)


head(5, "枠に着く前に、いつ減速するか", "すべる宇宙駐車場")
word("実プレイ：黄色い丸で囲んだ船を左から右へ追う", 38, 128, 17, teal, True)
with Image.open(root / "files/images/sliding-space-parking.gif") as gif:
    for i, (frame, ship, caption) in enumerate(((0, 99, "01  枠へ進む"), (12, 151, "02  枠までの距離が縮む"), (21, 189, "03  枠の手前"), (36, 218, "04  枠内で停止"))):
        gif.seek(frame)
        im = gif.convert("RGB").crop((58, 70, 326, 158))
        draw = ImageDraw.Draw(im)
        sx = ship*400/300-58
        sy = 82*400/300-70
        draw.ellipse((sx-11, sy-11, sx+11, sy+11), outline="#FFF063", width=2)
        x = 38+i*223
        picture(im, x, 169, 211, 69.3)
        word(caption, x, 248, 14, ink, True)
box(38, 297, 884, 162, "#E3EFEB")
word("操作の模式図：実プレイ画像から入力の瞬間は判別できません", 58, 310, 15, muted)
for i, (title, arrow, color, desc) in enumerate((
    ("噴射", "→", teal, "右向きに加速"),
    ("慣性移動", "→", teal, "入力を離しても進む"),
    ("逆噴射", "←", "#A34321", "左向きの推力で減速"),
    ("駐車", "■", teal, "枠内で止める"),
)):
    x = 58+i*218
    word(title, x, 348, 17, ink, True)
    word(arrow, x, 373, 25, color, True)
    word(desc, x, 414, 15, muted)
word("緑：進む方向  ／  橙：逆噴射による推力の方向", 38, 478, 15, muted)
c.showPage()

head(8, "攻撃するか、隙を見てアピールするか", "V-Link Battle")
word("企画上の判断図", 38, 130, 17, teal, True)
for x, title, lines in (
    (38, "01  先に攻撃する", ("アピールを挟まず、攻撃する。",)),
    (487, "02  隙を見てアピールする", ("アピール中は無防備。", "成功後の攻撃でボルテージを高める構想。")),
):
    box(x, 167, 435, 129, "#E3EFEB")
    word(title, x+18, 180, 21, ink, True)
    for n, line in enumerate(lines):
        word(line, x+18, 220+n*25, 17, muted)
word("実際の対戦映像：アピールの場面ではありません", 38, 315, 17, teal, True)
for i, (seconds, caption) in enumerate(((27, "対峙"), (29, "攻撃エフェクト"), (31, "相手が後退"))):
    path = out.parent / f"vlink-sequence-{seconds}.jpg"
    picture(str(path), 38+i*302, 352, 210, 118)
    word(f"00:{seconds}  {caption}", 38+i*302, 482, 15, muted)
c.showPage()

head(12, "攻撃と強化を優先し、リンクを2種類に", "双子")
for i, (label, lines) in enumerate((
    ("変更前", ("ダメージ・バフに加え、", "パッシブ共有も検討")),
    ("変更理由", ("優先度の高い", "攻撃と強化の共有を先に固める")),
    ("変更後", ("ダメージとバフの2種類。", "パッシブ共有は見送り")),
)):
    x = 38+i*300
    box(x, 145, 284, 130, "#E3EFEB" if i == 1 else "#EAF0F1")
    word(label, x+14, 157, 16, teal, True)
    for n, line in enumerate(lines):
        word(line, x+14, 191+n*27, 16, ink, True)
word("根拠：制作仕様書 p.3「F-C01」", 38, 294, 16, teal, True)
with Image.open(out.parent / "futago-spec.png") as im:
    picture(im, 38, 327, 585, 195)
word("現行コードで確認", 658, 347, 17, teal, True)
word("Damage / Buff の2種類", 658, 380, 18, ink, True)
word("仕様書には影響範囲も記録。", 658, 425, 16, muted)
c.showPage()
c.save()

poppler = sys.argv[1]
for i, page in enumerate((5, 8, 12), 1):
    for source, index, name in ((original, page, "before"), (out/"planner-samples.pdf", i, "after")):
        subprocess.run([poppler, "-f", str(index), "-l", str(index), "-singlefile",
                        "-scale-to", "1200", "-png", str(source), str(out/f"p{page}-{name}")], check=True)
    sheet = Image.new("RGB", (1476, 454), "#E4E9E8")
    draw = ImageDraw.Draw(sheet)
    for k, (name, caption) in enumerate((("before", "修正前"), ("after", "修正見本"))):
        x = 12+k*732
        with Image.open(out/f"p{page}-{name}.png") as im:
            sheet.paste(im.resize((720,405), Image.Resampling.LANCZOS), (x,37))
        draw.text((x,5), f"P{page}  {caption}", fill=ink, font=ImageFont.truetype(font, 22))
    sheet.save(out/f"p{page}-compare.png")
