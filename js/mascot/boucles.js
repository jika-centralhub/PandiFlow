// Labo : les boucles enregistrées.
// Un Pandi de carte au repos refait sans cesse le même geste (il se brosse les dents, se balance…). Au lieu
// de recalculer la 3D 15 fois par seconde, on enregistre une fois un tour complet du geste (quelques
// secondes, 12 images par seconde) dans une planche d'images, puis le navigateur la fait défiler tout seul
// (une animation CSS en « steps ») : plus aucun calcul 3D tant que rien ne change. Dès que Pandi doit
// réagir (une note, un changement de minuteur…), la vraie 3D reprend là où la boucle en était.
// Pour que la boucle ne saute pas au raccord, la fin du tour est fondue dans son début : d'abord la pose
// (Pandi rejoint en douceur sa position du début), puis l'image (les bulles et les emojis se fondent).
// Pendant l'enregistrement, Pandi est dessiné en direct comme d'habitude : chaque image dessinée est
// simplement recopiée dans la planche. Rien n'est calculé en plus.

const REC_FPS = 12;
const COLS = 8; // images par ligne de la planche
const BLEND_POSE = 0.45; // durée du fondu de pose de l'acteur (actor.js)
const BLEND_IMG = 0.5; // fondu des images au raccord (secondes)
const MAX_BYTES = 22e6; // une planche ne dépasse pas ~22 Mo (sinon moins d'images par seconde)
const MIN_FPS = 8;
const CACHE_BYTES = 70e6; // planches gardées en mémoire pour les cartes qui reviennent

// La durée d'un tour de chaque geste (secondes de numéro, voir acts.js) ; from : on n'enregistre qu'après
// l'entrée en matière (Pandi qui s'endort). Les numéros absents (coucher, réveil…) restent en direct.
export const LOOPS = {
  idle: { L: 9 }, coucou: { L: 4 }, dents: { L: 7 }, manger: { L: 3.4 }, douche: { L: 6 }, habiller: { L: 7.5 },
  cartable: { L: 6.5 }, lecture: { L: 8 }, ranger: { L: 7.8 }, dodo: { L: 8 }, endormi: { L: (2 * Math.PI) / 1.1, from: 4.6 },
  lever: { L: 6.5 }, mains: { L: 6 }, coiffer: { L: 4 }, chaussures: { L: 7.2 }, pancarte: { L: 5 },
  bravo: { L: 3.6 }, ok: { L: 2.5 }, calin: { L: 3.2 }, alarme: { L: 2.5 },
  sieste: { L: (2 * Math.PI) / 1.2 },
};

// Les chiffres du labo, repris par le compteur de performance (js/lib/perf.js)
export const stats = { on: true, bakes: 0, recMs: 0, recFrames: 0, hits: 0, aborted: 0, plays: 0, liveBack: 0, mb: 0, playing: 0, sizes: [] };
globalThis.pandiBoucles = stats;

const cache = new Map(); // clé -> planche { atlas, N, C, R, dReal, L, t0, w, h, bytes, inUse }

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `@keyframes pandi-bX { to { transform: translateX(-100%); } }
@keyframes pandi-bY { to { transform: translateY(-100%); } }
.pandi3d-boucle > div { position: absolute; left: 0; top: 0; will-change: transform; animation-iteration-count: infinite; }
.pandi3d-boucle > div > div { width: 100%; height: 100%; will-change: transform; animation-iteration-count: infinite; }
.pandi3d-boucle canvas { display: block; width: 100%; height: 100%; }`;
  document.head.appendChild(s);
}

// La clé d'une planche : le geste, ses réglages utiles, la tenue du jour, la couleur et la taille
function keyOf(v, w, h) {
  const ctx = { ...v.actor.cur.ctx };
  if (v.actName !== 'dents') delete ctx.zone; // la zone de la bouche ne compte que pour les dents
  return `${v.actName}|${JSON.stringify(ctx)}|${v.lookKey}|${w}x${h}`;
}

