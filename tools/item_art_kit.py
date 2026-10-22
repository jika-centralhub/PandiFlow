"""Outils locaux pour créer les images 3D des objets (tools/item-art.json) avec la clé OpenAI déjà
enregistrée dans Supabase, via la fonction TEMPORAIRE make-item-art (son code est gardé hors dépôt dans
tests/local/make-item-art/index.ts).

  python tools/item_art_kit.py spec nom1 nom2…
      prépare supabase/functions/make-item-art/ (hors dépôt, voir .git/info/exclude) : le code de la
      fonction et un spec.ts qui n'accepte QUE ces objets ; refuse si le dossier existe déjà (une autre
      série d'images est peut-être en cours), sauf avec --force
  python tools/item_art_kit.py receive
      reçoit sur 127.0.0.1:8099 les images envoyées par tests/local/item-art.html et les écrit dans
      tests/local/item-art/<nom>.webp ; une image déjà là n'est jamais écrasée (gardée en <nom>-oldN.webp)
  python tools/item_art_kit.py clean
      retire supabase/functions/make-item-art/ une fois la fonction supprimée de Supabase
"""
import argparse
import http.server
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(ROOT, "tools", "item-art.json")
CODE = os.path.join(ROOT, "tests", "local", "make-item-art", "index.ts")
FUNC = os.path.join(ROOT, "supabase", "functions", "make-item-art")
RAW = os.path.join(ROOT, "tests", "local", "item-art")
ORIGINS = ("http://localhost:8080", "http://127.0.0.1:8080")
MAX_BYTES = 25 * 1024 * 1024
DEPLOY = ('& "$env:LOCALAPPDATA\\supabase-cli\\supabase.exe" functions deploy make-item-art '
          f'--project-ref kyhhkhmwdostzdaksxzw --no-verify-jwt --use-api --workdir "{ROOT}"')


def load_spec():
    with open(SPEC, encoding="utf-8") as f:
        return json.load(f)


def keep_old(path):
    """Renomme une image existante en <nom>-oldN.webp (comme make-item-art.ps1 -Again)."""
    if not os.path.exists(path):
        return None
    stem, ext = os.path.splitext(path)
    k = 1
    while os.path.exists(f"{stem}-old{k}{ext}"):
        k += 1
    os.rename(path, f"{stem}-old{k}{ext}")
    return f"{os.path.basename(stem)}-old{k}{ext}"


def cmd_spec(args):
    spec = load_spec()
    by_id = {it["id"]: it for it in spec["items"]}
    unknown = [i for i in args.ids if i not in by_id]
    if unknown:
        sys.exit(f"Absents de tools/item-art.json : {', '.join(unknown)}")
    if not os.path.exists(CODE):
        sys.exit(f"Code de la fonction introuvable : {CODE}")
    if os.path.exists(args.dest) and not args.force:
        sys.exit(f"{args.dest} existe déjà : une autre série d'images est peut-être en cours "
                 "(voir les autres sessions). Relance avec --force seulement si elle est finie.")
    os.makedirs(args.dest, exist_ok=True)
    shutil.copyfile(CODE, os.path.join(args.dest, "index.ts"))
    part = {"styles": spec["styles"], "cutout": spec["cutout"], "items": [by_id[i] for i in args.ids]}
    with open(os.path.join(args.dest, "spec.ts"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Copie partielle de tools/item-art.json (faite par tools/item_art_kit.py pour le déploiement) :\n")
        f.write("// les seuls prompts acceptés.\n")
        f.write("export const SPEC = " + json.dumps(part, ensure_ascii=False, indent=2) + ";\n")
    print(f"Fonction prête dans {args.dest} pour : {', '.join(args.ids)}")
    print(f"Déploiement (à lancer par l'utilisateur, PowerShell) :\n  {DEPLOY}")
    print(f"Puis : http://localhost:8080/tests/local/item-art.html?only={','.join(args.ids)}")


def cmd_receive(args):
    ids = {it["id"] for it in load_spec()["items"]}
    os.makedirs(args.dir, exist_ok=True)

    class Handler(http.server.BaseHTTPRequestHandler):
        def cors(self):
            origin = self.headers.get("Origin", "")
            if origin in ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def answer(self, code, text):
            body = json.dumps({"message": text}, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.cors()
            self.end_headers()

        def do_POST(self):
            # Seulement la page locale (une autre page ouverte dans le navigateur ne peut rien déposer)
            if self.headers.get("Origin") not in ORIGINS:
                return self.answer(403, "origine refusée")
            m = re.fullmatch(r"/save/([a-z0-9_]+)", self.path)
            if not m or m.group(1) not in ids:
                return self.answer(404, "objet inconnu")
            size = int(self.headers.get("Content-Length") or 0)
            if not 0 < size <= MAX_BYTES:
                return self.answer(413, "taille refusée")
            data = self.rfile.read(size)
            if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
                return self.answer(415, "webp seulement")
            path = os.path.join(args.dir, f"{m.group(1)}.webp")
            old = keep_old(path)
            with open(path + ".part", "wb") as f:
                f.write(data)
            os.replace(path + ".part", path)
            print(f"{m.group(1)}.webp : {len(data) // 1024} Ko" + (f" (ancienne gardée : {old})" if old else ""), flush=True)
            self.answer(200, "ok")

        def log_message(self, fmt, *a):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Réception des images sur http://127.0.0.1:{args.port}/save/<nom> -> {args.dir}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def cmd_clean(args):
    if not os.path.exists(args.dest):
        print("Rien à retirer.")
        return
    code = os.path.join(args.dest, "index.ts")
    if not os.path.exists(code) or "TEMPORAIRE" not in open(code, encoding="utf-8").read():
        sys.exit(f"{args.dest} ne ressemble pas à la fonction temporaire : je n'y touche pas.")
    shutil.rmtree(args.dest)
    print(f"{args.dest} retiré.")


def main():
    # Accents lisibles même quand la sortie passe par un tube (Claude, journal)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("spec")
    s.add_argument("ids", nargs="+")
    s.add_argument("--force", action="store_true")
    s.add_argument("--dest", default=FUNC)
    r = sub.add_parser("receive")
    r.add_argument("--port", type=int, default=8099)
    r.add_argument("--dir", default=RAW)
    c = sub.add_parser("clean")
    c.add_argument("--dest", default=FUNC)
    args = p.parse_args()
    {"spec": cmd_spec, "receive": cmd_receive, "clean": cmd_clean}[args.cmd](args)


if __name__ == "__main__":
    main()
