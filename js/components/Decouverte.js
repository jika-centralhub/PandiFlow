// La première soirée d'une nouvelle famille, après l'assistant de démarrage :
//   - la visite de l'écran de la routine, en 5 bulles (une fois sur chaque appareil, à revoir dans les Réglages) ;
//   - Pandi dit bonjour aux enfants, à voix haute, quand un parent le lance (les enfants sont devant la télé) ;
//   - le mot de la première soirée finie, pour les parents (sur l'écran de la nuit, ou à la prochaine ouverture).
import { html, useEffect, useLayoutEffect, useRef, useState } from '../vendor/preact-htm.js';
import { getState } from '../lib/store.js';
import { Avatar } from '../avatar/Avatar.js';
import { Pandi } from './Coin.js';
import { activeChildren, tasksForChild, eveningStones } from '../domain.js';
import { addDays } from '../lib/dates.js';
import { sfx, say, canSay, stopSaying } from '../lib/sounds.js';

const names = (kids) => kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');

// --- La visite --------------------------------------------------------------------------------------
// target : ce que la bulle montre (le premier enfant) ; fallback si l'élément n'est pas à l'écran
const STEPS = [
  {
    target: '.kid-col',
    title: (kids) => (kids.length > 1 ? 'Une colonne par enfant' : `La colonne de ${kids[0].name}`),
    text: (kids) =>
      `${kids.length > 1 ? 'Chaque enfant a sa colonne. ' : ''}Les tâches défilent dans l'ordre de la routine : celle du moment est au centre. Balaie ou touche une flèche pour voir les autres.`,
  },
  {
    target: '.kid-col .cr-card.center',
    fallback: '.kid-col',
    title: () => 'Noter une tâche',
    text: () => 'Quand la tâche est faite, touche la carte et choisis 🌟, 👍, ✋ ou ⏸️. Sur la télé, la carte devient simplement « faite ».',
  },
  {
    target: '.kid-col .cr-timer-btn',
    fallback: '.kid-col .cr-card.center',
    title: () => 'Le minuteur calme',
    text: () => 'Pour une tâche qui traîne : de 1 à 15 minutes, sans bip ni rouge, avec une musique douce. À la fin, tu notes la tâche.',
  },
  {
    target: '.calm-btn',
    title: () => 'Le coin calme',
    text: () => "Une colère, une peur, trop d'excitation ? Pandi guide l'enfant 1 à 2 minutes pour retrouver son calme. Rien n'est noté.",
  },
  {
    target: '.kid-col .kid-avatar',
    title: () => "Le coin de l'enfant",
    text: () => "Touche sa tête : son personnage, la boutique et ses défis. En haut, ⚙️ ouvre l'espace parent avec ton code.",
  },
];

const PAD = 8;
const GAP = 14;

function find(step) {
  return document.querySelector(step.target) || (step.fallback && document.querySelector(step.fallback)) || document.querySelector('.columns');
}

export function Visite({ kids, onDone }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null); // le trou de lumière autour de l'élément montré
  const [pos, setPos] = useState(null); // la place de la bulle
  const bubble = useRef(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // L'élément montré peut bouger (carrousel, défilement, rotation) : on le suit
  useLayoutEffect(() => {
    let alive = true;
    const el = find(step);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    function measure() {
      if (!alive) return;
      const target = find(step);
      const b = bubble.current;
      if (!target || !b) return;
      const r = target.getBoundingClientRect();
      const vw = innerWidth;
      const vh = innerHeight;
      const hole = {
        left: Math.max(4, r.left - PAD),
        top: Math.max(4, r.top - PAD),
        right: Math.min(vw - 4, r.right + PAD),
        bottom: Math.min(vh - 4, r.bottom + PAD),
      };
      setBox({ left: hole.left, top: hole.top, width: Math.max(0, hole.right - hole.left), height: Math.max(0, hole.bottom - hole.top) });
      const bw = b.offsetWidth;
      const bh = b.offsetHeight;
      // Sous l'élément, sinon au-dessus, sinon à côté (la télé : une grande carte), sinon dessus, en bas
      const midX = (hole.left + hole.right) / 2;
      const midY = (hole.top + hole.bottom) / 2;
      const centered = Math.min(Math.max(12, midX - bw / 2), vw - bw - 12);
      const beside = Math.min(Math.max(12, midY - bh / 2), vh - bh - 12);
      let p;
      if (hole.bottom + GAP + bh <= vh - 12) p = { left: centered, top: hole.bottom + GAP, side: 'below' };
      else if (hole.top - GAP - bh >= 12) p = { left: centered, top: hole.top - GAP - bh, side: 'above' };
      else if (vw - hole.right - GAP >= bw + 12) p = { left: hole.right + GAP, top: beside, side: 'right' };
      else if (hole.left - GAP >= bw + 12) p = { left: hole.left - GAP - bw, top: beside, side: 'left' };
      else p = { left: centered, top: vh - bh - 16, side: 'over' };
      const vertical = p.side === 'left' || p.side === 'right';
      p.arrow = vertical ? Math.min(Math.max(24, midY - p.top), bh - 24) : Math.min(Math.max(24, midX - p.left), bw - 24);
      setPos(p);
    }
    measure();
    const t = setInterval(measure, 250);
    addEventListener('resize', measure);
    return () => {
      alive = false;
      clearInterval(t);
      removeEventListener('resize', measure);
    };
  }, [i]);

  function next() {
    sfx.tap();
    if (last) return onDone();
    setI(i + 1);
  }

  return html`<div class="visite" role="dialog" aria-label="Visite de l'écran de la routine" aria-live="polite">
    ${box && html`<div class="vi-hole" style=${{ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }} />`}
    <div ref=${bubble} class=${`vi-bubble ${pos?.side || ''}`} key=${i}
      style=${pos ? { left: `${pos.left}px`, top: `${pos.top}px`, '--arrow': `${pos.arrow}px` } : { left: '-9999px', top: '0px' }}>
      <div class="vi-head"><span>🐼 La visite</span><span>${i + 1} / ${STEPS.length}</span></div>
      <div class="vi-title">${step.title(kids)}</div>
      <p class="vi-text">${step.text(kids)}</p>
      <div class="vi-actions">
        ${!last && html`<button class="vi-skip" onClick=${() => { sfx.tap(); onDone(); }}>Passer la visite</button>`}
        <span class="vi-gap" />
        ${i > 0 && html`<button class="p-btn" aria-label="Bulle précédente" onClick=${() => { sfx.tap(); setI(i - 1); }}>←</button>`}
        <button class="btn btn-green btn-small" onClick=${next}>${last ? "C'est compris !" : 'Suivant →'}</button>
      </div>
    </div>
  </div>`;
}

