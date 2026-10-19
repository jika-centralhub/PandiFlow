"""Génère les icônes PNG de l'application (pièce pandi sur fond de ciel du soir).
Usage : python tools/make_icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "icons")
S = 1024  # dessin en grand puis réduction (anticrénelage)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background():
    img = Image.new("RGB", (S, S))
    top, mid, bottom = (18, 20, 61), (43, 34, 104), (122, 62, 140)
    px = img.load()
    for y in range(S):
        t = y / (S - 1)
        c = lerp(top, mid, t / 0.6) if t < 0.6 else lerp(mid, bottom, (t - 0.6) / 0.4)
        for x in range(S):
            px[x, y] = c
    d = ImageDraw.Draw(img)
    for (x, y, r) in [(160, 170, 7), (300, 90, 5), (850, 200, 8), (760, 110, 4), (120, 420, 4), (900, 470, 5), (210, 860, 5), (880, 820, 6)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    return img


def coin(img, cx, cy, R):
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - R * 1.25, cy - R * 1.25, cx + R * 1.25, cy + R * 1.25], fill=(255, 210, 63, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(R * 0.18))
    img.paste(glow, (0, 0), glow)

    d = ImageDraw.Draw(img)
    # Pièce : dégradé radial approximé par des cercles concentriques
    steps = 60
    for i in range(steps, 0, -1):
        t = i / steps
        c = lerp((255, 246, 196), (224, 154, 0), t ** 1.4)
        r = R * t
        ox, oy = -R * 0.2 * (1 - t), -R * 0.25 * (1 - t)
        d.ellipse([cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r], fill=c)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(201, 134, 0), width=int(R * 0.09))
    d.ellipse([cx - R * 0.77, cy - R * 0.77, cx + R * 0.77, cy + R * 0.77], outline=(255, 240, 160), width=int(R * 0.05))

    k = R / 30  # repère du dessin d'origine (viewBox 64)
    def P(x, y):
        return cx + (x - 32) * k, cy + (y - 32) * k

    ink = (43, 43, 51)
    for ex in (20, 44):
        x, y = P(ex, 20)
        d.ellipse([x - 6.5 * k, y - 6.5 * k, x + 6.5 * k, y + 6.5 * k], fill=ink)
    x, y = P(32, 34)
    d.ellipse([x - 16 * k, y - 16 * k, x + 16 * k, y + 16 * k], fill=(255, 253, 245))
    for ex, ang in ((25.5, -25), (38.5, 25)):
        patch = Image.new("RGBA", (int(12 * k), int(14 * k)), (0, 0, 0, 0))
        ImageDraw.Draw(patch).ellipse([0, 0, patch.width - 1, patch.height - 1], fill=ink + (255,))
        patch = patch.rotate(-ang, expand=True, resample=Image.BICUBIC)
        px_, py_ = P(ex, 32)
        img.paste(patch, (int(px_ - patch.width / 2), int(py_ - patch.height / 2)), patch)
    for ex in (26, 38):
        x, y = P(ex, 31.5)
        d.ellipse([x - 1.9 * k, y - 1.9 * k, x + 1.9 * k, y + 1.9 * k], fill=(255, 255, 255))
    x, y = P(32, 39)
    d.ellipse([x - 2.8 * k, y - 2 * k, x + 2.8 * k, y + 2 * k], fill=ink)
    a, b = P(29, 41), P(35, 45)
    d.arc([a[0], a[1], b[0], b[1]], start=20, end=160, fill=ink, width=int(1.7 * k))


def make(size, path, rounded=False, scale=0.62):
    img = background().convert("RGBA")
    coin(img, S / 2, S / 2, S * scale / 2)
    if rounded:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
        img.putalpha(mask)
    img.resize((size, size), Image.LANCZOS).save(path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    make(512, os.path.join(OUT, "icon-512.png"), rounded=True)
    make(192, os.path.join(OUT, "icon-192.png"), rounded=True)
    make(512, os.path.join(OUT, "icon-maskable-512.png"), scale=0.5)
    make(180, os.path.join(OUT, "apple-touch-icon.png"), scale=0.62)
    print("Icônes générées dans", OUT)
