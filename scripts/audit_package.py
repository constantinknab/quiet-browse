"""Verify that the Chrome Web Store ZIP is exactly the reviewed extension tree.

Run this after scripts/package.py. The audit intentionally performs no network
requests and never changes the archive it is checking.
"""

from hashlib import sha256
from pathlib import Path, PurePosixPath
import json
import zipfile


PROJECT_ROOT = Path(__file__).resolve().parents[1]
EXTENSION_ROOT = PROJECT_ROOT / "extension"
DIST_ROOT = PROJECT_ROOT / "dist"


def package_source_files():
    """Return the same non-hidden files that the packager is allowed to copy."""
    return sorted(
        path for path in EXTENSION_ROOT.rglob("*")
        if path.is_file() and not path.name.startswith(".")
    )


manifest = json.loads((EXTENSION_ROOT / "manifest.json").read_text())
archive = DIST_ROOT / f"quiet-browse-{manifest['version']}.zip"
checksum_file = DIST_ROOT / f"{archive.name}.sha256"

if not archive.is_file():
    raise SystemExit(f"MISSING PACKAGE: run scripts/package.py first ({archive})")

# Build the expected byte-for-byte map from the source tree we just tested.
expected = {
    path.relative_to(EXTENSION_ROOT).as_posix(): path.read_bytes()
    for path in package_source_files()
}

with zipfile.ZipFile(archive) as package:
    names = package.namelist()
    if len(names) != len(set(names)):
        raise SystemExit("UNSAFE PACKAGE: duplicate ZIP entry names")
    if package.testzip() is not None:
        raise SystemExit("UNSAFE PACKAGE: corrupt ZIP member")

    # Absolute paths and `..` segments could write outside the chosen extraction
    # directory. The packager should never create either form.
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            raise SystemExit(f"UNSAFE PACKAGE PATH: {name}")

    missing = sorted(set(expected) - set(names))
    unexpected = sorted(set(names) - set(expected))
    if missing or unexpected:
        raise SystemExit(f"PACKAGE FILE MISMATCH: missing={missing}, unexpected={unexpected}")

    for name, source_bytes in expected.items():
        if package.read(name) != source_bytes:
            raise SystemExit(f"PACKAGE BYTE MISMATCH: {name}")

    packaged_manifest = json.loads(package.read("manifest.json"))
    if packaged_manifest != manifest:
        raise SystemExit("PACKAGE MANIFEST MISMATCH")

digest = sha256(archive.read_bytes()).hexdigest()
expected_checksum_line = f"{digest}  {archive.name}"
if not checksum_file.is_file() or checksum_file.read_text().strip() != expected_checksum_line:
    raise SystemExit("PACKAGE CHECKSUM FILE MISMATCH")

print(f"PASS: {archive.name} matches all {len(expected)} reviewed extension files byte-for-byte.")
print(f"SHA-256: {digest}")
print("This proves package integrity, not live-site compatibility or Chrome Web Store approval.")
