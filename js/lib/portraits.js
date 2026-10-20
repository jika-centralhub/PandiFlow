// Visages 3D des enfants : téléchargés depuis Supabase Storage (bucket privé « portraits »),
// gardés en mémoire pour la session et dans le cache du navigateur quand il est disponible (https).
// Chaque chemin contient une version : un fichier ne change jamais, on peut le garder indéfiniment.
// Au chargement, le fond est retiré ici, sans IA : fond vert uni (incrustation), sinon fond uni ;
// si le fond ne peut pas être retiré, l'avatar découpe le visage avec un masque doux.
import { useEffect, useState } from '../vendor/preact-htm.js';

const CACHE = 'pandiflow-portraits';
const ready = new Map(); // chemin -> { url, skin, keyed }
const pending = new Map(); // chemin -> Promise<entrée | null>
const failedAt = new Map(); // chemin -> date du dernier échec (nouvel essai après 30 s)
let source = null; // (chemin) => Promise<Blob>, fourni par le dépôt Supabase

export function setPortraitSource(fn) {
  source = fn;
}

export const portraitPath = (base, expr) => `${base}/${expr}.webp`;

// Image reçue juste après sa création : affichée tout de suite, sans téléchargement
export async function primePortrait(path, blob, marks) {
  if (ready.has(path)) return ready.get(path);
  const entry = await prepare(blob, marks);
  ready.set(path, entry);
  remember(path, blob);
  return entry;
}

