// Grandes animations plein écran : fin de soirée et trésor de défi débloqué.
// Elles passent l'une après l'autre grâce à une petite file d'attente.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { getState, setState, useStore } from '../lib/store.js';
import { Avatar } from '../avatar/Avatar.js';
import { getItem } from '../avatar/items.js';
import { ItemThumb } from './ItemThumb.js';
import { Pandi } from './Coin.js';
import { PandiCounter } from './ui.js';
import { sfx } from '../lib/sounds.js';
import { fireworks, coinRain, confettiBurst, flyCoins, dropCoins } from '../anim/fx.js';
import { sleep } from '../lib/util.js';
import { ROUTINES } from '../domain.js';

let queue = [];

export function showOverlay(type, data) {
  return new Promise((resolve) => {
    queue.push({ type, data, resolve, key: Date.now() + Math.random() });
    if (queue.length === 1) setState({ overlay: queue[0] });
  });
}

function closeOverlay() {
  const current = queue.shift();
  current?.resolve();
  setState({ overlay: queue[0] || null });
}

export function OverlayHost() {
  const { overlay } = useStore();
  if (!overlay) return null;
  if (overlay.type === 'celebrate') return html`<${Celebration} key=${overlay.key} ...${overlay.data} onClose=${closeOverlay} />`;
  if (overlay.type === 'reveal') return html`<${Reveal} key=${overlay.key} ...${overlay.data} onClose=${closeOverlay} />`;
  if (overlay.type === 'pandi') return html`<${PandiMoment} key=${overlay.key} ...${overlay.data} onClose=${closeOverlay} />`;
  if (overlay.type === 'team') return html`<${TeamMoment} key=${overlay.key} ...${overlay.data} onClose=${closeOverlay} />`;
  return null;
}

