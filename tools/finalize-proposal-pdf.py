"""Restore links omitted by PowerPoint PDF export and add document navigation."""

import json
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link


def finalize(source, navigation_path, destination):
    navigation = json.loads(Path(navigation_path).read_text(encoding="utf-8"))
    reader = PdfReader(source)
    writer = PdfWriter()
    writer.append(reader, import_outline=False)
    writer.remove_annotations(subtypes="/Link")
    if len(writer.pages) != len(navigation["titles"]):
        raise ValueError("PDF page count does not match the presentation")
    for i, title in enumerate(navigation["titles"]):
        writer.add_outline_item(title, i)
    for item in navigation["links"]:
        page = writer.pages[item["page"]]
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        x, y, w, h = (item[key] for key in ("x", "y", "width", "height"))
        rect = (x * width / 1280, (720 - y - h) * height / 720,
                (x + w) * width / 1280, (720 - y) * height / 720)
        writer.add_annotation(item["page"], Link(rect=rect, url=item["url"]))
    writer.add_metadata({"/Title": navigation["title"] + " 企画書", "/Author": "島本善太",
                         "/Subject": "ゲームコンセプト・プレイヤー体験・制作体制"})
    with Path(destination).open("wb") as stream:
        writer.write(stream)


if __name__ == "__main__":
    finalize(*sys.argv[1:])
