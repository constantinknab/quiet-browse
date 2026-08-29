"""Draw original extension icons with the Python standard library; no downloaded art."""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / 'extension' / 'icons'

def rounded(x, y, left, top, right, bottom, radius):
    dx = max(left + radius - x, 0, x - (right - radius))
    dy = max(top + radius - y, 0, y - (bottom - radius))
    return left <= x <= right and top <= y <= bottom and dx*dx + dy*dy <= radius*radius

def pixel(x, y):
    if not rounded(x, y, 4, 4, 124, 124, 29):
        return (0, 0, 0, 0)
    color = (38, 82, 60, 255)
    for l, t, r, b in [(29, 37, 98, 48), (29, 59, 81, 70), (29, 81, 62, 92)]:
        if rounded(x, y, l, t, r, b, 5.5):
            color = (229, 239, 205, 255)
    return color

def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)

ROOT.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            samples = [pixel((x+(sx+.5)/4)*128/size, (y+(sy+.5)/4)*128/size) for sy in range(4) for sx in range(4)]
            # Premultiplied alpha averaging avoids dark halos at transparent edges.
            alpha = sum(p[3] for p in samples)
            rgb = [round(sum(p[c]*p[3] for p in samples)/alpha) if alpha else 0 for c in range(3)]
            raw.extend((*rgb, round(alpha/16)))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    (ROOT / f'icon{size}.png').write_bytes(png)
print('Created four original PNG icons.')
