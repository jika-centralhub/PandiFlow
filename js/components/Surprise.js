// La surprise de Pandi, côté parents : on la prépare (une carte privilège pour chaque enfant, ou une
// pour toute l'équipe), on suit les paquets pas encore ouverts et les promesses à tenir, et on garde le
// paquet de cartes à la main. Jamais de pandi, jamais tirée au sort : ce sont les parents qui décident.
import { html, useState } from '../vendor/preact-htm.js';
import { useStore, toast } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import {
  activeChildren, scaleOf, PRIVILEGE_FAMILIES, NEVER_AT_STAKE, privilegeDeck, privilegesFor, suggestPrivilege,
  privilegeCard, privilegeWarning, surpriseBoard,
} from '../domain.js';
import { nextRoutineStart, toISODate } from '../lib/dates.js';
import { uid } from '../lib/util.js';
import { Avatar } from '../avatar/Avatar.js';
import { Modal } from './ui.js';
import { sfx } from '../lib/sounds.js';

const CARD_EMOJIS = ['🎁', '📖', '🍰', '🥐', '🎵', '🎲', '🪑', '🚦', '🍽️', '🪙', '💡', '🪴', '⏱️', '🧑‍🍳', '🥞', '🧩', '🚲', '🎂', '🛝', '⛺', '🧺', '🗺️', '💃', '🎨', '🕯️', '🎈', '🌳', '🍿', '🎤', '🧁'];
const AGES = { tous: 'Tous', petit: 'Moins de 6 ans', grand: '6 ans et plus' };

// Quand le paquet arrivera, en mots (« demain matin », « pour la routine du soir »)
export function arrivalLabel(fromIso, now = new Date()) {
  const from = new Date(fromIso);
  if (from <= now) return 'déjà dans la colonne';
  if (from.getHours() >= 13) return from.toDateString() === now.toDateString() ? 'à la routine du soir' : `le ${from.toLocaleDateString('fr-FR', { weekday: 'long' })} soir`;
  return toISODate(from) === toISODate(now) ? 'ce matin' : 'demain matin';
}

