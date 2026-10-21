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

// Image à préparer de nouveau (ses repères ont changé) ; le fichier reste dans le cache du navigateur
export function forgetPortrait(path) {
  const entry = ready.get(path);
  if (!entry) return;
  ready.delete(path);
  for (const url of [entry.url, entry.body?.cloth, entry.body?.skinMask, entry.body?.shade]) if (url) URL.revokeObjectURL(url);
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

// Image avec le haut du corps : les repères des bras sont là
export const hasBody = (m) => Boolean(m && Number.isFinite(m.elbowLeftX) && Number.isFinite(m.waistY));

const toUrl = (canvas, fallback = null) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b || fallback ? URL.createObjectURL(b || fallback) : ''), 'image/png'));

// Détourage + couleur de peau, en une seule lecture de l'image ; pour un personnage avec le haut du corps,
// aussi les masques du t-shirt et de la peau, l'ombrage du tissu et l'épaisseur des bras (bodyMaps)
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
    const withBody = keyed && hasBody(marks);
    const neck = keyed && marks && !withBody ? measureNeck(img.data, w, h, (marks.eyeLeftX + marks.eyeRightX) / 2, marks.chinY) : null;
    const body = withBody ? await bodyMaps(img.data, w, h, marks) : null;
    if (keyed !== 'already') ctx.putImageData(img, 0, 0);
    const url = keyed === 'already' ? URL.createObjectURL(blob) : await toUrl(canvas, blob);
    return { url, skin, neck, keyed: keyed !== false, ratio: h / w, body };
  } catch {
    return { url: URL.createObjectURL(blob), skin: null, neck: null, keyed: false, ratio: 1, body: null };
  }
}

// Haut du corps en t-shirt blanc : trois images à demi-résolution, tirées des pixels du personnage
//  - cloth : le t-shirt (blanc opaque là où c'est du tissu), pour le colorer et y poser les costumes
//  - skinMask : la peau (les gants ne couvrent que les mains)
//  - shade : la lumière du tissu et de la peau (gris, 1 = le plus éclairé), posée en « produit » sur
//    les couleurs : le costume garde les plis, les ombres et le volume de l'image
// et l'épaisseur de chaque segment de bras (rayons en fraction de la largeur de l'image).
async function bodyMaps(px, w, h, m) {
  const mw = Math.round(w / 2);
  const mh = Math.round(h / 2);
  const n = mw * mh;
  const lum = new Float32Array(n);
  const cloth = new Float32Array(n);
  const skinW = new Float32Array(n);
  const chin = m.chinY - 0.004;
  const ramp = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  // La tête (cheveux compris) n'est jamais du tissu : le blanc des yeux et des dents reste intact,
  // mais les manches levées à côté de la tête restent du tissu
  const hx = (m.headLeftX + m.headRightX) / 2;
  const hy = (m.topY + m.chinY) / 2;
  const rx = ((m.headRightX - m.headLeftX) / 2) * 1.04;
  const ry = (m.chinY - m.topY) / 2;
  for (let y = 0; y < mh; y++) {
    const fy = ((y / mh - hy) / ry) ** 2;
    for (let x = 0; x < mw; x++) {
      const i = ((y * 2) * w + x * 2) * 4;
      const a = px[i + 3] / 255;
      const p = y * mw + x;
      if (a < 0.03) continue;
      const clothZone = y / mh > chin || fy + ((x / mw - hx) / rx) ** 2 > 1;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Teinte chaude de la peau : (rouge - bleu) rapporté à la luminosité ; le blanc, même sous une
      // lumière chaude, reste bien plus neutre que la peau la plus claire
      const warm = (r - b) / Math.max(r, g, 1);
      // Reste de fond vert au bord du personnage : ni tissu ni peau
      const green = ramp(g - Math.max(r, b), 24, 10);
      lum[p] = l;
      if (clothZone) cloth[p] = a * green * ramp(0.17 - warm, 0, 0.06) * ramp(l, 0.14, 0.26);
      skinW[p] = a * green * ramp(warm, 0.12, 0.18) * ramp(l, 0.1, 0.2);
    }
  }
  // Lumière de référence (le plus éclairé, hors reflets) du tissu et de la peau sous le menton
  const ref = (weights, from) => {
    const vals = [];
    for (let p = from; p < n; p += 3) if (weights[p] > 0.8) vals.push(lum[p]);
    if (vals.length < 50) return 0.9;
    vals.sort((a, b) => a - b);
    return Math.max(0.3, vals[Math.floor(vals.length * 0.92)]);
  };
  const from = Math.floor(chin * mh) * mw;
  const clothRef = ref(cloth, from);
  const skinRef = ref(skinW, from);
  const make = (fill) => {
    const c = document.createElement('canvas');
    c.width = mw;
    c.height = mh;
    const cx = c.getContext('2d');
    const out = cx.createImageData(mw, mh);
    for (let p = 0; p < n; p++) fill(out.data, p * 4, p);
    cx.putImageData(out, 0, 0);
    return c;
  };
  const white = (weights) => (d, i, p) => {
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = Math.round(weights[p] * 255);
  };
  const shade = make((d, i, p) => {
    const c = cloth[p];
    const s = skinW[p];
    const k = c + s > 0 ? (c * Math.min(1, lum[p] / clothRef) + s * Math.min(1, lum[p] / skinRef)) / (c + s) : 1;
    d[i] = d[i + 1] = d[i + 2] = Math.round(k * 255);
    d[i + 3] = c + s > 0 ? 255 : 0;
  });
  const [clothUrl, skinUrl, shadeUrl] = await Promise.all([toUrl(make(white(cloth))), toUrl(make(white(skinW))), toUrl(shade)]);
  return { cloth: clothUrl, skinMask: skinUrl, shade: shadeUrl, arms: { l: armWidths(px, w, h, m, 'Left'), r: armWidths(px, w, h, m, 'Right') } };
}

