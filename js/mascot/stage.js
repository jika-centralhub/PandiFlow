// La scène de Pandi : chaque Pandi visible (un par carte d'enfant, un grand pendant le minuteur, celui du
// coin calme…) a sa propre surface WebGL, posée telle quelle dans la page.
// Avant, un seul moteur caché dessinait tout puis recopiait chaque image dans un <canvas> 2D : sur iPhone,
// cette copie oblige Safari à attendre la carte graphique et à rapatrier l'image, 30 fois par seconde et
// par Pandi (mesuré le 28/10/2026 sur un iPhone 14 Pro : 75 % du temps du processeur, 13 images/s).
// Les surfaces sont gardées et réutilisées (une carte qui change reprend une surface libre) : le moteur
// garde ses shaders déjà compilés au lieu de tout recompiler à chaque note.
// Lumière de studio d'animation : grande lumière chaude devant à gauche, contre-jour froid qui
// détoure la fourrure, ciel doux pour les reflets des yeux et de la truffe.
import { THREE, blobTexture } from './pandi3d.js';
import { PandiActor } from './actor.js';

let raf = 0, last = 0, solo = null;
const views = new Set();
const surfaces = []; // { canvas, renderer, env, busy, lost }
const KEEP_FREE = 3; // surfaces libres gardées pour les prochains Pandi

function studio(r) {
  const s = new THREE.Scene();
  const dome = new THREE.SphereGeometry(20, 32, 16);
  const col = [];
  const top = new THREE.Color('#DCE8FF'), mid = new THREE.Color('#FFF3E2'), low = new THREE.Color('#9C8A7C');
  const p = dome.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 20;
    const c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(low, Math.min(1, -y * 2));
    col.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, pos, k, color = '#ffffff') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 1, 0);
    s.add(m);
  };
  panel(6, 4, [-6, 8, 8], 6, '#FFF1DE'); // grande boîte à lumière (reflet dans les yeux)
  panel(4, 6, [8, 4, -6], 3.5, '#E2EBFF'); // contre-jour
  panel(8, 3, [6, 1, 8], 1.2, '#FFE9F0'); // débouché doux
  const pm = new THREE.PMREMGenerator(r);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}

// Une surface : un <canvas> et son moteur WebGL, avec sa lumière de studio (propre à ce moteur)
function makeSurface() {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const s = { canvas, renderer, env: studio(renderer), busy: false, lost: false };
  // iOS peut reprendre le contexte d'une app en arrière-plan : la lumière de studio est refaite au retour
  canvas.addEventListener('webglcontextlost', () => (s.lost = true));
  canvas.addEventListener('webglcontextrestored', () => {
    s.lost = false;
    s.env = studio(renderer);
    for (const v of views) if (v.surface === s) v.scene.environment = s.env;
  });
  surfaces.push(s);
  return s;
}

function acquire() {
  const s = surfaces.find((x) => !x.busy && !x.lost) || makeSurface();
  s.busy = true;
  return s;
}

function release(s) {
  s.busy = false;
  s.canvas.remove();
  s.canvas.className = '';
  const free = surfaces.filter((x) => !x.busy);
  if (s.lost || free.length > KEEP_FREE) {
    surfaces.splice(surfaces.indexOf(s), 1);
    s.env.dispose();
    s.renderer.dispose();
    s.renderer.forceContextLoss();
  }
}

// Cadrages : tout Pandi (avec chapeau et bras levés), ou le haut du corps
const FRAMES = {
  full: { y: 1.22, h: 3.1 },
  bust: { y: 1.5, h: 2.0 },
};

