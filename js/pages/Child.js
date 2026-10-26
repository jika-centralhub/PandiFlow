// Le coin de l'enfant : son avatar, ses affaires, la boutique et ses défis.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useStore } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { balance, isOwned, challengesForChild, activeChildren, accord, sexOf, tasksForChild, findRating, COLOR_META, ROUTINES } from '../domain.js';
import { routineDate } from '../lib/dates.js';
import { Avatar, COVERED_BY_SKIN } from '../avatar/Avatar.js';
import { ITEMS, SLOTS, shopItems, getItem, rayonOf, offeredTo, starredFor } from '../avatar/items.js';
import { COSTUME_GROUPS } from '../avatar/costumes.js';
import { ItemThumb } from '../components/ItemThumb.js';
import { PandiCounter, Modal } from '../components/ui.js';
import { Coin } from '../components/Coin.js';
import { LookEditor } from '../components/LookEditor.js';
import { PinGate } from '../components/PinGate.js';
import { PhotoAvatar } from '../components/PhotoAvatar.js';
import { PandiBank } from '../components/PandiBank.js';
import { useParentAction } from '../components/PinGate.js';
import { burst, confettiBurst, flyCoins, replay } from '../anim/fx.js';
import { hasGarage } from '../components/Garage.js';
import { KidScene } from '../components/KidScene.js';
import { TeamPanel } from '../components/Team.js';
import { TsedakaPanel } from '../components/Tsedaka.js';
import { sfx } from '../lib/sounds.js';
import { navigate } from '../router.js';

const TABS = [
  { id: 'boutique', label: 'Boutique', icon: '🛍️' },
  { id: 'look', label: 'Mon look', icon: '🪞' },
  { id: 'affaires', label: 'Mes affaires', icon: '🎒' },
  { id: 'defis', label: 'Défis', icon: '🏆' },
  { id: 'equipe', label: 'Équipe', icon: '🤝' },
  { id: 'tsedaka', label: 'Tsedaka', icon: '💙' },
];

const SLOT_ORDER = ['skin', 'judaica', 'hat', 'face', 'back', 'neck', 'outfit', 'pet', 'bg', 'fx', 'vehicle', 'flag', 'gear', 'yard', 'magic'];

function ItemCard({ item, index, state, price, look, note, onClick }) {
  return html`<button class=${`item-card ${state}`} style=${{ '--i': index }} onClick=${onClick}>
    ${state === 'equipped' && html`<span class="tag">Porté</span>`}
    ${note && html`<span class="tag muted">${note}</span>`}
    <div class="thumb"><${ItemThumb} item=${item} look=${look} /></div>
    <div class="name">${item.short || item.name}</div>
    ${price != null && html`<div class="price"><${Coin} />${price}</div>`}
  </button>`;
}

// Rayons de la boutique et des affaires : une carte par type d'objet, avec sa couleur
const RAYON_COLORS = {
  skin: '#FF7EB6', hat: '#FFB84D', face: '#5EC8FF', back: '#9B7BFF', neck: '#FF8A5C', outfit: '#48E0A4', pet: '#C98A5B',
  bg: '#4D9BFF', fx: '#F06BD8', vehicle: '#E2363F', flag: '#3DD6D0', gear: '#A8E05F', yard: '#2FCF74', magic: '#FFD23F', judaica: '#3D6FE0',
};

function RayonCard({ slot, list, index, look, bal = null, onOpen }) {
  const prices = list.map((it) => it.price).filter((p) => p > 0);
  const min = prices.length ? Math.min(...prices) : null;
  const affordable = bal == null ? 0 : list.filter((it) => it.price <= bal).length;
  const preview = list.slice(0, slot === 'skin' ? 2 : 3);
  return html`<button class="rayon-card" style=${{ '--c': RAYON_COLORS[slot] || '#9B7BFF', '--i': index }} onClick=${() => { sfx.tap(); onOpen(slot); }}>
    <span class="rc-ico">${SLOTS[slot].icon}</span>
    <span class="rc-label">${SLOTS[slot].label}</span>
    <span class="rc-meta">${list.length} objet${list.length > 1 ? 's' : ''}${bal != null && min != null ? html` · dès ${min} <${Coin} />` : ''}</span>
    <span class="rc-thumbs">${preview.map((it) => html`<span key=${it.id} class="rc-thumb"><${ItemThumb} item=${it} look=${look} /></span>`)}</span>
    ${affordable > 0 && html`<span class="rc-badge">${affordable} pour toi !</span>`}
  </button>`;
}

