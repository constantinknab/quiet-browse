"""Package only extension source/assets. Does not submit or claim publication readiness."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'extension'
manifest = json.loads((source / 'manifest.json').read_text())
assert manifest['manifest_version'] == 3
files = sorted(p for p in source.rglob('*') if p.is_file() and not p.name.startswith('.'))
allowed = {'.js', '.json', '.css', '.html', '.png', '.txt'}
for p in files:
    assert not p.is_symlink(), f'Symlinks are not packaged: {p}'
    assert p.suffix in allowed, f'Unexpected file type: {p}'
dist = root / 'dist'
dist.mkdir(exist_ok=True)
archive = dist / f"quiet-browse-{manifest['version']}.zip"
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as out:
    for p in files:
        info = zipfile.ZipInfo(p.relative_to(source).as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        out.writestr(info, p.read_bytes())
with zipfile.ZipFile(archive) as package:
    assert 'manifest.json' in package.namelist()
    assert package.testzip() is None
    for path in package.namelist():
        assert not path.startswith('/') and '..' not in Path(path).parts
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(dist / (archive.name + '.sha256')).write_text(checksum + '  ' + archive.name + '\n')
print(f'Packaged {len(files)} extension files: {archive}')
print(f'SHA-256: {checksum}')
print('Not submitted or approved. Run scripts/release_check.py before public submission.')