function makeScene(env) {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.7;
  const key = new THREE.DirectionalLight('#FFF0DC', 2.3);
  key.position.set(-2.4, 4, 4.2);
  const rim = new THREE.DirectionalLight('#E4ECFF', 2.6);
  rim.position.set(3, 2.6, -3.6);
  const rim2 = new THREE.DirectionalLight('#FFE2C8', 1.1);
  rim2.position.set(-3.4, 1.6, -2.8);
  scene.add(key, rim, rim2, new THREE.HemisphereLight('#DFE9FF', '#C8A98F', 0.45));
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.25).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.34, depthWrite: false, color: '#2A1E3A' }),
  );
  shadow.position.y = 0.004;
  scene.add(shadow);
  return { scene, shadow };
}

function frame(view, dt) {
  const { canvas, camera } = view;
  const dpr = Math.min(window.devicePixelRatio || 1, view.maxDpr || 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) view.surface.renderer.setSize(w, h, false);
  // cadrage « auto » : le haut du corps, sauf pour les numéros qui se passent par terre (chaussures, jouets…)
  const frames = view.frames || FRAMES;
  const want = frames[view.framing === 'auto' ? view.cast?.frame || view.actor.frame || view.base : view.framing] || frames.full || FRAMES.full;
  const c = view.cam || (view.cam = { x: 0, w: want.h * 0.78, ...want });
  const k = dt > 0 ? 1 - Math.exp(-dt * 3) : 1;
  c.y += (want.y - c.y) * k;
  c.h += (want.h - c.h) * k;
  c.x += ((want.x || 0) - c.x) * k;
  c.w += ((want.w || want.h * 0.78) - c.w) * k;
  const f = c;
  const aspect = w / h;
  const dist = 7.5;
  // la hauteur cadrée tient toujours, même dans une carte étroite (et la largeur w des scènes à deux)
  const vh = Math.max(f.h, f.w / aspect);
  camera.aspect = aspect;
  camera.userData.h = h; // taille des particules (feu du dragon)
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(vh / 2 / dist));
  camera.position.set(f.x, f.y + 0.15, dist);
  camera.lookAt(f.x, f.y, 0);
  camera.updateProjectionMatrix();
  return [w, h];
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  // jamais de temps négatif (horodatages qui reculent sur un appareil très lent) : la mousse et les ressorts s'emballeraient
  const dt = last ? Math.max(0, (now - last) / 1000) : 0.016;
  last = now;
  if (!document.hidden) drawAll(dt);
}

function drawAll(dt, steps = 1) {
  for (const v of views) {
    if (!v.visible || !v.active || !v.canvas.isConnected || v.surface.lost) continue;
    if (solo && v !== solo && solo.canvas.isConnected) continue; // une scène plein écran : les autres attendent
    // les petits Pandi des cartes se contentent de 30 images par seconde
    v.acc += dt * steps;
    if (v.fps && steps === 1 && v.acc < 1 / v.fps - 0.004) continue;
    const step = v.acc / steps;
    v.acc = 0;
    frame(v, step * steps);
    for (let i = 0; i < steps; i++) {
      v.actor.update(v.still ? 0 : step, v.camera);
      v.cast?.update(v.still ? 0 : step, v.camera);
    }
    v.shadow.scale.setScalar(1 - Math.min(0.45, v.actor.rig.root.position.y * 1.2));
    v.shadow.material.opacity = 0.34 * (1 - Math.min(0.6, v.actor.rig.root.position.y * 1.5));
    v.surface.renderer.render(v.scene, v.camera);
    if (!v.drawn) {
      v.drawn = true;
      v.onFirstDraw?.();
    }
  }
}

// Arrête ou relance l'animation automatique (captures du banc d'essai)
export function pause(on) {
  if (on) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else if (!raf && views.size) raf = requestAnimationFrame(tick);
}

// Avance le temps à la main puis dessine (banc d'essai, captures)
export function advance(seconds, fps = 30) {
  const n = Math.max(1, Math.round(seconds * fps));
  drawAll(seconds / n, n);
}

