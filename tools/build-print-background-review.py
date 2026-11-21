"""Compare monochrome background treatments without changing the booklet master."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).resolve().parents[1] / "launcher/test-output/portfolio-booklet/design-review"
with Image.open(out / "feature-opening-1.png") as im:
    original = im.convert("RGB")
page = original.convert("L").convert("RGB")
w, h = page.size
scale = w / 1440


def point(x, y):
    return round(x * scale), round(y * scale)


def draw_treatment(kind):
    field = Image.new("RGB", page.size, "#F6F6F6")
    d = ImageDraw.Draw(field)
    if kind == "grid":
        for x in range(15, 1440, 24):
            d.line([point(x, 0), point(x, 1019)], fill="#DBDBDB", width=2)
        for y in range(12, 1020, 24):
            d.line([point(0, y), point(1439, y)], fill="#DBDBDB", width=2)
        d.rectangle([point(43, 36), point(1396, 981)], outline="#9CA5A2", width=2)
        for x, y in ((43, 36), (1396, 36), (43, 981), (1396, 981)):
            d.line([point(x-9, y), point(x+9, y)], fill="#647472", width=2)
            d.line([point(x, y-9), point(x, y+9)], fill="#647472", width=2)
    else:
        for y in range(-500, 1700, 28):
            d.arc([point(-1180, y-680), point(2520, y+690)], start=3, end=177,
                  fill="#DDDDDD", width=2)
    mask = page.convert("L").point(lambda v: 255 if v == 255 else 0)
    result = Image.composite(field, page, mask)
    # Preserve the actual game capture, including white HUD pixels.
    capture = (63, 287, 990, 716)
    result.paste(original.crop(capture), capture[:2])
    result.save(out / f"full-background-{kind}.png")
    return result


baseline = page.copy()
baseline.paste(original.crop((63, 287, 990, 716)), (63, 287))
options = (("比較基準：白地", baseline), ("A：設計図の方眼", draw_treatment("grid")),
           ("B：大きな曲線の背景", draw_treatment("curve")))
thumb = (520, round(h * 520/w))
sheet = Image.new("RGB", (1596, thumb[1]+58), "#E7EBEC")
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 23)
for i, (label, design) in enumerate(options):
    x = 8+i*532
    draw.text((x, 8), label, fill="#17272C", font=font)
    sheet.paste(design.resize(thumb, Image.Resampling.LANCZOS), (x, 45))
sheet.save(out / "full-background-comparison.png")
draw_treatment("grid").convert("L").save(out / "full-background-mono.png")
