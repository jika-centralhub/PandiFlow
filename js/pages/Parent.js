// Espace parent (protégé par le code PIN) : enfants, tâches, défis, historique, réglages.
import { html, useState } from '../vendor/preact-htm.js';
import { useStore, setPrefs } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { SEXES, activeChildren, tasksForChild, findRating, balance, challengesForChild, COLOR_META, ROUTINES, routineOf, BEHAVIOR, findBehavior, behaviorLevel } from '../domain.js';
import { eveningDate, addDays, formatLong, WEEKDAYS_SHORT, currentRoutine } from '../lib/dates.js';
import { Avatar } from '../avatar/Avatar.js';
import { CHILD_COLORS } from '../avatar/palette.js';
import { ITEMS, SLOTS, rewardItems, getItem } from '../avatar/items.js';
import { ItemThumb } from '../components/ItemThumb.js';
import { Modal, Toggle, NumberInput, ColorPicker, SexPicker } from '../components/ui.js';
import { PinPad } from '../components/PinGate.js';
import { PhotoAvatar } from '../components/PhotoAvatar.js';
import { PandiBank } from '../components/PandiBank.js';
import { FamilyMembers } from '../components/FamilyMembers.js';
import { TsedakaParent } from '../components/Tsedaka.js';
import { sfx } from '../lib/sounds.js';
import { navigate } from '../router.js';
import { APP_VERSION } from '../config.js';

const SECTIONS = [
  { id: 'enfants', label: 'Enfants', icon: '👧' },
  { id: 'taches', label: 'Tâches', icon: '✅' },
  { id: 'defis', label: 'Défis', icon: '🏆' },
  { id: 'historique', label: 'Historique', icon: '📅' },
  { id: 'tsedaka', label: 'Tsedaka', icon: '💙' },
  { id: 'reglages', label: 'Réglages', icon: '⚙️' },
];

const EMOJIS = ['⏰', '☀️', '🥣', '🥐', '🧃', '🍽️', '🥦', '🥛', '🍎', '🛁', '🚿', '🧼', '🪥', '🦷', '👕', '🧦', '👖', '🎒', '📚', '📖', '✏️', '🧸', '🧩', '🛏️', '😴', '🌙', '🚽', '🧴', '💧', '🪮', '👟', '🧥', '🧹', '🗑️', '🐶', '🐱', '🌱', '🎹', '⚽', '🧘', '💊', '⏰', '📵', '🤗', '💬', '🌟', '❤️', '🙏', '🎨', '🧺', '🍳'];

// --- Enfants -------------------------------------------------------------------
function ChildForm({ child, onClose }) {
  const s = useStore();
  const [name, setName] = useState(child?.name || '');
  const [age, setAge] = useState(child?.age || 6);
  const [sex, setSex] = useState(child?.sex || null);
  const [color, setColor] = useState(child?.color || CHILD_COLORS[s.children.length % CHILD_COLORS.length]);
  function save() {
    if (!name.trim()) return;
    if (child) actions.saveChild({ ...child, name: name.trim(), age, sex, color });
    else actions.addChild({ name: name.trim(), age, sex, color });
    sfx.green();
    onClose();
  }
  return html`<${Modal} onClose=${onClose}>
    <h2>${child ? `Modifier ${child.name}` : 'Nouvel enfant'}</h2>
    <div class="field"><label>Prénom</label><input class="input" value=${name} maxLength="20" onInput=${(e) => setName(e.target.value)} placeholder="Prénom" /></div>
    <div class="field"><label>Âge</label><${NumberInput} value=${age} onChange=${setAge} min=${2} max=${14} /></div>
    <div class="field"><label>C'est…</label><${SexPicker} value=${sex} onChange=${setSex} /></div>
    <div class="field"><label>Sa couleur (celle de sa colonne)</label><${ColorPicker} value=${color} onChange=${setColor} /></div>
    <div class="sheet-actions">
      ${child && html`<button class="p-btn danger" onClick=${() => { actions.archiveChild(child.id, !child.archived); onClose(); }}>${child.archived ? 'Réactiver' : 'Archiver'}</button>`}
      <button class="btn btn-green" onClick=${save} disabled=${!name.trim()}>Enregistrer</button>
    </div>
  <//>`;
}

