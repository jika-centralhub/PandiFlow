// Compteur de performance caché : mesure l'app sur le vrai téléphone (celui dont l'écran est dupliqué
// sur la télé) sans rien changer à son fonctionnement. Chargé seulement quand il est allumé :
// ?perf l'allume sur cet appareil, ?perf=0 l'éteint (js/main.js).
//
// Une petite pastille dans le coin montre les images par seconde ; la toucher ouvre le rapport.
// En cloud, le rapport part tout seul dans la table perf_reports (une ligne par lancement de l'app,
// mise à jour 20 s après le lancement, toutes les 2 minutes et quand l'app passe en arrière-plan).
// Jamais de donnée d'enfant : seulement des durées, des nombres, des noms de fichiers et l'appareil.
//
// Mesuré :
//  - démarrage : premier affichage, code de l'app prêt, écran prêt, premier Pandi 3D ;
//  - fichiers chargés (nombre, poids, fin de la cascade) et appels Supabase (durées, rechargements complets) ;
//  - images par seconde minute par minute, saccades, temps de chaque boucle d'animation (Pandi 3D, ciel…) ;
//  - taps : du doigt jusqu'à l'écran à jour (Event Timing) ;
//  - images longues (plus de 50 ms) et le code responsable (Long Animation Frames) ;
//  - préparation des visages 3D, mémoire, batterie, réseau, erreurs.
import { getState } from './store.js';
import { getRepo } from './actions.js';
import { parseHash } from '../router.js';
import { uid } from './util.js';
import { APP_VERSION, SUPABASE_URL } from '../config.js';

const FLAG = 'pandiflow-perf';
const FIRST_SEND_MS = 20000;
const SEND_EVERY_MS = 120000;
const MAX_MINUTES = 240;
const JANK_MS = 50;
// Boucles d'animation, d'après le nom de la fonction donnée à requestAnimationFrame
const LOOPS = { tick: 'pandi3d', loop: 'ciel', step: 'scene', _tick: 'gsap' };
const LOOP_LABELS = { pandi3d: 'Pandi 3D', ciel: 'ciel', scene: 'scène', gsap: 'effets' };

const sessionId = uid();
const startedAt = new Date(performance.timeOrigin || Date.now() - performance.now()).toISOString();
let running = false;
let stopped = false;
let rafBefore = null;
let raf0 = null;
let device = null;
let battery = null;
let batteryStart = null;
const start = { appCode: null, boot: null, dataReady: null, firstPandi: null, fcp: null, lcp: null };
const reloads = []; // chargements complets des données (js/lib/actions.js reload)
const resources = [];
const interactions = new Map(); // interactionId -> le plus long de ses événements
let taps = 0;
const loaf = { n: 0, ms: 0, blocking: 0, scripts: {}, worst: [] }; // images longues, avec le code responsable
const lt = { n: 0, ms: 0, worst: [] }; // tâches longues (sans détail), quand les images longues manquent
const portraits = [];
const errors = [];
const vis = { hides: 0, hiddenMs: 0, since: 0 };
const total = { frames: 0, ms: 0, jank: 0, loops: {} };
const series = [];
let cur = null;
let lastFrame = 0;
let secFrames = 0;
let secStart = 0;
let fpsNow = null;
const sent = { at: null, ok: null, error: null, n: 0 };
let sending = false;
let dot = null;
let panel = null;
const timers = [];

// --- Petits outils -----------------------------------------------------------------------
const ms = (x) => (x == null ? null : Math.round(x));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const sec = (x) => r1(x / 1000);
const file = (url) => (url || '').split(/[?#]/)[0].split('/').pop() || '';
const clock = (t) => new Date(performance.timeOrigin + t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const quantile = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : null);
const fr = (x, digits = 1) => (x == null ? '–' : x.toLocaleString('fr-FR', { maximumFractionDigits: digits }));
const fs = (t) => (t == null ? '–' : `${fr(t / 1000)} s`);

function route() {
  const { path, query } = parseHash();
  const page = path[0] || 'soiree';
  if (page === 'parent') return path[1] ? `parent/${path[1]}` : 'parent';
  return query.onglet ? `${page}?${query.onglet}` : page;
}

// Élément touché : balise et classes seulement (jamais le texte, qui peut contenir un prénom)
const describe = (el) => (el && el.nodeType === 1 ? `${el.tagName.toLowerCase()}${[...el.classList].slice(0, 3).map((c) => `.${c}`).join('')}` : '');

// Chemin d'un appel Supabase sans les identifiants (famille, enfant…)
function sbPath(url) {
  try {
    const p = new URL(url).pathname.replace(/^\/(rest|auth|functions|storage)\/v1\//, '$1:');
    return p.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '…').split('/').slice(0, 4).join('/');
  } catch {
    return '?';
  }
}

function observe(type, fn, opts = {}) {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return false;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) fn(e);
    }).observe({ type, buffered: true, ...opts });
    return true;
  } catch {
    return false;
  }
}

