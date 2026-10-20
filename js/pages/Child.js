// Le coin de l'enfant : son avatar, ses affaires, la boutique et ses défis.
import { html, useRef, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { balance, isOwned, challengesForChild } from '../domain.js';
import { Avatar, COVERED_BY_SKIN } from '../avatar/Avatar.js';
import { ITEMS, SLOTS, shopItems, getItem } from '../avatar/items.js';
import { ItemThumb } from '../components/ItemThumb.js';
import { PandiCounter, Modal, ColorPicker } from '../components/ui.js';
import { Coin } from '../components/Coin.js';
import { LookEditor } from '../components/LookEditor.js';
import { PinGate } from '../components/PinGate.js';
import { PhotoAvatar } from '../components/PhotoAvatar.js';
import { PandiBank } from '../components/PandiBank.js';
import { useParentAction } from '../components/PinGate.js';
import { burst, confettiBurst, flyCoins, replay } from '../anim/fx.js';
import { sfx } from '../lib/sounds.js';
import { navigate } from '../router.js';

const TABS = [
  { id: 'look', label: 'Mon look', icon: '🪞' },
  { id: 'affaires', label: 'Mes affaires', icon: '🎒' },
  { id: 'boutique', label: 'Boutique', icon: '🛍️' },
  { id: 'defis', label: 'Défis', icon: '🏆' },
];

const SLOT_ORDER = ['skin', 'hat', 'face', 'back', 'neck', 'outfit', 'pet', 'bg', 'fx', 'magic'];

function ItemCard({ item, index, state, price, look, note, onClick }) {
  return html`<button class=${`item-card ${state}`} style=${{ '--i': index }} onClick=${onClick}>
    ${state === 'equipped' && html`<span class="tag">Porté</span>`}
    ${note && html`<span class="tag muted">${note}</span>`}
    <div class="thumb"><${ItemThumb} item=${item} look=${look} /></div>
    <div class="name">${item.short || item.name}</div>
    ${price != null && html`<div class="price"><${Coin} />${price}</div>`}
  </button>`;
}

function Inventory({ child, owned, onEquip }) {
  const mine = ITEMS.filter((i) => owned.has(i.id));
  const costumeOn = Boolean(child.equipped?.skin);
  if (!mine.length) {
    return html`<div style="text-align:center;padding:24px;font-size:calc(var(--u)*4.2)">
      Tu n'as pas encore d'objets.<br />Gagne des pandi ce soir et file à la boutique ! 🛍️
      <div class="sheet-actions"><button class="btn btn-gold" onClick=${() => navigate(`enfant/${child.id}?onglet=boutique`)}>Voir la boutique</button></div>
    </div>`;
  }
  let i = 0;
  return html`<div>${SLOT_ORDER.map((slot) => {
    const list = mine.filter((it) => it.slot === slot);
    if (!list.length) return null;
    return html`<div key=${slot}>
      <h3 class="section-title">${SLOTS[slot].icon} ${SLOTS[slot].label}</h3>
      <div class="item-grid">${list.map((it) => {
        const worn = child.equipped?.[slot] === it.id;
        const hidden = worn && costumeOn && COVERED_BY_SKIN.includes(slot);
        return html`<${ItemCard} key=${it.id} item=${it} index=${i++} look=${child.look} state=${worn ? 'equipped' : ''} note=${hidden ? 'Sous le costume' : null} onClick=${() => onEquip(it)} />`;
      })}</div>
    </div>`;
  })}</div>`;
}

function Shop({ child, owned, bal, onPick }) {
  let i = 0;
  return html`<div>${SLOT_ORDER.filter((s) => s !== 'magic').map((slot) => {
    const list = shopItems().filter((it) => it.slot === slot && !owned.has(it.id)).sort((a, b) => a.price - b.price);
    if (!list.length) return null;
    return html`<div key=${slot}>
      <h3 class="section-title">${SLOTS[slot].icon} ${SLOTS[slot].label}</h3>
      <div class="item-grid">${list.map((it) => html`<${ItemCard} key=${it.id} item=${it} index=${i++} look=${child.look} state=${bal < it.price ? 'locked' : ''} price=${it.price} onClick=${() => onPick(it)} />`)}</div>
    </div>`;
  })}</div>`;
}

function Challenges({ child, state }) {
  const list = challengesForChild(child.id, state);
  if (!list.length) return html`<p style="padding:20px;text-align:center">Pas encore de défi. Demande à tes parents d'en créer un !</p>`;
  return html`<div>${list.map(({ challenge, count, target, done }, i) => {
    const item = getItem(challenge.reward_item);
    const task = state.tasks.find((t) => t.id === challenge.task_id);
    return html`<div key=${challenge.id} class=${`challenge-card ${done ? 'done' : ''}`} style=${{ '--i': i }}>
      <div class=${`reward-thumb ${done ? '' : 'locked'}`}>${item && html`<${ItemThumb} item=${item} look=${child.look} />`}${!done && html`<span class="lock">🔒</span>`}</div>
      <div class="info">
        <h3>${challenge.title}</h3>
        <p>${task ? `${target} × ${task.emoji} ${task.title} en vert` : 'Tâche supprimée'}${challenge.bonus ? ` · +${challenge.bonus} pandi` : ''}</p>
        <div class="progress"><i style=${{ width: `${(count / target) * 100}%` }} /><span>${done ? 'Débloqué ! 🎉' : `${count} / ${target}`}</span></div>
      </div>
    </div>`;
  })}</div>`;
}

function BuyModal({ child, item, bal, onBuy, onClose }) {
  const missing = item.price - bal;
  return html`<${Modal} onClose=${onClose} style=${{ '--kid': child.color, width: 'min(100%, calc(var(--u) * 130))' }}>
    <div style="display:flex;gap:calc(var(--u)*5);align-items:center;flex-wrap:wrap;justify-content:center">
      <div style="width:calc(var(--u)*44);height:calc(var(--u)*52);border-radius:calc(var(--u)*6);overflow:hidden;background:radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--kid), #fff 40%), var(--kid))">
        <${Avatar} look=${child.look} equipped=${child.equipped} tryOn=${{ slot: item.slot, itemId: item.id }} expr="joy" mode="full" seed=${child.id} />
      </div>
      <div style="flex:1;min-width:calc(var(--u)*50)">
        <h2>${item.name}</h2>
        <p style="font-size:calc(var(--u)*4.4);display:flex;align-items:center;gap:8px;color:#8a5a00;font-weight:700"><${Coin} class="coin coin-inline" /> ${item.price} pandi</p>
        <p style="color:var(--ink-soft);margin-top:8px;font-size:calc(var(--u)*3.8)">${missing > 0 ? `Encore ${missing} pandi à gagner. Tu peux y arriver !` : 'Tu peux te l’offrir !'}</p>
        <div class="sheet-actions" style="justify-content:flex-start">
          <button class="btn btn-ghost" style="color:var(--ink)" onClick=${onClose}>Pas maintenant</button>
          <button class="btn btn-gold btn-big" disabled=${missing > 0} onClick=${onBuy}>Acheter</button>
        </div>
      </div>
    </div>
  <//>`;
}

export function ChildPage({ childId, tab = 'look' }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const [buying, setBuying] = useState(null);
  const [gate, setGate] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [bank, setBank] = useState(false);
  const [asParent, parentGate] = useParentAction();
  const stage = useRef(null);
  const counter = useRef(null);

  if (!child) {
    return html`<div class="welcome"><div class="sheet">Cet enfant n'existe plus. <button class="btn" onClick=${() => navigate('soiree')}>Retour</button></div></div>`;
  }

  const owned = new Set(s.owned.filter((o) => o.child_id === child.id).map((o) => o.item_id));
  const bal = balance(child.id, s);
  const current = TABS.some((t) => t.id === tab) ? tab : 'look';
  const celebrateStage = () => {
    replay(stage.current?.querySelector('.avatar'), 'av-jump', 900);
    burst(stage.current, { count: 16, chars: ['✨', '⭐', '💖'] });
  };

  function equipToggle(item) {
    const on = child.equipped?.[item.slot] === item.id;
    actions.equip(child.id, item.slot, on ? null : item.id);
    if (on) sfx.pop();
    else {
      sfx.sparkle();
      celebrateStage();
    }
  }

  async function buy(item) {
    const res = actions.buy(child.id, item.id);
    setBuying(null);
    if (res.error) {
      sfx.error();
      return;
    }
    sfx.chest();
    flyCoins(counter.current, stage.current, 6);
    setTimeout(() => {
      celebrateStage();
      confettiBurst(stage.current);
    }, 500);
  }

  return html`<div class="child-page page-enter" style=${{ '--kid': child.color }}>
    <header class="topbar">
      <button class="btn btn-ghost btn-small" onClick=${() => navigate('soiree')}>← Soirée</button>
      <div class="page-title">Le coin de ${child.name}</div>
      <div class="spacer" />
      <button class="counter-btn" aria-label="Cagnotte" onClick=${() => { sfx.tap(); asParent(() => setBank(true)); }}>
        <${PandiCounter} value=${bal} big=${true} counterRef=${counter} />
      </button>
    </header>
    <div class="child-body">
      <div class="child-stage" ref=${stage}>
        <div class="stage-floor" />
        <${Avatar} look=${child.look} equipped=${child.equipped} expr="happy" mode="full" seed=${child.id} class="overflow" />
      </div>
      <div class="child-panel">
        <nav class="tabs">
          ${TABS.map((t) => html`<button key=${t.id} class=${`tab ${current === t.id ? 'on' : ''}`} onClick=${() => { sfx.tap(); navigate(`enfant/${child.id}?onglet=${t.id}`, { replace: true }); }}>
            <span class="tab-ico">${t.icon}</span>${t.label}
          </button>`)}
        </nav>
        <div class="tab-content" key=${current}>
          ${current === 'look' && html`<div>
            <div class="look-group"><h3>Ma couleur</h3><${ColorPicker} value=${child.color} onChange=${(color) => actions.saveChild({ ...child, color })} /></div>
            <${LookEditor} look=${child.look} onChange=${(look) => actions.saveLook(child.id, look)} onPhoto=${() => (actions.isParentUnlocked() ? setPhoto(true) : setGate(true))} />
          </div>`}
          ${current === 'affaires' && html`<${Inventory} child=${child} owned=${owned} onEquip=${equipToggle} />`}
          ${current === 'boutique' && html`<${Shop} child=${child} owned=${owned} bal=${bal} onPick=${(it) => { sfx.tap(); setBuying(it); }} />`}
          ${current === 'defis' && html`<${Challenges} child=${child} state=${s} />`}
        </div>
      </div>
    </div>
    ${buying && html`<${BuyModal} child=${child} item=${buying} bal=${bal} onBuy=${() => buy(buying)} onClose=${() => setBuying(null)} />`}
    ${gate && html`<${PinGate} onSuccess=${() => { setGate(false); setPhoto(true); }} onCancel=${() => setGate(false)} />`}
    ${photo && html`<${PhotoAvatar} child=${child} onClose=${() => setPhoto(false)} />`}
    ${bank && html`<${PandiBank} child=${child} onClose=${() => setBank(false)} />`}
    ${parentGate}
  </div>`;
}