function ChildrenSection() {
  const s = useStore();
  const [editing, setEditing] = useState(null);
  const [photoFor, setPhotoFor] = useState(null);
  const list = [...s.children].sort((a, b) => Number(a.archived) - Number(b.archived) || (a.sort ?? 0) - (b.sort ?? 0));
  return html`<div>
    <h2>Les enfants</h2>
    <p class="hint">Chaque enfant a sa colonne le matin et le soir, son avatar et sa cagnotte de pandi.</p>
    <div class="row-list">
      ${list.map((c) => html`<div key=${c.id} class=${`row ${c.archived ? 'muted' : ''}`} style=${{ '--kid': c.color }}>
        <div class="mini-head" style=${{ background: c.color }}><${Avatar} look=${c.look} mode="head" still=${true} /></div>
        <div class="grow"><div class="title">${c.name}${c.archived ? ' (archivé)' : ''}</div><div class="meta">${c.sex ? `${SEXES[c.sex].label} · ` : ''}${c.age ? `${c.age} ans · ` : ''}${balance(c.id, s)} pandi</div></div>
        <button class="p-btn" onClick=${() => setPhotoFor(c)}>📸 Avatar photo</button>
        <button class="p-btn" onClick=${() => navigate(`enfant/${c.id}?onglet=look`)}>🪞 Look</button>
        <button class="p-btn" onClick=${() => setEditing(c)}>Modifier</button>
      </div>`)}
    </div>
    <div class="sheet-actions" style="justify-content:flex-start"><button class="btn btn-blue" onClick=${() => setEditing('new')}>+ Ajouter un enfant</button></div>
    ${editing && html`<${ChildForm} child=${editing === 'new' ? null : editing} onClose=${() => setEditing(null)} />`}
    ${photoFor && html`<${PhotoAvatar} child=${photoFor} onClose=${() => setPhotoFor(null)} onEdit=${() => navigate(`enfant/${photoFor.id}?onglet=look`)} />`}
  </div>`;
}

// --- Tâches ----------------------------------------------------------------------
function TaskForm({ task, routine: initialRoutine = 'soir', onClose }) {
  const s = useStore();
  const kids = activeChildren(s.children);
  const [routine, setRoutine] = useState(task ? routineOf(task) : initialRoutine);
  const [title, setTitle] = useState(task?.title || '');
  const [emoji, setEmoji] = useState(task?.emoji || '⭐');
  const [days, setDays] = useState(task?.days || (initialRoutine === 'matin' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]));
  const [childIds, setChildIds] = useState(task ? s.childTasks.filter((ct) => ct.task_id === task.id).map((ct) => ct.child_id) : kids.map((k) => k.id));
  const toggleDay = (d) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));
  const toggleKid = (id) => setChildIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  function save() {
    if (!title.trim()) return;
    if (task) {
      actions.saveTask({ ...task, title: title.trim(), emoji, days, routine });
      actions.setTaskChildren(task.id, childIds);
    } else actions.addTask({ title: title.trim(), emoji, days, childIds, routine });
    sfx.green();
    onClose();
  }
  return html`<${Modal} onClose=${onClose}>
    <h2>${task ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
    <div class="field"><label>Nom de la tâche</label><input class="input" value=${title} maxLength="28" onInput=${(e) => setTitle(e.target.value)} placeholder="Ex. : Préparer ses habits" /></div>
    <div class="field"><label>Image</label><div class="emoji-grid">${EMOJIS.map((e) => html`<button key=${e} class=${emoji === e ? 'on' : ''} onClick=${() => setEmoji(e)}>${e}</button>`)}</div></div>
    <div class="field"><label>Routine</label><${RoutineSwitch} value=${routine} onChange=${setRoutine} /></div>
    <div class="field"><label>Quels jours ?</label><div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button key=${d} class=${`day ${days.includes(d) ? 'on' : ''}`} onClick=${() => toggleDay(d)}>${WEEKDAYS_SHORT[d]}</button>`)}</div></div>
    <div class="field"><label>Pour qui ?</label><div class="chip-row">${kids.map((k) => html`<button key=${k.id} class=${`kid-chip ${childIds.includes(k.id) ? 'on' : ''}`} style=${{ '--kid': k.color }} onClick=${() => toggleKid(k.id)}><i />${k.name}</button>`)}</div></div>
    <div class="sheet-actions">
      ${task && html`<button class="p-btn danger" onClick=${() => { actions.archiveTask(task.id); onClose(); }}>Supprimer</button>`}
      <button class="btn btn-green" onClick=${save} disabled=${!title.trim() || !days.length}>Enregistrer</button>
    </div>
  <//>`;
}

