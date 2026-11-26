// La chambre de Pandi, en plein écran : le cycle de la journée.
// Le soir, quand tous les enfants ont dit bonne nuit, Pandi bâille, saute dans son lit, remonte sa couette
// et s'endort (l'écran de nuit ; on le touche pour revenir à la routine). Avec le jeu « Chut, Pandi
// s'endort » (Réglages, js/lib/chut.js), il ne s'endort que si la maison reste calme : le micro écoute
// le temps du jeu, des étoiles s'allument, et un bruit le fait juste remuer.
// Le matin, à la première ouverture de l'app sur cet appareil, Pandi dort encore : les enfants le
// réveillent en lui grattant le ventre (il rit en dormant, gigote… puis saute du lit), et la routine
// du matin apparaît.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { eveningDate } from '../lib/dates.js';
import { prefersReducedMotion } from '../lib/util.js';
import { pandiVoice, sfx } from '../lib/sounds.js';
import { keepScreenOn, releaseScreen } from '../lib/device.js';
import { getState } from '../lib/store.js';
import { chutSettings, createChut, savedFloor, saveFloor, earRefused, setEarRefused } from '../lib/chut.js';
import { earSupported, openEar } from '../lib/micro.js';
import { has3D } from './Pandi3D.js';
import { PandiFlat } from './Coin.js';
import { FirstEveningCard } from './Decouverte.js';
import { POSES } from '../config.js';
import { loadPoses, poseCatalog, POSES_BASE } from './PandiPose.js';

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

// « Chut, Pandi s'endort » : le micro s'ouvre quand il est sous sa couette (le numéro « coucher »)
const CHUT_AT = 4.8;
const STARS = 28;
// l'ordre dans lequel les étoiles s'allument, éparpillées dans le ciel (11 et 28 sont premiers entre eux)
const starRank = (i) => (i * 11) % STARS;
// le jeu ce soir ? (réglage de la famille, micro possible et pas refusé sur cet appareil)
const chutTonight = () => chutSettings(getState().settings).on && earSupported() && !earRefused();

const listNames = (kids) => kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');

