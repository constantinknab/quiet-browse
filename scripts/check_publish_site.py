"""Check the static public site before Chrome Web Store submission."""
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "website"
ALLOW_PLACEHOLDERS = "--allow-placeholders" in sys.argv
errors = []


class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for key in ("href", "src"):
            value = values.get(key, "")
            if not value or value.startswith(("https://", "mailto:", "#")):
                continue
            target = (SITE / value.split("#", 1)[0].split("?", 1)[0]).resolve()
            if SITE.resolve() not in target.parents and target != SITE.resolve():
                errors.append(f"Path escapes website: {value}")
            elif not target.exists():
                errors.append(f"Missing local link: {value}")


required = ["index.html", "privacy.html", "support.html", "404.html", "styles.css", "icon128.png", ".nojekyll"]
for name in required:
    if not (SITE / name).exists():
        errors.append(f"Missing website file: {name}")

for path in SITE.glob("*.html"):
    source = path.read_text()
    parser = Links(); parser.feed(source)
    if "<script" in source.lower(): errors.append(f"Scripts are not expected in {path.name}")
    if any(term in source.lower() for term in ("google-analytics", "googletagmanager", "facebook pixel")):
        errors.append(f"Tracking reference in {path.name}")
    if not ALLOW_PLACEHOLDERS and any(term in source for term in ("[PUBLISHER NAME]", "[SUPPORT EMAIL]", "SUPPORT_EMAIL")):
        errors.append(f"Replace publisher placeholders in {path.name}")

privacy = (SITE / "privacy.html").read_text() if (SITE / "privacy.html").exists() else ""
for phrase in ("Chrome Web Store User Data Policy", "PBKDF2-SHA-256", "raw.githubusercontent.com", "GitHub Pages"):
    if phrase not in privacy: errors.append(f"Privacy policy is missing: {phrase}")

if errors:
    print("PUBLIC WEBSITE NOT READY")
    for error in sorted(set(errors)): print(" - " + error)
    raise SystemExit(2)
print("PASS: website files, local links, no scripts/tracking, disclosures, and publisher fields.")