export function loadPortrait(path, marks) {
  if (ready.has(path)) return Promise.resolve(ready.get(path));
  if (pending.has(path)) return pending.get(path);
  if (!source || Date.now() - (failedAt.get(path) || 0) < 30000) return Promise.resolve(null);
  const job = (async () => {
    try {
      let blob = await recall(path);
      if (!blob) {
        blob = await source(path);
        remember(path, blob);
      }
      const entry = await prepare(blob, marks);
      ready.set(path, entry);
      return entry;
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

// Renvoie { url, skin, keyed } du visage, ou null tant qu'il n'est pas chargé (la tête dessinée s'affiche alors)
export function usePortrait(path, marks) {
  const [, setTick] = useState(0);
  const entry = path ? ready.get(path) || null : null;
  useEffect(() => {
    if (!path || entry) return undefined;
    let alive = true;
    loadPortrait(path, marks).then((e) => alive && e && setTick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [path, entry]);
  return entry;
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

// Détourage + couleur de peau, en une seule lecture de l'image
async function prepare(blob, marks) {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const { width: w, height: h } = canvas;
    const img = ctx.getImageData(0, 0, w, h);
    const keyed = clearBackground(img.data, w, h);
    const skin = marks ? sampleSkin(img.data, w, h, marks) : null;
    if (keyed !== 'already') ctx.putImageData(img, 0, 0);
    const out = keyed === 'already' ? blob : await new Promise((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/png'));
    return { url: URL.createObjectURL(out), skin, keyed: keyed !== false };
  } catch {
    return { url: URL.createObjectURL(blob), skin: null, keyed: false };
  }
}

// Renvoie 'already' (déjà transparent), 'green', 'plain' ou false (fond impossible à retirer)
function clearBackground(px, w, h) {
  const border = [];
  const step = Math.max(1, Math.floor((w + h) / 60));
  for (let x = 0; x < w; x += step) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += step) border.push(y * w, y * w + w - 1);
  if (border.every((p) => px[p * 4 + 3] < 20)) return 'already';
  const greenness = (p) => px[p * 4 + 1] - Math.max(px[p * 4], px[p * 4 + 2]);
  if (border.filter((p) => greenness(p) > 90).length > border.length * 0.6) {
    keyGreen(px, w, h);
    return 'green';
  }
  // Fond uni d'une autre couleur : tous les bords doivent être de la même teinte
  const [r0, g0, b0] = [0, 1, 2].map((c) => border.reduce((s, p) => s + px[p * 4 + c], 0) / border.length);
  const far = (p) => Math.abs(px[p * 4] - r0) + Math.abs(px[p * 4 + 1] - g0) + Math.abs(px[p * 4 + 2] - b0);
  if (border.some((p) => far(p) > 36)) return false;
  flood(px, w, h, (p) => far(p) < 54, () => 0);
  return 'plain';
}

// Incrustation sur fond vert : transparence progressive sur les bords, sans liseré vert
function keyGreen(px, w, h) {
  const LOW = 30;
  const HIGH = 120;
  const seen = flood(
    px,
    w,
    h,
    (p) => px[p * 4 + 1] - Math.max(px[p * 4], px[p * 4 + 2]) >= LOW,
    (p) => {
      const k = px[p * 4 + 1] - Math.max(px[p * 4], px[p * 4 + 2]);
      return k >= HIGH ? 0 : 1 - (k - LOW) / (HIGH - LOW);
    },
  );
  // Liseré vert dans les cheveux : on retire le vert des pixels proches du fond (jusqu'à 7 px),
  // franchement sur les 3 premiers, plus doucement ensuite
  const RING = 7;
  const n = w * h;
  const dist = new Uint8Array(n);
  let front = [];
  for (let p = 0; p < n; p++) if (seen[p]) {
    dist[p] = 1;
    front.push(p);
  }
  for (let d = 1; d <= RING && front.length; d++) {
    const next = [];
    for (const p of front) {
      const i = p * 4;
      const lim = d <= 3 ? (px[i] + px[i + 2]) / 2 : Math.max(px[i], px[i + 2]);
      if (px[i + 1] > lim) px[i + 1] = Math.round(lim);
      if (d === RING) continue;
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1]) {
        if (q >= 0 && !dist[q]) {
          dist[q] = d + 1;
          next.push(q);
        }
      }
    }
    front = next;
  }
}

// Remplissage depuis les bords : alpha(p) donne l'opacité gardée (0 = transparent)
function flood(px, w, h, inside, alpha) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const push = (p) => {
    if (!seen[p] && inside(p)) {
      seen[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push(n - w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (top) {
    const p = stack[--top];
    px[p * 4 + 3] = Math.round(px[p * 4 + 3] * alpha(p));
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  return seen;
}

// Couleur de peau prise sur le front et les joues (médiane des teintes, sans les cheveux ni le fond) :
// les mains et le col du corps dessiné prennent la même teinte que le visage.
function sampleSkin(px, w, h, m) {
  const eyeY = (m.eyeLeftY + m.eyeRightY) / 2;
  const gap = m.eyeRightX - m.eyeLeftX;
  const spots = [
    [(m.eyeLeftX + m.eyeRightX) / 2, eyeY - gap * 0.55],
    [m.eyeLeftX - gap * 0.1, eyeY + gap * 0.5],
    [m.eyeRightX + gap * 0.1, eyeY + gap * 0.5],
  ];
  const tones = [];
  const r = Math.max(4, Math.round(w * 0.012));
  for (const [fx, fy] of spots) {
    const cx = Math.round(fx * w);
    const cy = Math.round(fy * h);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        if (px[i + 3] < 220 || px[i + 1] - Math.max(px[i], px[i + 2]) > 10) continue;
        tones.push([px[i], px[i + 1], px[i + 2]]);
      }
    }
  }
  if (tones.length < 30) return null;
  // Les plus sombres (cheveux, sourcils) et les plus claires (reflets) sont écartées
  tones.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const mid = tones.slice(Math.floor(tones.length * 0.3), Math.ceil(tones.length * 0.8));
  const hex = (c) => Math.round(mid.reduce((s, t) => s + t[c], 0) / mid.length).toString(16).padStart(2, '0');
  return `#${hex(0)}${hex(1)}${hex(2)}`;
}
