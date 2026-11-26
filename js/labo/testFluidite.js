// Labo : le test de fluidité de l'écran de la routine (lancé depuis Réglages).
// Ce matin-là (26/11/2026), la routine plafonnait vers 45 images par seconde alors que le processeur ne
// faisait presque rien : le frein vient de l'affichage. Le test mesure l'écran de la routine en 5 étapes
// de 40 s, sans toucher l'écran : tout anime ; le décor figé ; Pandi figé ; Pandi caché ; tout figé.
// On voit ainsi qui coûte les images manquantes. Le résultat s'affiche et part dans perf_reports.
import { getState } from '../lib/store.js';
import { getRepo } from '../lib/actions.js';
import { navigate } from '../router.js';
import { APP_VERSION } from '../config.js';

const STEP_S = 40;
const SETTLE_S = 5; // les premières secondes de chaque étape ne comptent pas (le temps que tout se pose)
const STEPS = [
  { id: 'tout', label: 'Tout anime', css: '' },
  { id: 'decor_fige', label: 'Le décor figé', css: '*:not(.pp):not(.pp *) { animation-play-state: paused !important; }' },
  { id: 'pandi_fige', label: 'Pandi figé', css: '.pp, .pp * { animation-play-state: paused !important; }' },
  { id: 'pandi_cache', label: 'Pandi caché', css: '.pp { visibility: hidden !important; } .pp * { animation-play-state: paused !important; }' },
  { id: 'tout_fige', label: 'Tout figé', css: '* { animation-play-state: paused !important; }' },
];

let running = false;

export function startFluidityTest() {
  if (running) return;
  running = true;
  navigate('/soiree');
  setTimeout(run, 1500);
}

async function run() {
  const style = document.createElement('style');
  document.head.appendChild(style);
  const pill = document.createElement('div');
  pill.style.cssText = 'position:fixed;left:50%;top:max(6px,env(safe-area-inset-top));transform:translateX(-50%);z-index:9999;background:rgba(20,16,48,.86);color:#fff;font:600 13px Fredoka,system-ui,sans-serif;padding:6px 14px;border-radius:999px;pointer-events:none;white-space:nowrap';
  document.body.appendChild(pill);
  let taps = 0;
  const onTap = () => taps++;
  window.addEventListener('pointerdown', onTap, true);
  const results = [];
  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i];
    style.textContent = s.css;
    taps = 0;
    const gaps = [];
    let last = 0, t0 = performance.now(), measuring = false;
    await new Promise((done) => {
      const frame = (t) => {
        const el = (t - t0) / 1000;
        if (el >= SETTLE_S && !measuring) {
          measuring = true;
          last = t;
        } else if (measuring) {
          gaps.push(t - last);
          last = t;
        }
        pill.textContent = `Test de fluidité · ${i + 1}/${STEPS.length} : ${s.label} · ${Math.max(0, Math.ceil(STEP_S - el))} s · ne touche pas l'écran`;
        if (el < STEP_S) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    });
    const g = gaps.sort((a, b) => a - b);
    const sum = g.reduce((n, x) => n + x, 0);
    const q = (p) => (g.length ? Math.round(g[Math.min(g.length - 1, Math.floor(g.length * p))] * 10) / 10 : null);
    const anims = document.getAnimations?.() || [];
    results.push({
      id: s.id, label: s.label, fps: sum ? Math.round((g.length / sum) * 10000) / 10 : null, p50: q(0.5), p95: q(0.95),
      worst: g.length ? Math.round(g[g.length - 1]) : null, over25: g.filter((x) => x > 25).length,
      anims: anims.length, running: anims.filter((a) => a.playState === 'running').length, taps,
    });
  }
  style.remove();
  window.removeEventListener('pointerdown', onTap, true);
  const extra = {
    pandi: document.querySelectorAll('.pp').length,
    calques: document.querySelectorAll('.pp-l').length,
    dpr: devicePixelRatio, viewport: `${innerWidth}x${innerHeight}`,
    standalone: matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true,
    ua: navigator.userAgent,
  };
  const sent = await send(results, extra);
  pill.remove();
  show(results, sent);
  running = false;
}

async function send(results, extra) {
  try {
    const s = getState();
    const repo = getRepo();
    if (s.mode !== 'cloud' || !s.family?.id || !repo?.sb) return 'pas envoyé (mode démo)';
    const now = new Date().toISOString();
    const { error } = await repo.sb.from('perf_reports').insert({
      id: crypto.randomUUID(), family_id: s.family.id, app_version: `${APP_VERSION}+fluidite`, started_at: now, updated_at: now,
      report: { v: 1, reason: 'test-fluidite', fluidite: results, device: extra },
    });
    return error ? `pas envoyé (${error.message})` : 'envoyé à Claude';
  } catch (e) {
    return `pas envoyé (${e.message})`;
  }
}

function show(results, sent) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(10,8,30,.55)';
  box.innerHTML = `<div style="background:#fff;color:#2B2733;border-radius:16px;padding:12px 16px;font:14px Fredoka,system-ui,sans-serif;max-width:94vw">
    <b>Test de fluidité</b>
    <table style="border-collapse:collapse;margin-top:6px;font-variant-numeric:tabular-nums">
      <tr><th style="text-align:left;padding:2px 8px"></th><th style="padding:2px 8px">images/s</th><th style="padding:2px 8px">image p95</th><th style="padding:2px 8px">anim.</th><th style="padding:2px 8px">taps</th></tr>
      ${results.map((r) => `<tr><td style="padding:2px 8px">${r.label}</td><td style="text-align:right;padding:2px 8px">${r.fps}</td><td style="text-align:right;padding:2px 8px">${r.p95} ms</td><td style="text-align:right;padding:2px 8px">${r.running}</td><td style="text-align:right;padding:2px 8px">${r.taps}</td></tr>`).join('')}
    </table>
    <div style="margin-top:6px;opacity:.7">Résultat ${sent}. Touche pour fermer.</div></div>`;
  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}