function RoutineSwitch({ value, onChange }) {
  return html`<div class="routine-switch">${['matin', 'soir'].map((r) => html`<button key=${r} class=${value === r ? 'on' : ''} onClick=${() => { sfx.tap(); onChange(r); }}>${ROUTINES[r].icon} ${ROUTINES[r].label}</button>`)}</div>`;
}

function TasksSection() {
  const s = useStore();
  const [editing, setEditing] = useState(null);
  const [routine, setRoutine] = useState(currentRoutine());
  const kids = activeChildren(s.children);
  const list = s.tasks.filter((t) => !t.archived && routineOf(t) === routine).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return html`<div>
    <h2>Les tâches</h2>
    <${RoutineSwitch} value=${routine} onChange=${setRoutine} />
    <p class="hint">${routine === 'matin' ? 'La routine du réveil, avant de partir à l’école.' : 'La routine du soir.'} Les tâches défilent dans le carrousel dans cet ordre (flèches ↑ ↓). Choisis les jours où chaque tâche apparaît et pour quels enfants. Une tâche supprimée garde ses pandi déjà gagnés.</p>
    <div class="row-list">
      ${list.map((t, i) => {
        const assigned = new Set(s.childTasks.filter((ct) => ct.task_id === t.id).map((ct) => ct.child_id));
        return html`<div key=${t.id} class=${`row ${t.active === false ? 'muted' : ''}`}>
          <span class="emoji">${t.emoji}</span>
          <div class="grow">
            <div class="title">${t.title}</div>
            <div class="days" style="margin-top:6px">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<span key=${d} class=${`day ${!t.days || t.days.includes(d) ? 'on' : ''}`}>${WEEKDAYS_SHORT[d]}</span>`)}</div>
          </div>
          <div class="chip-row">${kids.map((k) => html`<button key=${k.id} class=${`kid-chip ${assigned.has(k.id) ? 'on' : ''}`} style=${{ '--kid': k.color }}
            onClick=${() => actions.setTaskChildren(t.id, assigned.has(k.id) ? [...assigned].filter((x) => x !== k.id) : [...assigned, k.id])}><i />${k.name}</button>`)}</div>
          <${Toggle} on=${t.active !== false} label="Active" onChange=${(on) => actions.saveTask({ ...t, active: on })} />
          <button class="p-btn icon" disabled=${i === 0} onClick=${() => actions.moveTask(t.id, -1)} aria-label="Monter">↑</button>
          <button class="p-btn icon" disabled=${i === list.length - 1} onClick=${() => actions.moveTask(t.id, 1)} aria-label="Descendre">↓</button>
          <button class="p-btn" onClick=${() => setEditing(t)}>Modifier</button>
        </div>`;
      })}
    </div>
    <div class="sheet-actions" style="justify-content:flex-start"><button class="btn btn-blue" onClick=${() => setEditing('new')}>+ Nouvelle tâche</button></div>
    ${list.length === 0 && html`<p class="hint">Aucune tâche pour le ${ROUTINES[routine].label.toLowerCase()} : ajoute la première !</p>`}
    ${editing && html`<${TaskForm} task=${editing === 'new' ? null : editing} routine=${routine} onClose=${() => setEditing(null)} />`}
  </div>`;
}

// --- Défis -------------------------------------------------------------------------
function ChallengeForm({ challenge, onClose }) {
  const s = useStore();
  const kids = activeChildren(s.children);
  const tasks = s.tasks.filter((t) => !t.archived);
  const [title, setTitle] = useState(challenge?.title || '');
  const [taskId, setTaskId] = useState(challenge?.task_id || tasks[0]?.id);
  const [target, setTarget] = useState(challenge?.target || 10);
  const [reward, setReward] = useState(challenge?.reward_item || rewardItems()[0].id);
  const [bonus, setBonus] = useState(challenge?.bonus ?? 10);
  const [childId, setChildId] = useState(challenge?.child_id || null);
  const [restart, setRestart] = useState(false);
  const rewards = [...rewardItems(), ...ITEMS.filter((i) => !i.exclusive && i.price >= 60)];
  function save() {
    const task = tasks.find((t) => t.id === taskId);
    actions.saveChallenge({
      ...(challenge || {}),
      title: title.trim() || `${target} × ${task?.title || 'tâche'}`,
      task_id: taskId,
      target,
      reward_item: reward,
      bonus,
      child_id: childId,
      start_date: !challenge || restart ? eveningDate() : challenge.start_date,
    });
    sfx.green();
    onClose();
  }
  return html`<${Modal} onClose=${onClose}>
    <h2>${challenge ? 'Modifier le défi' : 'Nouveau défi'}</h2>
    <div class="field"><label>Nom du défi</label><input class="input" value=${title} maxLength="40" onInput=${(e) => setTitle(e.target.value)} placeholder="Ex. : Le super lecteur" /></div>
    <div class="field-row">
      <div class="field"><label>Tâche</label>
        <select class="input" value=${taskId} onChange=${(e) => setTaskId(e.target.value)}>${tasks.map((t) => html`<option key=${t.id} value=${t.id}>${t.emoji} ${t.title}</option>`)}</select></div>
      <div class="field"><label>Nombre de verts à cumuler</label><${NumberInput} value=${target} onChange=${setTarget} min=${2} max=${60} /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Pandi en bonus</label><${NumberInput} value=${bonus} onChange=${setBonus} min=${0} max=${200} step=${5} /></div>
      <div class="field"><label>Pour qui ?</label><div class="chip-row">
        <button class=${`chip ${!childId ? 'on' : ''}`} style="color:inherit;background:${!childId ? '#7b6cff' : '#e6e0fb'};${!childId ? 'color:#fff' : 'color:var(--ink)'}" onClick=${() => setChildId(null)}>Tous</button>
        ${kids.map((k) => html`<button key=${k.id} class=${`kid-chip ${childId === k.id ? 'on' : ''}`} style=${{ '--kid': k.color }} onClick=${() => setChildId(k.id)}><i />${k.name}</button>`)}
      </div></div>
    </div>
    <div class="field"><label>Récompense</label>
      <div class="item-grid" style="grid-template-columns:repeat(auto-fill,minmax(calc(var(--u)*22),1fr))">
        ${rewards.map((it) => html`<button key=${it.id} class=${`item-card ${reward === it.id ? 'equipped' : ''}`} style="background:#f3effd" onClick=${() => setReward(it.id)}>
          <div class="thumb" style=${it.exclusive ? 'background:radial-gradient(circle,#3b2a8c,#1a1450)' : ''}><${ItemThumb} item=${it} /></div>
          <div class="name">${it.short || it.name}</div>
        </button>`)}
      </div>
    </div>
    ${challenge && html`<label class="chip-row" style="align-items:center;gap:10px;margin-bottom:10px"><${Toggle} on=${restart} onChange=${setRestart} label="Repartir de zéro" /> Repartir de zéro (les verts d'avant ne comptent plus)</label>`}
    <div class="sheet-actions">
      ${challenge && html`<button class="p-btn danger" onClick=${() => { actions.deleteChallenge(challenge.id); onClose(); }}>Supprimer</button>`}
      <button class="btn btn-green" onClick=${save} disabled=${!taskId}>Enregistrer</button>
    </div>
  <//>`;
}