function RayonHead({ slot, onBack, extra = null }) {
  return html`<div class="rayon-head" style=${{ '--c': RAYON_COLORS[slot] || '#9B7BFF' }}>
    <button class="rh-back" aria-label="Tous les rayons" onClick=${() => { sfx.tap(); onBack(); }}>←</button>
    <h3><span class="rh-ico">${SLOTS[slot].icon}</span>${SLOTS[slot].label}</h3>
    ${extra}
  </div>`;
}

// Rayon Judaïsme : kippas, talit katan, puis livres et objets
const JUDAICA_GROUPS = [
  { id: 'hat', label: 'Kippas', icon: '🧢' },
  { id: 'outfit', label: 'Talit katan', icon: '🤍' },
  { id: 'judaica', label: 'Livres et objets', icon: '📖' },
];

// Les costumes sont rangés par famille (super-héros, maillots, métiers…)
function grouped(slot, list) {
  if (slot === 'judaica') return JUDAICA_GROUPS.map((g) => ({ ...g, items: list.filter((it) => it.slot === g.id) })).filter((g) => g.items.length);
  if (slot !== 'skin') return [{ id: 'all', label: null, items: list }];
  const left = new Set(list.map((it) => it.id));
  const groups = COSTUME_GROUPS.map((g) => {
    const items = list.filter((it) => g.ids.includes(it.id));
    items.forEach((it) => left.delete(it.id));
    return { ...g, items };
  }).filter((g) => g.items.length);
  const rest = list.filter((it) => left.has(it.id));
  if (rest.length) groups.push({ id: 'autres', label: 'Autres', icon: '✨', items: rest });
  return groups;
}

function Inventory({ child, owned, rayon, onRayon, onEquip }) {
  const mine = ITEMS.filter((i) => owned.has(i.id));
  const costumeOn = Boolean(child.equipped?.skin);
  if (!mine.length) {
    return html`<div style="text-align:center;padding:24px;font-size:calc(var(--u)*4.2)">
      Tu n'as pas encore d'objets.<br />Gagne des pandi ce soir et file à la boutique ! 🛍️
      <div class="sheet-actions"><button class="btn btn-gold" onClick=${() => navigate(`enfant/${child.id}?onglet=boutique`)}>Voir la boutique</button></div>
    </div>`;
  }
  const slots = SLOT_ORDER.filter((slot) => mine.some((it) => rayonOf(it) === slot));
  if (!rayon || !slots.includes(rayon)) {
    return html`<div class="rayons">${slots.map((slot, i) => html`<${RayonCard} key=${slot} slot=${slot} index=${i} look=${child.look} list=${mine.filter((it) => rayonOf(it) === slot)} onOpen=${onRayon} />`)}</div>`;
  }
  let i = 0;
  return html`<div>
    <${RayonHead} slot=${rayon} onBack=${() => onRayon(null)} />
    ${grouped(rayon, mine.filter((it) => rayonOf(it) === rayon)).map((g) => html`<div key=${g.id}>
      ${g.label && html`<h3 class="section-title">${g.icon} ${g.label}</h3>`}
      <div class="item-grid">${g.items.map((it) => {
        const worn = child.equipped?.[it.slot] === it.id;
        const hidden = worn && costumeOn && COVERED_BY_SKIN.includes(it.slot);
        return html`<${ItemCard} key=${it.id} item=${it} index=${i++} look=${child.look} state=${worn ? 'equipped' : ''} note=${hidden ? 'Sous le costume' : null} onClick=${() => onEquip(it)} />`;
      })}</div>
    </div>`)}
  </div>`;
}

