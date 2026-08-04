#!/usr/bin/env python3
"""Generate Dельта VPN launcher icons from the source logo.

The source logo is a white glyph on a black background. We crop it to a square,
lift the glyph out as an alpha mask and re-render it in the app palette
(white glyph on a blue gradient rounded square).

Usage:  python3 scripts/gen_icons.py
Deps:   pillow
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "logo_source.jpg")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

BLUE_LIGHT = (61, 141, 255)
BLUE_DARK = (23, 78, 216)
WHITE = (255, 255, 255)

# Legacy launcher icon sizes (px) per density bucket.
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# Adaptive icon layers are 108dp squares.
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def glyph_mask(size: int, coverage: float) -> Image.Image:
    """Return an L-mode mask of the logo glyph, centred in a `size` square.

    `coverage` is the fraction of the canvas the glyph's bounding box spans.
    """
    src = Image.open(SRC).convert("L")
    # The artwork is a light glyph on black; anything reasonably bright is glyph.
    mask = src.point(lambda p: 255 if p > 96 else 0, mode="L")
    box = mask.getbbox()
    mask = mask.crop(box)

    # Pad the (non-square) glyph box out to a square so it never distorts.
    side = max(mask.size)
    square = Image.new("L", (side, side), 0)
    square.paste(mask, ((side - mask.width) // 2, (side - mask.height) // 2))

    target = max(1, int(round(size * coverage)))
    square = square.resize((target, target), Image.LANCZOS)

    out = Image.new("L", (size, size), 0)
    off = (size - target) // 2
    out.paste(square, (off, off))
    return out


def gradient(size: int) -> Image.Image:
    """Diagonal blue gradient, top-left light -> bottom-right dark."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1)) if size > 1 else 0.0
            px[x, y] = tuple(
                int(round(BLUE_LIGHT[c] + (BLUE_DARK[c] - BLUE_LIGHT[c]) * t))
                for c in range(3)
            )
    return img


def rounded_mask(size: int, radius_ratio: float = 0.235) -> Image.Image:
    ss = 4  # supersample for smooth corners
    big = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, size * ss - 1, size * ss - 1),
        radius=int(size * ss * radius_ratio),
        fill=255,
    )
    return big.resize((size, size), Image.LANCZOS)


def tile(size: int, rounded: bool, coverage: float) -> Image.Image:
    """Blue tile with the white glyph on it."""
    img = gradient(size).convert("RGBA")
    glyph = Image.new("RGBA", (size, size), WHITE + (0,))
    glyph.putalpha(glyph_mask(size, coverage))
    img.alpha_composite(glyph)
    if rounded:
        img.putalpha(rounded_mask(size))
    return img


def write(img: Image.Image, *parts: str) -> None:
    path = os.path.join(RES, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("wrote", os.path.relpath(path, ROOT))


def main() -> None:
    for bucket, size in LEGACY.items():
        icon = tile(size, rounded=True, coverage=0.60)
        write(icon, f"mipmap-{bucket}", "ic_launcher.png")
        write(icon, f"mipmap-{bucket}", "ic_launcher_round.png")

    for bucket, size in ADAPTIVE.items():
        # Adaptive foreground: glyph only, inside the 66dp/108dp safe zone.
        fg = Image.new("RGBA", (size, size), WHITE + (0,))
        fg.putalpha(glyph_mask(size, 0.40))
        write(fg, f"mipmap-{bucket}", "ic_launcher_foreground.png")

        # Themed (monochrome) icon for Android 13+; same shape, tinted by system.
        write(fg, f"mipmap-{bucket}", "ic_launcher_monochrome.png")

    # Large rounded tile used by the splash screen and the "best server" avatar.
    logo = tile(512, rounded=True, coverage=0.60)
    write(logo, "drawable-nodpi", "logo_delta.png")

    # Soft glow sprite behind the power button when connected.
    glow = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((96, 96, 416, 416), fill=BLUE_LIGHT + (170,))
    glow = glow.filter(ImageFilter.GaussianBlur(56))
    write(glow, "drawable-nodpi", "power_glow.png")


if __name__ == "__main__":
    main()