// --- Démarrage du compteur ----------------------------------------------------------------
export function startPerf({ appCode = null } = {}) {
  if (running) return;
  running = true;
  start.appCode = appCode;
  try {
    performance.setResourceTimingBufferSize?.(1500);
  } catch {
    /* rien */
  }
  observe('resource', onResource);
  observe('paint', (e) => e.name === 'first-contentful-paint' && (start.fcp = e.startTime));
  observe('largest-contentful-paint', (e) => (start.lcp = e.startTime));
  observe('long-animation-frame', onLoaf);
  observe('longtask', onLongTask);
  observe('event', onEvent, { durationThreshold: 16 });
  observe('first-input', onEvent);
  // Repères posés par l'app elle-même (vus même si le compteur arrive après eux)
  observe('mark', (e) => e.name === 'pandiflow:boot' && start.boot == null && (start.boot = e.startTime));
  observe('measure', (e) => {
    if (e.name === 'pandiflow:portrait' && portraits.length < 60) portraits.push({ t: sec(e.startTime), ms: ms(e.duration), ...(e.detail || {}) });
    if (e.name === 'pandiflow:reload') {
      if (start.dataReady == null) start.dataReady = e.startTime + e.duration;
      if (reloads.length >= 60) reloads.shift();
      reloads.push({ t: sec(e.startTime), ms: ms(e.duration), ...(e.detail || {}) });
    }
  });


  wrapLoops();
  cur = newMinute(performance.now());
  secStart = performance.now();
  raf0(frameLoop);
  timers.push(setInterval(everySecond, 1000));
  timers.push(setTimeout(() => send('start'), FIRST_SEND_MS));
  timers.push(setInterval(() => !document.hidden && send('timer'), SEND_EVERY_MS));

  document.addEventListener('pointerdown', onTap, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  navigator.getBattery?.()
    .then((b) => {
      battery = b;
      batteryStart = { level: Math.round(b.level * 100), charging: b.charging };
    })
    .catch(() => {});
  readDevice();
  mountUi();
}

// Chaque boucle d'animation est chronométrée (la 3D, le ciel…) : rien d'autre ne change
function wrapLoops() {
  rafBefore = window.requestAnimationFrame;
  raf0 = (cb) => rafBefore.call(window, cb);
  window.requestAnimationFrame = function (cb) {
    return rafBefore.call(window, function (t) {
      const s = performance.now();
      try {
        cb(t);
      } finally {
        const name = LOOPS[cb.name] || cb.name || 'autre';
        const d = performance.now() - s;
        if (cur) cur.loops[name] = (cur.loops[name] || 0) + d;
        total.loops[name] = (total.loops[name] || 0) + d;
      }
    });
  };
}

function frameLoop(t) {
  if (stopped) return;
  raf0(frameLoop);
  if (document.hidden) {
    lastFrame = 0;
    return;
  }
  if (lastFrame && t > lastFrame) {
    const d = t - lastFrame;
    if (d < 10000) {
      cur.deltas.push(d);
      secFrames++;
      total.frames++;
      total.ms += d;
      if (d > JANK_MS) total.jank++;
    }
  }
  lastFrame = t;
  if (start.firstPandi == null && t < 120000 && document.querySelector('canvas.pandi3d.ready')) start.firstPandi = t;
}

function everySecond() {
  if (stopped) return;
  const now = performance.now();
  if (!document.hidden) {
    fpsNow = Math.round((secFrames * 1000) / Math.max(1, now - secStart));
    const r = route();
    cur.routes[r] = (cur.routes[r] || 0) + 1;
    cur.pandi = Math.max(cur.pandi, document.querySelectorAll('canvas.pandi3d.ready').length);
    updateDot();
    if (panel) renderPanel();
  }
  secFrames = 0;
  secStart = now;
  if (now - cur.start >= 60000) {
    series.push(summarize(cur));
    if (series.length > MAX_MINUTES) series.shift();
    cur = newMinute(now);
  }
}

const newMinute = (now) => ({ start: now, deltas: [], loops: {}, routes: {}, pandi: 0, taps: 0 });

function summarize(m) {
  const d = [...m.deltas].sort((a, b) => a - b);
  const secs = m.deltas.reduce((a, b) => a + b, 0) / 1000;
  const routes = Object.entries(m.routes).sort((a, b) => b[1] - a[1]);
  return {
    t: r1(m.start / 60000),
    at: clock(m.start),
    route: routes[0]?.[0] || null,
    visibleS: Math.round(secs),
    fps: secs > 0.5 ? r1(d.length / secs) : null,
    p50: r1(quantile(d, 0.5)),
    p95: r1(quantile(d, 0.95)),
    worst: ms(d[d.length - 1] || 0),
    jank: d.filter((x) => x > JANK_MS).length,
    // temps de chaque boucle en ms par seconde visible (10 ms/s = 1 % du temps)
    loops: Object.fromEntries(Object.entries(m.loops).map(([k, v]) => [k, r1(v / Math.max(1, secs))])),
    pandi: m.pandi,
    taps: m.taps,
    heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    bat: battery ? Math.round(battery.level * 100) : null,
    charging: battery ? battery.charging : null,
    rtt: navigator.connection?.rtt ?? null,
  };
}

// --- Observateurs --------------------------------------------------------------------------
function onResource(e) {
  if (!e.name.startsWith('http') || e.name.includes('/rest/v1/perf_reports') || resources.length >= 3000) return;
  resources.push({ u: e.name, s: e.startTime, e: e.responseEnd, d: e.duration, tr: e.transferSize || 0, dec: e.decodedBodySize || 0, sw: e.workerStart > 0 });
}

function onEvent(e) {
  if (!e.interactionId) return;
  if (e.target?.closest?.('.pf-dot, .pf-panel')) return;
  const prev = interactions.get(e.interactionId);
  if (prev && prev.ms >= e.duration) return;
  interactions.set(e.interactionId, {
    t: sec(e.startTime),
    type: e.name,
    ms: ms(e.duration),
    input: ms(e.processingStart - e.startTime),
    run: ms(e.processingEnd - e.processingStart),
    paint: ms(e.startTime + e.duration - e.processingEnd),
    target: describe(e.target),
    route: route(),
  });
  if (interactions.size > 3000) interactions.delete(interactions.keys().next().value);
}

function onTap() {
  taps++;
  if (cur) cur.taps++;
}

function onLoaf(e) {
  loaf.n++;
  loaf.ms += e.duration;
  loaf.blocking += e.blockingDuration || 0;
  let top = null;
  for (const s of e.scripts || []) {
    const key = `${file(s.sourceURL) || s.invokerType || '?'}:${s.sourceFunctionName || s.invoker || '?'}`;
    const a = (loaf.scripts[key] ||= { ms: 0, n: 0 });
    a.ms += s.duration;
    a.n++;
    if (!top || s.duration > top.d) top = { key, d: s.duration };
  }
  const end = e.startTime + e.duration;
  keepWorst(loaf.worst, {
    t: sec(e.startTime),
    ms: ms(e.duration),
    block: ms(e.blockingDuration || 0),
    render: e.renderStart ? ms(end - e.renderStart) : 0,
    top: top ? `${top.key} (${ms(top.d)} ms)` : '',
    route: route(),
  });
}

function onLongTask(e) {
  lt.n++;
  lt.ms += e.duration;
  keepWorst(lt.worst, { t: sec(e.startTime), ms: ms(e.duration), route: route() });
}

function keepWorst(list, row) {
  list.push(row);
  list.sort((a, b) => b.ms - a.ms);
  if (list.length > 15) list.length = 15;
}

function onVisibility() {
  const now = performance.now();
  if (document.hidden) {
    vis.hides++;
    vis.since = now;
    send('hidden');
  } else if (vis.since) {
    vis.hiddenMs += now - vis.since;
    vis.since = 0;
    lastFrame = 0;
  }
}

function onPageHide() {
  send('pagehide');
}

function pushError(message, where) {
  if (errors.length >= 20) errors.shift();
  errors.push({ t: sec(performance.now()), message: String(message || '').slice(0, 200), where, route: route() });
}
const onError = (e) => pushError(e.message, `${file(e.filename)}:${e.lineno}`);
const onRejection = (e) => pushError(e.reason?.message || e.reason, 'promesse');

// --- Appareil ------------------------------------------------------------------------------
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'pas de WebGL';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(name);
  } catch {
    return null;
  }
}

