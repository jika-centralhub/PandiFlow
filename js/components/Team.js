// L'espace Équipe : tout ce que les enfants font ensemble.
//   - le défi d'équipe de la semaine (au moins 80 % de vert à plusieurs -> cadeau pour tous)
//   - le trésor de la fratrie (chaque vert remplit une jauge commune -> récompense en vrai)
//   - la cagnotte commune (on y met des pandi, on y achète des objets pour tous)
//   - les cadeaux entre enfants et le coup de main (récompensé par les parents)
import { html, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { activeChildren, balance, teamWeek, treasureProgress, potBalance, potContributions, isOwned, TEAM_REWARDS } from '../domain.js';
import { routineDate, currentRoutine, fromISODate } from '../lib/dates.js';
import { getItem, potItems } from '../avatar/items.js';
import { Avatar } from '../avatar/Avatar.js';
import { ItemThumb } from './ItemThumb.js';
import { Coin } from './Coin.js';
import { Modal, NumberInput } from './ui.js';
import { useParentAction } from './PinGate.js';
import { showOverlay } from './Overlays.js';
import { sfx } from '../lib/sounds.js';

const shortDay = (iso) => fromISODate(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
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
  const today = routineDate(currentRoutine());
  return { week: teamWeek(s, today), treasure: treasureProgress(s), pot: potBalance(s) };
}

// Petite pastille de l'écran de la soirée : progression du défi de la semaine et du trésor
export function TeamPill({ onOpen }) {
  const s = useStore();
  const { week, treasure } = teamSummary(s);
  return html`<button class=${`team-pill ${week.done ? 'done' : ''}`} onClick=${() => { sfx.tap(); onOpen(); }} aria-label="L'espace équipe">
    <span class="tp-ico">🤝</span>
    <span class="tp-bar"><i style=${{ width: `${week.ratio * 100}%` }} /></span>
    <span class="tp-num">${week.done ? 'Réussi !' : `${week.greens}/${week.goal}`}</span>
    <span class="tp-sep" />
    <span class="tp-ico">💎</span><span class="tp-num">${treasure.count}/${treasure.goal}</span>
  </button>`;
}

export function TeamPanel({ me = null }) {
  const s = useStore();
  const kids = activeChildren(s.children);
  const [asParent, gate] = useParentAction();
  const { week, treasure, pot } = teamSummary(s);
  const nextReward = getItem(TEAM_REWARDS.find((id) => kids.some((k) => !isOwned(k.id, id, s.owned))));
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
    <section class=${`team-card week ${week.done ? 'done' : ''}`}>
      <h3>🤝 Défi d'équipe de la semaine</h3>
      <p class="meta">Du ${shortDay(week.start)} au ${shortDay(week.end)} · ${s.settings.team.threshold} % de vert, tous ensemble, matin et soir</p>
      <div class="team-row">${kids.map((k) => html`<${Head} key=${k.id} child=${k} />`)}</div>
      <div class="team-bar"><i style=${{ width: `${week.ratio * 100}%` }} /><span>${week.greens} / ${week.goal} verts</span></div>
      ${week.done
        ? html`<p class="team-win">Réussi cette semaine ! 🎉 Bravo l'équipe.</p>`
        : html`<div class="team-reward">
            <span>Encore <b>${Math.max(0, week.goal - week.greens)}</b> vert${week.goal - week.greens > 1 ? 's' : ''} ensemble pour gagner :</span>
            ${nextReward && html`<div class="team-thumb"><${ItemThumb} item=${nextReward} look=${kids[0].look} /></div>`}
            <b>${nextReward ? nextReward.name : ''}${s.settings.team.bonus ? ` + ${s.settings.team.bonus} pandi chacun` : ''}</b>
          </div>`}
    </section>

    <section class=${`team-card treasure ${treasure.reached ? 'done' : ''}`}>
      <h3>💎 Trésor de la fratrie</h3>
      <div class="treasure-jar" style=${{ '--fill': treasure.count / treasure.goal }}><i /><span>${treasure.count} / ${treasure.goal}</span></div>
      <p>Récompense : <b>${treasure.reward}</b></p>
      ${treasure.reached
        ? html`<p class="team-win">Trésor ouvert ! 🎉 À vous la récompense.</p>
            <button class="p-btn" onClick=${() => asParent(() => setNewTreasure({ goal: treasure.goal, reward: '' }))}>Nouveau trésor</button>`
        : html`<p class="meta">Chaque note verte de ${kids.map((k) => k.name).join(', ').replace(/, ([^,]*)$/, ' ou $1')} remplit le trésor.</p>
            <button class="p-btn" onClick=${() => asParent(() => setNewTreasure({ goal: treasure.goal, reward: treasure.reward }))}>Modifier</button>`}
    </section>

    <section class="team-card pot">
      <h3>🏦 Cagnotte commune</h3>
      <div class="pot-balance"><${Coin} /> ${pot} pandi</div>
      <div class="pot-kids">${potContributions(s).map(({ child, amount }) => html`<span key=${child.id} class="kid-chip on" style=${{ '--kid': child.color }}><i />${child.name} : ${amount}</span>`)}</div>
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
      <h2>💎 Trésor de la fratrie</h2>
      <div class="field"><label>Récompense en vrai</label><input class="input" value=${newTreasure.reward} maxLength="60" placeholder="Ex. : une sortie au cinéma 🎬" onInput=${(e) => setNewTreasure({ ...newTreasure, reward: e.target.value })} /></div>
      <div class="field"><label>Nombre de notes vertes à réunir</label><${NumberInput} value=${newTreasure.goal} onChange=${(goal) => setNewTreasure({ ...newTreasure, goal })} min=${5} max=${500} step=${5} /></div>
      <div class="sheet-actions">
        ${!treasure.reached && html`<button class="btn btn-ghost" style="color:var(--ink)" onClick=${() => { actions.updateSettings({ treasure: { ...s.settings.treasure, goal: newTreasure.goal, reward: newTreasure.reward.trim() || treasure.reward } }); setNewTreasure(null); }}>Garder les verts déjà gagnés</button>`}
        <button class="btn btn-green" disabled=${!newTreasure.reward.trim()} onClick=${() => { actions.newTreasure({ goal: newTreasure.goal, reward: newTreasure.reward.trim() }); sfx.sparkle(); setNewTreasure(null); }}>Nouveau trésor (repart de zéro)</button>
      </div>
    <//>`}
    ${gate}
  </div>`;
}

export function TeamSheet({ onClose }) {
  return html`<${Modal} onClose=${onClose} class="team-sheet"><h2>🤝 L'équipe</h2><${TeamPanel} /><//>`;
}
