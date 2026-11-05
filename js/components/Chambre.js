// La chambre de Pandi, en plein écran : le cycle de la journée.
// Le soir, quand tous les enfants ont dit bonne nuit, Pandi bâille, saute dans son lit, remonte sa couette
// et s'endort (l'écran de nuit ; on le touche pour revenir à la routine).
// Le matin, à la première ouverture de l'app sur cet appareil, Pandi dort encore : les enfants le
// réveillent en lui grattant le ventre (il rit en dormant, gigote… puis saute du lit), et la routine
// du matin apparaît.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { eveningDate } from '../lib/dates.js';
import { prefersReducedMotion } from '../lib/util.js';
import { pandiVoice, sfx } from '../lib/sounds.js';
import { keepScreenOn, releaseScreen } from '../lib/device.js';
import { has3D } from './Pandi3D.js';
import { PandiFlat } from './Coin.js';
import { FirstEveningCard } from './Decouverte.js';

let stage = null;
const loadStage = () => (stage ||= import('../mascot/stage.js'));

const BELLY = [0, 0.1, 0.56]; // son ventre, dans le repère du buste (voir js/mascot/acts.js)
// Le numéro « reveil » (en secondes de son animation, qui ralentit sur un appareil lent) : il rit,
// s'étire, saute du lit (3,1 s), atterrit et fait coucou ; puis l'écran s'efface sur la routine
const WAKE = { hello: 4.0, leave: 5.0, done: 5.6 };
const SNORES = 3; // ronflements au plus par nuit : la télé peut rester allumée longtemps

// Gratter : le chemin parcouru par le doigt (en hauteurs d'écran) qu'il faut pour le réveiller,
// tout près du ventre ; ailleurs sur l'écran ça compte moins (les petits ne visent pas toujours)
const RUB_TO_WAKE = 2;
const FAR = 0.4;

const listNames = (kids) => kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');

