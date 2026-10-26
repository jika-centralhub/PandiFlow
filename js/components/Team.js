// L'espace Équipe : tout ce que les enfants font ensemble.
//   - le coffre de l'équipe (chaque tâche faite, 🌟 ou 👍, y met une pierre ; un palier = des pandi pour
//     chacun ; au bout, la récompense en vrai choisie par les parents)
//   - la cagnotte commune (on y met des pandi, la carte d'équipe du soir l'alimente, on y achète pour tous)
//   - les cadeaux entre enfants et le coup de main (récompensé par les parents)
import { html, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { activeChildren, balance, treasureProgress, potBalance, isOwned } from '../domain.js';
import { potItems } from '../avatar/items.js';
import { Avatar } from '../avatar/Avatar.js';
import { ItemThumb } from './ItemThumb.js';
import { Coin } from './Coin.js';
import { Modal, NumberInput } from './ui.js';
import { useParentAction } from './PinGate.js';
import { showOverlay } from './Overlays.js';
import { sfx } from '../lib/sounds.js';

const AMOUNTS = [2, 5, 10, 20];

function Head({ child, size = 'md' }) {
  return html`<div class=${`team-head ${size}`} style=${{ '--kid': child.color }}><${Avatar} look=${child.look} equipped=${child.equipped} mode="head" seed=${child.id} /></div>`;
}

function KidPicker({ kids, value, onChange, exclude = null, label }) {
  return html`<div class="team-pick">${label && html`<span class="team-pick-label">${label}</span>`}
    ${kids.filter((k) => k.id !== exclude).map((k) => html`<button key=${k.id} class=${`kid-chip ${value === k.id ? 'on' : ''}`} style=${{ '--kid': k.color }} onClick=${() => { sfx.tap(); onChange(k.id); }}><i />${k.name}</button>`)}
  </div>`;
}

export function teamSummary(s) {
  return { treasure: treasureProgress(s), pot: potBalance(s) };
}

// Avancée vers le prochain palier (0 -> 1) ; 1 quand le coffre est plein
export function palierRatio(t) {
  if (t.reached) return 1;
  const from = t.paliers * t.step;
  return Math.max(0, Math.min(1, (t.count - from) / Math.max(1, t.nextAt - from)));
}

// Les pierres et les pièces du coffre, de la plus basse à la plus haute : [x, y, r, couleur]
const LOOT = [
  [30, 47, 7, '#FFD23F'], [44, 46, 7.5, '#FFC21A'], [58, 47, 7, '#FFD23F'], [71, 46, 7, '#FFB800'],
  [37, 41, 6.5, '#5EC8FF'], [51, 40, 7, '#FFD23F'], [65, 41, 6.5, '#FF6FA8'],
  [43, 35, 6, '#FFC21A'], [57, 34, 6.5, '#48E0A4'], [50, 29, 5.5, '#9B7BFF'],
];

// Écran de la soirée : le coffre de l'équipe, qui se remplit à chaque tâche faite jusqu'au prochain
// palier, et brille quand il est plein. On le touche pour ouvrir l'espace équipe.
export function TeamPill({ onOpen }) {
  const s = useStore();
  const { treasure } = teamSummary(s);
  const ratio = palierRatio(treasure);
  const shown = ratio > 0 ? Math.max(1, Math.ceil(ratio * LOOT.length)) : 0;
  const lift = ratio > 0 ? 5 + ratio * 13 : 0; // le couvercle se soulève à mesure qu'il se remplit
  const label = `Le coffre de l'équipe : ${treasure.count} pierres, prochain palier à ${treasure.nextAt}. Ouvrir l'espace équipe`;
  return html`<button class=${`team-chest ${treasure.reached ? 'done full' : ''}`} onClick=${() => { sfx.chest?.(); onOpen(); }} aria-label=${label} title=${`${treasure.count} / ${treasure.nextAt}`}>
    <svg viewBox="0 0 100 80" aria-hidden="true">
      <defs>
        <linearGradient id="tc-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98A5B" /><stop offset="1" stop-color="#8B5A2B" /></linearGradient>
        <radialGradient id="tc-glow"><stop offset="0" stop-color="#FFF3B0" stop-opacity=".95" /><stop offset="1" stop-color="#FFD23F" stop-opacity="0" /></radialGradient>
      </defs>
      <ellipse class="tc-halo" cx="50" cy="40" rx=${20 + ratio * 26} ry=${12 + ratio * 18} fill="url(#tc-glow)" opacity=${0.25 + ratio * 0.75} />
      <g class="tc-lid" style=${{ transform: `translateY(${-lift}px) rotate(${-lift * 0.5}deg)` }}>
        <path d="M14 46 Q14 26 50 26 Q86 26 86 46 Z" fill="url(#tc-wood)" stroke="#5E3A1A" stroke-width="2.5" />
        <path d="M14 46 Q14 26 50 26 Q86 26 86 46" fill="none" stroke="#FFC21A" stroke-width="3" />
        <rect x="45" y="26" width="10" height="20" fill="#FFC21A" stroke="#B07A00" stroke-width="1.2" />
      </g>
      ${lift > 0 && html`<path d=${`M16 46 L20 ${44 - lift} L80 ${44 - lift} L84 46 Z`} fill="#3A2210" />`}
      <g class="tc-loot">${LOOT.slice(0, shown).map(([x, y, r, c], i) => html`<circle key=${i} cx=${x} cy=${y} r=${r} fill=${c} stroke="rgba(0,0,0,.25)" stroke-width="1" style=${{ '--i': i }} />`)}</g>
      <rect x="14" y="46" width="72" height="28" rx="4" fill="url(#tc-wood)" stroke="#5E3A1A" stroke-width="2.5" />
      <rect x="14" y="46" width="72" height="5" fill="#FFC21A" stroke="#B07A00" stroke-width="1" />
      <rect x="22" y="46" width="6" height="28" fill="#FFC21A" opacity=".85" />
      <rect x="72" y="46" width="6" height="28" fill="#FFC21A" opacity=".85" />
      <rect x="43" y="52" width="14" height="13" rx="3" fill="#FFD23F" stroke="#B07A00" stroke-width="1.5" />
      <circle cx="50" cy="57.5" r="2" fill="#6b4300" />
      ${treasure.reached && html`<g class="tc-stars"><text x="12" y="22" font-size="13">⭐</text><text x="78" y="18" font-size="11">✨</text></g>`}
    </svg>
  </button>`;
}

export function TeamPanel({ me = null }) {
  const s = useStore();
  const kids = activeChildren(s.children);
  const [asParent, gate] = useParentAction();
  const { treasure, pot } = teamSummary(s);
  const [giver, setGiver] = useState(me?.id || kids[0]?.id);
  const [receiver, setReceiver] = useState(kids.find((k) => k.id !== (me?.id || kids[0]?.id))?.id);
  const [giftAmount, setGiftAmount] = useState(5);
  const [depositor, setDepositor] = useState(me?.id || kids[0]?.id);
  const [deposit, setDeposit] = useState(5);
  const [helper, setHelper] = useState(null);
  const [helped, setHelped] = useState(null);
  const [newTreasure, setNewTreasure] = useState(null);

  if (kids.length < 2) {
    return html`<div class="team-empty">L'espace équipe s'ouvre dès qu'il y a au moins deux enfants dans la famille 🤝</div>`;
  }

  const giverBal = balance(giver, s);
  const depositorBal = balance(depositor, s);

  function doGift() {
    const res = actions.giveGift(giver, receiver, giftAmount);
    if (!res.amount) return sfx.error();
    showOverlay('team', { kind: 'gift', kids: [giver, receiver], amount: res.amount });
  }
  function doDeposit() {
    const res = actions.potDeposit(depositor, deposit);
    if (!res.amount) return sfx.error();
    sfx.coin(0);
    sfx.chest();
  }
  function buyFromPot(item) {
    asParent(() => {
      const res = actions.potBuy(me?.id || kids[0].id, item.id);
      if (res.error) return sfx.error();
      showOverlay('team', { kind: 'pot', kids: kids.map((k) => k.id), itemId: item.id });
    });
  }
  function doHelp() {
    asParent(() => {
      const res = actions.giveHelp(helper, helped);
      if (!res.amount) return sfx.error();
      showOverlay('team', { kind: 'help', kids: [helper, helped], amount: res.amount });
      setHelper(null);
      setHelped(null);
    });
  }

  return html`<div class="team">
    <section class=${`team-card treasure ${treasure.reached ? 'done' : ''}`}>
      <h3>🧰 Le coffre de l'équipe</h3>
      <div class="team-row">${kids.map((k) => html`<${Head} key=${k.id} child=${k} />`)}</div>
      <div class="treasure-jar" style=${{ '--fill': treasure.count / treasure.goal }}><i />
        ${Array.from({ length: treasure.totalPaliers }, (_, i) => html`<b key=${i} class=${`jar-step ${i < treasure.paliers ? 'on' : ''}`} style=${{ left: `${(((i + 1) * treasure.step) / treasure.goal) * 100}%` }} />`)}
        <span>${treasure.count} / ${treasure.goal}</span>
      </div>
      <p class="coffre-rule">Tous les <b>${treasure.step}</b> : <b>+${treasure.bonus} pandi</b> pour chacun · Au bout : <b>${treasure.reward}</b></p>
      ${treasure.reached
        ? html`<p class="team-win">Coffre plein ! 🎉 À vous la récompense.</p>
            <button class="p-btn" onClick=${() => asParent(() => setNewTreasure({ goal: treasure.goal, reward: '', step: treasure.step, bonus: treasure.bonus }))}>Nouveau coffre</button>`
        : html`<p class="meta">Chaque tâche faite (🌟 ou 👍) par ${kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' ou $1')} met une pierre dans le coffre. Encore <b>${treasure.nextAt - treasure.count}</b> pour le prochain palier. Rien ne repart à zéro chaque semaine.</p>
            <button class="p-btn" onClick=${() => asParent(() => setNewTreasure({ goal: treasure.goal, reward: treasure.reward, step: treasure.step, bonus: treasure.bonus }))}>Modifier</button>`}
    </section>

    <section class="team-card pot">
      <h3>🏦 Cagnotte commune</h3>
      <div class="pot-balance"><${Coin} /> ${pot} pandi</div>
      <p class="meta">Tout le monde y participe : les dépôts de chacun et la carte d'équipe « La meilleure équipe ! » du soir.</p>
      <div class="team-form">
        ${!me && html`<${KidPicker} kids=${kids} value=${depositor} onChange=${setDepositor} label="Qui met des pandi ?" />`}
        <div class="chip-row">${AMOUNTS.map((n) => html`<button key=${n} class=${`p-btn ${deposit === n ? 'primary' : ''}`} onClick=${() => setDeposit(n)}>${n}</button>`)}</div>
        <button class="btn btn-gold btn-small" disabled=${depositorBal <= 0} onClick=${doDeposit}>Mettre ${Math.min(deposit, Math.max(0, depositorBal))} pandi</button>
      </div>
      <div class="pot-items">
        ${potItems().map((it) => {
          const owned = kids.every((k) => isOwned(k.id, it.id, s.owned));
          return html`<div key=${it.id} class=${`pot-item ${owned ? 'owned' : ''}`}>
            <div class="thumb"><${ItemThumb} item=${it} /></div>
            <div class="name">${it.name}</div>
            ${owned
              ? html`<span class="tag-owned">À vous ! 🎉</span>`
              : html`<button class="btn btn-green btn-small" disabled=${pot < it.price} onClick=${() => buyFromPot(it)}><${Coin} /> ${it.price}</button>`}
          </div>`;
        })}
      </div>
      <p class="meta">Les achats de la cagnotte commune sont validés par un parent (code).</p>
    </section>

    <section class="team-card gift">
      <h3>🎁 Offrir des pandi</h3>
      ${!me && html`<${KidPicker} kids=${kids} value=${giver} onChange=${(id) => { setGiver(id); if (id === receiver) setReceiver(kids.find((k) => k.id !== id)?.id); }} label="De" />`}
      <${KidPicker} kids=${kids} value=${receiver} onChange=${setReceiver} exclude=${giver} label="Pour" />
      <div class="chip-row" style="align-items:center">${AMOUNTS.map((n) => html`<button key=${n} class=${`p-btn ${giftAmount === n ? 'primary' : ''}`} onClick=${() => setGiftAmount(n)}>${n}</button>`)}<${NumberInput} value=${giftAmount} onChange=${setGiftAmount} min=${1} max=${500} /></div>
      <button class="btn btn-pink btn-small" disabled=${giverBal <= 0 || !receiver} onClick=${doGift}>Offrir ${Math.min(giftAmount, Math.max(0, giverBal))} pandi</button>
    </section>

    <section class="team-card help">
      <h3>🙌 Coup de main</h3>
      <p class="meta">Un enfant a aidé l'autre ? +${s.settings.helpBonus} pandi pour les deux (validé par un parent).</p>
      <${KidPicker} kids=${kids} value=${helper} onChange=${(id) => { setHelper(id); if (id === helped) setHelped(null); }} label="Qui a aidé ?" />
      ${helper && html`<${KidPicker} kids=${kids} value=${helped} onChange=${setHelped} exclude=${helper} label="Qui a été aidé ?" />`}
      <button class="btn btn-blue btn-small" disabled=${!helper || !helped} onClick=${doHelp}>Bravo pour l'entraide !</button>
    </section>

    ${newTreasure && html`<${Modal} onClose=${() => setNewTreasure(null)}>
      <h2>🧰 Le coffre de l'équipe</h2>
      <div class="field"><label>Récompense en vrai, au bout du coffre</label><input class="input" value=${newTreasure.reward} maxLength="60" placeholder="Ex. : une sortie au cinéma 🎬" onInput=${(e) => setNewTreasure({ ...newTreasure, reward: e.target.value })} /></div>
      <div class="field"><label>Taille du coffre : tâches faites (🌟 ou 👍) à réunir</label><${NumberInput} value=${newTreasure.goal} onChange=${(goal) => setNewTreasure({ ...newTreasure, goal })} min=${10} max=${2000} step=${10} /></div>
      <div class="field"><label>Un palier toutes les … tâches faites</label><${NumberInput} value=${newTreasure.step} onChange=${(step) => setNewTreasure({ ...newTreasure, step })} min=${5} max=${1000} step=${5} /></div>
      <div class="field"><label>Pandi pour chaque enfant, à chaque palier</label><${NumberInput} value=${newTreasure.bonus} onChange=${(bonus) => setNewTreasure({ ...newTreasure, bonus })} min=${0} max=${100} /></div>
      <div class="sheet-actions">
        ${!treasure.reached && html`<button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => { actions.updateSettings({ treasure: { ...s.settings.treasure, goal: newTreasure.goal, reward: newTreasure.reward.trim() || treasure.reward }, team: { ...s.settings.team, step: newTreasure.step, bonus: newTreasure.bonus } }); setNewTreasure(null); }}>Garder les pierres déjà gagnées</button>`}
        <button class="btn btn-green" disabled=${!newTreasure.reward.trim()} onClick=${() => { actions.updateSettings({ team: { ...s.settings.team, step: newTreasure.step, bonus: newTreasure.bonus } }); actions.newTreasure({ goal: newTreasure.goal, reward: newTreasure.reward.trim() }); sfx.sparkle(); setNewTreasure(null); }}>Nouveau coffre (repart de zéro)</button>
      </div>
    <//>`}
    ${gate}
  </div>`;
}

export function TeamSheet({ onClose }) {
  return html`<${Modal} onClose=${onClose} class="team-sheet"><h2>🤝 L'équipe</h2><${TeamPanel} /><//>`;
}