// Pandi content (pandi offerts) ou triste (pandi retirés), hors des routines
function PandiMoment({ childId, amount, note, before, onClose }) {
  const child = useChild(childId);
  const happy = amount > 0;
  const [shown, setShown] = useState(before);
  const [canClose, setCanClose] = useState(false);
  const pandi = useRef(null);
  const counter = useRef(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (happy) sfx.happy();
      else sfx.sad();
      await sleep(800);
      if (!alive) return;
      if (happy) {
        await flyCoins(pandi.current, counter.current, amount);
        confettiBurst(counter.current);
      } else {
        dropCoins(counter.current, -amount);
      }
      setShown(before + amount);
      setCanClose(true);
    })();
    const t = setTimeout(onClose, 8000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);
  if (!child) return null;
  return html`<div class=${`pandi-moment ${happy ? 'happy' : 'sad'}`} style=${{ '--kid': child.color }} onClick=${() => canClose && onClose()}>
    <div class="pm-pandi" ref=${pandi}>
      ${happy
        ? html`<div class="pm-hearts">${['💖', '⭐', '💛', '✨', '💖'].map((e, i) => html`<span key=${i} style=${{ left: `${10 + i * 19}%`, animationDelay: `${i * 0.35}s` }}>${e}</span>`)}</div>`
        : html`<svg class="pm-cloud" viewBox="0 0 120 70" aria-hidden="true">
            <g fill="#C9D3E8"><circle cx="38" cy="30" r="18" /><circle cx="62" cy="22" r="22" /><circle cx="86" cy="32" r="16" /><rect x="30" y="30" width="62" height="18" rx="9" /></g>
            ${[40, 56, 72, 86].map((x, i) => html`<path key=${x} class="rain-drop" style=${{ animationDelay: `${i * 0.25}s` }} d=${`M${x} 52 q-3 6 0 8 q3 -2 0 -8 Z`} fill="#7FC4FF" />`)}
          </svg>`}
      <${Pandi} mood=${happy ? 'happy' : 'sad'} wave=${false} />
    </div>
    <div class="pm-text">
      <div class="pm-kid">
        <div class="kid-avatar"><${Avatar} look=${child.look} equipped=${child.equipped} expr=${happy ? 'joy' : 'focus'} mode="head" seed=${child.id} /></div>
        <${PandiCounter} value=${shown} big=${true} counterRef=${counter} />
      </div>
      <h2>${happy ? `+${amount} pandi pour ${child.name} !` : `−${-amount} pandi pour ${child.name}…`}</h2>
      ${note && html`<p class="pm-note">${note}</p>`}
      <p class="pm-sub">${happy ? 'Pandi est super fier de toi ! 🎉' : 'Pandi est un peu triste… On se rattrape vite ?'}</p>
      ${canClose && html`<p class="tap-hint">Touche l'écran pour continuer</p>`}
    </div>
  </div>`;
}

// Les grands moments d'équipe : défi de la semaine, trésor, coup de main, cadeau, achat commun, « tape là »
// (aucun chiffre pendant la routine : les pandi gagnés se voient ensuite dans le coin de chaque enfant)
const TEAM_TEXT = {
  week: (names, d) => ({ title: 'Défi d’équipe réussi !', sub: `Bravo ${names} ! ${d.item ? `${d.item.name} pour tous 🎁` : 'Un cadeau pour tous 🎁'}`, emoji: '🏆' }),
  teamcard: (names) => ({ title: 'La meilleure équipe !', sub: `Bravo ${names} : un trésor tombe dans la cagnotte commune 🏦`, emoji: '🏆' }),
  palier: (names) => ({ title: 'Un palier du coffre !', sub: `Bravo ${names} : des pandi pour chacun 🎉`, emoji: '🧰' }),
  treasure: (names, d) => ({ title: 'Le coffre de l’équipe est plein !', sub: `Récompense pour ${names} : ${d.reward}`, emoji: '💎' }),
  help: (names, d, kids) => ({ title: 'Bravo pour l’entraide !', sub: `${kids[0]?.name} a aidé ${kids[1]?.name} : +${d.amount} pandi pour les deux`, emoji: '🙌' }),
  gift: (names, d, kids) => ({ title: `${kids[0]?.name} offre ${d.amount} pandi à ${kids[1]?.name} !`, sub: 'Quel beau cadeau 💝', emoji: '🎁' }),
  pot: (names, d) => ({ title: 'Achat de la cagnotte commune !', sub: `${d.item?.name} pour toute l’équipe`, emoji: '🏦' }),
  highfive: (names) => ({ title: 'Toute l’équipe a fini !', sub: `Tape là, ${names} ! 🙌`, emoji: '🙌' }),
};

// soft : le soir (soirée douce), pas de fanfare, de feu d'artifice ni de pluie de pièces
function TeamMoment({ kind, kids: ids = [], soft = false, onClose, ...data }) {
  const all = getState().children;
  const kids = ids.map((id) => all.find((c) => c.id === id)).filter(Boolean);
  const item = data.itemId ? getItem(data.itemId) : null;
  const names = kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' et $1');
  const text = (TEAM_TEXT[kind] || TEAM_TEXT.highfive)(names, { ...data, item }, kids);
  const [canClose, setCanClose] = useState(false);
  const center = useRef(null);
  useEffect(() => {
    if (soft) sfx.sparkle();
    else if (kind === 'week' || kind === 'highfive') sfx.fanfare();
    else if (kind === 'treasure' || kind === 'pot' || kind === 'teamcard' || kind === 'palier') sfx.chest();
    else sfx.happy();
    if (!soft && (kind === 'week' || kind === 'treasure')) fireworks(2600);
    if (!soft && kind === 'week') setTimeout(() => coinRain(2000), 800);
    if (!soft) setTimeout(() => confettiBurst(center.current), 400);
    const t1 = setTimeout(() => setCanClose(true), 1200);
    const t2 = setTimeout(onClose, 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return html`<div class=${`team-moment tm-${kind} ${soft ? 'soft' : ''}`} onClick=${() => canClose && onClose()}>
    <div class="tm-stage">
      ${kids.map((k, i) => html`<div key=${k.id} class="tm-kid" style=${{ '--kid': k.color, '--i': i }}>
        <${Avatar} look=${k.look} equipped=${k.equipped} expr="joy" pose=${i % 2 ? 'cheer' : 'dance'} mode="full" seed=${k.id} class="overflow" />
      </div>`)}
      <div class="tm-center" ref=${center}>${item ? html`<div class="tm-item"><${ItemThumb} item=${item} look=${kids[0]?.look} /></div>` : html`<span class="tm-emoji">${text.emoji}</span>`}</div>
    </div>
    <div class="tm-text">
      <div class="title">${text.title}</div>
      <div class="subtitle">${text.sub}</div>
      ${canClose && html`<div class="tap-hint">Touche l'écran pour continuer</div>`}
    </div>
  </div>`;
}

function useChild(childId) {
  return getState().children.find((c) => c.id === childId);
}

// Fin de routine. Le soir (soft), c'est une fête douce avant le coucher : ni fanfare ni feu d'artifice.
// (Plus de bonus « soirée parfaite » ni de chiffre à l'écran.)
function Celebration({ childId, routine = 'soir', soft = false, onClose }) {
  const child = useChild(childId);
  const [canClose, setCanClose] = useState(false);
  useEffect(() => {
    if (soft) sfx.sparkle();
    else {
      sfx.fanfare();
      fireworks(2800);
    }
    const t1 = setTimeout(() => setCanClose(true), 1200);
    const t2 = setTimeout(onClose, 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  if (!child) return null;
  return html`<div class=${`celebrate ${soft ? 'soft' : ''}`} style=${{ '--kid': child.color }} onClick=${() => canClose && onClose()}>
    <div class="stage">
      <div class="rays" />
      <${Avatar} look=${child.look} equipped=${child.equipped} expr="joy" pose=${soft ? 'idle' : 'dance'} mode="full" seed=${child.id} class="overflow" />
    </div>
    <div class="text">
      <div class="title">Bravo ${child.name} !</div>
      <div class="subtitle">${soft ? 'Toute ta soirée est faite. Il est l’heure de dire bonne nuit à Pandi 🌙' : (ROUTINES[routine] || ROUTINES.soir).done}</div>
      <div class="tap-hint">Touche l'écran pour continuer</div>
    </div>
  </div>`;
}

function Chest() {
  return html`<svg class="chest" viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ch-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C47A3A" /><stop offset="100%" stop-color="#7E4520" /></linearGradient>
      <linearGradient id="ch-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF3B0" /><stop offset="100%" stop-color="#E0A100" /></linearGradient>
    </defs>
    <ellipse cx="100" cy="160" rx="80" ry="8" fill="#000" opacity="0.3" />
    <rect x="22" y="78" width="156" height="78" rx="10" fill="url(#ch-wood)" stroke="#5A2F12" stroke-width="3" />
    <rect x="22" y="100" width="156" height="10" fill="url(#ch-gold)" />
    <rect x="44" y="78" width="12" height="78" fill="url(#ch-gold)" /><rect x="144" y="78" width="12" height="78" fill="url(#ch-gold)" />
    <rect x="88" y="96" width="24" height="28" rx="5" fill="url(#ch-gold)" stroke="#B8860B" stroke-width="2" />
    <circle cx="100" cy="108" r="4" fill="#5A2F12" />
    <g class="chest-lid">
      <path d="M22 80 C22 40 60 26 100 26 C140 26 178 40 178 80 Z" fill="url(#ch-wood)" stroke="#5A2F12" stroke-width="3" />
      <path d="M44 80 C44 46 56 34 56 30 L56 80 Z M144 80 L144 30 C144 34 156 46 156 80 Z" fill="url(#ch-gold)" />
      <rect x="22" y="72" width="156" height="10" fill="url(#ch-gold)" />
    </g>
  </svg>`;
}

function Reveal({ childId, itemId, challengeTitle, onClose }) {
  const child = useChild(childId);
  const item = getItem(itemId);
  const [phase, setPhase] = useState('drum');
  const wrap = useRef(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      sfx.drumroll(1.6);
      await sleep(1700);
      if (!alive) return;
      setPhase('open');
      sfx.chest();
      await sleep(400);
      confettiBurst(wrap.current, ['#FFD23F', '#FFF3B0', '#FF7EB6', '#5EC8FF']);
      sfx.sparkle();
      fireworks(1600);
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (!child || !item) return null;
  return html`<div class=${`reveal ${phase === 'open' ? 'open' : ''}`} style=${{ '--kid': child.color }}>
    <div class="chest-wrap" ref=${wrap}>
      <div class="glow" />
      <div class=${`chest ${phase === 'drum' ? 'shake' : ''}`}><${Chest} /></div>
      <div class="reward"><${ItemThumb} item=${item} look=${child.look} /></div>
    </div>
    ${phase === 'drum' && html`<div class="drum">Roulement de tambour…</div>`}
    <div class="label">
      <h2>Nouveau trésor pour ${child.name} !</h2>
      <p><strong>${item.name}</strong></p>
      <p>${challengeTitle ? `Défi réussi : ${challengeTitle}. ` : ''}${item.hint || ''}</p>
      <div class="sheet-actions">
        <button class="btn btn-gold btn-big" onClick=${() => { sfx.tap(); onClose(); }}>Super !</button>
      </div>
    </div>
  </div>`;
}
