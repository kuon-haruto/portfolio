import json
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link


build = Path(sys.argv[1])
output = Path(sys.argv[2])
navigation = json.loads((build / "navigation.json").read_text(encoding="utf-8"))
reader = PdfReader(build / "candidate.pdf")
writer = PdfWriter()
writer.append(reader, import_outline=False)
writer.remove_annotations(subtypes="/Link")
assert len(writer.pages) == len(navigation["titles"])

for i, title in enumerate(navigation["titles"]):
    writer.add_outline_item(title, i)

for item in navigation["links"]:
    page = writer.pages[item["page"]]
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    x, y, w, h = (item[key] for key in ("x", "y", "width", "height"))
    rect = (x * width / 1280, (720 - y - h) * height / 720,
            (x + w) * width / 1280, (720 - y) * height / 720)
    target = {"url": item["url"]} if "url" in item else {"target_page_index": item["targetPage"]}
    writer.add_annotation(item["page"], Link(rect=rect, **target))

writer.add_metadata({"/Title": "島本善太 ポートフォリオ", "/Author": "島本善太", "/Subject": "ゲームプランナー志望 制作作品・企画・担当内容"})
with output.open("wb") as stream:
    writer.write(stream)

check = PdfReader(output)
assert len(check.pages) == len(navigation["titles"])
assert len(check.outline) == len(navigation["titles"])
assert all((page.extract_text() or "").strip() for page in check.pages)
annotations = [ref.get_object() for page in check.pages for ref in page.get("/Annots", [])]
assert len(annotations) == len(navigation["links"])
for page_index, page in enumerate(check.pages):
    expected_urls = sorted(item["url"] for item in navigation["links"]
                           if item["page"] == page_index and "url" in item)
    actual_urls = sorted(str(ref.get_object()["/A"]["/URI"])
                         for ref in page.get("/Annots", [])
                         if ref.get_object().get("/A", {}).get("/S") == "/URI")
    assert actual_urls == expected_urls
print(f"PDF verified: {len(check.pages)} pages, {len(navigation['links'])} navigation links")
