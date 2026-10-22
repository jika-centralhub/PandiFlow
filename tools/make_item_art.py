"""Prépare les images 3D des objets de la boutique (décrits dans tools/item-art.json).

Les images brutes viennent de tools/make-item-art.ps1 (tests/local/item-art/, hors dépôt), sur un fond uni
vert ou magenta : on retire le fond (bords adoucis, reflets de la couleur du fond neutralisés), on recadre
au ras de l'objet (son bas se pose ainsi pile sur le sol de la scène), puis on réduit. Les décors (key none)
gardent tout leur cadre et sont seulement réduits.
Résultat : assets/items/<nom>.webp (scène) et assets/items/thumb/<nom>.webp (vignettes de la boutique),
et js/avatar/art-list.js, la liste des images présentes avec leur taille (lue par js/avatar/art.js).
Usage : python tools/make_item_art.py [nom1 nom2…]
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tests", "local", "item-art")
OUT = os.path.join(ROOT, "assets", "items")
THUMB = os.path.join(OUT, "thumb")
LIST = os.path.join(ROOT, "js", "avatar", "art-list.js")
FULL_MAX = 640  # côté le plus long dans la scène
SCENERY_MAX = 960  # côté le plus long d'un décor plein cadre
THUMB_MAX = 220  # côté le plus long d'une vignette


def key_out(img, key):
    """Fond uni -> transparent. Le fond « domine » quand sa couleur dépasse nettement les autres canaux."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dom = g - np.maximum(r, b) if key == "green" else np.minimum(r, b) - g
    # 0 (objet) -> 1 (fond) entre deux seuils : bords doux
    t = np.clip((dom - 18) / 62, 0, 1)
    alpha = (1 - t) * 255
    # Bords à moitié transparents : on retire la part du fond mélangée à la couleur
    # (couleur = a x objet + (1 - a) x fond)
    fallback = [0, 255, 0] if key == "green" else [255, 0, 255]
    bg = np.median(a[t >= 1], axis=0) if (t >= 1).any() else np.array(fallback, np.float32)
    k = np.clip(alpha / 255, 0.05, 1)[..., None]
    edge = ((alpha > 0) & (alpha < 255))[..., None]
    rgb = np.where(edge, (a - (1 - k) * bg) / k, a).clip(0, 255)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # Reflets de la couleur du fond sur l'objet : on les ramène au niveau des autres canaux
    if key == "green":
        g = np.minimum(g, np.maximum(r, b))
    else:
        spill = np.clip(np.minimum(r, b) - g, 0, None)
        r, b = r - spill, b - spill
    out = np.dstack([r, g, b, alpha]).clip(0, 255).astype(np.uint8)
    # Petites taches de fond isolées : on efface ce qui est presque transparent
    out[..., 3] = np.where(out[..., 3] < 24, 0, out[..., 3])
    return Image.fromarray(out, "RGBA")


def trim(img, margin=2):
    box = img.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    if not box:
        return img
    l, t, r, b = box
    return img.crop((max(0, l - margin), max(0, t - margin), min(img.width, r + margin), min(img.height, b + margin)))


def shrink(img, side):
    k = side / max(img.size)
    return img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS) if k < 1 else img


def write_list():
    sizes = {}
    for name in sorted(os.listdir(OUT)):
        stem, ext = os.path.splitext(name)
        if ext == ".webp":
            with Image.open(os.path.join(OUT, name)) as im:
                sizes[stem] = im.size
    lines = [f"  {k}: [{w}, {h}]," for k, (w, h) in sizes.items()]
    with open(LIST, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Fichier créé par tools/make_item_art.py : les images 3D présentes dans assets/items/ et leur taille\n")
        f.write("// en pixels [largeur, hauteur]. Ne pas modifier à la main.\n")
        f.write("export const ART = {\n" + "\n".join(lines) + ("\n" if lines else "") + "};\n")
    return len(sizes)


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"Dossier introuvable : {SRC} (lance d'abord tools/make-item-art.ps1)")
    with open(os.path.join(ROOT, "tools", "item-art.json"), encoding="utf-8") as f:
        keys = {it["id"]: it.get("key", "green") for it in json.load(f)["items"]}
    only = set(sys.argv[1:])
    os.makedirs(THUMB, exist_ok=True)
    for name in sorted(os.listdir(SRC)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".webp", ".png", ".jpg") or re.search(r"-old\d+$", stem) or (only and stem not in only):
            continue
        if stem not in keys:
            print(f"{stem}: absent de tools/item-art.json, ignoré")
            continue
        raw = Image.open(os.path.join(SRC, name))
        if keys[stem] == "none":
            out = raw.convert("RGB")
            full = shrink(out, SCENERY_MAX)
            full.save(os.path.join(OUT, f"{stem}.webp"), "WEBP", quality=80, method=6)
        else:
            out = trim(key_out(raw, keys[stem]))
            full = shrink(out, FULL_MAX)
            full.save(os.path.join(OUT, f"{stem}.webp"), "WEBP", quality=84, method=6)
        shrink(out, THUMB_MAX).save(os.path.join(THUMB, f"{stem}.webp"), "WEBP", quality=82, method=6)
        size = os.path.getsize(os.path.join(OUT, f"{stem}.webp")) // 1024
        print(f"{stem}: {full.width}x{full.height}, {size} Ko")
    print(f"{write_list()} image(s) listée(s) dans js/avatar/art-list.js")


if __name__ == "__main__":
    main()