export function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Monte un Pandi dans host : sa surface (un <canvas> WebGL de classe className) y est ajoutée ; si host
// est lui-même un <canvas> (bancs d'essai), la surface prend sa place le temps du numéro.
// Renvoie de quoi lui faire jouer un numéro et le démonter ; onFirstDraw : sa première image est dessinée.
// framing : 'full' (tout Pandi), 'bust' (le haut du corps) ou 'auto' (base, sauf numéros qui demandent tout)
// Scène à plusieurs (coin calme) : spot { x, z, turn } place Pandi, cast { group, update(dt, camera), frame }
// est l'autre personnage, frames remplace les cadrages ({ x, y, h, w }), maxDpr limite la définition ;
// exclusive : tant qu'elle est affichée, les autres Pandi de l'écran (cachés dessous) ne sont plus dessinés.
export function mountPandi(host, { act = 'idle', ctx = {}, framing = 'full', base = 'bust', date, look, brushColor, still = false, fps = 0, onCue, spot = null, cast = null, frames = null, maxDpr = 0, exclusive = false, className = '', label = 'Pandi le panda', onFirstDraw = null } = {}) {
  const surface = acquire();
  const canvas = surface.canvas;
  const stand = host instanceof HTMLCanvasElement ? host : null;
  canvas.className = stand ? stand.className : className;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', stand?.getAttribute('aria-label') || label);
  const standDisplay = stand?.style.display;
  if (stand) {
    canvas.style.cssText = stand.style.cssText;
    stand.after(canvas);
    stand.style.display = 'none';
  } else {
    canvas.style.cssText = '';
    host.appendChild(canvas);
  }
  const { scene, shadow } = makeScene(surface.env);
  const actor = new PandiActor({ date, look, brushColor });
  if (spot) {
    // Pandi, son ombre et ses objets posés au sol suivent sa place ; les effets restent dans la scène
    const holder = new THREE.Group();
    holder.position.set(spot.x || 0, 0, spot.z || 0);
    holder.rotation.y = spot.turn || 0;
    holder.add(actor.rig.root, actor.ground, shadow);
    scene.add(holder, actor.fx.group);
  } else scene.add(actor.rig.root, ...actor.stageObjects);
  if (cast) scene.add(cast.group);
  actor.play(act, ctx);
  actor.onCue = onCue || null;
  const view = { canvas, surface, scene, shadow, camera: new THREE.PerspectiveCamera(24, 1, 0.1, 40), actor, cast, frames, maxDpr, framing, base, visible: true, active: true, still, fps, acc: 0, drawn: false, onFirstDraw };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => (view.visible = e.isIntersecting)) : null;
  io?.observe(canvas);
  views.add(view);
  if (exclusive) solo = view;
  if (!raf) raf = requestAnimationFrame(tick);
  const ctl = {
    actor,
    canvas,
    play: (name, c) => actor.play(name, c),
    set: (c) => actor.setContext(c),
    setFraming: (f) => (view.framing = f),
    setActive: (on) => (view.active = on),
    setCue: (fn) => (actor.onCue = fn),
    // une image (animations réduites : Pandi reste immobile mais garde sa pose)
    still: (on) => (view.still = on),
    // Bancs d'essai qui montrent beaucoup de Pandi : l'image du moment est recopiée dans le <canvas> d'origine,
    // puis la surface est rendue (un navigateur ne garde qu'une quinzaine de contextes WebGL à la fois)
    freeze() {
      if (!stand) return ctl.destroy();
      frame(view, 0);
      surface.renderer.render(scene, view.camera);
      stand.width = canvas.width;
      stand.height = canvas.height;
      stand.getContext('2d').drawImage(canvas, 0, 0);
      ctl.destroy();
    },
    destroy() {
      io?.disconnect();
      views.delete(view);
      if (solo === view) solo = null;
      actor.wear.dispose();
      cast?.dispose?.();
      release(surface);
      if (stand) stand.style.display = standDisplay;
      if (!views.size) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    },
  };
  return ctl;
}