const ago = (ms, now = Date.now()) => {
  const days = Math.floor((now - ms) / 864e5);
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`;
};

const names = (list) => list.join(', ').replace(/, ([^,]*)$/, ' et $1');

function MiniHead({ child }) {
  return html`<div class="mini-head" style=${{ background: child.color }}><${Avatar} look=${child.look} mode="head" still=${true} /></div>`;
}

// Le choix d'une carte : les cartes du paquet (selon l'âge, ou celles de l'équipe), ou une carte écrite à la main
function CardChooser({ child, team, value, onPick }) {
  const s = useStore();
  const [custom, setCustom] = useState('');
  const deck = privilegesFor(team ? null : child, s.settings, team);
  const families = Object.keys(PRIVILEGE_FAMILIES).filter((f) => deck.some((p) => p.family === f));
  const warning = privilegeWarning(custom);
  return html`<div class="srp-chooser">
    ${families.map((f) => html`<div key=${f} class="srp-family">
      <div class="srp-family-title">${PRIVILEGE_FAMILIES[f].icon} ${PRIVILEGE_FAMILIES[f].label}</div>
      <div class="srp-cards">${deck.filter((p) => p.family === f).map((p) => html`<button key=${p.id} class=${`srp-card ${value?.cardId === p.id ? 'on' : ''}`}
        onClick=${() => { sfx.tap(); onPick(p); }}><span class="srp-card-emoji">${p.emoji}</span>${child ? privilegeCard(p, child).text : p.text}</button>`)}</div>
    </div>`)}
    <div class="srp-family">
      <div class="srp-family-title">✏️ Une carte écrite par vous</div>
      <div class="row" style="background:none;padding:0">
        <input class="input grow" value=${custom} maxLength="80" placeholder=${team ? 'Ex. : On va voir les canards samedi, tous ensemble' : 'Ex. : Tu viens avec moi chez le boulanger samedi'}
          onInput=${(e) => setCustom(e.target.value)} />
        <button class="p-btn primary" disabled=${!custom.trim()} onClick=${() => { sfx.tap(); onPick({ id: null, emoji: '🎁', text: custom.trim() }); setCustom(''); }}>Choisir</button>
      </div>
      ${warning && html`<p class="srp-warning">⚠️ ${warning}</p>`}
    </div>
  </div>`;
}

// La carte retenue pour un enfant (ou pour l'équipe), avec le bouton pour en changer
function CardSlot({ child, kids, team, card, open, onToggle, onPick }) {
  return html`<div class="srp-slot" style=${child ? { '--kid': child.color } : null}>
    <div class="srp-slot-head">
      ${team
        ? html`<span class="kid-chip on"><i />Toute l'équipe</span><span class="meta">${names(kids.map((k) => k.name))}</span>`
        : html`<span class="kid-chip on" style=${{ '--kid': child.color }}><i />${child.name}</span><span class="meta">${scaleOf(child) === 'petit' ? 'Cartes des moins de 6 ans' : 'Cartes des 6 ans et plus'}</span>`}
    </div>
    <div class="srp-chosen">
      <span class="srp-chosen-emoji">${card?.emoji || '🎁'}</span>
      <span class="grow">${card ? card.text : 'Aucune carte pour cet âge : écrivez-en une.'}</span>
      <button class="p-btn" onClick=${onToggle}>${open ? 'Fermer' : 'Changer'}</button>
    </div>
    ${open && html`<${CardChooser} child=${team ? null : child} team=${team} value=${card} onPick=${onPick} />`}
  </div>`;
}

function PrepareSurprise({ onClose }) {
  const s = useStore();
  const kids = activeChildren(s.children);
  const [team, setTeam] = useState(false);
  const [now, setNow] = useState(false);
  const [open, setOpen] = useState(null);
  const [skip, setSkip] = useState([]);
  // Une carte proposée par enfant, toutes différentes, et une pour l'équipe
  const [cards, setCards] = useState(() => {
    const out = {};
    const avoid = [];
    for (const k of kids) {
      const p = suggestPrivilege(k, s.settings, { avoid });
      if (p) {
        out[k.id] = privilegeCard(p, k);
        avoid.push(p.id);
      }
    }
    return out;
  });
  const [teamCard, setTeamCard] = useState(() => suggestPrivilege(null, s.settings, { team: true }));
  const chosen = kids.filter((k) => !skip.includes(k.id));
  const ready = team ? Boolean(teamCard) && kids.length > 0 : chosen.length > 0 && chosen.every((k) => cards[k.id]);
  const when = arrivalLabel(nextRoutineStart(new Date()).toISOString());

  function pick(child, p) {
    if (team) setTeamCard(p);
    else setCards((c) => ({ ...c, [child.id]: privilegeCard(p, child) }));
    setOpen(null);
  }

  function prepare() {
    const list = team ? kids.map((k) => privilegeCard(teamCard, k)) : chosen.map((k) => cards[k.id]);
    actions.prepareSurprise({ cards: list, team, now });
    sfx.sparkle();
    toast(now ? 'Le paquet de Pandi est déjà dans la colonne 🎁' : `Pandi déposera le paquet ${when} 🎁`);
    onClose();
  }

  return html`<${Modal} onClose=${onClose} class="srp-sheet">
    <h2>🎁 Une surprise de Pandi</h2>
    <p class="hint">Une carte privilège dans un paquet cadeau, sans aucun chiffre. L'enfant l'ouvre sur la télé, au début de la routine.</p>
    ${kids.length > 1 && html`<div class="routine-switch">
      <button class=${!team ? 'on' : ''} onClick=${() => { sfx.tap(); setTeam(false); setOpen(null); }}>🎁 Chacun sa carte</button>
      <button class=${team ? 'on' : ''} onClick=${() => { sfx.tap(); setTeam(true); setOpen(null); }}>🤝 Une carte pour l'équipe</button>
    </div>`}
    ${team
      ? html`<${CardSlot} kids=${kids} team=${true} card=${teamCard ? { ...teamCard, cardId: teamCard.id } : null} open=${open === 'team'} onToggle=${() => setOpen(open === 'team' ? null : 'team')} onPick=${(p) => pick(null, p)} />`
      : kids.map((k) => html`<div key=${k.id} class=${skip.includes(k.id) ? 'srp-skipped' : ''}>
          <${CardSlot} child=${k} kids=${kids} team=${false} card=${cards[k.id]} open=${open === k.id} onToggle=${() => setOpen(open === k.id ? null : k.id)} onPick=${(p) => pick(k, p)} />
          ${kids.length > 1 && html`<button class="srp-skip" onClick=${() => setSkip((l) => (l.includes(k.id) ? l.filter((x) => x !== k.id) : [...l, k.id]))}>
            ${skip.includes(k.id) ? `+ Remettre ${k.name}` : `Pas de paquet pour ${k.name} cette fois`}</button>`}
        </div>`)}
    ${!team && skip.length > 0 && chosen.length > 0 && html`<p class="srp-warning">⚠️ ${names(kids.filter((k) => skip.includes(k.id)).map((k) => k.name))} verra un paquet sans en avoir : le même matin pour tous, c'est mieux.</p>`}
    <div class="field" style="margin-top:12px"><label>Quand ?</label>
      <div class="routine-switch">
        <button class=${!now ? 'on' : ''} onClick=${() => { sfx.tap(); setNow(false); }}>🌙 ${when[0].toUpperCase() + when.slice(1)}</button>
        <button class=${now ? 'on' : ''} onClick=${() => { sfx.tap(); setNow(true); }}>⚡ Tout de suite</button>
      </div>
    </div>
    <p class="hint">Astuce : préparez-la quand les enfants dorment, la télé montre l'écran de votre téléphone.</p>
    <div class="sheet-actions">
      <button class="btn btn-gold" disabled=${!ready} onClick=${prepare}>🎁 Préparer la surprise</button>
    </div>
  <//>`;
}

