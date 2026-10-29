// Visages 3D des enfants : téléchargés depuis Supabase Storage (bucket privé « portraits »),
// gardés en mémoire pour la session et dans le cache du navigateur quand il est disponible (https).
// Chaque chemin contient une version : un fichier ne change jamais, on peut le garder indéfiniment.
// Au chargement, le fond est retiré ici, sans IA : fond vert uni (incrustation), sinon fond uni ;
// si le fond ne peut pas être retiré, l'avatar découpe le visage avec un masque doux.
// Le résultat de cette préparation (image détourée, masques du corps, mesures) est lui aussi gardé sur
// l'appareil et relu tel quel aux lancements suivants : sur iPhone, les 8 images (2 enfants × 4 poses)
// demandaient de 0,3 à 1,4 s de calcul chacune à chaque lancement (mesuré le 29/10/2026).
import { useEffect, useState } from '../vendor/preact-htm.js';
import { measure } from './util.js';

const CACHE = 'pandiflow-portraits';
const PREP_CACHE = 'pandiflow-portraits-prets';
// À changer dès que le calcul de prepareImage ou de bodyMaps change : tout est alors préparé de nouveau
const PREP_VERSION = 1;
const BODY_PARTS = ['cloth', 'skinMask', 'shade', 'hood', 'hair', 'headShade'];
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
  const entry = await prepare(path, blob, marks);
  ready.set(path, entry);
  remember(path, blob);
  return entry;
}

// Image à préparer de nouveau (ses repères ont changé) ; le fichier reste dans le cache du navigateur
export function forgetPortrait(path) {
  const entry = ready.get(path);
  if (!entry) return;
  ready.delete(path);
  const b = entry.body || {};
  for (const url of [entry.url, b.cloth, b.skinMask, b.shade, b.hood, b.hair, b.headShade]) if (url) URL.revokeObjectURL(url);
}

