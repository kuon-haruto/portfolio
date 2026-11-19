from collections import Counter
from pathlib import Path
from pypdf import PdfReader

here = Path(__file__).resolve().parent
def targets(file):
    book = PdfReader(file)
    pages = {p.indirect_reference.idnum: i for i, p in enumerate(book.pages, 1)}
    links = Counter()
    for i, p in enumerate(book.pages, 1):
        for annotation in p.get('/Annots', []):
            a = annotation.get_object()
            if a.get('/Subtype') != '/Link':
                continue
            action = a.get('/A', {})
            dest = a.get('/Dest', action.get('/D'))
            if dest is not None:
                target = pages[dest[0].idnum]
            else:
                target = str(action['/URI'])
            links[i, target] += 1
    return links

original = targets(here.parents[2] / 'documents/portfolio/portfolio.pdf')
preview = targets(here / 'portfolio-preview.pdf')
missing = original - preview
print(f'Original: {original.total()} links; preview: {preview.total()}; missing: {missing}')
assert not missing
