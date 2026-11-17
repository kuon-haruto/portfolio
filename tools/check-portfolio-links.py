"""Check public PDF destinations without downloading entire videos or releases."""

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urldefrag
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'launcher/test-output/portfolio-booklet'
navigation = json.loads((BUILD / 'navigation.json').read_text(encoding='utf-8'))
urls = sorted({urldefrag(item['url'])[0] for item in navigation['links']
               if item.get('url', '').startswith('https://')})
results = []
for url in urls:
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-4095'})
    try:
        with urlopen(request, timeout=30) as response:
            sample = response.read(4096)
            item = {'url': url, 'status': response.status,
                    'final_url': response.url,
                    'content_type': response.headers.get('Content-Type'),
                    'sample_bytes': len(sample)}
    except Exception as exc:
        item = {'url': url, 'error': str(exc)}
    results.append(item)
    print(f"{item.get('status', 'ERROR')} {url}", flush=True)
report = {'checked_at': datetime.now(timezone.utc).isoformat(), 'links': results,
          'scope': 'Unauthenticated HTTP accessibility; not gameplay verification.'}
(BUILD / 'link-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
raise SystemExit(1 if any('error' in item for item in results) else 0)
