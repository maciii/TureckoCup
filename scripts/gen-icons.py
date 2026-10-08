#!/usr/bin/env python3
"""
PWA ikony a erb do aplikace z předlohy design/crest.png (erb Turecko Cupu:
pohár, české a turecké barvy, zlatý lem). Spouští se ručně, výstup se
commituje:

    python3 scripts/gen-icons.py        # potřebuje Pillow (pip install pillow)

Předloha má bílé pozadí a měkký stín; ten se odstraní záplavou od okrajů
(světlé neutrální pixely), zbylý lem erodováním alfy. Ikony mají erb na
námořnické modři erbu (#0b1d3a), maskable ikona ho zmenší do bezpečné zóny.
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "crest.png"
PUBLIC = ROOT / "public"
ASSETS = ROOT / "src" / "assets"
NAVY = (11, 29, 58, 255)


def cut_crest() -> Image.Image:
    src = Image.open(SOURCE).convert("RGBA")
    width, height = src.size
    px = src.load()

    def is_background(p) -> bool:
        r, g, b = p[:3]
        return max(r, g, b) - min(r, g, b) < 22 and min(r, g, b) > 150

    seen = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        i = y * width + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_background(px[x, y]):
            continue
        px[x, y] = (255, 255, 255, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    alpha = src.split()[3].filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    src.putalpha(alpha)
    return src.crop(src.getbbox())


def on_navy(crest: Image.Image, size: int, scale: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), NAVY)
    part = crest.copy()
    part.thumbnail((int(size * scale), int(size * scale)), Image.LANCZOS)
    canvas.alpha_composite(part, ((size - part.size[0]) // 2, (size - part.size[1]) // 2))
    return canvas.convert("RGB")


def fit(crest: Image.Image, size: int) -> Image.Image:
    part = crest.copy()
    part.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(part, ((size - part.size[0]) // 2, (size - part.size[1]) // 2))
    return canvas


def main() -> None:
    crest = cut_crest()
    on_navy(crest, 512, 0.84).save(PUBLIC / "icon-512.png")
    on_navy(crest, 192, 0.84).save(PUBLIC / "icon-192.png")
    on_navy(crest, 512, 0.62).save(PUBLIC / "icon-512-maskable.png")
    on_navy(crest, 180, 0.84).save(PUBLIC / "apple-touch-icon.png")
    fit(crest, 64).save(PUBLIC / "favicon.png")
    part = crest.copy()
    part.thumbnail((320, 320), Image.LANCZOS)
    part.save(ASSETS / "crest.png", optimize=True)
    print("hotovo:", crest.size)


if __name__ == "__main__":
    main()