// Le paquet de cartes : on en ajoute, on en retire, on revient aux cartes de départ
function DeckEditor() {
  const s = useStore();
  const deck = privilegeDeck(s.settings);
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState('🎁');
  const [text, setText] = useState('');
  const [family, setFamily] = useState('choix');
  const [age, setAge] = useState('tous');
  const warning = privilegeWarning(text);
  const save = (privileges) => actions.updateSettings({ privileges });

  function add() {
    if (!text.trim()) return;
    save([...deck, { id: `pv-${uid()}`, family, emoji, text: text.trim().slice(0, 80), age }]);
    sfx.green();
    setText('');
    setAdding(false);
  }

  return html`<div>
    ${Object.keys(PRIVILEGE_FAMILIES).map((f) => {
      const list = deck.filter((p) => p.family === f);
      return html`<div key=${f} class="srp-family">
        <div class="srp-family-title">${PRIVILEGE_FAMILIES[f].icon} ${PRIVILEGE_FAMILIES[f].label}</div>
        <div class="row-list">${list.map((p) => html`<div key=${p.id} class="row srp-deck-row">
          <span class="emoji">${p.emoji}</span>
          <div class="grow"><div class="title">${p.text.replace(/\{([^{}|]*)\|[^{}|]*\}/g, '$1')}</div>${p.age && p.age !== 'tous' && html`<div class="meta">${AGES[p.age]}</div>`}</div>
          <button class="p-btn icon" aria-label=${`Retirer « ${p.text} »`} onClick=${() => { sfx.pop(); save(deck.filter((x) => x.id !== p.id)); }}>✕</button>
        </div>`)}
        ${!list.length && html`<p class="meta" style="margin:4px 0 0 4px">Aucune carte pour l'instant.</p>`}</div>
      </div>`;
    })}
    ${adding
      ? html`<div class="srp-new">
          <div class="field"><label>Image</label><div class="emoji-grid">${CARD_EMOJIS.map((e) => html`<button key=${e} class=${emoji === e ? 'on' : ''} onClick=${() => setEmoji(e)}>${e}</button>`)}</div></div>
          <div class="field"><label>Le texte de la carte</label><input class="input" value=${text} maxLength="80" placeholder=${family === 'equipe' ? 'Ex. : Une soirée crêpes, tous ensemble' : 'Ex. : Tu choisis le film du dimanche'} onInput=${(e) => setText(e.target.value)} /></div>
          ${warning && html`<p class="srp-warning">⚠️ ${warning}</p>`}
          <div class="field-row">
            <div class="field"><label>Famille</label><select class="input" value=${family} onChange=${(e) => setFamily(e.target.value)}>${Object.entries(PRIVILEGE_FAMILIES).map(([id, f]) => html`<option key=${id} value=${id}>${f.icon} ${f.label}</option>`)}</select></div>
            <div class="field"><label>Pour qui ?</label><select class="input" value=${age} onChange=${(e) => setAge(e.target.value)}>${Object.entries(AGES).map(([id, l]) => html`<option key=${id} value=${id}>${l}</option>`)}</select></div>
          </div>
          <div class="sheet-actions" style="justify-content:flex-start">
            <button class="p-btn" onClick=${() => setAdding(false)}>Annuler</button>
            <button class="p-btn primary" disabled=${!text.trim()} onClick=${add}>+ Ajouter la carte</button>
          </div>
        </div>`
      : html`<div class="sheet-actions" style="justify-content:flex-start">
          <button class="btn btn-blue btn-small" onClick=${() => { sfx.tap(); setAdding(true); }}>+ Nouvelle carte</button>
          ${Array.isArray(s.settings.privileges) && html`<button class="p-btn" onClick=${() => confirm('Revenir aux cartes de départ ? Vos cartes ajoutées seront retirées.') && save(null)}>Revenir aux cartes de départ</button>`}
        </div>`}
  </div>`;
}

