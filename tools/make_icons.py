"""Génère l'icône de PandiFlow (le P dont le rond est la tête du panda) et les écrans de lancement iPhone.

Le dessin est écrit ici en SVG, puis photographié par Chrome (sans fenêtre) :
- assets/icons/icon.svg : l'icône des onglets ;
- assets/icons/apple-touch-icon.png : le raccourci iPhone (carré plein, l'iPhone arrondit lui-même les coins) ;
- assets/icons/icon-192.png, icon-512.png, icon-maskable-512.png : Android ;
- assets/splash/splash-<largeur>x<hauteur>.jpg : les images de lancement iPhone, photos de l'écran
  de lancement de index.html (#splash) à la taille de chaque iPhone, en portrait et en paysage ;
- dans index.html : la marque de l'écran de lancement (entre <!-- marque --> et <!-- /marque -->)
  et la liste des images de lancement (entre <!-- images-de-lancement --> et <!-- /images-de-lancement -->).
Les couleurs du fond sont aussi dans le CSS de #splash (index.html) : changer les deux ensemble.
Usage : python tools/make_icons.py
"""
import math
import os
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "assets" / "icons"
SPLASH = ROOT / "assets" / "splash"
INDEX = ROOT / "index.html"
FONT = ROOT / "assets" / "fonts" / "fredoka.woff2"

INK = "#1F1B2E"
# Fond : du miel (matin, en haut à gauche) jusqu'à la nuit (en bas à droite), avec quelques étoiles
STOPS = [(0, "#FFDE6E"), (0.3, "#FFB24F"), (0.55, "#FF8D72"), (0.78, "#9A5AA8"), (1, "#2E2C78")]
STARS = [(86, 80, 1.1), (76, 92, 0.8), (93, 66, 0.7), (64, 95, 0.6)]

# Le P : un anneau (le rond est la tête du panda) et sa barre, oreilles derrière l'anneau (repère 100 x 100)
CX, CY, RI, T = 50, 40, 15, 14
RC = RI + T / 2
EAR_A = math.radians(42)

# iPhone : largeur, hauteur (en points, portrait), densité
DEVICES = [
    (440, 956, 3),  # 16 Pro Max, 17 Pro Max
    (420, 912, 3),  # Air
    (402, 874, 3),  # 16 Pro, 17, 17 Pro
    (430, 932, 3),  # 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16
    (428, 926, 3),  # 12 Pro Max, 13 Pro Max, 14 Plus
    (390, 844, 3),  # 12, 12 Pro, 13, 13 Pro, 14, 16e
    (375, 812, 3),  # X, XS, 11 Pro, 12 mini, 13 mini
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (414, 736, 3),  # 6s Plus, 7 Plus, 8 Plus
    (375, 667, 2),  # 6s, 7, 8, SE (2e et 3e génération)
]


def n(x):
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def stroke(color, w):
    return f'fill="none" stroke="{color}" stroke-width="{n(w)}" stroke-linecap="round" stroke-linejoin="round"'


def ears(fill):
    r0 = RC + 8
    return "".join(
        f'<circle cx="{n(CX + d * r0 * math.sin(EAR_A))}" cy="{n(CY - r0 * math.cos(EAR_A))}" r="6" fill="{fill}"/>'
        for d in (-1, 1)
    )


def letter(paint):
    return f'<circle cx="{CX}" cy="{CY}" r="{n(RC)}" {stroke(paint, T)}/><path d="M{n(CX - RC)} {CY + 2}V82" {stroke(paint, T)}/>'


def face(eye_class):
    """Visage « petites billes » : taches rondes, un point blanc pour chaque œil, un petit nez."""
    r, k = RI, RI * 1.3
    cls = f' class="{eye_class}"' if eye_class else ""
    s = f'<circle cx="{CX}" cy="{CY}" r="{RI + 1}" fill="#fff"/>'
    s += f'<circle cx="{CX}" cy="{n(CY + 1.2)}" r="{n(RI - 0.7)}" fill="none" stroke="{INK}" stroke-width="1.4" opacity=".06"/>'
    for d in (-1, 1):
        s += f'<circle cx="{n(CX + d * 0.4 * r)}" cy="{n(CY + 0.1 * r)}" r="{n(0.25 * r)}" fill="{INK}"/>'
    for d in (-1, 1):
        s += f'<circle{cls} cx="{n(CX + d * 0.37 * r)}" cy="{n(CY + 0.06 * r)}" r="{n(0.08 * r)}" fill="#fff"/>'
    y = CY + 0.42 * r
    s += (
        f'<path d="M{n(CX - 0.11 * k)} {n(y - 0.05 * k)}Q{CX} {n(y - 0.1 * k)} {n(CX + 0.11 * k)} {n(y - 0.05 * k)}'
        f'Q{n(CX + 0.1 * k)} {n(y + 0.03 * k)} {CX} {n(y + 0.07 * k)}Q{n(CX - 0.1 * k)} {n(y + 0.03 * k)} {n(CX - 0.11 * k)} {n(y - 0.05 * k)}Z" fill="{INK}"/>'
    )
    return s


def mark(scale=1.06, eye_class=""):
    shadow = f'<g transform="translate(0 2.2)" opacity=".18">{ears("#7A3A00")}{letter("#7A3A00")}</g>'
    return f'<g transform="translate(50 50) scale({n(scale)}) translate(-50 -50)">{shadow}{ears(INK)}{letter(INK)}{face(eye_class)}</g>'


