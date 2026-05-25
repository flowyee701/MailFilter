"""Generate the MailMind app icon.

Design:
  - 1024x1024 canvas, transparent background outside the squircle.
  - Squircle (iOS/macOS-style superellipse) filled with a vertical gradient
    from deep indigo to the app's accent blue.
  - White envelope centered, ~55% canvas width, with a soft drop shadow.
  - Closed envelope (triangular front flap) so the silhouette is unmistakable
    even at 16x16.
  - A four-point "sparkle" star in soft gold overlapping the envelope's
    upper-right corner — signals "smart" / AI-augmented without being cute.
  - Three small category dots (red / yellow / blue) tucked along the envelope's
    bottom edge — a subtle echo of the four-category triage UI.

Run:  python/.venv/bin/python scripts/make_logo.py
Output: logo.png in the repo root.
"""
from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SUPERSAMPLE = 4  # render at 4x then downscale for crisp anti-aliasing
W = SIZE * SUPERSAMPLE

# Palette
COLOR_TOP = (79, 70, 229)        # indigo-600
COLOR_BOT = (91, 140, 255)       # app accent #5B8CFF
ENVELOPE = (255, 255, 255)
ENVELOPE_LINE = (220, 228, 255)  # subtle stroke on the envelope
SHADOW = (20, 30, 60, 90)        # bluish drop shadow with alpha
SPARKLE = (255, 211, 92)         # warm gold
DOT_RED = (239, 68, 68)
DOT_YELLOW = (234, 179, 8)
DOT_BLUE = (59, 130, 246)


def squircle_mask(w: int, radius: float) -> Image.Image:
    """Build an alpha mask for an iOS-style squircle (superellipse, n=5)."""
    mask = Image.new("L", (w, w), 0)
    px = mask.load()
    cx = cy = w / 2
    a = b = w / 2 - 1
    n = 5.0
    for y in range(w):
        for x in range(w):
            v = (abs((x - cx) / a)) ** n + (abs((y - cy) / b)) ** n
            if v <= 1.0:
                px[x, y] = 255
            elif v <= 1.05:
                # 1-pixel-ish soft edge
                px[x, y] = int(255 * (1 - (v - 1.0) / 0.05))
    return mask


def vertical_gradient(w: int, top: tuple[int, int, int], bot: tuple[int, int, int]) -> Image.Image:
    g = Image.new("RGB", (w, w), top)
    px = g.load()
    for y in range(w):
        t = y / (w - 1)
        r = round(top[0] + (bot[0] - top[0]) * t)
        gn = round(top[1] + (bot[1] - top[1]) * t)
        b = round(top[2] + (bot[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, gn, b)
    return g


def rounded_rect(draw: ImageDraw.ImageDraw, xy: tuple[float, float, float, float],
                 radius: float, fill, outline=None, width: int = 0):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_envelope(canvas: Image.Image):
    """Closed envelope: a rectangle body with a triangular top flap."""
    draw = ImageDraw.Draw(canvas)

    # Envelope geometry (in supersampled coords)
    env_w = W * 0.56
    env_h = env_w * 0.66
    cx = W / 2
    cy = W * 0.54
    x0 = cx - env_w / 2
    y0 = cy - env_h / 2
    x1 = cx + env_w / 2
    y1 = cy + env_h / 2
    r = env_w * 0.04  # corner radius

    # Drop shadow — render shape on a separate alpha layer and blur it.
    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    offset = W * 0.012
    rounded_rect(sd, (x0 + offset, y0 + offset * 2, x1 + offset, y1 + offset * 2),
                 radius=r, fill=SHADOW)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(W * 0.018))
    canvas.alpha_composite(shadow_layer)

    # Envelope body
    rounded_rect(draw, (x0, y0, x1, y1), radius=r, fill=ENVELOPE)

    # Closed-flap triangle: peak at horizontal center, base spans the top edge.
    flap_peak_y = y0 + env_h * 0.55
    flap_pts = [(x0, y0), (x1, y0), (cx, flap_peak_y)]
    draw.polygon(flap_pts, fill=ENVELOPE, outline=ENVELOPE_LINE, width=max(1, int(W * 0.003)))

    # Subtle seam line down the flap diagonals to read as an envelope at small sizes.
    seam_w = max(1, int(W * 0.0025))
    draw.line([(x0, y0), (cx, flap_peak_y)], fill=ENVELOPE_LINE, width=seam_w)
    draw.line([(x1, y0), (cx, flap_peak_y)], fill=ENVELOPE_LINE, width=seam_w)

    # Category dots at the bottom — small, evenly spaced, the four-category UI in miniature.
    dot_r = env_w * 0.035
    dot_y = y1 - env_h * 0.18
    spacing = env_w * 0.13
    colors = [DOT_RED, DOT_YELLOW, DOT_BLUE]
    for i, col in enumerate(colors):
        dx = cx + (i - 1) * spacing
        draw.ellipse(
            (dx - dot_r, dot_y - dot_r, dx + dot_r, dot_y + dot_r),
            fill=col,
        )


def draw_sparkle(canvas: Image.Image):
    """Four-point sparkle star overlapping the envelope's upper-right."""
    draw = ImageDraw.Draw(canvas)

    # Center the sparkle near the upper-right of the envelope.
    sx = W * 0.74
    sy = W * 0.32
    long = W * 0.085
    short = W * 0.018

    # Four-point star (kite) by alternating long/short radii.
    pts: list[tuple[float, float]] = []
    for i in range(8):
        angle = math.pi / 2 + i * math.pi / 4  # start pointing up
        r = long if i % 2 == 0 else short
        pts.append((sx + r * math.cos(angle), sy - r * math.sin(angle)))

    # Glow halo first, then the solid star on top.
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.polygon(pts, fill=(255, 211, 92, 130))
    glow = glow.filter(ImageFilter.GaussianBlur(W * 0.018))
    canvas.alpha_composite(glow)

    draw.polygon(pts, fill=SPARKLE)

    # Tiny secondary sparkle, off to the side, for a touch of life.
    sx2 = W * 0.83
    sy2 = W * 0.44
    long2 = W * 0.025
    short2 = W * 0.006
    pts2: list[tuple[float, float]] = []
    for i in range(8):
        angle = math.pi / 2 + i * math.pi / 4
        r = long2 if i % 2 == 0 else short2
        pts2.append((sx2 + r * math.cos(angle), sy2 - r * math.sin(angle)))
    draw.polygon(pts2, fill=SPARKLE)


def main() -> None:
    # Supersampled RGBA canvas with transparent background.
    canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))

    # Vertical gradient masked to a squircle.
    gradient = vertical_gradient(W, COLOR_TOP, COLOR_BOT).convert("RGBA")
    mask = squircle_mask(W, W / 2 - 1)
    gradient.putalpha(mask)
    canvas.alpha_composite(gradient)

    draw_envelope(canvas)
    draw_sparkle(canvas)

    # Downscale with LANCZOS for crisp anti-aliasing.
    out = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    target = Path(__file__).resolve().parent.parent / "logo.png"
    out.save(target, optimize=True)
    print(f"wrote {target} ({target.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
