// Minuteur des tâches : l'anneau qui se vide, le choix de la durée et le grand écran pour la télé.
import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { useStore, setPrefs } from '../lib/store.js';
import * as cd from '../lib/countdown.js';
import * as timers from '../lib/timers.js';
import { Avatar } from '../avatar/Avatar.js';
import { Pandi3D, has3D } from './Pandi3D.js';
import { PandiFlat } from './Coin.js';
import { pandiFor } from '../mascot/tasks.js';
import { Modal } from './ui.js';
import { sfx } from '../lib/sounds.js';
import { burst, confettiBurst } from '../anim/fx.js';

// Horloge locale : seul le composant qui affiche un minuteur se redessine plusieurs fois par seconde
export function useClock(active = true, ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

// Ce qu'il faut pour dessiner un minuteur à un instant donné
export function timerView(t, now) {
  const phase = cd.phaseOf(t, now);
  const left = cd.remainingMs(t, now);
  return {
    phase,
    look: cd.isPaused(t) && phase !== 'over' ? 'paused' : phase,
    progress: cd.progressOf(t, now),
    clock: cd.clockText(t, now),
    second: Math.ceil(left / 1000),
  };
}

// Anneau qui se vide (le reste du temps), avec une petite comète au bout
export function TimerRing({ progress, ticks = false }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const a = (1 - progress) * 2 * Math.PI - Math.PI / 2;
  return html`<svg class="t-ring" viewBox="0 0 100 100" aria-hidden="true">
    ${ticks && html`<g class="t-ticks">${Array.from({ length: 12 }, (_, i) => html`<line key=${i} x1="50" y1="-1.5" x2="50" y2="2.5" transform=${`rotate(${i * 30} 50 50)`} />`)}</g>`}
    <circle class="t-ring-track" cx="50" cy="50" r=${r} />
    <circle class="t-ring-bar" cx="50" cy="50" r=${r} stroke-dasharray=${c} stroke-dashoffset=${c * progress} transform="rotate(-90 50 50)" />
    ${progress < 1 && html`<circle class="t-ring-dot" cx=${50 + r * Math.cos(a)} cy=${50 + r * Math.sin(a)} r="4.4" />`}
  </svg>`;
}

// Choix de la durée au lancement
export function TimerPicker({ child, task, last, onPick, onClose }) {
  return html`<${Modal} onClose=${onClose} class="timer-picker" style=${{ '--kid': child.color }}>
    <div class="rate-title"><span class="big-emoji">${task.emoji}</span> ${task.title}</div>
    <p class="rate-sub">⏱️ Combien de temps pour ${child.name} ?</p>
    <div class="tp-grid">
      ${cd.DURATIONS.map((m, i) => html`<button key=${m} class=${`tp-choice ${last === m ? 'last' : ''}`} style=${{ '--i': i }} onClick=${() => onPick(m)}>
        <b>${m}</b><span>min</span>
      </button>`)}
    </div>
    ${last && html`<p class="hint" style="margin-top:12px;color:var(--ink-soft)">⭐ = la durée choisie la dernière fois</p>`}
  <//>`;
}

const BUBBLE = {
  calm: (name) => `C'est parti, ${name} !`,
  hurry: () => 'Ça avance bien !',
  rush: () => 'Vite, vite, on accélère !',
  final: () => 'Dernières secondes !',
  over: () => 'Temps écoulé !',
  paused: () => 'Petite pause…',
  won: () => 'Bravo, à temps ! 🎉',
};

const DECO = {
  calm: ['✨'],
  hurry: ['💨', '✨'],
  rush: ['💦', '💨', '💦'],
  final: ['💦', '⏰', '💦', '❗'],
  over: ['⏰', '❗', '⏰'],
  paused: ['💤', '💤'],
  won: ['⭐', '💖', '⭐', '✨'],
};

// Grand écran du minuteur (dupliqué sur la télé) : anneau géant et Pandi qui s'agite de plus en plus
export function TimerStage({ timer, child, task, others, onRate, onClose, onSwitch }) {
  const s = useStore();
  const now = useClock(true, 200);
  const v = timerView(timer, now);
  const [won, setWon] = useState(false);
  const clock = useRef(null);
  const prev = useRef(v.phase);
  const look = won ? 'won' : v.look;
  const over = v.phase === 'over';
  const musicOn = s.prefs.timerMusic !== false;

  useEffect(() => {
    if (v.phase === 'over' && prev.current !== 'over') burst(clock.current, { count: 12, chars: ['⏰', '❗', '💥'], spread: 220 });
    prev.current = v.phase;
  }, [v.phase]);

  function finish() {
    const res = timers.finishTimer(timer.key);
    if (!res) return;
    if (res.inTime) {
      setWon(true);
      sfx.timerWin();
      confettiBurst(clock.current);
      burst(clock.current, { count: 16, chars: ['⭐', '✨', '🎉'], spread: 260 });
      setTimeout(() => onRate(res), 1700);
    } else onRate(res);
  }

  const deco = DECO[look] || [];
  return html`<div class=${`timer-stage ts-${look}`} style=${{ '--kid': child.color }} role="dialog" aria-modal="true" aria-label=${`Minuteur : ${task.title}`}>
    <button class="icon-btn ts-close" aria-label="Réduire le minuteur" onClick=${() => { sfx.tap(); onClose(); }}>✕</button>
    <div class="ts-clock" ref=${clock}>
      <${TimerRing} progress=${won ? 1 : v.progress} ticks=${true} />
      <div class="ts-center">
        <span class="ts-emoji">${over && !won ? '⏰' : task.emoji}</span>
        <span class="ts-digits" key=${v.phase === 'final' && !won ? v.second : 'd'}>${won ? '🎉' : v.clock}</span>
      </div>
    </div>
    <div class="ts-side">
      <div class="ts-kid">
        <div class="kid-avatar"><${Avatar} look=${child.look} equipped=${child.equipped} expr=${won ? 'joy' : over ? 'encourage' : 'happy'} mode="head" seed=${child.id} /></div>
        <div><div class="ts-name">${child.name}</div><div class="ts-task">${task.title}</div></div>
      </div>
      <div class="ts-pandi">
        <div class="ts-mascot">
          ${has3D()
            ? html`<${Pandi3D} class="ts-pandi3d" framing="auto" base="full" sound=${true} brushColor=${child.color} ...${pandiFor(task, { timer: { look, progress: v.progress } })} />`
            : html`<${PandiFlat} mood=${won ? 'happy' : 'neutral'} wave=${look === 'calm'} />`}
          <div class="ts-deco">${deco.map((e, i) => html`<span key=${`${look}${i}`} style=${{ left: `${8 + ((i * 29) % 84)}%`, animationDelay: `${i * 0.35}s` }}>${e}</span>`)}</div>
        </div>
        <span class="ts-bubble" key=${look}>${BUBBLE[look](child.name)}</span>
      </div>
      ${!won && html`<div class="ts-actions">
        ${over
          ? html`<button class="btn btn-gold btn-big" onClick=${finish}>⭐ Noter la tâche</button>`
          : html`<button class="btn btn-green btn-big" onClick=${finish}>✅ Fini !</button>`}
        <div class="ts-row">
          <button class="btn btn-blue" onClick=${() => timers.addMinute(timer.key)}>+1 min</button>
          ${!over && html`<button class="btn btn-ghost" onClick=${() => (cd.isPaused(timer) ? timers.resumeTimer(timer.key) : timers.pauseTimer(timer.key))}>${cd.isPaused(timer) ? '▶️ Reprendre' : '⏸ Pause'}</button>`}
        </div>
      </div>`}
      ${!won && html`<div class="ts-tools">
        <button class="ts-link" onClick=${() => { sfx.tap(); setPrefs({ timerMusic: !musicOn }); }}>${musicOn ? '🎵 Musique' : '🔇 Sans musique'}</button>
        <button class="ts-link" onClick=${() => { sfx.pop(); timers.removeTimer(timer.key); onClose(); }}>Arrêter le minuteur</button>
      </div>`}
      ${others.length > 0 && html`<div class="ts-others">
        ${others.map((o) => html`<button key=${o.timer.key} class="ts-chip" style=${{ '--kid': o.child.color }} onClick=${() => { sfx.tap(); onSwitch(o.timer.key); }}>
          ${o.task.emoji} ${o.child.name} · <b>${cd.clockText(o.timer, now)}</b>
        </button>`)}
      </div>`}
    </div>
  </div>`;
}

// Petite phrase sous les choix de notation : combien de temps la tâche a pris
export function TimerResult({ result }) {
  if (!result) return null;
  const spent = cd.mmss(result.elapsedMs);
  if (result.inTime) {
    return html`<div class="rate-timer ok">⏱️ Fini en ${spent}${result.extended ? ', avec du temps en plus' : ` sur ${cd.mmss(result.plannedMs)}`} : à temps !</div>`;
  }
  return html`<div class="rate-timer late">⏰ Fini en ${spent} : ${cd.mmss(result.elapsedMs - result.durationMs)} de plus que prévu</div>`;
}