def icon_svg(scale=1.06, radius=0):
    stops = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in STOPS)
    stars = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity=".75"/>' for x, y, r in STARS)
    clip = f'<clipPath id="tile"><rect width="100" height="100" rx="{radius}"/></clipPath>' if radius else ""
    bg = f'<rect width="100" height="100" fill="url(#bg)"/><rect width="100" height="100" fill="url(#glow)"/>{stars}'
    if radius:
        bg = f'<g clip-path="url(#tile)">{bg}</g>'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>'
        f'<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">{stops}</linearGradient>'
        '<radialGradient id="glow" cx=".12" cy=".08" r=".55"><stop offset="0" stop-color="#FFF4C4" stop-opacity=".9"/>'
        f'<stop offset="1" stop-color="#FFF4C4" stop-opacity="0"/></radialGradient>{clip}</defs>{bg}{mark(scale)}</svg>'
    )


def find_chrome():
    for p in (
        os.environ.get("CHROME", ""),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    ):
        if p and os.path.exists(p):
            return p
    raise SystemExit("Chrome introuvable (variable CHROME pour donner son chemin)")


def shoot(chrome, html, w, h, dpr=1):
    """Photographie une page HTML de w x h points à la densité dpr ; renvoie l'image (w*dpr x h*dpr)."""
    with tempfile.TemporaryDirectory() as tmp:
        page, png = Path(tmp) / "page.html", Path(tmp) / "shot.png"
        page.write_text(html, encoding="utf-8")
        subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
             f"--window-size={w},{h}", f"--force-device-scale-factor={dpr}", "--virtual-time-budget=3000",
             f"--screenshot={png}", page.as_uri()],
            check=True, capture_output=True,
        )
        img = Image.open(png).convert("RGB")
        img.load()
    size = (round(w * dpr), round(h * dpr))
    return img if img.size == size else img.resize(size, Image.LANCZOS)


def square(chrome, svg):
    sized = svg.replace("<svg ", '<svg width="1024" height="1024" ', 1)
    return shoot(chrome, f'<!doctype html><body style="margin:0">{sized}', 1024, 1024)


def rounded(img, size):
    img = img.resize((size, size), Image.LANCZOS).convert("RGBA")
    big = size * 4
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.225), fill=255)
    img.putalpha(mask.resize((size, size), Image.LANCZOS))
    return img


def replace_block(text, name, content, indent):
    pattern = re.compile(rf"(<!-- {name} -->)(.*?)(\s*<!-- /{name} -->)", re.S)
    if not pattern.search(text):
        raise SystemExit(f"index.html : repères <!-- {name} --> introuvables")
    return pattern.sub(lambda m: m.group(1) + content.replace("\n", "\n" + indent) + m.group(3), text, count=1)


def startup_links():
    lines = [""]
    for w, h, d in DEVICES:
        for orient, (pw, ph) in (("portrait", (w * d, h * d)), ("landscape", (h * d, w * d))):
            media = f"(device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: {d}) and (orientation: {orient})"
            lines.append(f'<link rel="apple-touch-startup-image" media="{media}" href="assets/splash/splash-{pw}x{ph}.jpg">')
    return "\n".join(lines)


def splash_page(index):
    css = re.search(r'<style id="splash-css">.*?</style>', index, re.S).group(0)
    div = re.search(r'<div id="splash".*?<!-- /splash -->', index, re.S).group(0).replace('<div id="splash"', '<div id="splash" class="still"', 1)
    font = f"@font-face {{ font-family: 'Fredoka'; src: url('{FONT.as_uri()}') format('woff2'); font-weight: 300 700; font-display: block; }}"
    # La photo est prise en taille double (voir main) : les plafonds en px, jamais atteints sur un iPhone, sont retirés
    uncap = ("#splash .sp-mark { max-width: none; max-height: none; } #splash .sp-name { font-size: 10vmin; }"
             " #splash .sp-hi { font-size: 4.6vmin; }")
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{font} html, body {{ margin: 0; }}</style>{css}'
            f'<style>{uncap}</style></head><body>{div}</body></html>')


def main():
    chrome = find_chrome()
    ICONS.mkdir(parents=True, exist_ok=True)
    SPLASH.mkdir(parents=True, exist_ok=True)

    (ICONS / "icon.svg").write_text(icon_svg(radius=22), encoding="utf-8")
    full = square(chrome, icon_svg())
    full.resize((180, 180), Image.LANCZOS).save(ICONS / "apple-touch-icon.png")
    rounded(full, 192).save(ICONS / "icon-192.png")
    rounded(full, 512).save(ICONS / "icon-512.png")
    # Android découpe l'icône « maskable » en cercle ou en goutte : le P tient dans le cercle central (80 %)
    square(chrome, icon_svg(scale=0.86)).resize((512, 512), Image.LANCZOS).save(ICONS / "icon-maskable-512.png")

    index = INDEX.read_text(encoding="utf-8")
    index = replace_block(index, "marque", "\n" + mark(eye_class="sp-eye"), "      ")
    index = replace_block(index, "images-de-lancement", startup_links(), "  ")
    INDEX.write_text(index, encoding="utf-8", newline="\n")

    page = splash_page(index)
    for old in SPLASH.glob("splash-*.jpg"):
        old.unlink()
    for w, h, d in DEVICES:
        for cw, ch in ((w, h), (h, w)):
            # Chrome sans fenêtre impose une largeur minimale (~500 points) : la page est photographiée
            # en taille double à densité moitié, ce qui donne les mêmes pixels avec la même mise en page (vmin)
            img = shoot(chrome, page, cw * 2, ch * 2, d / 2)
            img.save(SPLASH / f"splash-{cw * d}x{ch * d}.jpg", quality=90, optimize=True, progressive=True, subsampling=0)
    print(f"Icônes dans {ICONS}, {2 * len(DEVICES)} images de lancement dans {SPLASH}, index.html mis à jour")


if __name__ == "__main__":
    main()