function Shop({ child, owned, bal, rayon, onRayon, onPick }) {
  const [affordableOnly, setAffordableOnly] = useState(false);
  const sex = sexOf(child);
  const bySlot = (slot) => shopItems()
    .filter((it) => rayonOf(it) === slot && !owned.has(it.id) && offeredTo(it, sex))
    .sort((a, b) => Number(starredFor(b, sex)) - Number(starredFor(a, sex)) || a.price - b.price);
  const slots = SLOT_ORDER.filter((slot) => slot !== 'magic' && bySlot(slot).length);
  if (!slots.length) return html`<p style="padding:20px;text-align:center">Tu as déjà tout acheté. Bravo, ${accord(child, 'champion', 'championne')} ! 🏆</p>`;
  if (!rayon || !slots.includes(rayon)) {
    return html`<div class="rayons">${slots.map((slot, i) => html`<${RayonCard} key=${slot} slot=${slot} index=${i} look=${child.look} bal=${bal} list=${bySlot(slot)} onOpen=${onRayon} />`)}</div>`;
  }
  const list = bySlot(rayon).filter((it) => !affordableOnly || it.price <= bal);
  let i = 0;
  return html`<div>
    <${RayonHead} slot=${rayon} onBack=${() => onRayon(null)} extra=${html`<button class=${`chip rh-filter ${affordableOnly ? 'on' : ''}`} onClick=${() => { sfx.tap(); setAffordableOnly(!affordableOnly); }}>💰 À ma portée</button>`} />
    ${!list.length && html`<p class="hint" style="padding:12px;text-align:center">Rien à ta portée ici pour l'instant : encore quelques pandi à gagner ! 💪</p>`}
    ${grouped(rayon, list).map((g) => html`<div key=${g.id}>
      ${g.label && html`<h3 class="section-title">${g.icon} ${g.label}</h3>`}
      <div class="item-grid">${g.items.map((it) => html`<${ItemCard} key=${it.id} item=${it} index=${i++} look=${child.look} state=${bal < it.price ? 'locked' : ''} price=${it.price} note=${starredFor(it, sex) ? 'Pour toi ✨' : null} onClick=${() => onPick(it)} />`)}</div>
    </div>`)}
  </div>`;
}

// Mes notes du jour : c'est ici (et pas sur la télé, qui ne montre que « fait ») que l'enfant voit ses 🌟
function MyDay({ child, state }) {
  const rows = ['matin', 'soir']
    .map((routine) => {
      const date = routineDate(routine);
      return { routine, date, list: tasksForChild(child.id, date, state, routine) };
    })
    .filter((r) => r.list.length);
  if (!rows.length) return null;
  const stars = rows.reduce((n, r) => n + r.list.filter((t) => findRating(state.ratings, child.id, t.id, r.date)?.color === 'green').length, 0);
  return html`<div class="my-day">
    <h3>Ma journée</h3>
    ${rows.map(({ routine, date, list }) => html`<div key=${routine} class="md-row"><em title=${ROUTINES[routine].label}>${ROUTINES[routine].icon}</em>
      ${list.map((t) => {
        const r = findRating(state.ratings, child.id, t.id, date);
        return html`<span key=${t.id} class=${`md-dot ${r?.color || ''}`} title=${`${t.title}${r ? ` : ${COLOR_META[r.color].label}` : ''}`}><i>${t.emoji}</i>${r && html`<b>${COLOR_META[r.color].face}</b>`}</span>`;
      })}
    </div>`)}
    ${stars > 0 && html`<p class="md-sum">🌟 ${stars} fois du premier coup aujourd'hui, bravo !</p>`}
  </div>`;
}

function Challenges({ child, state }) {
  const list = challengesForChild(child.id, state);
  if (!list.length) return html`<div><${MyDay} child=${child} state=${state} /><p style="padding:20px;text-align:center">Pas encore de défi. Demande à tes parents d'en créer un !</p></div>`;
  return html`<div><${MyDay} child=${child} state=${state} />${list.map(({ challenge, count, target, done }, i) => {
    const item = getItem(challenge.reward_item);
    const task = state.tasks.find((t) => t.id === challenge.task_id);
    return html`<div key=${challenge.id} class=${`challenge-card ${done ? 'done' : ''}`} style=${{ '--i': i }}>
      <div class=${`reward-thumb ${done ? '' : 'locked'}`}>${item && html`<${ItemThumb} item=${item} look=${child.look} />`}${!done && html`<span class="lock">🔒</span>`}</div>
      <div class="info">
        <h3>${challenge.title}</h3>
        <p>${task ? `${target} × ${task.emoji} ${task.title} du premier coup 🌟` : 'Tâche supprimée'}${challenge.bonus ? ` · +${challenge.bonus} pandi` : ''}</p>
        <div class="progress"><i style=${{ width: `${(count / target) * 100}%` }} /><span>${done ? 'Débloqué ! 🎉' : `${count} / ${target}`}</span></div>
      </div>
    </div>`;
  })}</div>`;
}