export function Chambre({ mode, kids, onExit, onAwake, mot = null, onMotClose }) {
  const morning = mode === 'matin';
  const host = useRef(null);
  const ctl = useRef(null);
  const hand = useRef(null);
  const [ready, setReady] = useState(false);
  const [waking, setWaking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hello, setHello] = useState(false);
  const poll = useRef(0);
  const still = prefersReducedMotion();
  const st = useRef({ progress: 0, tickle: 0, last: null, giggle: 0, snores: 0, waking: false });
  const exitRef = useRef(onAwake);
  exitRef.current = onAwake;

  // Le soir, l'écran peut s'éteindre ; le matin, il reste allumé pour la routine
  useEffect(() => {
    if (morning) keepScreenOn();
    else releaseScreen();
  }, [morning]);
  useEffect(
    () => () => {
      keepScreenOn();
      clearInterval(poll.current);
    },
    [],
  );

  // Pandi et son lit en 3D (sans WebGL : le Pandi dessiné)
  useEffect(() => {
    if (!has3D()) return;
    let alive = true;
    loadStage()
      .then((m) => {
        if (!alive || !host.current) return;
        ctl.current = m.mountPandi(host.current, {
          act: morning || still ? 'auLit' : 'coucher', ctx: { tickle: 0 }, framing: 'auto', base: 'full',
          still, fps: still ? 4 : 0, exclusive: true, maxDpr: 1.5, date: eveningDate(),
          className: 'ch-pandi', label: 'Pandi dans son lit',
          onCue: (cue) => {
            if (cue === 'ronfle' && st.current.snores++ >= SNORES) return;
            pandiVoice(cue);
          },
          onFirstDraw: () => ctl.current?.canvas.classList.add('ready'),
        });
        setReady(true);
      })
      .catch((e) => console.warn('Pandi : chambre 3D indisponible', e?.message));
    return () => {
      alive = false;
      ctl.current?.destroy();
      ctl.current = null;
    };
  }, []);

  // Le soir, une fois endormi, la caméra se rapproche doucement de son lit
  useEffect(() => {
    if (!ready || morning || still) return;
    const t = setTimeout(() => ctl.current?.play('auLit', { tickle: 0 }), 7500);
    return () => clearTimeout(t);
  }, [ready, morning]);

  // La nuit passe (4 h) alors que l'écran de nuit est resté ouvert : Pandi dort toujours, c'est le matin
  useEffect(() => {
    if (!ready || !morning || st.current.waking) return;
    st.current.snores = 0;
    ctl.current?.play('auLit', { tickle: 0 });
  }, [morning, ready]);

  // Le matin : les chatouilles retombent doucement, et la petite main montre où est son ventre
  useEffect(() => {
    if (!morning) return;
    let raf = 0, prev = performance.now(), n = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const s = st.current;
      if (s.waking) return;
      s.tickle = Math.max(0, s.tickle - dt * 1.3);
      ctl.current?.set({ tickle: s.tickle });
      if (n++ % 6 === 0 && hand.current) {
        const b = bellyAt();
        if (b) {
          hand.current.style.left = `${b.x}px`;
          hand.current.style.top = `${b.y}px`;
          hand.current.classList.add('on');
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [morning, ready]);

  // Le ventre de Pandi à l'écran (coordonnées de la page), ou null tant que la 3D n'est pas prête
  function bellyAt() {
    const c = ctl.current;
    const p = c?.screenOf(BELLY);
    if (!p) return null;
    const r = c.canvas.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }

  function rub(d, x, y, tap = false) {
    const s = st.current;
    const H = window.innerHeight || 600;
    const b = bellyAt();
    const near = !b || Math.hypot(x - b.x, y - b.y) < H * 0.24;
    const w = near ? 1 : FAR;
    s.progress += (tap ? 0.07 : d / H / RUB_TO_WAKE) * w;
    s.tickle = Math.min(1, s.tickle + (tap ? 0.55 : (d / H) * 4) * w);
    const now = performance.now();
    if (s.tickle > 0.15 && now - s.giggle > (tap ? 150 : 420)) {
      s.giggle = now;
      pandiVoice('hihi');
    }
    if (s.progress >= 1) wake();
  }

  function wake() {
    const s = st.current;
    if (s.waking) return;
    s.waking = true;
    s.last = null;
    setWaking(true);
    if (ctl.current) ctl.current.play('reveil', {});
    else {
      pandiVoice('rire');
      setTimeout(() => pandiVoice('tada'), 900);
    }
    // le temps de l'animation (sans 3D ou sans animations : un réveil court, à l'horloge)
    const c = ctl.current, t0 = performance.now();
    poll.current = setInterval(() => {
      const wall = (performance.now() - t0) / 1000;
      const t = c && !still ? c.actor.cur.t : wall * 2.5;
      if (t >= WAKE.hello || wall > 7) setHello(true);
      if (t >= WAKE.leave || wall > 9) setLeaving(true);
      if (t >= WAKE.done || wall > 9.6) {
        clearInterval(poll.current);
        exitRef.current?.();
      }
    }, 100);
  }

  const handlers = morning
    ? {
        onPointerDown(e) {
          if (st.current.waking) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          st.current.last = { x: e.clientX, y: e.clientY, moved: 0 };
        },
        onPointerMove(e) {
          const s = st.current;
          if (s.waking || !s.last) return;
          const d = Math.hypot(e.clientX - s.last.x, e.clientY - s.last.y);
          s.last.x = e.clientX;
          s.last.y = e.clientY;
          s.last.moved += d;
          rub(d, e.clientX, e.clientY);
        },
        onPointerUp(e) {
          const s = st.current;
          if (!s.last) return;
          // un simple toucher le fait rire aussi (et finit par le réveiller)
          if (s.last.moved < 10) rub(0, e.clientX, e.clientY, true);
          s.last = null;
        },
        onPointerCancel() {
          st.current.last = null;
        },
      }
    : {
        onClick() {
          sfx.tap();
          onExit();
        },
      };

  const names = listNames(kids);
  const cls = ['night-screen', 'chambre', morning ? 'matin' : 'soir', waking ? 'eveil' : '', leaving ? 'leaving' : ''].filter(Boolean).join(' ');
  return html`<div class=${cls} role="dialog" aria-label=${morning ? 'Pandi dort encore : gratte-lui le ventre pour le réveiller' : 'Bonne nuit'} ...${handlers}>
    <div class="ch-sky" aria-hidden="true" />
    <div class="ns-stars" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => html`<i key=${i} style=${{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, animationDelay: `${(i % 7) * 0.6}s` }} />`)}</div>
    ${morning && html`<div class="ch-sun" aria-hidden="true" />`}
    <div class="ch-scene ns-pandi">
      ${has3D() ? html`<span ref=${host} style="display:contents" />` : html`<div class="ch-flat">${waking ? html`<${PandiFlat} mood="happy" />` : html`<${PandiFlat} wave=${false} /><span class="ch-zz">💤</span>`}</div>`}
    </div>
    <div class="ns-text">${morning ? (waking ? hello && html`<span class="ch-bonjour">Bonjour ${names} ! ☀️</span>` : 'Chut… Pandi dort encore') : `Bonne nuit ${names} 🌙`}</div>
    <div class="ns-hint">${morning ? (waking ? '' : 'Gratte-lui le ventre pour le réveiller !') : 'Touche l’écran pour revenir à la routine'}</div>
    ${morning && !waking && has3D() && html`<div class="ch-hand" ref=${hand} aria-hidden="true"><span>👆</span></div>`}
    ${mot && html`<div class="ns-mot" onClick=${(e) => { e.stopPropagation(); onMotClose(); }}><${FirstEveningCard} date=${mot} onClose=${onMotClose} /></div>`}
  </div>`;
}
