// Labo : la planche des trois styles de Pandi (planche-styles.html).
// 1. la 3D d'aujourd'hui (stage.js, 15 images par seconde comme sur les cartes) ; 2. la marionnette en
// papier découpé (marionnette.js) ; 3. les poses illustrées (assets/labo/ : le brossage en calques animés,
// fabriqués par tests/local/pose_art_kit.py ; le bravo en une image).
// « Mesurer chacun » montre chaque style seul 14 s (7 s de dents, 7 s de bravo) et mesure les images par
// seconde et le temps de calcul. Le résultat part dans perf_reports quand la page est ouverte depuis l'app
// (même connexion), sinon il reste affiché.

import { makeMarionnette } from './marionnette.js';
import { APP_VERSION, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// --- Le compteur : chaque fonction d'animation (requestAnimationFrame) est chronométrée ---
const rawRaf = window.requestAnimationFrame.bind(window);
let jsMs = 0;
window.requestAnimationFrame = (cb) => rawRaf((t) => {
  const s = performance.now();
  try { cb(t); } finally { jsMs += performance.now() - s; }
});
const gaps = [];
let lastT = 0;
function meter(t) {
  if (lastT) gaps.push(t - lastT);
  lastT = t;
  rawRaf(meter);
}
rawRaf(meter);
function sample() {
  const g = gaps.splice(0);
  const js = jsMs;
  jsMs = 0;
  return { g, js };
}
function stats(samples, secs) {
  const g = samples.flatMap((x) => x.g).sort((a, b) => a - b);
  const js = samples.reduce((n, x) => n + x.js, 0);
  const sum = g.reduce((n, x) => n + x, 0);
  const q = (p) => (g.length ? Math.round(g[Math.min(g.length - 1, Math.floor(g.length * p))]) : null);
  return { fps: sum ? Math.round((g.length / sum) * 1000 * 10) / 10 : null, jsMs: Math.round((js / secs) * 10) / 10, p50: q(0.5), p95: q(0.95), worst: g.length ? Math.round(g[g.length - 1]) : null, over50: g.filter((x) => x > 50).length };
}
const live = document.getElementById('live');
setInterval(() => {
  const s = stats([sample()], 1);
  live.textContent = `${s.fps ?? '–'} images/s · calcul ${s.jsMs} ms/s`;
}, 1000);

// --- Les trois Pandi ---
let act = 'dents';
const styles = {};

// 1. la 3D d'aujourd'hui
(async () => {
  const host = document.getElementById('d3');
  try {
    const m = await import('../mascot/stage.js');
    const ctl = m.mountPandi(host, { act, framing: 'auto', fps: 15, maxDpr: 1.5, className: 'pandi3d ready', label: 'Pandi en 3D' });
    styles.d3 = { play: (a) => ctl.play(a, {}), show: (on) => ctl.setActive(on) };
  } catch (e) {
    host.innerHTML = `<div class="wait">3D indisponible : ${e.message}</div>`;
  }
})();

// 2. la marionnette
{
  const p = makeMarionnette(document.getElementById('mq'), act);
  styles.mq = { play: (a) => p.play(a), show: () => {} };
}

// 3. les poses illustrées
{
  const host = document.getElementById('pz');
  const box = document.createElement('div');
  box.className = `pz ${act}`;
  // les dents en calques (le bras frotte, la mousse pétille, il cligne des yeux) ; le bravo d'un bloc
  // [x, y (centre, % du cadre), largeur %, envol x, y (% de la bulle), retard s] : au coin de la bouche, sous le nez
  const foam = [[47.5, 40.8, 6.5, -70, 25, 0], [53.5, 41.2, 6, 70, 15, 0.33], [50.5, 42.8, 5.5, 10, 70, 0.66], [45.5, 41.8, 6, -90, 55, 0.99]]
    .map(([x, y, w, dx, dy, d]) => `<img class="l-mousse" alt="" src="assets/labo/mousse.webp" style="left:${x - w / 2}%;top:${y - (w * 0.83) / 2}%;width:${w}%;--dx:${dx}%;--dy:${dy}%;animation-delay:${d}s">`).join('');
  box.innerHTML = `<div class="pz-a"><div class="pz-b"><div class="pz-c">
      <div class="calques">
        <img class="l-corps" alt="" src="assets/labo/dents-corps.webp">
        <img class="l-yeux" alt="" src="assets/labo/dents-yeux.webp">
        ${foam}
        <img class="l-bras" alt="" src="assets/labo/dents-bras.webp">
      </div>
      <img class="i-bravo" alt="" src="assets/labo/pose-bravo.webp">
    </div></div></div>`;
  [[-380, -260, 0], [360, -300, 0.18], [-520, -60, 0.36], [520, -90, 0.54], [40, -420, 0.72]].forEach(([dx, dy, d]) => {
    const s = document.createElement('div');
    s.className = 'mq-etoile';
    s.style.cssText = `position:absolute;left:45%;top:4%;width:10%;height:8.3%;--dx:${dx}%;--dy:${dy}%;animation-delay:${d}s`;
    s.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.3 3.6 1.5-7.1L1.8 9.2 9 8.4z" fill="#FFD84A" stroke="#E0A100" stroke-width="1.2"/></svg>';
    box.appendChild(s);
  });
  host.appendChild(box);
  let missing = 0;
  for (const img of box.querySelectorAll('img')) {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      if (++missing === 1) host.insertAdjacentHTML('beforeend', '<div class="wait" style="position:absolute;inset:auto 0 40%">Images à venir</div>');
    });
  }
  styles.pz = { play: (a) => (box.className = `pz ${a}`), show: () => {} };
}