function ChallengesSection() {
  const s = useStore();
  const [editing, setEditing] = useState(null);
  const kids = activeChildren(s.children);
  return html`<div>
    <h2>Les défis</h2>
    <p class="hint">Un défi se gagne en cumulant des notes vertes sur une tâche (les soirs ratés ne remettent pas à zéro). La récompense est un trésor animé que l'enfant ne peut pas acheter.</p>
    <div class="row-list">
      ${s.challenges.map((c) => {
        const task = s.tasks.find((t) => t.id === c.task_id);
        const item = getItem(c.reward_item);
        return html`<div key=${c.id} class="row">
          <div style="width:calc(var(--u)*14);height:calc(var(--u)*14);border-radius:12px;background:radial-gradient(circle,#3b2a8c,#1a1450);flex:none"><${ItemThumb} item=${item} /></div>
          <div class="grow">
            <div class="title">${c.title}</div>
            <div class="meta">${c.target} × ${task ? `${task.emoji} ${task.title}` : '?'} en vert · depuis le ${formatLong(c.start_date)}${c.bonus ? ` · +${c.bonus} pandi` : ''}</div>
            <div class="chip-row" style="margin-top:6px">${kids.filter((k) => !c.child_id || c.child_id === k.id).map((k) => {
              const p = challengesForChild(k.id, s).find((x) => x.challenge.id === c.id);
              return p ? html`<span key=${k.id} class="kid-chip on" style=${{ '--kid': k.color }}><i />${k.name} ${p.done ? '✅' : `${p.count}/${p.target}`}</span>` : null;
            })}</div>
          </div>
          <button class="p-btn" onClick=${() => setEditing(c)}>Modifier</button>
        </div>`;
      })}
    </div>
    <div class="sheet-actions" style="justify-content:flex-start"><button class="btn btn-blue" onClick=${() => setEditing('new')}>+ Nouveau défi</button></div>
    ${editing && html`<${ChallengeForm} challenge=${editing === 'new' ? null : editing} onClose=${() => setEditing(null)} />`}
  </div>`;
}