// urgent : la pose est affichée maintenant (elle passe devant celles chargées en avance)
export function loadPortrait(path, marks, urgent = false) {
  if (ready.has(path)) return Promise.resolve(ready.get(path));
  if (pending.has(path)) {
    if (urgent) promote(path);
    return pending.get(path);
  }
  if (!source || Date.now() - (failedAt.get(path) || 0) < 30000) return Promise.resolve(null);
  const job = (async () => {
    try {
      const start = performance.now();
      const kept = await recallPrepared(path, marks);
      if (kept) {
        const entry = toEntry(kept.raw, kept.source);
        measure('pandiflow:portrait', start, { cached: true, body: Boolean(entry.body), outKb: kept.kb });
        ready.set(path, entry);
        return entry;
      }
      let blob = await recall(path);
      if (!blob) {
        blob = await source(path);
        remember(path, blob);
      }
      const entry = await inTurn(path, () => prepare(path, blob, marks), urgent);
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
    loadPortrait(path, marks, true).then((e) => alive && e && setTick((n) => n + 1));
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

// --- Préparations gardées sur l'appareil ----------------------------------------------------
// Une préparation ne dépend que de l'image (son chemin contient sa version), de ses repères et du calcul
// (PREP_VERSION) : la clé contient les trois. Les morceaux sont rangés d'abord, la fiche (meta) en dernier :
// une fiche présente veut dire une préparation complète.
const stable = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? `[${v.map(stable)}]` : `{${Object.keys(v).sort().map((k) => `${k}:${stable(v[k])}`)}}`) : String(v));
function marksKey(marks) {
  if (!marks) return 'sans-reperes';
  let h = 2166136261;
  for (const ch of stable(marks)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}
const prepBase = (path, marks) => `${location.origin}/__portraits-prets/v${PREP_VERSION}/${path}/${marksKey(marks)}/`;

// Range une préparation complète ; renvoie le poids de ce qui est rangé (Ko), pour le compteur de performance
function storePrepared(path, marks, raw) {
  const parts = {};
  if (raw.main) parts.main = raw.main;
  if (raw.body) Object.assign(parts, raw.body.blobs);
  const kb = Math.round(Object.values(parts).reduce((s, b) => s + (b?.size || 0), 0) / 1024);
  // une image qui n'a pas pu être produite n'est pas gardée : elle sera refaite au prochain lancement
  const complete = (raw.main || raw.already) && Object.values(parts).every(Boolean);
  if (!complete || !('caches' in window)) return kb;
  const base = prepBase(path, marks);
  caches
    .open(PREP_CACHE)
    .then(async (cache) => {
      await Promise.all(Object.entries(parts).map(([k, b]) => cache.put(new Request(base + k), new Response(b, { headers: { 'Content-Type': 'image/png' } }))));
      const meta = { skin: raw.skin, neck: raw.neck, keyed: raw.keyed, ratio: raw.ratio, main: Boolean(raw.main), body: raw.body ? { arms: raw.body.arms } : null };
      await cache.put(new Request(base + 'meta'), new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
    })
    .catch(() => {});
  return kb;
}

// La préparation gardée, ou null (jamais faite, rangement incomplet, stockage vidé par le système)
async function recallPrepared(path, marks) {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(PREP_CACHE);
    const base = prepBase(path, marks);
    const hit = await cache.match(base + 'meta');
    if (!hit) return null;
    const meta = await hit.json();
    const get = async (k) => (await cache.match(base + k))?.blob() ?? null;
    const [main, ...parts] = await Promise.all([meta.main ? get('main') : recall(path), ...(meta.body ? BODY_PARTS.map(get) : [])]);
    if (!main || parts.some((b) => !b)) return null;
    const body = meta.body ? { blobs: Object.fromEntries(BODY_PARTS.map((k, i) => [k, parts[i]])), arms: meta.body.arms } : null;
    const kb = Math.round([main, ...parts].reduce((s, b) => s + b.size, 0) / 1024);
    return { raw: { main: meta.main ? main : null, skin: meta.skin, neck: meta.neck, keyed: meta.keyed, ratio: meta.ratio, body }, source: main, kb };
  } catch {
    return null;
  }
}

// Au démarrage : seules les préparations des visages actuels des enfants (avec leurs repères actuels)
// restent sur l'appareil ; list = [[chemin, repères], …]
export async function keepPrepared(list) {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(PREP_CACHE);
    const keep = new Set(list.map(([path, marks]) => prepBase(path, marks)));
    for (const req of await cache.keys()) if (!keep.has(req.url.slice(0, req.url.lastIndexOf('/') + 1))) cache.delete(req);
  } catch {
    /* rien */
  }
}

// Préparations une à la fois : la pose affichée passe devant les poses chargées en avance
const turns = [];
let turning = false;
function inTurn(path, fn, urgent) {
  return new Promise((resolve, reject) => {
    const turn = { path, fn, resolve, reject };
    if (urgent) turns.unshift(turn);
    else turns.push(turn);
    nextTurn();
  });
}
function promote(path) {
  const i = turns.findIndex((t) => t.path === path);
  if (i > 0) turns.unshift(...turns.splice(i, 1));
}
async function nextTurn() {
  if (turning) return;
  turning = true;
  while (turns.length) {
    const t = turns.shift();
    try {
      t.resolve(await t.fn());
    } catch (e) {
      t.reject(e);
    }
  }
  turning = false;
}

// Ce que l'avatar utilise : des adresses d'images (blob:) et les mesures ; raw null = image brute, telle quelle
function toEntry(raw, sourceBlob) {
  if (!raw) return { url: URL.createObjectURL(sourceBlob), skin: null, neck: null, keyed: false, ratio: 1, body: null };
  const b = raw.body;
  const body = b ? { ...Object.fromEntries(BODY_PARTS.map((k) => [k, b.blobs[k] ? URL.createObjectURL(b.blobs[k]) : ''])), arms: b.arms } : null;
  return { url: URL.createObjectURL(raw.main || sourceBlob), skin: raw.skin, neck: raw.neck, keyed: raw.keyed, ratio: raw.ratio, body };
}

// Image avec le haut du corps : les repères des bras sont là
export const hasBody = (m) => Boolean(m && Number.isFinite(m.elbowLeftX) && Number.isFinite(m.waistY));

const toPng = (canvas) => new Promise((resolve) => canvas.toBlob((b) => resolve(b || null), 'image/png'));

// Prépare l'image, range le résultat sur l'appareil et renvoie ce que l'avatar utilise ; la durée est lue
// par le compteur de performance caché (js/lib/perf.js)
async function prepare(path, blob, marks) {
  const start = performance.now();
  const raw = await prepareImage(blob, marks);
  const outKb = raw ? storePrepared(path, marks, raw) : 0;
  measure('pandiflow:portrait', start, { cached: false, body: Boolean(raw?.body), keyed: raw?.keyed ?? false, kb: Math.round(blob.size / 1024), outKb });
  return toEntry(raw, blob);
}

// Détourage + couleur de peau, en une seule lecture de l'image ; pour un personnage avec le haut du corps,
// aussi les masques du t-shirt et de la peau, l'ombrage du tissu et l'épaisseur des bras (bodyMaps).
// Renvoie les images produites (main : l'image détourée, null si elle l'était déjà) et les mesures, ou
// null si l'image n'a pas pu être lue (elle s'affiche alors telle quelle).
async function prepareImage(blob, marks) {
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
    const main = keyed === 'already' ? null : await toPng(canvas);
    return { main, already: keyed === 'already', skin, neck, keyed: keyed !== false, ratio: h / w, body };
  } catch {
    return null;
  }
}

// Force de la lumière de l'image sur les couleurs posées : un peu adoucie, pour garder le volume
// sans marquer le tissu de taches claires et sombres
const CLOTH_LIGHT = 0.7;
const HEAD_LIGHT = 0.6;

// Haut du corps en t-shirt blanc : images à demi-résolution, tirées des pixels du personnage
//  - cloth : le t-shirt (blanc opaque là où c'est du tissu), pour le colorer et y poser les costumes
//  - skinMask : la peau (les gants ne couvrent que les mains)
//  - shade : la lumière du tissu et de la peau (gris, 1 = le plus éclairé), posée en « produit » sur
//    les couleurs : le costume garde les plis, les ombres et le volume de l'image
//  - hood, hair : toute la tête (cheveux compris), ses cheveux seuls ; headShade : sa lumière, adoucie
//    et floutée, pour les masques et cagoules des costumes
// et l'épaisseur de chaque segment de bras (rayons en fraction de la largeur de l'image).
async function bodyMaps(px, w, h, m) {
  const mw = Math.round(w / 2);
  const mh = Math.round(h / 2);
  const n = mw * mh;
  const lum = new Float32Array(n);
  const cloth = new Float32Array(n);
  const skinW = new Float32Array(n);
  const head = new Float32Array(n);
  const skinLike = new Float32Array(n);
  const chin = m.chinY - 0.004;
  const ramp = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  // La tête (cheveux compris) n'est jamais du tissu : le blanc des yeux et des dents reste intact,
  // mais les manches levées à côté de la tête restent du tissu
  const hx = (m.headLeftX + m.headRightX) / 2;
  const hy = (m.topY + m.chinY) / 2;
  const rx = ((m.headRightX - m.headLeftX) / 2) * 1.04;
  const ry = (m.chinY - m.topY) / 2;
  // Sous le menton, la peau n'est possible qu'aux mains et au cou : partout ailleurs c'est le t-shirt,
  // même là où une lumière chaude le teinte (sinon il resterait des taches blanches sous le costume)
  const k = h / w;
  const hands = ['Left', 'Right'].map((s) => {
    const hxs = m[`hand${s}X`];
    const hys = m[`hand${s}Y`];
    const r = Math.max(0.07, Math.hypot(hxs - m[`wrist${s}X`], (hys - m[`wrist${s}Y`]) * k) * 1.3);
    return [hxs, hys, r];
  });
  const neckHalf = (m.headRightX - m.headLeftX) * 0.3;
  // Visage (des sourcils au menton) : ni le blanc des yeux ni la bouche ne sont des cheveux
  const gap = m.eyeRightX - m.eyeLeftX;
  const eyeY = (m.eyeLeftY + m.eyeRightY) / 2;
  const faceTop = eyeY - (gap / k) * 0.6;
  const fcx = (m.eyeLeftX + m.eyeRightX) / 2;
  const fcy = (faceTop + m.chinY + 0.01) / 2;
  const frx = gap * 1.1;
  const fry = (m.chinY + 0.01 - faceTop) / 2;
  const hair = new Float32Array(n);
  const skinAllowed = (fx, fy) =>
    fy < m.chinY || (fy < m.collarY + 0.015 && Math.abs(fx - m.collarX) < neckHalf) ||
    hands.some(([cx, cy, r]) => (fx - cx) ** 2 + ((fy - cy) * k) ** 2 < r * r);
  for (let y = 0; y < mh; y++) {
    const fy = y / mh;
    const ey = ((fy - hy) / ry) ** 2;
    for (let x = 0; x < mw; x++) {
      const i = ((y * 2) * w + x * 2) * 4;
      const a = px[i + 3] / 255;
      const p = y * mw + x;
      if (a < 0.03) continue;
      const fx = x / mw;
      const e = ey + ((fx - hx) / rx) ** 2;
      const inHead = e <= 1;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Teinte chaude de la peau : (rouge - bleu) rapporté à la luminosité ; le blanc, même sous une
      // lumière chaude, reste bien plus neutre que la peau la plus claire
      const warm = (r - b) / Math.max(r, g, 1);
      // Reste de fond vert au bord du personnage : ni tissu ni peau
      const green = ramp(g - Math.max(r, b), 24, 10);
      const sk = green * ramp(warm, 0.12, 0.18) * ramp(l, 0.1, 0.2);
      lum[p] = l;
      skinLike[p] = sk;
      // Cagoule : toute la tête, et juste autour la peau seule (les oreilles, jamais une manche levée)
      if (fy <= m.chinY + 0.012) head[p] = inHead ? a * green : e <= 1.2 ? a * sk : 0;
      const inFace = ((fx - fcx) / frx) ** 2 + ((fy - fcy) / fry) ** 2 < 1;
      if (inHead && !inFace) hair[p] = head[p] * (1 - sk);
      if (inHead && fy <= chin) {
        skinW[p] = a * sk;
      } else {
        const s = skinAllowed(fx, fy) ? sk : 0;
        skinW[p] = a * s;
        cloth[p] = a * green * (1 - s);
      }
    }
  }
  // Lumière de référence (le plus éclairé, hors reflets) d'une zone
  const ref = (weight, from = 0) => {
    const vals = [];
    for (let p = from; p < n; p += 3) if (weight(p) > 0.8) vals.push(lum[p]);
    if (vals.length < 50) return 0.9;
    vals.sort((a, b) => a - b);
    return Math.max(0.3, vals[Math.floor(vals.length * 0.92)]);
  };
  const from = Math.floor(chin * mh) * mw;
  const clothRef = ref((p) => cloth[p], from);
  const skinRef = ref((p) => skinW[p], from);
  // Tête : la peau et les cheveux ont chacun leur lumière de référence (les cheveux sombres ne doivent
  // pas assombrir une cagoule)
  const faceRef = ref((p) => head[p] * skinLike[p]);
  const hairRef = ref((p) => hair[p]);
  const soft = (v, strength) => 1 - (1 - Math.min(1, v)) * strength;
  const HAIR_LIGHT = 0.35;
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
  const white = (weight) => (d, i, p) => {
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = Math.round(weight(p) * 255);
  };
  const shade = make((d, i, p) => {
    const c = cloth[p];
    const s = skinW[p];
    const v = c + s > 0 ? (c * soft(lum[p] / clothRef, CLOTH_LIGHT) + s * Math.min(1, lum[p] / skinRef)) / (c + s) : 1;
    d[i] = d[i + 1] = d[i + 2] = Math.round(v * 255);
    d[i + 3] = c + s > 0 ? 255 : 0;
  });
  // Lumière de la tête : grandes formes seulement (front, joues, nez), sans le détail des mèches
  // (sous une cagoule, les cheveux ne donnent qu'un léger relief)
  const headRaw = make((d, i, p) => {
    const s = skinLike[p];
    const v = head[p] > 0 ? s * soft(lum[p] / faceRef, HEAD_LIGHT) + (1 - s) * soft(lum[p] / hairRef, HAIR_LIGHT) : 1;
    d[i] = d[i + 1] = d[i + 2] = Math.round(v * 255);
    d[i + 3] = 255;
  });
  const headShade = document.createElement('canvas');
  headShade.width = mw;
  headShade.height = mh;
  const hs = headShade.getContext('2d');
  hs.filter = `blur(${Math.max(3, Math.round(mw / 60))}px)`;
  hs.drawImage(headRaw, 0, 0);
  // dans l'ordre de BODY_PARTS
  const blobs = await Promise.all([
    toPng(make(white((p) => cloth[p]))),
    toPng(make(white((p) => skinW[p]))),
    toPng(shade),
    toPng(make(white((p) => head[p]))),
    toPng(make(white((p) => hair[p]))),
    toPng(headShade),
  ]);
  return {
    blobs: Object.fromEntries(BODY_PARTS.map((k, i) => [k, blobs[i]])),
    arms: { l: armWidths(px, w, h, m, 'Left'), r: armWidths(px, w, h, m, 'Right') },
  };
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
