// Visages 3D des enfants : téléchargés depuis Supabase Storage (bucket privé « portraits »),
// gardés en mémoire pour la session et dans le cache du navigateur quand il est disponible (https).
// Chaque chemin contient une version : un fichier ne change jamais, on peut le garder indéfiniment.
import { useEffect, useState } from '../vendor/preact-htm.js';

const CACHE = 'pandiflow-portraits';
const urls = new Map(); // chemin -> URL d'objet prête à afficher
const pending = new Map(); // chemin -> Promise<string | null>
const failedAt = new Map(); // chemin -> date du dernier échec (nouvel essai après 30 s)
let source = null; // (chemin) => Promise<Blob>, fourni par le dépôt Supabase

export function setPortraitSource(fn) {
  source = fn;
}

export const portraitPath = (base, expr) => `${base}/${expr}.webp`;

// Image reçue juste après sa création : affichée tout de suite, sans téléchargement
export async function primePortrait(path, blob) {
  if (urls.has(path)) return urls.get(path);
  const url = URL.createObjectURL(await clearBackground(blob));
  urls.set(path, url);
  remember(path, blob);
  return url;
}

export function loadPortrait(path) {
  if (urls.has(path)) return Promise.resolve(urls.get(path));
  if (pending.has(path)) return pending.get(path);
  if (!source || Date.now() - (failedAt.get(path) || 0) < 30000) return Promise.resolve(null);
  const job = (async () => {
    try {
      let blob = await recall(path);
      if (!blob) {
        blob = await source(path);
        remember(path, blob);
      }
      const url = URL.createObjectURL(await clearBackground(blob));
      urls.set(path, url);
      return url;
    } catch {
      failedAt.set(path, Date.now());
      return null;
    } finally {
      pending.delete(path);
    }
  })();
  pending.set(path, job);
  return job;
}

// Renvoie l'URL du visage, ou null tant qu'il n'est pas chargé (l'avatar dessiné s'affiche alors)
export function usePortrait(path) {
  const [, setTick] = useState(0);
  const url = path ? urls.get(path) || null : null;
  useEffect(() => {
    if (!path || url) return undefined;
    let alive = true;
    loadPortrait(path).then((u) => alive && u && setTick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [path, url]);
  return url;
}

async function recall(path) {
  if (!('caches' in window)) return null;
  try {
    const hit = await (await caches.open(CACHE)).match(cacheKey(path));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

function remember(path, blob) {
  if (!('caches' in window)) return;
  caches
    .open(CACHE)
    .then((cache) => cache.put(cacheKey(path), new Response(blob, { headers: { 'Content-Type': blob.type || 'image/webp' } })))
    .catch(() => {});
}

const cacheKey = (path) => new Request(`${location.origin}/__portraits/${path}`);

async function decode(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { canvas, ctx };
}

// Le visage doit avoir un fond transparent. Si le générateur a quand même mis un fond uni,
// on l'efface en partant des bords (remplissage par couleur proche).
export async function clearBackground(blob) {
  try {
    const { canvas, ctx } = await decode(blob);
    const { width: w, height: h } = canvas;
    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    if (corners.every((i) => px[i * 4 + 3] < 20)) return blob;
    const [r0, g0, b0] = [px[0], px[1], px[2]];
    const close = (i) => Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0) < 60;
    const seen = new Uint8Array(w * h);
    const stack = [...corners];
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      if (!close(p * 4)) continue;
      px[p * 4 + 3] = 0;
      const x = p % w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < w * (h - 1)) stack.push(p + w);
    }
    ctx.putImageData(img, 0, 0);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/png'));
  } catch {
    return blob;
  }
}

// Couleur de peau prise sur le cou, juste sous le menton : les mains et le col du corps dessiné
// prennent la même teinte que le visage.
export async function sampleSkin(blob, marks) {
  try {
    const { canvas, ctx } = await decode(blob);
    const { width: w, height: h } = canvas;
    const cx = Math.round(((marks.eyeLeftX + marks.eyeRightX) / 2) * w);
    const cy = Math.round(Math.min(0.98, marks.chinY + 0.05) * h);
    const { data } = ctx.getImageData(Math.max(0, cx - 6), Math.max(0, cy - 6), 12, 12);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    if (n < 20) return null;
    const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return null;
  }
}
