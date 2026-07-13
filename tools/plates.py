#!/usr/bin/env python3
"""Render a static map "plate" for every waypoint, at build time.

Why this exists — a finding from the prototype, not a preference:

A walk page has fifteen stops. Giving each one a live MapLibre map means thirty
WebGL contexts (modern + historical). Browsers cap simultaneous WebGL contexts
at about sixteen and silently kill the rest, so half the maps on the page come
back as broken canvases. Measured: 31 requested, 16 alive, 15 lost.

So the walk page uses no WebGL at all. It uses images — composited here, from
the same tile sources the interactive reader uses. Which turns out to be what we
wanted anyway:

  * zero JavaScript on the page that needs to be indexed and shared;
  * <img> gets lazy-loading, srcset and intrinsic sizing for free;
  * no layout shift, no context limit, no map that fails to paint;
  * the plates are cacheable, and become the OG images for social previews.

Live MapLibre is reserved for the one screen that is genuinely interactive:
the reader.
"""

import io
import json
import math
import pathlib
import sys
import urllib.request

from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parent.parent
TILE = 256
UA = {"User-Agent": "readtheplaces-plates/0.1 (https://readtheplaces.com)"}

MODERN = "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png"


def deg2num(lat: float, lon: float, z: int) -> tuple[float, float]:
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n
    return x, y


def fetch(url: str) -> Image.Image | None:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGBA")
    except Exception:
        return None


def compose(lat: float, lon: float, z: int, w: int, h: int, template: str,
            retina: bool = True) -> Image.Image:
    """Stitch the tiles covering a w×h window centred on (lat, lon)."""
    scale = 2 if retina else 1
    r = "@2x" if retina else ""
    W, H = w * scale, h * scale
    tsize = TILE * scale

    cx, cy = deg2num(lat, lon, z)
    # pixel position of the centre within the world at this zoom
    px, py = cx * tsize, cy * tsize
    x0, y0 = px - W / 2, py - H / 2

    canvas = Image.new("RGBA", (W, H), (245, 242, 234, 255))
    tx0, ty0 = int(x0 // tsize), int(y0 // tsize)
    tx1, ty1 = int((x0 + W) // tsize), int((y0 + H) // tsize)

    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            url = template.replace("{z}", str(z)).replace("{x}", str(tx)) \
                          .replace("{y}", str(ty)).replace("{r}", r)
            tile = fetch(url)
            if tile is None:
                continue
            if tile.size != (tsize, tsize):
                tile = tile.resize((tsize, tsize), Image.LANCZOS)
            canvas.paste(tile, (int(tx * tsize - x0), int(ty * tsize - y0)), tile)

    return canvas


def ink(img: Image.Image) -> Image.Image:
    """Ink on paper. The map is an illustration; it must not fight the page.

    Mirrors the CSS filter used on the live map, so the two surfaces match.
    """
    grey = img.convert("L")
    warm = Image.merge("RGB", [
        grey.point(lambda p: min(255, int(28 + p * 0.87))),   # R
        grey.point(lambda p: min(255, int(25 + p * 0.86))),   # G
        grey.point(lambda p: min(255, int(18 + p * 0.85))),   # B
    ])
    return warm


def pin(img: Image.Image, colour: str, scale: int = 2) -> Image.Image:
    d = ImageDraw.Draw(img)
    cx, cy = img.width // 2, img.height // 2
    r = 7 * scale
    d.ellipse([cx - r - 2 * scale, cy - r - 2 * scale, cx + r + 2 * scale, cy + r + 2 * scale],
              fill=(245, 242, 234, 255))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=colour)
    return img


def main() -> int:
    slug = sys.argv[1] if len(sys.argv) > 1 else "mrs-dalloway"
    book_dir = REPO / "books" / slug
    book = json.loads((book_dir / "book.json").read_text())
    waypoints = json.loads((book_dir / "waypoints.built.json").read_text())

    out = REPO / "design" / "plates" / slug
    out.mkdir(parents=True, exist_ok=True)

    hist = (book.get("layers") or {}).get("historical")
    print(f"{slug}: rendering plates for {len(waypoints)} waypoints → {out.relative_to(REPO)}\n")

    for w in waypoints:
        lon, lat = w["coords"]
        colour = book["characters"][w["character"]]["color"]

        for era, template in [("now", MODERN)] + ([("then", hist["tiles"])] if hist else []):
            img = compose(lat, lon, 16, 640, 400, template)
            img = ink(img) if era == "now" else img.convert("RGB")
            img = pin(img, colour)
            path = out / f"{w['id']}-{era}.webp"
            img.save(path, "WEBP", quality=86, method=6)
            kb = path.stat().st_size / 1024
            print(f"  {w['id']:<26} {era:<5} {kb:6.1f} KB")

    print(f"\n  {len(list(out.glob('*.webp')))} plates. No WebGL, no context limit, no JS.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