// --- Historique ------------------------------------------------------------------------
const NEXT = { undefined: 'green', green: 'orange', orange: 'red', red: null };
const NEXT_BEHAVIOR = { null: 'super', super: 'bien', bien: 'non', non: null };
const BEHAVIOR_DOT = { super: 'gold', bien: 'green', non: 'red' };

function HistorySection() {
  const s = useStore();
  const kids = activeChildren(s.children);
  const [adjust, setAdjust] = useState(null);
  const today = eveningDate();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  return html`<div>
    <h2>Historique</h2>
    <p class="hint">Touche une pastille pour corriger une note (vert → orange → rouge → vide). Les pandi et les bonus sont recalculés.</p>
    <div class="row-list" style="margin-bottom:16px">${kids.map((k) => html`<div key=${k.id} class="row" style=${{ '--kid': k.color }}>
      <div class="mini-head" style=${{ background: k.color }}><${Avatar} look=${k.look} mode="head" still=${true} /></div>
      <div class="grow"><div class="title">${k.name}</div><div class="meta">${balance(k.id, s)} pandi</div></div>
      <button class="p-btn" onClick=${() => setAdjust(k)}>💰 Cagnotte</button>
    </div>`)}</div>
    ${days.map((d) => html`<div key=${d} class="history-day">
      <h3>${d === today ? 'Aujourd’hui' : formatLong(d)}</h3>
      <div class="history-grid">${kids.map((k) => html`<div key=${k.id} class="history-line">
        <span class="who"><span class="kid-chip on" style=${{ '--kid': k.color }}><i />${k.name}</span></span>
        ${['matin', 'soir'].map((routine) => {
          const list = tasksForChild(k.id, d, s, routine);
          if (!list.length) return null;
          return html`<span key=${routine} class="history-routine"><em title=${ROUTINES[routine].label}>${ROUTINES[routine].icon}</em>${list.map((t) => {
            const r = findRating(s.ratings, k.id, t.id, d);
            return html`<button key=${t.id} class=${`dot-btn ${r?.color || ''}`} title=${`${t.title}${r ? ` : ${COLOR_META[r.color].label}` : ''}`}
              onClick=${() => { sfx.tap(); actions.rate(k.id, t.id, d, NEXT[r?.color]); }}>${t.emoji}</button>`;
          })}${routine === 'soir' && (() => {
            const level = behaviorLevel(findBehavior(s.ledger, k.id, d));
            return html`<button class=${`dot-btn ${level ? BEHAVIOR_DOT[level] : ''}`} title=${`Comportement${level ? ` : ${BEHAVIOR[level].label}` : ''}`}
              onClick=${() => { sfx.tap(); actions.setBehavior(k.id, d, NEXT_BEHAVIOR[level]); }}>${level ? BEHAVIOR[level].face : '😇'}</button>`;
          })()}</span>`;
        })}
      </div>`)}</div>
    </div>`)}
    ${adjust && html`<${PandiBank} child=${adjust} onClose=${() => setAdjust(null)} />`}
  </div>`;
}