// Un Pandi peut-il passer en boucle maintenant ?
export function canStart(v) {
  if (!v.loop || v.still || v.loop.mode !== 'live' || v.loop.rec) return false;
  const spec = LOOPS[v.actName];
  const a = v.actor;
  if (!spec || a.prev || a.mix < 1 || a.cur.t < (spec.from || 0) + 0.3) return false;
  // pendant une réaction, la carte passe à 30 images par seconde : on attend qu'elle revienne au calme
  if (!v.fps || v.fps > 15) return false;
  // la carte ne doit plus bouger de taille (glissement du carrousel) depuis une demi-seconde
  const w = v.canvas.width, h = v.canvas.height;
  const sk = `${w}x${h}`;
  const now = performance.now();
  if (v.loop.sizeKey !== sk) {
    v.loop.sizeKey = sk;
    v.loop.sizeSince = now;
    return false;
  }
  return now - v.loop.sizeSince > 500 && w > 8 && h > 8;
}

// Commence l'enregistrement (ou rejoue tout de suite une planche déjà faite)
export function start(v, enterPlay) {
  const a = v.actor;
  const spec = LOOPS[v.actName];
  const w = v.canvas.width, h = v.canvas.height;
  // les dents sans minuteur changent de coin toutes les 8 s : la boucle garde le coin du moment
  if (v.actName === 'dents' && a.cur.ctx.zone == null) a.cur.ctx.zone = Math.floor(a.cur.t / 8) % 4;
  const key = keyOf(v, w, h);
  const hit = cache.get(key);
  if (hit && !hit.inUse) {
    cache.delete(key);
    cache.set(key, hit); // la plus récente en dernier
    stats.hits++;
    const tempo = a.cur.ctx.tempo || 1;
    const phase = ((((a.cur.t - hit.t0) / tempo) % (hit.N * hit.dReal)) + hit.N * hit.dReal) % (hit.N * hit.dReal);
    return enterPlay(v, hit, phase);
  }
  const tempo = a.cur.ctx.tempo || 1;
  const realL = spec.L / tempo; // durée réelle d'un tour
  let fps = REC_FPS;
  if (w * h * 4 * realL * fps > MAX_BYTES) fps = MAX_BYTES / (w * h * 4 * realL);
  if (fps < MIN_FPS) {
    v.loop.failed = key;
    return false;
  }
  const N = Math.max(COLS, Math.round((realL * fps) / COLS) * COLS);
  const C = COLS, R = N / COLS;
  const dReal = realL / N;
  const M = Math.ceil(BLEND_POSE / dReal) + 1;
  const K = Math.max(2, Math.round(BLEND_IMG / dReal));
  const atlas = document.createElement('canvas');
  atlas.width = C * w;
  atlas.height = R * h;
  const tail = document.createElement('canvas');
  tail.width = K * w;
  tail.height = h;
  // pas de clignement coupé en deux au début de l'enregistrement
  a.blink.t = -1;
  a.blink.next = Math.max(a.blink.next, 0.6);
  v.loop.rec = { key, N, C, R, dReal, L: spec.L, M, K, w, h, frame: 0, t0: 0, atlas, g: atlas.getContext('2d'), tail, tg: tail.getContext('2d'), ms: 0 };
  return false;
}

export function abort(v) {
  if (!v.loop?.rec) return;
  v.loop.rec.atlas.width = 0;
  v.loop.rec.tail.width = 0;
  v.loop.rec = null;
  stats.aborted++;
}

// Après chaque image dessinée en direct pendant l'enregistrement : on la recopie dans la planche
export function capture(v, enterPlay) {
  const r = v.loop.rec;
  const a = v.actor;
  const t = performance.now();
  if (v.canvas.width !== r.w || v.canvas.height !== r.h) return abort(v);
  if (r.frame === 0) r.t0 = a.cur.t;
  if (r.frame < r.N) r.g.drawImage(v.canvas, (r.frame % r.C) * r.w, Math.floor(r.frame / r.C) * r.h);
  else r.tg.drawImage(v.canvas, (r.frame - r.N) * r.w, 0);
  r.frame++;
  // fondu de pose : les dernières images rejoignent la pose du début du tour (même geste, un tour plus tôt)
  if (r.frame === r.N - r.M) {
    a.prev = { act: a.cur.act, t: a.cur.t, ctx: a.cur.ctx };
    a.cur = { act: a.cur.act, t: a.cur.t - r.L, ctx: a.cur.ctx };
    a.mix = 0;
  }
  // pas de clignement à cheval sur le raccord
  if (r.frame >= r.N - Math.round(0.35 / r.dReal) && a.blink.t < 0) a.blink.next = Math.max(a.blink.next, 0.4);
  r.ms += performance.now() - t;
  if (r.frame < r.N + r.K) return;
  finish(v, enterPlay);
}

