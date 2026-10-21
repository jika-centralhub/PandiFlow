// La bulle « Transformation en cours… » : pendant que le studio crée le personnage, des petites
// saynètes façon film d'animation 3D défilent dans la bulle (princesse, cowboy, super-héros,
// animaux, astronaute, pirate). Images créées une fois avec OpenAI (tools/make-scene-art.ps1),
// détourées par tools/make_scene_art.py, rangées dans assets/scenes/.
// Une saynète sans son décor ou sans aucun acteur est sautée ; un acteur manquant est laissé de côté.
import { html, useEffect, useState } from '../vendor/preact-htm.js';

// Chemin relatif à ce fichier : il marche depuis l'app comme depuis les pages de test
const SRC = (name) => new URL(`../../assets/scenes/${name}.webp`, import.meta.url).href;

// Chaque acteur : image, animation, position du bas-centre (x, y en % de la bulle) et hauteur (% de la bulle)
export const SCENES = [
  { id: 'princesse', bg: 'fond_chateau', fx: 'sparkles', actors: [{ img: 'princesse', anim: 'twirl', x: 50, y: 92, h: 74 }] },
  { id: 'cowboy', bg: 'fond_desert', fx: 'dust', actors: [{ img: 'cowboy', anim: 'gallop', x: 50, y: 90, h: 66 }] },
  { id: 'heros', bg: 'fond_ville', fx: 'speed', actors: [{ img: 'heros', anim: 'fly', x: 50, y: 70, h: 44 }] },
  {
    id: 'animaux', bg: 'fond_jungle', fx: 'leaves',
    actors: [
      { img: 'lion', anim: 'hop', x: 26, y: 88, h: 40, delay: 0 },
      { img: 'elephant', anim: 'hop', x: 52, y: 84, h: 50, delay: 0.25 },
      { img: 'panda', anim: 'hop', x: 77, y: 88, h: 38, delay: 0.5 },
    ],
  },
  { id: 'astronaute', bg: 'fond_espace', fx: 'stars', actors: [{ img: 'astronaute', anim: 'float', x: 50, y: 84, h: 64 }] },
  { id: 'pirate', bg: 'fond_bateau', fx: 'waves', actors: [{ img: 'pirate', anim: 'sway', x: 50, y: 94, h: 72 }] },
];
const SCENE_MS = 5200;

// Précharge les images d'une saynète. Résout à la saynète jouable (sans les acteurs dont l'image
// manque, les autres répartis dans la bulle), ou à null s'il manque le décor ou tous les acteurs.
const loaded = new Map();
const load = (name) => new Promise((ok) => {
  const img = new Image();
  img.onload = () => ok(true);
  img.onerror = () => ok(false);
  img.src = SRC(name);
});
function preload(scene) {
  if (!loaded.has(scene.id)) {
    loaded.set(scene.id, Promise.all([load(scene.bg), ...scene.actors.map((a) => load(a.img))]).then(([bg, ...ok]) => {
      const actors = scene.actors.filter((_, i) => ok[i]);
      if (!bg || !actors.length) return null;
      if (actors.length === scene.actors.length) return scene;
      return { ...scene, actors: actors.map((a, i) => ({ ...a, x: Math.round(((i + 1) / (actors.length + 1)) * 100), delay: i * 0.25 })) };
    }));
  }
  return loaded.get(scene.id);
}

// Étincelles et étoiles : positions fixes (en % de la bulle)
const SPARKS = [[22, 18], [70, 14], [82, 40], [16, 46], [58, 30], [36, 10]];
const STARS = [[12, 20], [30, 8], [52, 16], [78, 12], [88, 34], [8, 44], [68, 30]];
const dots = (cls, list) => html`<div class=${`mb-fx ${cls}`}>${list.map(([x, y], i) => html`<span key=${i} style=${{ left: `${x}%`, top: `${y}%`, animationDelay: `${-i * 0.27}s` }}>✦</span>`)}</div>`;

function Fx({ kind }) {
  if (kind === 'sparkles') return dots('mb-sparkles', SPARKS);
  if (kind === 'dust') return html`<div class="mb-fx mb-dust">${[0, 1, 2, 3].map((i) => html`<span key=${i} style=${{ '--i': i }} />`)}</div>`;
  if (kind === 'speed') return html`<div class="mb-fx mb-speed">${[0, 1, 2, 3, 4].map((i) => html`<span key=${i} style=${{ '--i': i }} />`)}</div>`;
  if (kind === 'leaves') return html`<div class="mb-fx mb-leaves">${[0, 1, 2, 3].map((i) => html`<span key=${i} style=${{ '--i': i }}>🍃</span>`)}</div>`;
  if (kind === 'stars') return dots('mb-stars', STARS);
  if (kind === 'waves') return html`<div class="mb-fx mb-waves"><i /><i /></div>`;
  return null;
}

function Scene({ scene, prev = false }) {
  return html`<div class=${`mb-scene mb-${scene.id} ${prev ? 'prev' : ''}`}>
    <img class="mb-bg" src=${SRC(scene.bg)} alt="" />
    ${scene.actors.map((a, i) => html`<div key=${i} class=${`mb-actor mb-${a.anim}`} style=${{ left: `${a.x}%`, top: `${a.y}%`, height: `${a.h}%`, '--d': `${a.delay || 0}s` }}>
      <img src=${SRC(a.img)} alt="" />
    </div>`)}
    <${Fx} kind=${scene.fx} />
  </div>`;
}

// delay : attente avant la première saynète (la photo se dissout d'abord)
export function MagicBubble({ delay = 2600 }) {
  const [ready, setReady] = useState([]);
  const [i, setI] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let alive = true;
    // Ordre de départ au hasard, pour ne pas toujours commencer par la même
    const start = Math.floor(Math.random() * SCENES.length);
    const order = [...SCENES.slice(start), ...SCENES.slice(0, start)];
    order.forEach((s) => preload(s).then((p) => alive && p && setReady((r) => (r.some((x) => x.id === p.id) ? r : [...r, p]))));
    const t = setTimeout(() => alive && setStarted(true), delay);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!started || ready.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), SCENE_MS);
    return () => clearInterval(t);
  }, [started, ready.length]);

  if (!started || !ready.length) return null;
  const scene = ready[i % ready.length];
  // La saynète précédente reste dessous pendant que la nouvelle apparaît en fondu
  const prev = i > 0 && ready.length > 1 ? ready[(i - 1) % ready.length] : null;
  return html`<div class="magic-bubble" aria-hidden="true">
    ${prev && html`<${Scene} key=${`p-${prev.id}-${i}`} scene=${prev} prev=${true} />`}
    <${Scene} key=${`${scene.id}-${i}`} scene=${scene} />
  </div>`;
}