export function SurpriseParent() {
  const s = useStore();
  const [preparing, setPreparing] = useState(false);
  const kids = activeChildren(s.children);
  const board = surpriseBoard(s.settings);
  const kid = (id) => s.children.find((c) => c.id === id);

  return html`<div class="srp-parent">
    <h2>Surprises de Pandi</h2>
    <p class="hint">Une récompense rare et inattendue : au début de la routine, un paquet cadeau attend dans la colonne de chaque enfant. Dedans, une carte privilège : choisir, une mission d'honneur, un moment en plus ensemble. Jamais de pandi, jamais tirée au sort : c'est vous qui décidez quand.</p>

    <div class="row srp-status">
      <span class="emoji">🎁</span>
      <div class="grow">
        <div class="title">${board.last ? `Dernière surprise : ${ago(board.last)}` : 'Pas encore de surprise'}</div>
        <div class="meta">${board.daysSince !== null && board.daysSince < 5 ? 'Rare, c’est ce qui la rend magique : environ une par semaine suffit.' : 'Environ une par semaine, sans jamais l’annoncer à l’avance.'}</div>
      </div>
      <button class="btn btn-gold" disabled=${!kids.length} onClick=${() => { sfx.tap(); setPreparing(true); }}>🎁 Préparer une surprise</button>
    </div>

    ${board.toKeep.length > 0 && html`<h3 class="section-title" style="color:var(--ink);margin-top:20px">Promesses à tenir</h3>
      <p class="hint" style="margin-bottom:8px">Une surprise oubliée abîmerait plus que pas de surprise du tout. Le rappel reste sur la télé jusqu'à ce que vous touchiez « Tenu ».</p>
      <div class="row-list">${board.toKeep.map(({ surprise: x, cards }) => (x.team
        ? html`<div key=${x.id} class="row srp-promise">
            <span class="emoji">${cards[0].emoji}</span>
            <div class="grow"><div class="title">${cards[0].text}</div><div class="meta">🤝 ${names(cards.map((c) => kid(c.childId)?.name || '?'))} · ouverte ${ago(new Date(x.opened[cards[0].childId]).getTime())}</div></div>
            <button class="p-btn primary" onClick=${() => { sfx.green(); actions.keepSurprise(x.id); }}>✓ Tenu</button>
          </div>`
        : cards.map((c) => {
            const k = kid(c.childId);
            return html`<div key=${`${x.id}:${c.childId}`} class="row srp-promise" style=${k ? { '--kid': k.color } : null}>
              ${k ? html`<${MiniHead} child=${k} />` : html`<span class="emoji">${c.emoji}</span>`}
              <div class="grow"><div class="title">${c.emoji} ${c.text}</div><div class="meta">${k?.name || '?'} · ouverte ${ago(new Date(x.opened[c.childId]).getTime())}</div></div>
              <button class="p-btn primary" onClick=${() => { sfx.green(); actions.keepSurprise(x.id, c.childId); }}>✓ Tenu</button>
            </div>`;
          })))}</div>`}

    ${board.waiting.length > 0 && html`<h3 class="section-title" style="color:var(--ink);margin-top:20px">Pas encore ouvertes</h3>
      <div class="row-list">${board.waiting.map((x) => {
        const closed = x.cards.filter((c) => !x.opened?.[c.childId]);
        const anyOpened = Object.keys(x.opened || {}).length > 0;
        return html`<div key=${x.id} class="row">
          <span class="emoji">🎁</span>
          <div class="grow">
            <div class="title">${x.team ? `🤝 ${closed[0].text}` : closed.map((c) => `${kid(c.childId)?.name || '?'} : ${c.emoji} ${c.text}`).join(' · ')}</div>
            <div class="meta">${x.team ? `${names(closed.map((c) => kid(c.childId)?.name || '?'))} · ` : ''}${new Date(x.from) <= new Date() ? 'Le paquet attend dans la colonne' : `Arrive ${arrivalLabel(x.from)}`}</div>
          </div>
          ${!anyOpened && html`<button class="p-btn danger" onClick=${() => { if (confirm('Annuler cette surprise ? Le paquet ne sera pas déposé.')) { sfx.pop(); actions.cancelSurprise(x.id); } }}>Annuler</button>`}
        </div>`;
      })}</div>`}

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Les cartes privilège</h3>
    <p class="hint" style="margin-bottom:8px">Le paquet de cartes proposé quand vous préparez une surprise. Une carte fait choisir, confie une mission ou ajoute un moment en plus.</p>
    <${DeckEditor} />

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Jamais en jeu</h3>
    <p class="hint" style="margin-bottom:8px">Ce qui ne se gagne pas : on le reçoit, quoi qu'il arrive, même après une soirée difficile. Une surprise ouverte ne se reprend jamais.</p>
    <div class="row-list">${NEVER_AT_STAKE.map((n) => html`<div key=${n.text} class="row srp-never"><span class="emoji">${n.emoji}</span><div class="grow"><div class="title">${n.text}</div></div></div>`)}</div>

    ${board.kept.length > 0 && html`<h3 class="section-title" style="color:var(--ink);margin-top:20px">Dernières promesses tenues</h3>
      <div class="row-list">${board.kept.map(({ surprise: x, card: c, at }) => html`<div key=${`${x.id}:${c.childId}`} class="row muted">
        <span class="emoji">${c.emoji}</span>
        <div class="grow"><div class="title">${c.text}</div><div class="meta">${kid(c.childId)?.name || '?'} · tenue ${ago(new Date(at).getTime())}</div></div>
      </div>`)}</div>`}

    ${preparing && html`<${PrepareSurprise} onClose=${() => setPreparing(false)} />`}
  </div>`;
}
