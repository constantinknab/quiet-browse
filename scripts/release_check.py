"""Checklist validation only. Never represents store approval or legal certification."""
import json
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
release = json.loads((root / 'docs/release.json').read_text())
missing = []
for name in ['publisherName', 'supportEmail']:
    if not isinstance(release.get(name), str) or not release[name].strip():
        missing.append(name)
for name in ['privacyPolicyUrl', 'supportUrl']:
    url = urlparse(release.get(name, ''))
    if url.scheme != 'https' or not url.hostname or url.hostname in ['localhost', '127.0.0.1', 'example.com']:
        missing.append(name + ' (real public HTTPS URL)')
for name in ['liveChromeChecklistComplete', 'liveYouTubeChecklistComplete', 'publicPrivacyPolicyFinalized', 'actualStoreScreenshotsAndPromoReady', 'publisherPolicyAndLegalReviewComplete']:
    if release.get(name) is not True:
        missing.append(name)
if missing:
    print('NOT READY FOR PUBLIC SUBMISSION. Local unpacked testing is available.')
    for item in missing:
        print(' - ' + item)
    raise SystemExit(2)
print('Publisher checklist recorded. Verify the evidence and the current dashboard requirements before submitting.')
print('This is not Google approval, a security audit, or legal certification.')
