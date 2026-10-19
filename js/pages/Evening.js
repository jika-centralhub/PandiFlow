// Écran de la soirée : celui qui est projeté sur la télé.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useStore, setPrefs } from '../lib/store.js';
import * as actions from '../lib/actions.js';
import { activeChildren, tasksForChild, eveningProgress, balance, findRating, pointsFor, COLOR_META } from '../domain.js';
import { eveningDate, addDays, formatLong } from '../lib/dates.js';
import { Avatar } from '../avatar/Avatar.js';
import { PandiCounter, Gauge, Modal } from '../components/ui.js';
import { Coin } from '../components/Coin.js';
import { showOverlay } from '../components/Overlays.js';
import { PandiBank } from '../components/PandiBank.js';
import { useParentAction } from '../components/PinGate.js';
import { flyCoins, burst, floatText, replay } from '../anim/fx.js';
import { sfx } from '../lib/sounds.js';
import { navigate } from '../router.js';
import { keepScreenOn, toggleFullscreen, isFullscreen } from '../lib/device.js';

export function TopBar({ date, setDate }) {
  const s = useStore();
  const today = eveningDate();
  const [fs, setFs] = useState(isFullscreen());
  return html`<header class="topbar">
    <div class="brand"><${Coin} /> <span>Pandi<b>Flow</b></span></div>
    ${s.mode === 'demo' && html`<span class="mode-badge">Démo</span>`}
    ${s.mode === 'cloud' && html`<span class=${`sync-dot ${s.pendingOps ? 'busy' : ''}`} title=${s.pendingOps ? 'Synchronisation…' : 'Synchronisé'} />`}
    <div class="spacer" />
    <div class="date-switch" role="tablist">
      <button class=${date === addDays(today, -1) ? 'on' : ''} onClick=${() => { sfx.tap(); setDate(addDays(today, -1)); }}>Hier soir</button>
      <button class=${date === today ? 'on' : ''} onClick=${() => { sfx.tap(); setDate(today); }}>Ce soir</button>
    </div>
    <div class="spacer" />
    <button class="icon-btn" aria-label=${s.prefs.sound ? 'Couper le son' : 'Activer le son'} onClick=${() => setPrefs({ sound: !s.prefs.sound })}>${s.prefs.sound ? '🔊' : '🔇'}</button>
    <button class="icon-btn fs-btn" aria-label="Plein écran" onClick=${async () => setFs(await toggleFullscreen())}>${fs ? '🗗' : '⛶'}</button>
    <button class="icon-btn" aria-label="Espace parent" onClick=${() => navigate('parent')}>⚙️</button>
  </header>`;
}

function TaskTile({ task, rating, index, tileRef, onOpen }) {
  return html`<button
    class=${`tile ${rating?.color || ''}`}
    style=${{ '--i': index }}
    ref=${tileRef}
    onClick=${onOpen}
    aria-label=${`${task.title}${rating ? ` : ${COLOR_META[rating.color].label}` : ''}`}
  >
    <span class="tile-emoji">${task.emoji}</span>
    <span class="tile-label">${task.title}</span>
    ${rating && html`<span class="tile-badge" key=${rating.color}>${COLOR_META[rating.color].face}</span>`}
  </button>`;
}

function RatingSheet({ child, task, current, settings, onPick, onClose }) {
  const [expr, setExpr] = useState('happy');
  const preview = { green: 'joy', orange: 'encourage', red: 'focus' };
  return html`<${Modal} onClose=${onClose} class="rate-sheet" style=${{ '--kid': child.color }}>
    <div class="rate-avatar">
      <${Avatar} look=${child.look} equipped=${child.equipped} expr=${expr} mode="full" seed=${child.id} pose=${expr === 'joy' ? 'cheer' : 'idle'} />
    </div>
    <div>
      <div class="rate-title"><span class="big-emoji">${task.emoji}</span> ${task.title}</div>
      <p class="rate-sub">Comment ça s'est passé, ${child.name} ?</p>
      <div class="rate-choices">
        ${['green', 'orange', 'red'].map((c) => html`<button
          key=${c}
          class=${`rate-choice ${c} ${current === c ? 'current' : ''}`}
          onPointerEnter=${() => setExpr(preview[c])}
          onPointerLeave=${() => setExpr('happy')}
          onClick=${() => onPick(c)}
        >
          <span class="face">${COLOR_META[c].face}</span>
          ${COLOR_META[c].label}
          <span class="pts">${pointsFor(c, settings) > 0 ? `+${pointsFor(c, settings)} pandi` : "On fera mieux demain"}</span>
        </button>`)}
      </div>
      ${current && html`<button class="rate-clear" onClick=${() => onPick(null)}>Effacer la note</button>`}
    </div>
  <//>`;
}