// --- Réglages ---------------------------------------------------------------------------
function SettingsSection() {
  const s = useStore();
  const pts = s.settings.points;
  const [changingPin, setChangingPin] = useState(false);
  const setPoints = (color) => (v) => actions.updateSettings({ points: { ...pts, [color]: v } });
  return html`<div>
    <h2>Réglages</h2>
    <h3 class="section-title" style="color:var(--ink)">Barème des pandi</h3>
    <div class="row-list">
      <div class="row"><span class="emoji">😄</span><div class="grow"><div class="title">Vert : bravo !</div></div><${NumberInput} value=${pts.green} onChange=${setPoints('green')} max=${20} /></div>
      <div class="row"><span class="emoji">😐</span><div class="grow"><div class="title">Orange : presque</div></div><${NumberInput} value=${pts.orange} onChange=${setPoints('orange')} max=${20} /></div>
      <div class="row"><span class="emoji">😟</span><div class="grow"><div class="title">Rouge : à retravailler</div></div><${NumberInput} value=${pts.red} onChange=${setPoints('red')} max=${20} /></div>
      <div class="row"><span class="emoji">⭐</span><div class="grow"><div class="title">Bonus soirée ou matinée parfaite</div><div class="meta">Quand toutes les tâches de la routine sont vertes</div></div><${NumberInput} value=${s.settings.perfectBonus} onChange=${(v) => actions.updateSettings({ perfectBonus: v })} max=${50} /></div>
    </div>
    <p class="hint" style="margin-top:8px">Un nouveau barème s'applique aux prochaines notes : les pandi déjà gagnés ne changent pas.</p>

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Comportement de fin de soirée</h3>
    <div class="row-list">
      <div class="row"><span class="emoji">😇</span><div class="grow"><div class="title">Super comportement</div><div class="meta">Dernière carte du carrousel, le soir</div></div><${NumberInput} value=${s.settings.behaviorPoints.super} onChange=${(v) => actions.updateSettings({ behaviorPoints: { ...s.settings.behaviorPoints, super: v } })} max=${20} /></div>
      <div class="row"><span class="emoji">🙂</span><div class="grow"><div class="title">Bon comportement</div></div><${NumberInput} value=${s.settings.behaviorPoints.bien} onChange=${(v) => actions.updateSettings({ behaviorPoints: { ...s.settings.behaviorPoints, bien: v } })} max=${20} /></div>
    </div>

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Équipe</h3>
    <div class="row-list">
      <div class="row"><span class="emoji">🤝</span><div class="grow"><div class="title">Défi d'équipe : % de vert à réunir</div><div class="meta">Sur la semaine, tous les enfants ensemble, matin et soir</div></div><${NumberInput} value=${s.settings.team.threshold} onChange=${(v) => actions.updateSettings({ team: { ...s.settings.team, threshold: v } })} min=${50} max=${100} step=${5} /></div>
      <div class="row"><span class="emoji">🎁</span><div class="grow"><div class="title">Bonus du défi d'équipe</div><div class="meta">Pandi pour chaque enfant, en plus du cadeau duo</div></div><${NumberInput} value=${s.settings.team.bonus} onChange=${(v) => actions.updateSettings({ team: { ...s.settings.team, bonus: v } })} max=${50} /></div>
      <div class="row"><span class="emoji">🙌</span><div class="grow"><div class="title">Coup de main</div><div class="meta">Pandi pour celui qui aide et celui qui est aidé</div></div><${NumberInput} value=${s.settings.helpBonus} onChange=${(v) => actions.updateSettings({ helpBonus: v })} max=${20} /></div>
    </div>
    <p class="hint" style="margin-top:8px">Le trésor de la fratrie et la cagnotte commune se règlent depuis le bouton 🤝 de l'écran de la soirée.</p>

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Routine du matin</h3>
    <div class="row-list">
      <div class="row"><span class="emoji">🎒</span><div class="grow"><div class="title">Compte à rebours du départ</div><div class="meta">L'écran du matin affiche le temps qui reste avant de partir à l'école, puis sonne à l'heure.</div></div>
        <${Toggle} on=${Boolean(s.settings.departure)} label="Compte à rebours du départ" onChange=${(on) => actions.updateSettings({ departure: on ? '08:15' : null })} /></div>
      ${s.settings.departure && html`<div class="row"><span class="emoji">⏰</span><div class="grow"><div class="title">Heure du départ</div></div>
        <input class="input time-input" type="time" value=${s.settings.departure} onChange=${(e) => e.target.value && actions.updateSettings({ departure: e.target.value })} /></div>`}
      ${s.settings.departure && html`<div class="row"><span class="emoji">📅</span><div class="grow"><div class="title">Jours d'école</div></div>
        <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = s.settings.departureDays.includes(d);
          return html`<button key=${d} class=${`day ${on ? 'on' : ''}`} onClick=${() => actions.updateSettings({ departureDays: on ? s.settings.departureDays.filter((x) => x !== d) : [...s.settings.departureDays, d] })}>${WEEKDAYS_SHORT[d]}</button>`;
        })}</div></div>`}
    </div>

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Sur cet appareil</h3>
    <div class="row-list">
      <div class="row"><span class="emoji">🔊</span><div class="grow"><div class="title">Sons</div></div><${Toggle} on=${s.prefs.sound} onChange=${(v) => setPrefs({ sound: v })} label="Sons" /></div>
      <div class="row"><span class="emoji">🐢</span><div class="grow"><div class="title">Animations réduites</div><div class="meta">Pour les écrans lents ou les enfants sensibles aux mouvements</div></div><${Toggle} on=${s.prefs.reducedMotion} onChange=${(v) => setPrefs({ reducedMotion: v })} label="Animations réduites" /></div>
    </div>

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Parents de la famille</h3>
    <${FamilyMembers} />

    <h3 class="section-title" style="color:var(--ink);margin-top:20px">Compte et données</h3>
    <div class="row-list">
      ${s.mode === 'cloud'
        ? html`<div class="row"><span class="emoji">✉️</span><div class="grow"><div class="title">Connecté</div><div class="meta">${s.user?.email}</div></div><button class="p-btn" onClick=${() => actions.signOut()}>Se déconnecter</button></div>`
        : html`<div class="row"><span class="emoji">🧪</span><div class="grow"><div class="title">Mode démo</div><div class="meta">Les données restent dans ce navigateur et les invitations sont factices.</div></div><button class="p-btn danger" onClick=${() => confirm('Remettre la démo à zéro ?') && actions.resetDemo()}>Remettre à zéro</button></div>`}
      <div class="row"><span class="emoji">🔐</span><div class="grow"><div class="title">Code parent</div></div><button class="p-btn" onClick=${() => setChangingPin(true)}>Changer le code</button></div>
      <div class="row"><span class="emoji">💾</span><div class="grow"><div class="title">Sauvegarde</div><div class="meta">Télécharger toutes les données (fichier JSON)</div></div><button class="p-btn" onClick=${actions.exportBackup}>Télécharger</button></div>
      ${s.settings.photoConsent && html`<div class="row"><span class="emoji">📸</span><div class="grow"><div class="title">Consentement photo donné</div><div class="meta">Les photos passent par Claude et OpenAI puis sont oubliées ; seuls les visages 3D créés sont gardés.</div></div><button class="p-btn" onClick=${() => actions.updateSettings({ photoConsent: false })}>Retirer</button></div>`}
    </div>
    <p class="hint" style="margin-top:16px;text-align:center">PandiFlow v${APP_VERSION}</p>
    ${changingPin && html`<${Modal} onClose=${() => setChangingPin(false)} style="width:auto"><${PinChange} onDone=${() => setChangingPin(false)} /><//>`}
  </div>`;
}

function PinChange({ onDone }) {
  const [step, setStep] = useState('old');
  if (step === 'old') return html`<${PinPad} onSuccess=${() => { actions.updateSettings({ pinHash: null }); setStep('new'); }} />`;
  return html`<${PinPad} onSuccess=${onDone} />`;
}

export function ParentPage({ section = 'enfants' }) {
  const s = useStore();
  const [, refresh] = useState(0);
  const unlocked = actions.isParentUnlocked();
  const current = SECTIONS.some((x) => x.id === section) ? section : 'enfants';

  if (!unlocked) {
    return html`<div class="parent-page page-enter">
      <header class="topbar"><button class="btn btn-ghost btn-small" onClick=${() => navigate('soiree')}>← Soirée</button><div class="page-title">Espace parent</div></header>
      <div class="welcome"><div class="sheet" style="width:auto"><${PinPad} onSuccess=${() => refresh((x) => x + 1)} /></div></div>
    </div>`;
  }

  return html`<div class="parent-page page-enter">
    <header class="topbar">
      <button class="btn btn-ghost btn-small" onClick=${() => navigate('soiree')}>← Soirée</button>
      <div class="page-title">Espace parent</div>
      <div class="spacer" />
      ${s.mode === 'demo' && html`<span class="mode-badge">Démo</span>`}
      <button class="icon-btn" aria-label="Verrouiller" onClick=${() => { actions.lockParent(); navigate('soiree'); }}>🔒</button>
    </header>
    <div class="parent-body">
      <nav class="side-tabs">${SECTIONS.map((x) => html`<button key=${x.id} class=${`tab ${current === x.id ? 'on' : ''}`} onClick=${() => { sfx.tap(); navigate(`parent/${x.id}`, { replace: true }); }}><span class="tab-ico">${x.icon}</span>${x.label}</button>`)}</nav>
      <div class="parent-content" key=${current}>
        ${current === 'enfants' && html`<${ChildrenSection} />`}
        ${current === 'taches' && html`<${TasksSection} />`}
        ${current === 'defis' && html`<${ChallengesSection} />`}
        ${current === 'historique' && html`<${HistorySection} />`}
        ${current === 'tsedaka' && html`<${TsedakaParent} />`}
        ${current === 'reglages' && html`<${SettingsSection} />`}
      </div>
    </div>
  </div>`;
}
