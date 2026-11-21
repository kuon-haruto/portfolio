"""Visual comparison of print treatments; does not write to the official PDF."""
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
out = root / "launcher/test-output/portfolio-booklet/design-review"
out.mkdir(parents=True, exist_ok=True)
pdf = root / "documents/portfolio/portfolio.pdf"
font = "C:/Windows/Fonts/meiryo.ttc"

for n, accent, tint in (
    (4, "#086F64", "#E8F2EF"),
    (7, "#99275F", "#F4E9F0"),
):
    stem = out / f"print-p{n}-original"
    subprocess.run([sys.argv[1], "-f", str(n), "-l", str(n), "-singlefile",
                    "-scale-to", "1440", "-png", str(pdf), str(stem)], check=True)
    with Image.open(stem.with_suffix(".png")) as source:
        original = source.convert("RGB")
    w, h = original.size
    a = original.copy()
    d = ImageDraw.Draw(a)
    d.rounded_rectangle((35, 108, 44, 750), radius=3, fill=accent)
    d.rectangle((72, 81, 196, 87), fill=accent)
    b = a.copy()
    # Tint only the white space in the right-column responsibility area.
    region = (928, 271, 1379, 718)
    crop = original.crop(region)
    bg = Image.new("RGB", crop.size, tint)
    mask = crop.convert("L").point(lambda value: 255 if value >= 246 else 0)
    b.paste(bg, region[:2], mask)
    d = ImageDraw.Draw(b)
    d.rectangle((928, 271, 1378, 276), fill=accent)
    a.save(out / f"print-p{n}-a.png")
    b.save(out / f"print-p{n}-b.png")
    thumb = 520
    th = round(h * thumb / w)
    sheet = Image.new("RGB", (1596, th+58), "#E7EBEC")
    draw = ImageDraw.Draw(sheet)
    for i, (label, page) in enumerate((
        ("現行：白地", original),
        ("A：作品色の罫線", a),
        ("B：担当欄にも淡い色", b),
    )):
        x = 8+i*532
        draw.text((x, 8), label, fill="#17272C", font=ImageFont.truetype(font, 22))
        sheet.paste(page.resize((thumb, th), Image.Resampling.LANCZOS), (x, 45))
    sheet.save(out / f"print-p{n}-styles.png")