export function Evening() {
  const s = useStore();
  const [date, setDate] = useState(eveningDate());
  const [open, setOpen] = useState(null); // { childId, taskId }
  const [moods, setMoods] = useState({});
  const [held, setHeld] = useState({}); // solde affiché gelé pendant le vol des pièces
  const [bankFor, setBankFor] = useState(null);
  const [asParent, parentGate] = useParentAction();
  const tiles = useRef({});
  const counters = useRef({});
  const heads = useRef({});
  const moodTimers = useRef({});

  useEffect(() => {
    keepScreenOn();
  }, []);

  // Si la soirée change (minuit passé puis 4 h), on suit
  useEffect(() => {
    const t = setInterval(() => {
      const now = eveningDate();
      setDate((d) => (d === addDays(now, -1) || d === now ? d : now));
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const kids = activeChildren(s.children);

  function setMood(childId, expr, ms) {
    clearTimeout(moodTimers.current[childId]);
    setMoods((m) => ({ ...m, [childId]: expr }));
    moodTimers.current[childId] = setTimeout(() => setMoods((m) => ({ ...m, [childId]: undefined })), ms);
  }

  async function pick(child, task, color) {
    setOpen(null);
    const before = balance(child.id, s);
    const res = actions.rate(child.id, task.id, date, color);
    if (!color) {
      sfx.pop();
      return;
    }
    const tile = tiles.current[`${child.id}:${task.id}`];
    const head = heads.current[child.id];
    const points = pointsFor(color, s.settings);

    if (color === 'green') {
      sfx.green();
      replay(tile, 'pop', 700);
      burst(tile, { count: 14 });
      replay(head?.querySelector('.avatar'), 'av-jump', 900);
      setMood(child.id, 'joy', 2800);
    } else if (color === 'orange') {
      sfx.orange();
      replay(tile, 'wobble', 700);
      burst(tile, { count: 6, chars: ['✨', '💫'], spread: 90 });
      replay(head?.querySelector('.avatar'), 'av-wobble', 900);
      setMood(child.id, 'encourage', 2400);
    } else {
      sfx.red();
      replay(tile, 'deflate', 800);
      setMood(child.id, 'focus', 2400);
    }

    if (points > 0 && res.delta > 0) {
      setHeld((h) => ({ ...h, [child.id]: before }));
      floatText(tile, `+${points}`);
      let shown = before;
      await flyCoins(tile, counters.current[child.id], Math.min(points, res.delta), () => {
        shown += 1;
      });
      setHeld((h) => ({ ...h, [child.id]: undefined }));
    }

    if (res.becameComplete) {
      await showOverlay('celebrate', { childId: child.id, perfect: res.after.perfect, bonus: res.perfectGained ? s.settings.perfectBonus : 0 });
    }
    for (const c of res.unlocked) {
      await showOverlay('reveal', { childId: child.id, itemId: c.reward_item, challengeTitle: c.title });
    }
  }

  const openChild = open && kids.find((k) => k.id === open.childId);
  const openTask = open && s.tasks.find((t) => t.id === open.taskId);
  const openRating = open && findRating(s.ratings, open.childId, open.taskId, date);

  return html`<div class="evening page-enter">
    <${TopBar} date=${date} setDate=${setDate} />
    ${date !== eveningDate() && html`<div style="text-align:center;margin:-6px 0 6px;opacity:.85;font-size:calc(var(--u)*3.6)">Tu modifies la soirée du ${formatLong(date)}</div>`}
    <div class="columns" style=${{ '--n': Math.max(1, kids.length) }}>
      ${kids.length === 0 && html`<div class="empty-col">Ajoute un enfant dans l'espace parent ⚙️ pour commencer !</div>`}
      ${kids.map((child) => {
        const prog = eveningProgress(child.id, date, s);
        const list = tasksForChild(child.id, date, s);
        const bal = held[child.id] ?? balance(child.id, s);
        return html`<section key=${child.id} class=${`kid-col ${prog.complete ? 'done' : ''}`} style=${{ '--kid': child.color }}>
          <div class="kid-head">
            <button class="kid-avatar" ref=${(n) => (heads.current[child.id] = n)} onClick=${() => navigate(`enfant/${child.id}`)} aria-label=${`Le coin de ${child.name}`}>
              <${Avatar} look=${child.look} equipped=${child.equipped} expr=${moods[child.id] || 'happy'} mode="head" seed=${child.id} />
            </button>
            <div class="kid-info">
              <div class="kid-name-row">
                <span class="kid-name">${child.name}</span>
                <button class="counter-btn" aria-label=${`Cagnotte de ${child.name}`} onClick=${() => { sfx.tap(); asParent(() => setBankFor(child.id)); }}>
                  <${PandiCounter} value=${bal} counterRef=${{ set current(n) { counters.current[child.id] = n; } }} />
                </button>
              </div>
              <${Gauge} segments=${prog.segments} complete=${prog.complete} />
            </div>
          </div>
          <div class="tiles">
            ${list.length === 0 && html`<div class="empty-col">Pas de tâche ce soir 🎉</div>`}
            ${list.map((task, i) => html`<${TaskTile}
              key=${task.id}
              task=${task}
              index=${i}
              rating=${findRating(s.ratings, child.id, task.id, date)}
              tileRef=${(n) => (tiles.current[`${child.id}:${task.id}`] = n)}
              onOpen=${() => { sfx.tap(); setOpen({ childId: child.id, taskId: task.id }); }}
            />`)}
          </div>
        </section>`;
      })}
    </div>
    ${bankFor && kids.some((k) => k.id === bankFor) && html`<${PandiBank} child=${kids.find((k) => k.id === bankFor)} onClose=${() => setBankFor(null)} />`}
    ${parentGate}
    ${openChild && openTask && html`<${RatingSheet}
      child=${openChild}
      task=${openTask}
      current=${openRating?.color}
      settings=${s.settings}
      onPick=${(c) => pick(openChild, openTask, c)}
      onClose=${() => setOpen(null)}
    />`}
  </div>`;
}