async function readDevice() {
  const c = navigator.connection;
  const d = {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${innerWidth}x${innerHeight}`,
    cores: navigator.hardwareConcurrency || null,
    memGb: navigator.deviceMemory || null,
    standalone: matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches,
    sw: Boolean(navigator.serviceWorker?.controller),
    gpu: gpuName(),
    net: c ? { type: c.effectiveType, rtt: c.rtt, down: c.downlink, save: c.saveData } : null,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  try {
    const h = await navigator.userAgentData?.getHighEntropyValues?.(['model', 'platformVersion']);
    if (h) {
      d.model = h.model || null;
      d.os = `${h.platform} ${h.platformVersion}`;
    }
  } catch {
    /* rien */
  }
  device = d;
}

// --- Rapport -------------------------------------------------------------------------------
function startup() {
  const nav = performance.getEntriesByType('navigation')[0];
  return {
    nav: nav ? { type: nav.type, ttfb: ms(nav.responseStart), dcl: ms(nav.domContentLoadedEventEnd), load: ms(nav.loadEventEnd), sw: nav.workerStart > 0 } : null,
    fcp: ms(start.fcp),
    lcp: ms(start.lcp),
    appCode: ms(start.appCode),
    boot: ms(start.boot),
    dataReady: ms(start.dataReady),
    firstPandi: ms(start.firstPandi),
  };
}

function filesSummary() {
  const own = resources.filter((r) => r.u.startsWith(location.origin));
  const boot = own.filter((r) => r.s < 30000);
  const kb = (list, k) => Math.round(list.reduce((a, r) => a + r[k], 0) / 1024);
  const end = (list) => ms(Math.max(0, ...list.map((r) => r.e)));
  const path = (u) => u.slice(location.origin.length).split('?')[0];
  return {
    boot: {
      n: boot.length,
      kb: kb(boot, 'dec'),
      netKb: kb(boot, 'tr'),
      viaSw: boot.filter((r) => r.sw).length,
      fromCache: boot.filter((r) => r.tr === 0 && r.dec > 0).length,
      jsEnd: end(boot.filter((r) => /\.js$/.test(path(r.u)))),
      threeEnd: end(boot.filter((r) => r.u.includes('/three/'))),
      slowest: [...boot].sort((a, b) => b.d - a.d).slice(0, 10).map((r) => [path(r.u), ms(r.d)]),
    },
    later: { n: own.length - boot.length, kb: kb(own.filter((r) => r.s >= 30000), 'dec') },
  };
}

function supabaseSummary() {
  const list = resources.filter((r) => r.u.startsWith(SUPABASE_URL)).sort((a, b) => a.s - b.s);
  const byPath = {};
  for (const r of list) {
    const a = (byPath[sbPath(r.u)] ||= { n: 0, ms: 0, max: 0 });
    a.n++;
    a.ms += r.d;
    a.max = Math.max(a.max, r.d);
  }
  for (const a of Object.values(byPath)) {
    a.avg = ms(a.ms / a.n);
    a.ms = ms(a.ms);
    a.max = ms(a.max);
  }
  // reloads : chaque chargement complet des données (au lancement, puis à chaque retour sur l'app)
  return { calls: list.length, byPath, reloads };
}

function dataSummary() {
  const s = getState();
  const kb = (rows) => (rows?.length ? (JSON.stringify(rows.slice(0, 50)).length / Math.min(50, rows.length)) * rows.length / 1024 : 0);
  const tables = [s.children, s.tasks, s.childTasks, s.ratings, s.ledger, s.owned, s.challenges];
  return {
    mode: s.mode,
    status: s.status,
    kids: s.children.length,
    tasks: s.tasks.length,
    ratings: s.ratings.length,
    ledger: s.ledger.length,
    owned: s.owned.length,
    kb: Math.round(tables.reduce((a, t) => a + kb(t), 0)),
    pendingOps: s.pendingOps,
    reducedMotion: Boolean(s.prefs?.reducedMotion),
  };
}

function tapSummary() {
  const all = [...interactions.values()];
  const d = all.map((x) => x.ms).sort((a, b) => a - b);
  return {
    taps,
    measured: all.length, // seulement ceux de plus de 16 ms
    p50: quantile(d, 0.5),
    p75: quantile(d, 0.75),
    p95: quantile(d, 0.95),
    max: d[d.length - 1] ?? null,
    over200: d.filter((x) => x > 200).length,
    slowest: [...all].sort((a, b) => b.ms - a.ms).slice(0, 15),
  };
}

function loafSummary() {
  const top = Object.entries(loaf.scripts)
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, 12)
    .map(([src, a]) => ({ src, ms: ms(a.ms), n: a.n }));
  return { n: loaf.n, ms: ms(loaf.ms), blocking: ms(loaf.blocking), top, worst: loaf.worst, longTasks: { n: lt.n, ms: ms(lt.ms), worst: lt.worst } };
}

function framesSummary() {
  const secs = total.ms / 1000;
  return {
    fps: secs > 0.5 ? r1(total.frames / secs) : null,
    visibleS: Math.round(secs),
    jank: total.jank,
    loops: Object.fromEntries(Object.entries(total.loops).map(([k, v]) => [k, r1(v / Math.max(1, secs))])),
  };
}

// Le rapport complet, aussi lisible depuis la console : (await import('./js/lib/perf.js')).report()
export function report(reason = 'console') {
  return {
    v: 1,
    reason,
    uptimeS: sec(performance.now()),
    route: route(),
    device,
    start: startup(),
    files: filesSummary(),
    supabase: supabaseSummary(),
    data: dataSummary(),
    frames: { ...framesSummary(), series: series.slice(), current: cur ? summarize(cur) : null },
    taps: tapSummary(),
    longFrames: loafSummary(),
    portraits,
    battery: { start: batteryStart, now: battery ? { level: Math.round(battery.level * 100), charging: battery.charging } : null },
    visibility: { hides: vis.hides, hiddenS: Math.round(vis.hiddenMs / 1000) },
    errors,
  };
}

// --- Envoi dans Supabase -------------------------------------------------------------------
async function send(reason) {
  if (stopped || sending) return;
  const s = getState();
  const repo = getRepo();
  if (s.mode !== 'cloud' || s.status !== 'ready' || !s.family?.id || !repo?.sb) {
    sent.error = s.mode === 'cloud' ? 'pas encore connecté' : 'mode démo : rien ne part';
    return;
  }
  sending = true;
  try {
    const { error } = await repo.sb.from('perf_reports').upsert({
      id: sessionId,
      family_id: s.family.id,
      app_version: APP_VERSION,
      started_at: startedAt,
      updated_at: new Date().toISOString(),
      report: report(reason),
    });
    if (error) throw error;
    sent.at = Date.now();
    sent.ok = true;
    sent.error = null;
    sent.n++;
  } catch (e) {
    sent.ok = false;
    sent.error = e?.message || String(e);
  } finally {
    sending = false;
    if (panel) renderPanel();
  }
}

async function stop() {
  await send('stop');
  stopped = true;
  localStorage.removeItem(FLAG);
  if (rafBefore) window.requestAnimationFrame = rafBefore;
  for (const t of timers) clearInterval(t);
  document.removeEventListener('pointerdown', onTap, { capture: true });
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  dot?.remove();
  panel?.remove();
  dot = panel = null;
}

// --- Pastille et rapport à l'écran -------------------------------------------------------------
const CSS = `
.pf-dot{position:fixed;left:4px;bottom:max(4px,env(safe-area-inset-bottom));z-index:2147483000;width:26px;height:26px;padding:0;border:0;border-radius:50%;
  font:600 11px/26px Fredoka,system-ui,sans-serif;text-align:center;color:#fff;background:rgba(40,170,100,.6);opacity:.75;-webkit-tap-highlight-color:transparent}
.pf-dot.mid{background:rgba(235,150,30,.75)}
.pf-dot.low{background:rgba(225,60,60,.8)}
.pf-panel{position:fixed;left:4px;bottom:calc(max(4px,env(safe-area-inset-bottom)) + 32px);z-index:2147483000;width:min(94vw,460px);max-height:min(80vh,600px);
  overflow:auto;padding:12px 14px;border-radius:14px;background:rgba(22,20,52,.96);color:#fff;font:13px/1.35 Fredoka,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45)}
.pf-panel h3{margin:0 0 8px;font-size:15px;font-weight:600}
.pf-panel dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:0}
.pf-panel dt{opacity:.65}
.pf-panel dd{margin:0}
.pf-btns{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.pf-panel button{font:600 13px Fredoka,system-ui,sans-serif;padding:7px 12px;border:0;border-radius:10px;background:#6c5ce7;color:#fff}
.pf-panel button.pf-quiet{background:rgba(255,255,255,.14)}
`;

function mountUi() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'pf-dot';
  dot.setAttribute('aria-label', 'Compteur de performance');
  dot.textContent = '…';
  dot.addEventListener('click', () => (panel ? closePanel() : openPanel()));
  document.body.appendChild(dot);
}

function updateDot() {
  if (!dot || fpsNow == null) return;
  dot.textContent = String(fpsNow);
  dot.classList.toggle('mid', fpsNow < 50 && fpsNow >= 30);
  dot.classList.toggle('low', fpsNow < 30);
}

// Le panneau est construit une fois ; chaque seconde, seules les valeurs changent (les boutons, en haut
// pour rester visibles sur un téléphone à l'horizontale, ne bougent pas)
function openPanel() {
  panel = document.createElement('div');
  panel.className = 'pf-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Rapport de performance');
  const h = document.createElement('h3');
  h.textContent = `Compteur de performance · v${APP_VERSION}`;
  const btns = document.createElement('div');
  btns.className = 'pf-btns';
  const button = (label, fn, quiet) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (quiet) b.className = 'pf-quiet';
    b.addEventListener('click', fn);
    btns.appendChild(b);
  };
  button('Envoyer maintenant', () => send('manual'));
  button('Arrêter le compteur', () => stop(), true);
  button('Fermer', closePanel, true);
  panel.append(h, btns, document.createElement('dl'));
  document.body.appendChild(panel);
  renderPanel();
}

function closePanel() {
  panel?.remove();
  panel = null;
}

function lines() {
  const st = startup();
  const files = filesSummary().boot;
  const f = framesSummary();
  const t = tapSummary();
  const l = loafSummary();
  const sb = supabaseSummary();
  const d = dataSummary();
  const loops = Object.entries(f.loops)
    .filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${LOOP_LABELS[k] || k} ${fr(v / 10)} %`)
    .join(' · ');
  const last = sb.reloads[sb.reloads.length - 1];
  const heap = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} Mo` : '–';
  const bat = batteryStart ? `${batteryStart.level} % → ${Math.round(battery.level * 100)} %${battery.charging ? ' (en charge)' : ''}` : '–';
  let sendText = sent.error || 'pas encore envoyé';
  if (sent.ok) sendText = `envoyé à ${new Date(sent.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (${sent.n} fois)`;
  else if (sent.ok === false) sendText = `échec : ${sent.error}`;
  return [
    ['Démarrage', `code ${fs(st.appCode)} · données ${fs(st.dataReady)} · 1er Pandi ${fs(st.firstPandi)}`],
    ['Fichiers', `${files.n} au démarrage, ${fr(files.kb / 1024)} Mo · dernier JS à ${fs(files.jsEnd)}`],
    ['Images/s', `maintenant ${fpsNow ?? '–'} · moyenne ${fr(f.fps)} · saccades ${f.jank} en ${Math.round(f.visibleS / 60)} min`],
    ['Animations', loops || '–'],
    ['Taps', `${t.taps} · le plus lent ${t.max ?? '–'} ms · ${t.over200} au-dessus de 200 ms`],
    l.n || !l.longTasks.n
      ? ['Images longues', `${l.n} · ${fs(l.ms)} au total${l.top[0] ? ` · surtout ${l.top[0].src}` : ''}`]
      : ['Tâches longues', `${l.longTasks.n} · ${fs(l.longTasks.ms)} au total`],
    ['Rechargements', `${sb.reloads.length}${last ? ` · le dernier ${fr(last.ms, 0)} ms` : ''} · ${sb.calls} appels Supabase`],
    ['Données', `${d.ratings} notes · ${d.ledger} écritures · ≈ ${d.kb} Ko`],
    ['Appareil', [device?.model, device?.gpu].filter(Boolean).join(' · ') || '–'],
    ['Mémoire', heap],
    ['Batterie', bat],
    ['Envoi', sendText],
  ];
}

function renderPanel() {
  const dl = panel?.querySelector('dl');
  if (!dl) return;
  const cells = [];
  for (const [k, v] of lines()) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    cells.push(dt, dd);
  }
  dl.replaceChildren(...cells);
}