function finish(v, enterPlay) {
  const r = v.loop.rec;
  const t = performance.now();
  const { w, h, g } = r;
  // fondu d'images : le début du tour se mélange à la suite de la fin (les bulles, les emojis)
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sg = scratch.getContext('2d');
  const dbg = globalThis.pandiBouclesDebug;
  if (dbg) dbg.push({ act: v.actName, N: r.N, K: r.K, w, h, head: r.g.getImageData(0, 0, r.C * w, h * Math.ceil(r.K / r.C)), tail: r.tg.getImageData(0, 0, r.K * w, h) });
  for (let j = 0; j < r.K; j++) {
    const k = (j + 1) / (r.K + 1);
    const x = (j % r.C) * w, y = Math.floor(j / r.C) * h;
    sg.clearRect(0, 0, w, h);
    sg.drawImage(r.atlas, x, y, w, h, 0, 0, w, h);
    g.clearRect(x, y, w, h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1 - k;
    g.drawImage(r.tail, j * w, 0, w, h, x, y, w, h);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = k;
    g.drawImage(scratch, 0, 0, w, h, x, y, w, h);
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  scratch.width = 0;
  r.tail.width = 0;
  r.ms += performance.now() - t;
  const entry = { key: r.key, atlas: r.atlas, N: r.N, C: r.C, R: r.R, dReal: r.dReal, L: r.L, t0: r.t0, w, h, bytes: r.atlas.width * r.atlas.height * 4, inUse: false };
  stats.bakes++;
  stats.recMs = Math.round(stats.recMs + r.ms);
  stats.recFrames += r.N + r.K;
  stats.sizes = [...stats.sizes.slice(-5), `${v.actName} ${w}x${h} ${r.N}im ${(entry.bytes / 1e6).toFixed(1)}Mo`];
  v.loop.rec = null;
  cache.set(entry.key, entry);
  trim();
  // la boucle reprend à l'image qui suit la dernière dessinée en direct
  enterPlay(v, entry, r.K * r.dReal);
}

function trim() {
  let total = 0;
  for (const e of cache.values()) total += e.bytes;
  for (const [k, e] of cache) {
    if (total <= CACHE_BYTES) break;
    if (e.inUse) continue;
    cache.delete(k);
    total -= e.bytes;
    e.atlas.width = 0;
  }
  stats.mb = Math.round(total / 1e5) / 10;
}

// La planche qui défile : deux boîtes l'une dans l'autre, l'une avance de ligne en ligne, l'autre
// d'image en image dans la ligne (des « steps » : chaque image reste affichée tout son temps)
export function makePlayer(entry, phase) {
  addStyle();
  const el = document.createElement('div');
  const row = document.createElement('div');
  const col = document.createElement('div');
  col.appendChild(entry.atlas);
  row.appendChild(col);
  el.appendChild(row);
  const k = Math.round(phase / entry.dReal) % entry.N;
  const delay = `${(-(k + 0.5) * entry.dReal).toFixed(3)}s`;
  row.style.cssText = `width:${entry.C * 100}%;height:${entry.R * 100}%;animation-name:pandi-bY;animation-duration:${(entry.N * entry.dReal).toFixed(3)}s;animation-timing-function:steps(${entry.R});animation-delay:${delay}`;
  col.style.cssText = `animation-name:pandi-bX;animation-duration:${(entry.C * entry.dReal).toFixed(3)}s;animation-timing-function:steps(${entry.C});animation-delay:${delay}`;
  return { el, row, col, entry, k, running: true, start: performance.now(), acc: 0 };
}

// Où en est la boucle (secondes depuis le début du tour), pour que la 3D reprenne au même endroit
export function phaseOf(play) {
  const e = play.entry;
  const loop = e.N * e.dReal;
  const run = play.acc + (play.running ? (performance.now() - play.start) / 1000 : 0);
  return ((play.k + 0.5) * e.dReal + run) % loop;
}

export function setRunning(play, on) {
  if (play.running === on) return;
  if (on) play.start = performance.now();
  else play.acc += (performance.now() - play.start) / 1000;
  play.running = on;
  const st = on ? 'running' : 'paused';
  play.row.style.animationPlayState = st;
  play.col.style.animationPlayState = st;
}

export function countPlaying(n) {
  stats.playing = n;
}