function play(a) {
  act = a;
  for (const s of Object.values(styles)) s.play(a);
}

// --- Les boutons ---
let auto = null;
const actBtns = [...document.querySelectorAll('#acts button')];
function setAct(name) {
  actBtns.forEach((b) => b.classList.toggle('on', b.dataset.act === name));
  clearInterval(auto);
  auto = null;
  if (name === 'auto') {
    play(act === 'dents' ? 'bravo' : 'dents');
    auto = setInterval(() => play(act === 'dents' ? 'bravo' : 'dents'), 5000);
  } else play(name);
}
actBtns.forEach((b) => b.addEventListener('click', () => setAct(b.dataset.act)));

const cols = document.getElementById('cols');
const showBtns = [...document.querySelectorAll('#show button')];
function show(which) {
  showBtns.forEach((b) => b.classList.toggle('on', b.dataset.show === which));
  cols.classList.toggle('solo', which !== 'all');
  for (const c of cols.children) {
    const on = which === 'all' || c.dataset.style === which;
    c.classList.toggle('off', !on);
    styles[c.dataset.style]?.show(on);
  }
}
showBtns.forEach((b) => b.addEventListener('click', () => show(b.dataset.show)));

// --- La mesure de chaque style seul ---
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = { d3: 'La 3D d\'aujourd\'hui', mq: 'La marionnette', pz: 'Les poses illustrées' };
const btn = document.getElementById('measure');
btn.addEventListener('click', async () => {
  btn.disabled = true;
  const table = document.getElementById('table');
  table.classList.remove('show');
  const results = {};
  for (const k of ['d3', 'mq', 'pz']) {
    show(k);
    const res = document.querySelector(`[data-res="${k}"]`);
    res.textContent = 'mesure en cours…';
    setAct('dents');
    await wait(2500);
    sample();
    const parts = [];
    for (const a of ['dents', 'bravo']) {
      if (a === 'bravo') setAct('bravo');
      for (let i = 0; i < 7; i++) {
        await wait(1000);
        parts.push(sample());
      }
    }
    results[k] = stats(parts, 14);
    const r = results[k];
    res.textContent = `${r.fps} images/s · calcul ${r.jsMs} ms/s · pire image ${r.worst} ms`;
  }
  show('all');
  setAct('dents');
  table.innerHTML = `<b>Chaque style seul, 14 s</b><table><tr><th></th><th>images/s</th><th>calcul ms/s</th><th>image p95</th><th>pire</th></tr>${
    Object.entries(results).map(([k, r]) => `<tr><td>${NAMES[k]}</td><td>${r.fps}</td><td>${r.jsMs}</td><td>${r.p95} ms</td><td>${r.worst} ms</td></tr>`).join('')
  }</table><div id="sent" style="margin-top:6px;opacity:.7">Envoi…</div>`;
  table.classList.add('show');
  table.onclick = () => table.classList.remove('show');
  document.getElementById('sent').textContent = await send(results);
  btn.disabled = false;
});

// Le résultat part dans perf_reports si la page partage la connexion de l'app (ouverte depuis l'app)
async function send(results) {
  try {
    if (!window.supabase) return 'Pas envoyé (pas de connexion) : fais une capture d\'écran.';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' } });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return 'Pas envoyé : ouvre la planche depuis l\'app (Réglages) pour l\'envoyer, ou fais une capture d\'écran.';
    const { data: fm } = await sb.from('family_members').select('family_id').eq('user_id', session.user.id).limit(1);
    const family = fm?.[0]?.family_id;
    if (!family) return 'Pas envoyé (famille introuvable) : fais une capture d\'écran.';
    const now = new Date().toISOString();
    const { error } = await sb.from('perf_reports').insert({
      id: crypto.randomUUID(), family_id: family, app_version: `${APP_VERSION}+planche`, started_at: now, updated_at: now,
      report: { v: 1, reason: 'planche-styles', planche: results, device: { ua: navigator.userAgent, dpr: devicePixelRatio, viewport: `${innerWidth}x${innerHeight}`, standalone: matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true } },
    });
    return error ? `Pas envoyé (${error.message}) : fais une capture d'écran.` : 'Envoyé : Claude peut lire ces mesures.';
  } catch (e) {
    return `Pas envoyé (${e.message}) : fais une capture d'écran.`;
  }
}