// Demi-épaisseur du bras et de l'avant-bras, mesurée en travers du milieu de chaque segment : jusqu'au
// fond des deux côtés, ou du seul côté libre quand le bras touche le buste
function armWidths(px, w, h, m, side) {
  const pt = (k) => [m[`${k}${side}X`] * w, m[`${k}${side}Y`] * h];
  const across = (a, b) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / L;
    const ny = (b[0] - a[0]) / L;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const reach = (dir) => {
      for (let d = 1; d < w * 0.2; d++) {
        const x = Math.round(mx + nx * d * dir);
        const y = Math.round(my + ny * d * dir);
        if (x < 0 || y < 0 || x >= w || y >= h || px[(y * w + x) * 4 + 3] < 128) return d;
      }
      return Infinity;
    };
    const d1 = reach(1);
    const d2 = reach(-1);
    const lo = Math.min(d1, d2);
    const hi = Math.max(d1, d2);
    const r = hi < lo * 2.2 ? (d1 + d2) / 2 : lo;
    return Math.min(0.09, Math.max(0.025, (Number.isFinite(r) ? r : w * 0.05) / w));
  };
  return { upper: across(pt('shoulder'), pt('elbow')), fore: across(pt('elbow'), pt('wrist')) };
}

// Cou dans l'image (fractions) : bas du cou, largeur et couleur à mi-hauteur entre le menton et
// le bas (là où il est droit, avant de s'élargir vers les épaules). Le cou dessiné derrière le
// visage le prolonge ainsi jusqu'au col, quel que soit le cadrage.
function measureNeck(px, w, h, centerX, chinY) {
  const cx = Math.round(centerX * w);
  const solid = (x, y) => px[(y * w + x) * 4 + 3] > 200;
  let bottom = -1;
  for (let y = h - 1; y > chinY * h; y--) {
    if (solid(cx, y)) {
      bottom = y;
      break;
    }
  }
  if (bottom < 0) return null;
  const y = Math.round(chinY * h + (bottom - chinY * h) * 0.5);
  if (!solid(cx, y)) return null;
  let x0 = cx;
  let x1 = cx;
  while (x0 > 0 && solid(x0 - 1, y)) x0--;
  while (x1 < w - 1 && solid(x1 + 1, y)) x1++;
  if (x1 - x0 < w * 0.06 || x1 - x0 > w * 0.5) return null;
  // Couleur prise là où le cou dessiné prend le relais (juste au-dessus du bas de l'image)
  const yc = Math.max(y, bottom - Math.round(h * 0.012));
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = yc - 3; yy <= yc + 3; yy++) {
    for (let x = x0 + Math.round((x1 - x0) * 0.3); x <= x1 - Math.round((x1 - x0) * 0.3); x++) {
      const i = (yy * w + x) * 4;
      if (px[i + 3] < 220) continue;
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
  }
  if (!n) return null;
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return { left: x0 / w, right: (x1 + 1) / w, top: y / h, bottom: (bottom + 1) / h, color: `#${hex(r)}${hex(g)}${hex(b)}` };
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
  const n = w * h;
  // Fond enfermé dans le personnage (entre un bras et le buste, mains sur les hanches) : pas relié aux
  // bords, il est retiré seulement s'il est franchement vert
  for (let p = 0; p < n; p++) {
    if (seen[p]) continue;
    const k = px[p * 4 + 1] - Math.max(px[p * 4], px[p * 4 + 2]);
    if (k < 80) continue;
    px[p * 4 + 3] = Math.round(px[p * 4 + 3] * (k >= 120 ? 0 : 1 - (k - 80) / 40));
    seen[p] = 1;
  }
  // Liseré vert dans les cheveux : on retire le vert des pixels proches du fond (jusqu'à 7 px),
  // franchement sur les 3 premiers, plus doucement ensuite
  const RING = 7;
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