function BuyModal({ child, item, bal, onBuy, onClose }) {
  const missing = item.price - bal;
  return html`<${Modal} onClose=${onClose} style=${{ '--kid': child.color, width: 'min(100%, calc(var(--u) * 130))' }}>
    <div style="display:flex;gap:calc(var(--u)*5);align-items:center;flex-wrap:wrap;justify-content:center">
      ${item.garage || item.slot === 'bg'
        ? html`<div class="buy-scene"><${KidScene} child=${child} tryOn=${{ slot: item.slot, itemId: item.id }} expr="joy" interactive=${false} /></div>`
        : html`<div style="width:calc(var(--u)*44);height:calc(var(--u)*52);border-radius:calc(var(--u)*6);overflow:hidden;background:radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--kid), #fff 40%), var(--kid))">
            <${Avatar} look=${child.look} equipped=${child.equipped} tryOn=${{ slot: item.slot, itemId: item.id }} expr="joy" mode="full" seed=${child.id} />
          </div>`}
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

export function ChildPage({ childId, tab = 'boutique', rayon = null }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const [buying, setBuying] = useState(null);
  const [gate, setGate] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [bank, setBank] = useState(false);
  const [asParent, parentGate] = useParentAction();
  const [cheer, setCheer] = useState(0);
  const stage = useRef(null);
  const counter = useRef(null);
  // Il fait la fête un moment quand il reçoit ou met un objet, puis reprend son sourire
  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(() => setCheer(0), 3200);
    return () => clearTimeout(t);
  }, [cheer]);

  if (!child) {
    return html`<div class="welcome"><div class="sheet">Cet enfant n'existe plus. <button class="btn" onClick=${() => navigate('soiree')}>Retour</button></div></div>`;
  }

  const owned = new Set(s.owned.filter((o) => o.child_id === child.id).map((o) => o.item_id));
  const bal = balance(child.id, s);
  const tabs = activeChildren(s.children).length > 1 ? TABS : TABS.filter((t) => t.id !== 'equipe');
  const current = tabs.some((t) => t.id === tab) ? tab : 'boutique';
  const garage = hasGarage(child.equipped);
  const toShop = () => navigate(`enfant/${child.id}?onglet=boutique&rayon=vehicle`);
  const openRayon = (slot) => navigate(`enfant/${child.id}?onglet=${current}${slot ? `&rayon=${slot}` : ''}`, { replace: true });
  const celebrateStage = () => {
    setCheer((c) => c + 1);
    replay(stage.current?.querySelector('.ks-kid .avatar'), 'av-jump', 900);
    burst(stage.current?.querySelector('.ks-kid') || stage.current, { count: 16, chars: ['✨', '⭐', '💖'] });
  };
  // Pendant qu'il choisit son look ou un vêtement, la caméra s'approche de lui
  const WEAR = ['skin', 'hat', 'face', 'neck', 'back', 'outfit', 'pet', 'fx'];
  const focus = current === 'look' || ((current === 'boutique' || current === 'affaires') && WEAR.includes(rayon)) ? 'kid' : 'all';

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
      <div class="scene-card" ref=${stage}>
        <${KidScene} child=${child} expr=${cheer ? 'joy' : 'happy'} pose=${cheer ? 'cheer' : 'idle'} focus=${focus} onEmpty=${toShop} />
        ${garage && html`<span class="gc-hint">Touche un objet !</span>`}
      </div>
      <div class="child-panel">
        <nav class="tabs">
          ${tabs.map((t) => html`<button key=${t.id} class=${`tab ${current === t.id ? 'on' : ''}`} onClick=${() => { sfx.tap(); navigate(`enfant/${child.id}?onglet=${t.id}`, { replace: true }); }}>
            <span class="tab-ico">${t.icon}</span>${t.label}
          </button>`)}
        </nav>
        <div class="tab-content" key=${`${current}-${rayon || ''}`}>
          ${current === 'look' && html`<${LookEditor} look=${child.look} onChange=${(look) => actions.saveLook(child.id, look)} onPhoto=${() => (actions.isParentUnlocked() ? setPhoto(true) : setGate(true))} />`}
          ${current === 'affaires' && html`<${Inventory} child=${child} owned=${owned} rayon=${rayon} onRayon=${openRayon} onEquip=${equipToggle} />`}
          ${current === 'boutique' && html`<${Shop} child=${child} owned=${owned} bal=${bal} rayon=${rayon} onRayon=${openRayon} onPick=${(it) => { sfx.tap(); setBuying(it); }} />`}
          ${current === 'defis' && html`<${Challenges} child=${child} state=${s} />`}
          ${current === 'equipe' && html`<${TeamPanel} me=${child} />`}
          ${current === 'tsedaka' && html`<${TsedakaPanel} child=${child} counter=${counter} onGive=${celebrateStage} />`}
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
