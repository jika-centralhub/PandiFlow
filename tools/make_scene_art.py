"""Prépare les images des saynètes de la bulle « Transformation en cours… ».

Les images brutes viennent de tools/make-scene-art.ps1 (tests/local/scene-art/, hors dépôt) :
  - les personnages et animaux, sur fond vert uni : on retire le vert (bords adoucis, reflets verts
    neutralisés), on recadre au plus près, puis on réduit ;
  - les décors (fond_*) : on les réduit seulement.
Résultat : assets/scenes/<nom>.webp (transparent pour les personnages).
Usage : python tools/make_scene_art.py
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tests", "local", "scene-art")
OUT = os.path.join(ROOT, "assets", "scenes")
CHAR_MAX = 560  # côté le plus long d'un personnage
BG_SIZE = 640  # décor carré


def key_green(img):
    """Fond vert -> transparent. Le vert « domine » quand G dépasse nettement R et B."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dom = g - np.maximum(r, b)
    # 0 (personnage) -> 1 (fond) entre deux seuils : bords doux
    t = np.clip((dom - 18) / 62, 0, 1)
    alpha = (1 - t) * 255
    # Bords à moitié transparents (cheveux, crinières) : on retire la part du fond vert mélangée à la
    # couleur (couleur = a x personnage + (1 - a) x fond), puis, les personnages n'ayant pas de vert,
    # on ramène partout G au niveau du plus fort de R et B
    key = np.median(a[t >= 1], axis=0) if (t >= 1).any() else np.array([0, 255, 0], np.float32)
    k = np.clip(alpha / 255, 0.05, 1)[..., None]
    edge = ((alpha > 0) & (alpha < 255))[..., None]
    rgb = np.where(edge, (a - (1 - k) * key) / k, a).clip(0, 255)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    g2 = np.minimum(g, np.maximum(r, b))
    out = np.dstack([r, g2, b, alpha]).clip(0, 255).astype(np.uint8)
    res = Image.fromarray(out, "RGBA")
    # Petites taches de fond isolées : on efface ce qui est presque transparent
    al = np.asarray(res)[..., 3]
    res.putalpha(Image.fromarray(np.where(al < 24, 0, al).astype(np.uint8)))
    return res


def trim(img, margin=8):
    box = img.getchannel("A").point(lambda v: 255 if v > 30 else 0).getbbox()
    if not box:
        return img
    l, t, r, b = box
    return img.crop((max(0, l - margin), max(0, t - margin), min(img.width, r + margin), min(img.height, b + margin)))


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"Dossier introuvable : {SRC} (lance d'abord tools/make-scene-art.ps1)")
    os.makedirs(OUT, exist_ok=True)
    for name in sorted(os.listdir(SRC)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".webp", ".png", ".jpg"):
            continue
        img = Image.open(os.path.join(SRC, name))
        if stem.startswith("fond_"):
            out = img.convert("RGB").resize((BG_SIZE, BG_SIZE), Image.LANCZOS)
            out.save(os.path.join(OUT, f"{stem}.webp"), "WEBP", quality=78, method=6)
        else:
            out = trim(key_green(img))
            k = CHAR_MAX / max(out.size)
            if k < 1:
                out = out.resize((round(out.width * k), round(out.height * k)), Image.LANCZOS)
            out.save(os.path.join(OUT, f"{stem}.webp"), "WEBP", quality=84, method=6)
        size = os.path.getsize(os.path.join(OUT, f"{stem}.webp")) // 1024
        print(f"{stem}: {out.width}x{out.height}, {size} Ko")


if __name__ == "__main__":
    main()