export function Chambre({ mode, kids, onExit, onAwake, mot = null, onMotClose }) {
  const morning = mode === 'matin';
  // labo : la chambre en images (le lit, Pandi qui rit en dormant, qui s'étire, qui dit bonjour)
  const [lit, setLit] = useState(() => (POSES ? poseCatalog()?.lit || null : null));
  const imgs = POSES && lit;
  const box = useRef(null);
  const rit = useRef(null);
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
  // Le jeu du chut : 'coucher' (il se couche) -> 'chut' (le micro écoute) -> 'dort' ; null : pas de jeu
  const [chutPhase, setChut] = useState(() => (!morning && chutTonight() ? 'coucher' : null));
  const chut = morning ? null : chutPhase;
  const chutRef = useRef(chut);
  chutRef.current = chut;
  const playing = chut === 'coucher' || chut === 'chut';
  const [lights, setLights] = useState(0); // les étoiles allumées par le calme
  // labo, le jeu du chut en images : éveillé dans son lit, un œil qui s'ouvre, la patte sur l'oreille
  const eveille = useRef(null);
  const oeil = useRef(null);
  const oreille = useRef(null);

  // Le soir, l'écran peut s'éteindre (sauf pendant le jeu du chut) ; le matin, il reste allumé pour la routine
  useEffect(() => {
    if (morning || playing) keepScreenOn();
    else releaseScreen();
  }, [morning, playing]);
  useEffect(
    () => () => {
      keepScreenOn();
      clearInterval(poll.current);
    },
    [],
  );

  useEffect(() => {
    if (POSES && !lit) loadPoses().then((c) => setLit(c.lit || null)).catch(() => {});
  }, []);
  // en images : il ronfle de temps en temps (trois fois au plus par nuit)
  useEffect(() => {
    if (!imgs || waking) return;
    const t = setInterval(() => {
      if (chutRef.current === 'coucher' || chutRef.current === 'chut') return; // le jeu du chut : aucun bruit
      if (st.current.snores++ < SNORES) pandiVoice('ronfle');
    }, 7000);
    return () => clearInterval(t);
  }, [imgs, waking]);

  // Pandi et son lit en 3D (sans WebGL : le Pandi dessiné)
  useEffect(() => {
    if (POSES || !has3D()) return;
    let alive = true;
    loadStage()
      .then((m) => {
        if (!alive || !host.current) return;
        const act = chutRef.current === 'chut' ? 'chut' : morning || still ? 'auLit' : 'coucher';
        ctl.current = m.mountPandi(host.current, {
          act, ctx: { tickle: 0 }, framing: 'auto', base: 'full',
          still, fps: still ? 4 : 0, exclusive: true, maxDpr: 1.5, date: eveningDate(),
          className: 'ch-pandi', label: 'Pandi dans son lit',
          onCue: (cue) => {
            if (chutRef.current === 'chut') return; // le micro écoute : Pandi ne fait aucun bruit
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

  // Le soir, une fois endormi, la caméra se rapproche doucement de son lit (avec le jeu du chut, c'est le
  // jeu qui la rapproche)
  useEffect(() => {
    if (!ready || morning || still || chutRef.current) return;
    const t = setTimeout(() => ctl.current?.play('auLit', { tickle: 0 }), 7500);
    return () => clearTimeout(t);
  }, [ready, morning]);

  // « Chut, Pandi s'endort » : une fois sous sa couette, le micro s'ouvre ; Pandi s'endort à mesure que
  // la maison reste calme, et un bruit le fait juste remuer. À la fin, le micro se ferme et il dort.
  useEffect(() => {
    if (morning || chutRef.current !== 'coucher') return;
    let alive = true, ear = null, loop = 0;
    const cfg = chutSettings(getState().settings);
    const game = createChut({ seconds: cfg.seconds, sens: cfg.sens, floor: savedFloor() });
    let level = null;
    const view = { sleep: 0, stir: 0, paw: 0 };
    const start = setTimeout(async () => {
      try {
        ear = await openEar((db) => (level = db));
      } catch (e) {
        if (!alive) return;
        // refusé : on ne le redemande plus sur cet appareil (rallumer le jeu dans Réglages le redemande)
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') setEarRefused(true);
        console.warn('Pandi : pas de micro pour le jeu du chut', e?.name || e?.message);
        setChut(null);
        paintChut(null);
        ctl.current?.play('auLit', { tickle: 0 });
        return;
      }
      if (!alive) return ear.close();
      setChut('chut');
      ctl.current?.play('chut', view);
      let prev = performance.now(), shown = 0;
      loop = setInterval(() => {
        const now = performance.now();
        const dt = (now - prev) / 1000;
        prev = now;
        const s = game.step(dt, level);
        view.sleep = s.progress;
        view.stir += ((s.noisy ? 1 : 0) - view.stir) * Math.min(1, dt * 3);
        view.paw += ((s.paw ? 1 : 0) - view.paw) * Math.min(1, dt * 2.5);
        ctl.current?.set(view);
        paintChut(view);
        const n = Math.floor(s.progress * STARS);
        if (n !== shown) setLights((shown = n));
        if (!s.done) return;
        // il dort : le micro se ferme, puis une petite mélodie de bonne nuit
        clearInterval(loop);
        ear.close();
        ear = null;
        saveFloor(s.quietest);
        paintChut(null);
        setChut('dort');
        ctl.current?.play('auLit', { tickle: 0 });
        setTimeout(() => alive && sfx.bonneNuit(), 700);
      }, 100);
    }, (still ? 0.5 : CHUT_AT) * 1000);
    return () => {
      alive = false;
      clearTimeout(start);
      clearInterval(loop);
      ear?.close();
    };
  }, [morning]);

  // Le jeu du chut en images (comme le numéro « chut » de la 3D) : encore éveillé, il s'endort à mesure que la
  // maison reste calme ; un bruit lui fait entrouvrir un œil et gigoter, et parfois il pose une patte sur son
  // oreille. view null : le jeu est fini, il dort.
  function paintChut(v) {
    const set = (r, o) => r.current && (r.current.style.opacity = o.toFixed(2));
    const awake = v ? 1 - Math.min(1, Math.max(0, (v.sleep - 0.3) / 0.55)) : 0;
    set(eveille, awake);
    set(oeil, v ? v.stir * (1 - v.paw) : 0);
    set(oreille, v ? v.paw : 0);
    box.current?.classList.toggle('gigote', Boolean(v && v.stir > 0.35));
  }

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
      // en images, la boucle s'arrête quand personne ne le chatouille (l'écran peut se reposer) ; rub() la relance
      if (POSES && st.current.tickle === 0 && n > 12 && !st.current.waking) {
        raf = 0;
        if (rit.current) rit.current.style.opacity = '0';
        box.current?.classList.remove('gigote');
        return;
      }
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const s = st.current;
      if (s.waking) return;
      s.tickle = Math.max(0, s.tickle - dt * 1.3);
      ctl.current?.set({ tickle: s.tickle });
      // en images : il rit en dormant d'autant plus qu'on le chatouille, et gigote
      if (rit.current) {
        rit.current.style.opacity = Math.min(1, s.tickle * 1.6).toFixed(2);
        box.current?.classList.toggle('gigote', s.tickle > 0.25);
      }
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
    st.current.relance = () => {
      if (raf) return;
      prev = performance.now();
      raf = requestAnimationFrame(loop);
    };
    return () => {
      cancelAnimationFrame(raf);
      st.current.relance = null;
    };
  }, [morning, ready]);

  // Le ventre de Pandi à l'écran (coordonnées de la page), ou null tant que la 3D n'est pas prête
  function bellyAt() {
    if (imgs && box.current) {
      const r = box.current.getBoundingClientRect();
      return r.width ? { x: r.left + (r.width * lit.ventre[0]) / 100, y: r.top + (r.height * lit.ventre[1]) / 100 } : null;
    }
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
    s.relance?.();
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
      const t = c && !still ? c.actor.cur.t : wall * (imgs ? 1.25 : 2.5);
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
  const cls = ['night-screen', 'chambre', morning ? 'matin' : 'soir', playing ? 'chut' : '', waking ? 'eveil' : '', hello ? 'bonjour' : '', leaving ? 'leaving' : ''].filter(Boolean).join(' ');
  const text = morning ? (waking ? hello && html`<span class="ch-bonjour">Bonjour ${names} ! ☀️</span>` : 'Chut… Pandi dort encore') : playing ? 'Chut… Pandi s’endort 🤫' : `Bonne nuit ${names} 🌙`;
  const hint = morning ? (waking ? '' : 'Gratte-lui le ventre pour le réveiller !') : playing ? 'Tout doux : quand c’est calme, il s’endort' : 'Touche l’écran pour revenir à la routine';
  // les images du jeu du chut, si elles existent (poses.json : lit.chut)
  const chutImg = (name, ref) => imgs && lit.chut?.includes(name) && html`<img class=${`l-${name}`} ref=${ref} src=${`${POSES_BASE}lit/${name}.webp`} alt="" draggable="false" />`;
  return html`<div class=${cls} role="dialog" aria-label=${morning ? 'Pandi dort encore : gratte-lui le ventre pour le réveiller' : playing ? 'Chut, Pandi s’endort' : 'Bonne nuit'} ...${handlers}>
    <div class="ch-sky" aria-hidden="true" />
    <div class="ns-stars" aria-hidden="true">${Array.from({ length: STARS }, (_, i) => html`<i key=${i} class=${playing && starRank(i) < lights ? 'lit' : ''} style=${{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, animationDelay: `${(i % 7) * 0.6}s` }} />`)}</div>
    ${morning && html`<div class="ch-sun" aria-hidden="true" />`}
    ${chut === 'chut' && html`<div class="ch-ear" aria-hidden="true">👂 Pandi écoute</div>`}
    <div class="ch-scene ns-pandi">
      ${imgs
        ? html`<div class="ch-poses" ref=${box} style=${{ aspectRatio: `${lit.frame[0]} / ${lit.frame[1]}`, '--decal': `${lit.decal || 0}%` }} role="img" aria-label="Pandi dans son lit">
            <div class="ch-pile"><img src=${`${POSES_BASE}lit/dort.webp`} alt="" draggable="false" /><img class="l-rit" ref=${rit} src=${`${POSES_BASE}lit/rit.webp`} alt="" draggable="false" />${chutImg('eveille', eveille)}${chutImg('oeil', oeil)}${chutImg('oreille', oreille)}</div>
            <img class="l-reveil" src=${`${POSES_BASE}lit/reveil.webp`} alt="" draggable="false" />
            <img class="l-debout" src=${`${POSES_BASE}lit/debout.webp`} alt="" draggable="false" />
            ${!waking && !playing && [0, 1.1, 2.2].map((d, i) => html`<span key=${i} class="pp-fx pp-zz" style=${{ left: `${(lit.tete?.[0] ?? 30) + 6 + i * 4}%`, top: `${(lit.tete?.[1] ?? 30) - 18 - i * 6}%`, animationDelay: `${d}s` }}>${i === 2 ? 'Z' : 'z'}</span>`)}
          </div>`
        : POSES ? null
        : has3D() ? html`<span ref=${host} style="display:contents" />` : html`<div class="ch-flat">${waking ? html`<${PandiFlat} mood="happy" />` : html`<${PandiFlat} wave=${false} />${!playing && html`<span class="ch-zz">💤</span>`}`}</div>`}
    </div>
    <div class="ns-text">${text}</div>
    <div class="ns-hint">${hint}</div>
    ${morning && !waking && (imgs || (!POSES && has3D())) && html`<div class="ch-hand" ref=${hand} aria-hidden="true"><span>👆</span></div>`}
    ${mot && html`<div class="ns-mot" onClick=${(e) => { e.stopPropagation(); onMotClose(); }}><${FirstEveningCard} date=${mot} onClose=${onMotClose} /></div>`}
  </div>`;
}
