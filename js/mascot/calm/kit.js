// La boîte à outils des personnages du coin calme (bébé dragon, tortue, papillon…) : mêmes matières,
// mêmes yeux et même lumière que Pandi, plus des particules douces (feu, fumée, étincelles).
import { THREE, shade, smoothNormals, eyeTexture, blob, mesh, joint, OCC_N, lerp, clamp, mouthRig, onEllipsoid, blobTexture } from '../pandi3d.js';

export { THREE, shade, smoothNormals, blob, mesh, joint, lerp, clamp, mouthRig, onEllipsoid, blobTexture };
export const TAU = Math.PI * 2;
export const ease = (x) => x * x * (3 - 2 * x);
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

const GEO = new Map();
export const memo = (key, make) => {
  if (!GEO.has(key)) GEO.set(key, make());
  return GEO.get(key);
};

// Les sphères qui assombrissent doucement leurs voisines (voir shade dans pandi3d.js)
export const occlusion = () => ({ value: Array.from({ length: OCC_N }, () => new THREE.Vector4(0, 0, 0, 0)) });
const _w = new THREE.Vector3();
export function updateOcc(occ, list, camera) {
  list.slice(0, OCC_N).forEach(([o, off, r], i) => {
    o.localToWorld(_w.set(...off)).applyMatrix4(camera.matrixWorldInverse);
    occ.value[i].set(_w.x, _w.y, _w.z, r);
  });
}

// --- Textures ------------------------------------------------------------------------------------

const texCache = new Map();
function canvasTex(key, size, draw, srgb = false) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = size[0];
  c.height = size[1];
  draw(c.getContext('2d'), ...size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texCache.set(key, t);
  return t;
}

// Petites écailles rondes qui se chevauchent (relief)
export function scaleBump(rx = 10, ry = 5) {
  const t = canvasTex('scales', [256, 256], (g, W, H) => {
    g.fillStyle = '#707070';
    g.fillRect(0, 0, W, H);
    const n = 8, cw = W / n, rh = H / (n * 2), r = cw * 0.62;
    for (let row = 0; row < n * 2 + 2; row++) {
      for (let col = -1; col <= n; col++) {
        const x = col * cw + (row % 2) * cw * 0.5, y = row * rh - rh;
        for (const ox of [0, W, -W]) for (const oy of [0, H, -H]) {
          const gr = g.createRadialGradient(x + ox, y + oy - r * 0.25, r * 0.1, x + ox, y + oy, r);
          gr.addColorStop(0, '#C8C8C8');
          gr.addColorStop(0.7, '#8A8A8A');
          gr.addColorStop(1, '#3A3A3A');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x + ox, y + oy, r, 0, Math.PI);
          g.fill();
        }
      }
    }
  }).clone();
  t.repeat.set(rx, ry);
  return t;
}

// Peau d'agrume : de petits creux partout (relief)
export function dimpleBump(rx = 4, ry = 2) {
  const t = canvasTex('dimples', [256, 256], (g, W, H) => {
    g.fillStyle = '#909090';
    g.fillRect(0, 0, W, H);
    let s = 3;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * W, y = rnd() * H, r = 1.5 + rnd() * 2.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, '#404040');
      gr.addColorStop(1, 'rgba(144,144,144,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }).clone();
  t.repeat.set(rx, ry);
  return t;
}

// Bandes horizontales (ventre du dragon, carapace…) : couleur et relief
export function bands(n, base, line, key = 'bands') {
  const draw = (bump) => (g, W, H) => {
    g.fillStyle = bump ? '#B0B0B0' : base;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i <= n; i++) {
      const y = (i * H) / n;
      const gr = g.createLinearGradient(0, y - 7, 0, y + 7);
      gr.addColorStop(0, bump ? 'rgba(80,80,80,0)' : 'rgba(0,0,0,0)');
      gr.addColorStop(0.5, bump ? '#202020' : line);
      gr.addColorStop(1, bump ? 'rgba(80,80,80,0)' : 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, y - 7, W, 14);
    }
  };
  return {
    map: canvasTex(`${key}${n}${base}${line}`, [32, 256], draw(false), true),
    bump: canvasTex(`${key}${n}b`, [32, 256], draw(true)),
  };
}

// Disque doux pour les particules
const softDot = () => canvasTex('dot', [64, 64], (g, W) => {
  const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,.75)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, W, W);
});

// --- Matières ------------------------------------------------------------------------------------

// Peau de vinyle douce (écailles, carapace…) éclairée comme la fourrure de Pandi
export function skin(occ, color, { patches, bump, bumpScale = 0.6, rough = 0.55, sheen = '#FFFFFF', sheenK = 0.6, coat = 0.15, map } = {}) {
  return shade(new THREE.MeshPhysicalMaterial({
    color, map: map || null, roughness: rough, sheen: sheenK, sheenRoughness: 0.45, sheenColor: new THREE.Color(sheen),
    clearcoat: coat, clearcoatRoughness: 0.55, bumpMap: bump || null, bumpScale,
  }), occ, patches);
}
export const plasticMat = (occ, color, o = {}) => shade(new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, ...o }), occ);