// --- Pandi dit bonjour aux enfants -------------------------------------------------------------------
export function GreetBar({ onGreet, onLater }) {
  return html`<div class="greet-bar" role="region" aria-label="Pandi dit bonjour aux enfants">
    <span class="gb-ico" aria-hidden="true">👋</span>
    <span class="gb-text">Les enfants sont devant l'écran ? Pandi va leur dire bonjour.</span>
    <button class="btn btn-gold btn-small" onClick=${onGreet}>Dire bonjour</button>
    <button class="btn btn-ghost btn-small" onClick=${onLater}>Plus tard</button>
  </div>`;
}

export function greetText(kids, withMorning) {
  const when = withMorning ? 'Le matin et le soir' : 'Chaque soir';
  if (kids.length === 1) {
    return `Bonjour ${kids[0].name} ! Je suis Pandi. ${when}, je fais la routine avec toi. Quand tu écoutes du premier coup, je danse de joie ! Avec tes pandi, tu choisiras des habits et des objets pour ton personnage. On commence ?`;
  }
  return `${kids.map((k) => `Bonjour ${k.name} !`).join(' ')} Je suis Pandi. ${when}, je fais la routine avec vous. Quand vous écoutez du premier coup, je danse de joie ! Avec vos pandi, vous choisirez des habits et des objets pour votre personnage. On commence ?`;
}

export function Bonjour({ onClose }) {
  const s = getState();
  const kids = activeChildren(s.children);
  const withMorning = s.tasks.some((t) => t.routine === 'matin' && t.active !== false);
  const text = greetText(kids, withMorning);
  useEffect(() => {
    sfx.sparkle();
    const t = setTimeout(() => say(text), 700);
    return () => {
      clearTimeout(t);
      stopSaying();
    };
  }, []);
  return html`<div class="bonjour" role="dialog" aria-label="Pandi dit bonjour">
    <div class="bj-stage">
      <div class="bj-pandi"><${Pandi} /></div>
      <div class="bj-kids">${kids.map((k, i) => html`<div key=${k.id} class="bj-kid" style=${{ '--kid': k.color, '--i': i }}>
        <${Avatar} look=${k.look} equipped=${k.equipped} expr="joy" pose=${i % 2 ? 'cheer' : 'dance'} mode="full" seed=${k.id} class="overflow" />
        <span>${k.name}</span>
      </div>`)}</div>
    </div>
    <p class="bj-bubble">${text}</p>
    <div class="sheet-actions">
      ${canSay() && html`<button class="btn btn-ghost" onClick=${() => { sfx.tap(); say(text); }}>🔊 Encore</button>`}
      <button class="btn btn-gold btn-big" onClick=${() => { sfx.tap(); onClose(); }}>On commence !</button>
    </div>
  </div>`;
}

// --- Le mot de la première soirée ---------------------------------------------------------------------
export function FirstEveningCard({ date, onClose }) {
  const s = getState();
  const kids = activeChildren(s.children);
  const stones = eveningStones(s, date);
  const tomorrow = addDays(date, 1);
  const morning = kids.some((k) => tasksForChild(k.id, tomorrow, s, 'matin').length);
  const departure = s.settings.departure ? `, départ à ${s.settings.departure.replace(/^0/, '').replace(':', ' h ')}` : '';
  useEffect(() => {
    sfx.softChime?.();
  }, []);
  return html`<div class="fe-card" role="dialog" aria-label="Première soirée réussie" onClick=${(e) => e.stopPropagation()}>
    <div class="fe-top"><span class="fe-emoji">🎉</span><h2>Première soirée réussie !</h2></div>
    <p class="fe-stones">🧰 ${kids.length > 1 ? `Ensemble, ${names(kids)} ont mis` : `${kids[0]?.name || "L'enfant"} a mis`} <b>${stones} pierre${stones > 1 ? 's' : ''}</b> dans le coffre de l'équipe.</p>
    <p>${morning ? `☀️ Demain matin : la routine du matin${departure}.` : '🌙 Demain soir, on recommence !'}</p>
    <p class="fe-tip"><b>Pour la suite :</b> ce qui marche le mieux, c'est de dire à l'enfant ce qu'il a bien fait, avec des mots précis (« Tu as mis ton pyjama dès la première demande »). Et si un soir est difficile, ⏸️ « Pas ce soir » ne compte ni pour ni contre.</p>
    <div class="sheet-actions"><button class="btn btn-green" onClick=${() => { sfx.tap(); onClose(); }}>Bonne nuit !</button></div>
  </div>`;
}

export function FirstEveningOverlay({ date, onClose }) {
  return html`<div class="fe-overlay" onClick=${onClose}><${FirstEveningCard} date=${date} onClose=${onClose} /></div>`;
}