// --- Formes --------------------------------------------------------------------------------------

export const lathe = (pts, seg = 32) => {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg);
  return smoothNormals(g);
};

// Corne, griffe, pointe : un cône arrondi (base r, hauteur h) qui se courbe vers z
export function horn(r, h, curve = 0, seg = 20) {
  return memo(`horn${r},${h},${curve}`, () => {
    const pts = [[r, 0], [r * 0.97, h * 0.15], [r * 0.82, h * 0.4], [r * 0.58, h * 0.65], [r * 0.3, h * 0.86], [r * 0.08, h * 0.98], [0.0005, h]];
    const g = lathe(pts, seg);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / h;
      p.setZ(i, p.getZ(i) + curve * h * y * y);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Tube qui s'affine (queue, antenne, tige) : rayon r0 à la base, r1 au bout, bout arrondi
export function taperTube(points, r0, r1, seg = 40, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const u = Math.floor(i / (radial + 1)) / seg;
    curve.getPointAt(u, c);
    const k = lerp(r0, r1, u ** 0.85);
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
  }
  g.computeVertexNormals();
  return { geo: g, curve };
}

// Forme plate épaisse aux bords arrondis (aile, collerette, nageoire)
export function slab(shape, depth = 0.016, bevel = 0.01) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// --- Yeux de film d'animation (comme Pandi) : globe vernis, iris peint, paupières en coquille ---------

export function eyes(parent, occ, { x, y, z, r, iris = '#B8742A', lid, turn = 0.12 }) {
  const eyeMat = shade(new THREE.MeshPhysicalMaterial({ map: eyeTexture(iris), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.02 }), occ);
  const ball = memo(`eye${r}`, () => new THREE.SphereGeometry(r, 40, 28).rotateX(Math.PI / 2));
  const up = memo(`lidUp${r}`, () => new THREE.SphereGeometry(r * 1.07, 36, 18, 0, TAU, 0, Math.PI / 2));
  const lo = memo(`lidLo${r}`, () => new THREE.SphereGeometry(r * 1.06, 36, 18, 0, TAU, Math.PI / 2, Math.PI / 2));
  return [1, -1].map((sx) => {
    const g = joint('eye', parent, [x * sx, y, z]);
    g.rotation.y = turn * sx;
    const b = mesh(ball, eyeMat);
    g.add(b);
    const upPivot = joint('lidUp', g), loPivot = joint('lidLo', g);
    upPivot.add(mesh(up, lid));
    loPivot.add(mesh(lo, lid));
    return { g, ball: b, upPivot, loPivot, sx };
  });
}

// f : { lidUp, lidLo, lidTilt, lookX, lookY } comme le visage de Pandi
export function setEyes(list, f, blink = 0) {
  const close = Math.max(f.lidUp, blink);
  for (const e of list) {
    e.upPivot.rotation.set(lerp(-1.35, 1.52, close), 0, (f.lidTilt || 0) * e.sx * 0.5);
    e.loPivot.rotation.set(lerp(1.4, -0.35, f.lidLo * (1 - blink * 0.5)), 0, 0);
    e.ball.rotation.set(-(f.lookY || 0) * 0.35, (f.lookX || 0) * 0.4, 0);
  }
}

// Clignements au hasard (parfois deux de suite) : renvoie 0 -> 1 -> 0
export function blinker() {
  const b = { next: 1 + Math.random() * 2, t: -1 };
  return (dt) => {
    b.next -= dt;
    if (b.next <= 0 && b.t < 0) {
      b.t = 0;
      b.next = 2.2 + Math.random() * 3;
      if (Math.random() < 0.2) b.next = 0.35;
    }
    if (b.t < 0) return 0;
    b.t += dt;
    const v = Math.sin(clamp(b.t / 0.17, 0, 1) * Math.PI);
    if (b.t > 0.17) b.t = -1;
    return v;
  };
}

// --- Particules : feu (lumière qui s'additionne), fumée, poussière d'étoiles ----------------------------

const VERT = `attribute float size; attribute vec4 tint; varying vec4 vT; uniform float scale;
void main() { vT = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = `uniform sampler2D map; varying vec4 vT;
void main() { vec4 d = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vT.rgb, vT.a * d.a); }`;

// ramp : couleurs [t, r, g, b, a] le long de la vie ; grow : [taille au début, à la fin] (unités de la scène)
export function particles(n, { additive = false, ramp, grow = [0.1, 0.4], drag = 1.5, lift = 0.6, order = 7 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), tint = new Float32Array(n * 4), size = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 300 }, map: { value: softDot() } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = order;
  const P = Array.from({ length: n }, () => ({ life: 1, max: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), k: 1, ph: 0 }));
  let next = 0, t = 0;
  const col = (k) => {
    let i = 0;
    while (i < ramp.length - 2 && ramp[i + 1][0] < k) i++;
    const a = ramp[i], b = ramp[i + 1];
    const f = clamp((k - a[0]) / Math.max(1e-4, b[0] - a[0]), 0, 1);
    return [lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f), lerp(a[4], b[4], f)];
  };
  return {
    points,
    // at, v : repère de la scène ; k : taille relative
    spawn(at, v, life = 0.7, k = 1) {
      const q = P[next];
      next = (next + 1) % n;
      q.life = 0;
      q.max = life;
      q.p.copy(at);
      q.v.copy(v);
      q.k = k;
      q.ph = Math.random() * TAU;
    },
    update(dt, camera) {
      t += dt;
      const h = camera?.userData.h || 600;
      mat.uniforms.scale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad((camera?.fov || 24) / 2)));
      P.forEach((q, i) => {
        if (q.life < q.max) {
          q.life += dt;
          q.v.multiplyScalar(1 - Math.min(0.5, dt * drag));
          q.v.y += lift * dt;
          q.p.addScaledVector(q.v, dt);
          q.p.x += Math.sin(t * 9 + q.ph) * dt * 0.12;
        }
        const k = q.life / q.max;
        const alive = q.life < q.max;
        pos.set([q.p.x, q.p.y, q.p.z], i * 3);
        const c = alive ? col(k) : [0, 0, 0, 0];
        tint.set(c, i * 4);
        size[i] = alive ? lerp(grow[0], grow[1], Math.sqrt(k)) * q.k : 0;
      });
      geo.attributes.position.needsUpdate = geo.attributes.tint.needsUpdate = geo.attributes.size.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// --- Visage complet (yeux + bouche de Pandi) sur un ellipsoïde E = { c, r } de parent ----------------

export const FACE = () => ({ open: 0, smile: 0.9, wide: 1.1, teeth: 0, tongue: 0, round: 0, lidUp: 0.08, lidLo: 0.55, lidTilt: 0, lookX: 0, lookY: 0 });

export function face(parent, occ, { E, eye, lid, mouth }) {
  const list = eyes(parent, occ, { ...eye, lid });
  const m = mouthRig(occ, { surf: (x, y, l) => onEllipsoid(E, x, y, l), y: mouth.y, k: mouth.k, line: mouth.line || '#24161C' });
  parent.add(m.group);
  const blink = blinker();
  const F = FACE();
  return {
    eyes: list, mouth: m, F,
    // f : l'expression voulue (champs de FACE) ; noBlink : yeux qui restent comme demandé
    update(dt, f, { rate = 8, noBlink = false } = {}) {
      for (const k in F) if (f[k] !== undefined) F[k] += (f[k] - F[k]) * damp(k === 'open' || k === 'round' ? 14 : rate, dt);
      const b = blink(dt);
      setEyes(list, F, noBlink ? 0 : b);
      m.set(F);
    },
  };
}

// Valeurs qui glissent en douceur vers leur cible : S[k] += (cible - S[k]) * …
export function glide(S, target, dt, rate = 6, rates = {}) {
  for (const k in target) S[k] = (S[k] ?? target[k]) + (target[k] - (S[k] ?? target[k])) * damp(rates[k] ?? rate, dt);
  return S;
}

// --- Socle d'un personnage : l'étape en cours, son horloge, son ombre et sa place dans la scène ------
// build(H) renvoie { update(H, dt, camera), dispose?, parts? } ; H : { root, ctx, pt (secondes dans
// l'étape), p (0 -> 1 sur ctx.secs), time, actor (Pandi), fx (ses effets) }
export function hero(build, { shadow = [1.2, 1] } = {}) {
  const root = new THREE.Group();
  const sh = new THREE.Mesh(
    memo('heroShadow', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.34, depthWrite: false, color: '#2A1E3A' }),
  );
  sh.position.y = 0.004;
  sh.scale.set(shadow[0], 1, shadow[1]);
  root.add(sh);
  const H = { root, shadow: sh, ctx: { phase: 'ready' }, pt: 0, p: 0, time: 0, actor: null, fx: null };
  const me = build(H);
  return {
    group: root,
    frame: me.frame || null,
    parts: me.parts,
    attach(actor) {
      H.actor = actor;
      H.fx = actor.fx;
    },
    place(x, z = 0, s = 1) {
      root.position.set(x, 0, z);
      root.scale.setScalar(s);
    },
    set(c) {
      if (c.phase !== H.ctx.phase || c.cycle !== H.ctx.cycle || c.step !== H.ctx.step) H.pt = 0;
      const prev = H.ctx;
      H.ctx = { ...c };
      me.set?.(H, c, prev);
    },
    update(dt, camera) {
      dt = clamp(dt, 0, 0.05);
      H.time += dt;
      H.pt += dt;
      H.p = clamp(H.pt / (H.ctx.secs || 3), 0, 1);
      me.update(H, dt, camera);
    },
    dispose() {
      me.dispose?.();
    },
  };
}

// Position d'un objet de la scène (patte de Pandi…) dans le repère du personnage
export function toLocal(root, obj, off = [0, 0, 0], out = new THREE.Vector3()) {
  obj.updateWorldMatrix(true, false);
  return root.worldToLocal(obj.localToWorld(out.set(...off)));
}
