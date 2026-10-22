// Pandi en 3D : un bébé panda façon film d'animation, construit en code avec three.js (aucun modèle à charger).
// C'est une peluche articulée : chaque partie est une forme arrondie posée sur une articulation
// (bassin, buste, cou, épaules, coudes, hanches) ; les bras vont chercher leur cible par cinématique inverse
// et s'étirent un peu si elle est trop loin, comme dans les dessins animés.
// Repère : les pieds sont au sol (y = 0), Pandi regarde vers +z, il mesure environ 2,3 unités.
import * as THREE from '../vendor/three/three.module.min.js';

export { THREE };

export const FUR_WHITE = '#F7F2E8';
export const FUR_BLACK = '#2C2934';
const PINK = '#FF9DB4';
const OCC_N = 6; // sphères qui assombrissent doucement leurs voisines (creux du cou, sous les bras…)

const { smoothstep, lerp, clamp } = THREE.MathUtils;

// --- Textures fabriquées une fois ---------------------------------------------------------------

let furTex = null;
// Relief de la fourrure : des milliers de petits poils clairs et sombres
function furBump() {
  if (furTex) return furTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * 256, y = rnd() * 256, l = 3 + rnd() * 8, a = (rnd() - 0.5) * 0.7, v = Math.floor(60 + rnd() * 140);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 0.7 + rnd() * 1.2;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.sin(a) * l, y + oy + Math.cos(a) * l);
      g.stroke();
    }
  }
  furTex = new THREE.CanvasTexture(c);
  furTex.wrapS = furTex.wrapT = THREE.RepeatWrapping;
  furTex.colorSpace = THREE.NoColorSpace;
  return furTex;
}

function bumpRepeat(x, y) {
  const t = furBump().clone();
  t.repeat.set(x, y);
  return t;
}

const eyeTex = new Map();
// Iris de film d'animation, peint sur une sphère dont le pôle regarde devant : anneau sombre, iris chaud
// qui s'éclaircit vers la pupille, fibres, grosse pupille
function eyeTexture(iris = '#B8742A') {
  if (eyeTex.has(iris)) return eyeTex.get(iris);
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const col = new THREE.Color(iris);
  const hex = (k, l = 0) => {
    const q = col.clone().offsetHSL(0, 0, l).multiplyScalar(k);
    return `#${q.getHexString()}`;
  };
  g.fillStyle = '#FBFAF7';
  g.fillRect(0, 0, W, H);
  const row = (theta) => (theta / Math.PI) * H; // angle depuis le centre de l'œil -> ligne de l'image
  const IRIS = 0.74, PUPIL = 0.4;
  // le blanc se teinte un peu vers les bords (l'œil n'est pas un néon)
  const sc = g.createLinearGradient(0, row(IRIS), 0, row(1.6));
  sc.addColorStop(0, '#FFFFFF');
  sc.addColorStop(1, '#E6E2EA');
  g.fillStyle = sc;
  g.fillRect(0, row(IRIS), W, H);
  const ir = g.createLinearGradient(0, 0, 0, row(IRIS));
  ir.addColorStop(0, hex(1.25, 0.12));
  ir.addColorStop(0.55, hex(1));
  ir.addColorStop(0.86, hex(0.7));
  ir.addColorStop(1, hex(0.35));
  g.fillStyle = ir;
  g.fillRect(0, 0, W, row(IRIS));
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    g.strokeStyle = rnd() > 0.5 ? hex(1.4, 0.2) : hex(0.55);
    g.globalAlpha = 0.25 + rnd() * 0.3;
    g.lineWidth = 1 + rnd() * 2;
    g.beginPath();
    g.moveTo(x, row(PUPIL));
    g.lineTo(x + (rnd() - 0.5) * 6, row(IRIS) * (0.75 + rnd() * 0.25));
    g.stroke();
  }
  g.globalAlpha = 1;
  // anneau sombre autour de l'iris
  g.fillStyle = hex(0.25);
  g.fillRect(0, row(IRIS) - 3, W, 5);
  const pu = g.createLinearGradient(0, 0, 0, row(PUPIL));
  pu.addColorStop(0, '#08070A');
  pu.addColorStop(0.9, '#120E10');
  pu.addColorStop(1, hex(0.4));
  g.fillStyle = pu;
  g.fillRect(0, 0, W, row(PUPIL));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  eyeTex.set(iris, t);
  return t;
}

let blobTex = null;
export function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,1)');
  r.addColorStop(0.45, 'rgba(0,0,0,.55)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// --- Matières -------------------------------------------------------------------------------------

// Ajoute à une matière : des taches colorées nettes (ellipsoïdes dans le repère de la forme) et
// l'ombre douce des sphères voisines (occlusion ambiante analytique), pour le rendu « film »
export function shade(mat, occ, patches = []) {
  const n = patches.length;
  const u = { occS: occ };
  if (n) {
    u.pC = { value: patches.map((p) => new THREE.Vector3(...p.c)) };
    u.pR = { value: patches.map((p) => new THREE.Vector3(1 / p.r[0], 1 / p.r[1], 1 / p.r[2])) };
    u.pM = {
      value: patches.map((p) => new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0]))).invert())),
    };
    u.pCol = {
      value: patches.map((p) => {
        const c = new THREE.Color(p.color);
        return new THREE.Vector4(c.r, c.g, c.b, p.alpha ?? 1);
      }),
    };
    u.pSoft = { value: patches.map((p) => p.soft ?? 0.015) };
  }
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    let head = `uniform vec4 occS[${OCC_N}];\n`;
    if (n) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = transformed;');
      head += `varying vec3 vObj;\nuniform vec3 pC[${n}];\nuniform vec3 pR[${n}];\nuniform mat3 pM[${n}];\nuniform vec4 pCol[${n}];\nuniform float pSoft[${n}];\n`;
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        for (int i = 0; i < ${n}; i++) {
          float d = length((pM[i] * (vObj - pC[i])) * pR[i]);
          float aa = fwidth(d) * 0.8 + pSoft[i];
          diffuseColor.rgb = mix(diffuseColor.rgb, pCol[i].rgb, (1.0 - smoothstep(1.0 - aa, 1.0 + aa, d)) * pCol[i].a);
        }`,
      );
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${head}`).replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        vec3 P = -vViewPosition;
        float occ = 1.0;
        for (int i = 0; i < ${OCC_N}; i++) {
          vec3 d = occS[i].xyz - P;
          float l2 = max(dot(d, d), 1e-4);
          float r = occS[i].w;
          float h = dot(normal, d * inversesqrt(l2));
          occ *= 1.0 - clamp(h * r * r / l2, 0.0, 1.0) * 0.8;
        }
        reflectedLight.indirectDiffuse *= occ;
        reflectedLight.indirectSpecular *= occ;
        reflectedLight.directDiffuse *= mix(1.0, occ, 0.5);
        reflectedLight.directSpecular *= mix(1.0, occ, 0.5);
      }`,
    );
  };
  mat.customProgramCacheKey = () => `pandi-${n}`;
  return mat;
}

function fur(color, occ, { patches, bump = [3, 2], sheen } = {}) {
  const black = new THREE.Color(color).getHSL({}).l < 0.4;
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: black ? 0.72 : 0.86,
    sheen: 1,
    sheenRoughness: black ? 0.42 : 0.55,
    sheenColor: new THREE.Color(sheen || (black ? '#8F8AA8' : '#FFF6EA')),
    bumpMap: bumpRepeat(...bump),
    bumpScale: black ? 1.2 : 0.9,
  });
  return shade(m, occ, patches);
}

// --- Formes ---------------------------------------------------------------------------------------

// Normales lissées même sur la couture des sphères (les sommets en double y reçoivent la même normale)
export function smoothNormals(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, nrm = g.attributes.normal;
  const acc = new Map();
  const key = (i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    const a = acc.get(k) || [0, 0, 0];
    a[0] += nrm.getX(i);
    a[1] += nrm.getY(i);
    a[2] += nrm.getZ(i);
    acc.set(k, a);
  }
  for (let i = 0; i < p.count; i++) {
    const a = acc.get(key(i));
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  return g;
}

// Sphère déformée (couture derrière) : radii en unités, deform(x, y, z) sur la sphère unité
function blob(radii, seg = [48, 32], deform) {
  const g = new THREE.SphereGeometry(1, seg[0], seg[1]);
  g.rotateY(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let v = [p.getX(i), p.getY(i), p.getZ(i)];
    if (deform) v = deform(...v);
    p.setXYZ(i, v[0] * radii[0], v[1] * radii[1], v[2] * radii[2]);
  }
  return smoothNormals(g);
}

function mesh(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  return m;
}

function joint(name, parent, pos = [0, 0, 0]) {
  const j = new THREE.Group();
  j.name = name;
  j.position.set(...pos);
  parent.add(j);
  return j;
}

// Corps en poire, ventre un peu bombé ; repère du bassin (le bas du corps vers y = -0,26)
function bodyGeo() {
  const prof = [[0, -0.27], [0.24, -0.25], [0.42, -0.16], [0.5, -0.01], [0.52, 0.12], [0.49, 0.28], [0.42, 0.43], [0.32, 0.56], [0.19, 0.66], [0.001, 0.7]];
  const curve = new THREE.CatmullRomCurve3(prof.map(([r, y]) => new THREE.Vector3(r, y, 0)));
  const pts = curve.getPoints(40).map((v) => new THREE.Vector2(Math.max(0.0005, v.x), v.y));
  const g = new THREE.LatheGeometry(pts, 56);
  g.rotateY(Math.PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    if (z > 0) p.setZ(i, z * (1 + 0.1 * Math.exp(-(((y - 0.05) / 0.22) ** 2))));
  }
  return smoothNormals(g);
}

// Tête : un peu plus large que haute, joues rebondies vers le bas, menton aplati
const HEAD_R = [0.66, 0.57, 0.59];
function headGeo() {
  return blob(HEAD_R, [112, 84], (x, y, z) => {
    const f = 1 - smoothstep(y, -0.55, 0.3);
    let nx = x * (1 + 0.1 * f), nz = z * (1 + 0.04 * f), ny = y;
    if (y < -0.78) ny = -0.78 - (-0.78 - y) * 0.55;
    return [nx, ny, nz];
  });
}

// Une mèche qui boucle vers l'avant, épaisse à la racine, fine au bout
function curlGeo() {
  const curve = new THREE.CatmullRomCurve3([[0, -0.02, 0], [0, 0.07, 0.01], [0.005, 0.12, 0.05], [0.01, 0.12, 0.1], [0.012, 0.085, 0.115]].map((p) => new THREE.Vector3(...p)));
  const T = 24, R = 10;
  const g = new THREE.TubeGeometry(curve, T, 0.034, R, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const u = Math.floor(i / (R + 1)) / T;
    curve.getPointAt(u, c);
    const k = 1 - 0.82 * u;
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
  }
  g.computeVertexNormals();
  return g;
}

// Truffe : un triangle arrondi, plus étroit vers le bas
function noseGeo() {
  return blob([0.092, 0.062, 0.058], [32, 20], (x, y, z) => [x * (1 + Math.min(0, y) * 0.42 + Math.max(0, y) * 0.1), y, z]);
}

// --- Bouche : formes 2D (lèvres, langue, dents) collées sur la surface du museau -----------------

export const MUZZLE = { c: [0, -0.17, 0.41], r: [0.28, 0.2, 0.21] };
export const MOUTH_Y = -0.245;

export function onMuzzle(x, y, lift) {
  const [cx, cy, cz] = MUZZLE.c, [rx, ry, rz] = MUZZLE.r;
  const k = Math.max(0.03, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2);
  const z = cz + rz * Math.sqrt(k);
  const n = new THREE.Vector3((x - cx) / rx ** 2, (y - cy) / ry ** 2, (z - cz) / rz ** 2).normalize();
  return [x + n.x * lift, y + n.y * lift, z + n.z * lift, n];
}

const cub = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

// Les formes de la bouche changent à chaque image : tampons alloués une fois, réécrits sur place
const CAP = 64;
function polyBuffer() {
  const g = new THREE.BufferGeometry();
  const attr = (n, size, T = Float32Array) => new THREE.BufferAttribute(new T(n * size), size).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', attr(CAP, 3));
  g.setAttribute('normal', attr(CAP, 3));
  g.setIndex(attr((CAP - 2) * 3, 1, Uint16Array));
  return g;
}

function polyGeo(pts, lift, g) {
  const contour = pts.slice(0, CAP).map(([x, y]) => new THREE.Vector2(x, y));
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
  const tris = THREE.ShapeUtils.triangulateShape(contour, []).flat();
  const pos = g.attributes.position, nor = g.attributes.normal;
  contour.forEach((v, i) => {
    const [x, y, z, n] = onMuzzle(v.x, v.y, lift);
    pos.array.set([x, y, z], i * 3);
    nor.array.set([n.x, n.y, n.z], i * 3);
  });
  g.index.array.set(tris);
  g.setDrawRange(0, tris.length);
  pos.needsUpdate = nor.needsUpdate = g.index.needsUpdate = true;
  return g;
}

// f : { open (0–0,12), smile (-1–1), wide (0,7–1,4), teeth (0–1), tongue (0–1), round (0–1 : bouche en O) }
function mouthPolys(f) {
  const w = 0.075 * f.wide * (1 - f.round * 0.5);
  const o = f.open;
  const cy = MOUTH_Y + 0.022 * f.smile; // les coins remontent quand il sourit
  const t = 0.012;
  // lèvre du haut presque droite, lèvre du bas bien ronde : un sourire en « D » (et l'inverse quand il est triste)
  const upMid = cy - 0.012 * Math.max(0, f.smile) - 0.004 + o * 0.12 - Math.min(0, f.smile) * 0.03;
  const loMid = upMid - t - o * 1.2;
  const N = 20;
  const up = [], lo = [];
  const cu = (mid) => (mid - 0.25 * cy) / 0.75; // contrôle d'une cubique symétrique qui passe par mid
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    up.push([cub(-w, -w * 0.45, w * 0.45, w, s), cub(cy, cu(upMid), cu(upMid), cy, s)]);
    lo.push([cub(-w, -w * 0.62, w * 0.62, w, s), cub(cy, cu(loMid), cu(loMid), cy, s)]);
  }
  if (f.round > 0.05) {
    // bouche en O : on arrondit les coins
    for (let i = 0; i <= N; i++) {
      const s = i / N, e = Math.sin(Math.PI * s) ** 0.5;
      const k = f.round;
      up[i][0] = lerp(up[i][0], -w * Math.cos(Math.PI * s), k);
      lo[i][0] = up[i][0];
      up[i][1] = lerp(up[i][1], (upMid + loMid) / 2 + ((upMid - loMid) / 2) * e, k);
      lo[i][1] = lerp(lo[i][1], (upMid + loMid) / 2 - ((upMid - loMid) / 2) * e, k);
    }
  }
  const mouth = [...up, ...lo.slice(1, -1).reverse()];
  const band = (from, to, k0, k1, s0, s1, bulge = 0) => {
    const a = [], b = [];
    for (let i = 0; i <= 12; i++) {
      const s = s0 + ((s1 - s0) * i) / 12;
      const j = s * N, i0 = Math.floor(j), i1 = Math.min(N, i0 + 1), fr = j - i0;
      const P = (arr) => [lerp(arr[i0][0], arr[i1][0], fr), lerp(arr[i0][1], arr[i1][1], fr)];
      const A = P(from), B = P(to);
      const r = bulge ? Math.sin((Math.PI * (s - s0)) / (s1 - s0)) * bulge : 0;
      a.push([lerp(A[0], B[0], k0), lerp(A[1], B[1], k0)]);
      b.push([lerp(A[0], B[0], k1 + r), lerp(A[1], B[1], k1 + r)]);
    }
    return [...a, ...b.reverse()];
  };
  const open = o > 0.012;
  return {
    mouth,
    open,
    teethUp: open && f.teeth > 0.05 ? band(up, lo, 0.04, 0.34 * f.teeth, 0.16, 0.84) : null,
    teethLo: open && f.teeth > 0.5 ? band(lo, up, 0.04, 0.26 * (f.teeth - 0.5) * 2, 0.24, 0.76) : null,
    tongue: open && f.tongue > 0.05 ? band(lo, up, 0.02, 0.12, 0.26, 0.74, 0.3 * f.tongue) : null,
  };
}

function mouthRig(occ) {
  const g = new THREE.Group();
  const mk = (color, rough, order) => {
    const m = new THREE.Mesh(
      polyBuffer(),
      shade(new THREE.MeshStandardMaterial({ color, roughness: rough, polygonOffset: true, polygonOffsetFactor: -2 - order, polygonOffsetUnits: -2 - order }), occ),
    );
    m.renderOrder = 2 + order;
    m.frustumCulled = false;
    g.add(m);
    return m;
  };
  const inner = mk('#5A1A2A', 0.7, 0), tongue = mk('#FF6F88', 0.45, 1), up = mk('#FFFDF7', 0.3, 2), lo = mk('#FFFDF7', 0.3, 2), line = mk('#24161C', 0.6, 0);
  // petit trait sous la truffe
  const phil = mk('#24161C', 0.6, 0);
  polyGeo([[-0.0065, -0.115], [0.0065, -0.115], [0.0055, MOUTH_Y + 0.006], [-0.0055, MOUTH_Y + 0.006]], 0.002, phil.geometry);
  let last = '';
  return {
    group: g,
    set(f) {
      const k = [f.open, f.smile, f.wide, f.teeth, f.tongue, f.round].map((v) => v.toFixed(3)).join();
      if (k === last) return;
      last = k;
      const P = mouthPolys(f);
      line.visible = !P.open;
      inner.visible = P.open;
      if (P.open) polyGeo(P.mouth, 0.002, inner.geometry);
      else polyGeo(P.mouth, 0.002, line.geometry);
      for (const [m, pts] of [[tongue, P.tongue], [up, P.teethUp], [lo, P.teethLo]]) {
        m.visible = Boolean(pts);
        if (pts) polyGeo(pts, 0.003, m.geometry);
      }
    },
  };
}

// --- Le personnage ------------------------------------------------------------------------------

export const ARM = { L1: 0.3, L2: 0.29, paw: 0.135 };

// Les formes sont fabriquées une fois et partagées par tous les Pandi de l'écran
const GEO = new Map();
const memo = (key, make) => {
  if (!GEO.has(key)) GEO.set(key, make());
  return GEO.get(key);
};
const SHOULDER = [0.35, 0.5, 0.06];

export function createPandi({ iris } = {}) {
  const occ = { value: Array.from({ length: OCC_N }, () => new THREE.Vector4(0, 0, 0, 0)) };
  const white = fur(FUR_WHITE, occ);
  const black = fur(FUR_BLACK, occ, { bump: [2, 2] });

  const root = new THREE.Group();
  root.name = 'pandi';
  const pelvis = joint('pelvis', root, [0, 0.52, 0]);
  const torso = joint('torso', pelvis);
  // buste blanc avec la « cape » noire des pandas sur les épaules (le devant reste blanc)
  const bodyMat = fur(FUR_WHITE, occ, {
    bump: [4, 2],
    patches: [
      { c: [0, 0.6, -0.12], r: [0.75, 0.2, 0.42], color: FUR_BLACK, soft: 0.02 },
      { c: [0, 0.44, -0.34], r: [0.62, 0.3, 0.32], color: FUR_BLACK, soft: 0.02 },
    ],
  });
  const body = mesh(memo('body', bodyGeo), bodyMat);
  torso.add(body);
  const tail = mesh(memo('tail', () => blob([0.11, 0.1, 0.09], [20, 14])), white, [0, -0.08, -0.47]);
  torso.add(tail);

  const neck = joint('neck', torso, [0, 0.6, 0.02]);
  const head = joint('head', neck, [0, 0.47, 0.03]);
  // taches des yeux : des ovales penchés vers le haut et l'extérieur (regard rieur), qui entourent l'œil
  // sans tomber sur les joues ; joues roses
  const headMat = fur(FUR_WHITE, occ, {
    bump: [5, 3],
    patches: [
      { c: [0.24, 0.075, 0.5], r: [0.162, 0.188, 0.24], rot: [0, 0, -0.34], color: FUR_BLACK },
      { c: [-0.24, 0.075, 0.5], r: [0.162, 0.188, 0.24], rot: [0, 0, 0.34], color: FUR_BLACK },
      { c: [0.37, -0.2, 0.42], r: [0.12, 0.085, 0.25], color: PINK, alpha: 0.55, soft: 0.5 },
      { c: [-0.37, -0.2, 0.42], r: [0.12, 0.085, 0.25], color: PINK, alpha: 0.55, soft: 0.5 },
    ],
  });
  const skull = mesh(memo('head', headGeo), headMat);
  head.add(skull);
  const muzzle = mesh(memo('muzzle', () => blob(MUZZLE.r, [48, 32])), white, MUZZLE.c);
  head.add(muzzle);
  const nose = mesh(memo('nose', noseGeo), shade(new THREE.MeshPhysicalMaterial({ color: '#1C1A21', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 }), occ), [0, -0.075, 0.585]);
  nose.rotation.x = -0.25;
  head.add(nose);
  const mouth = mouthRig(occ);
  head.add(mouth.group);

  // yeux : sphère mouillée (vernis), iris peint, deux paupières en coquille pour cligner et sourire
  const eyeR = 0.118;
  const eyeMat = shade(new THREE.MeshPhysicalMaterial({ map: eyeTexture(iris), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.02 }), occ);
  const eyeGeo = memo('eye', () => new THREE.SphereGeometry(eyeR, 48, 32).rotateX(Math.PI / 2));
  const lidUpGeo = memo('lidUp', () => new THREE.SphereGeometry(eyeR * 1.07, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2));
  const lidLoGeo = memo('lidLo', () => new THREE.SphereGeometry(eyeR * 1.06, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
  const eyes = [1, -1].map((sx) => {
    const g = joint(sx > 0 ? 'eyeR' : 'eyeL', head, [0.228 * sx, 0.05, 0.47]);
    g.rotation.y = 0.12 * sx;
    const ball = mesh(eyeGeo, eyeMat);
    g.add(ball);
    const up = mesh(lidUpGeo, black);
    const lo = mesh(lidLoGeo, black);
    const upPivot = joint('lidUp', g);
    const loPivot = joint('lidLo', g);
    upPivot.add(up);
    loPivot.add(lo);
    return { g, ball, upPivot, loPivot, sx };
  });

  // oreilles rondes, un peu creusées, qui ballottent après les mouvements
  const earGeo = memo('ear', () => blob([0.19, 0.18, 0.095], [32, 22], (x, y, z) => [x, y, z > 0 ? z * 0.55 : z]));
  const ears = [1, -1].map((sx) => {
    const pivot = joint('ear', head, [0.42 * sx, 0.4, -0.06]);
    pivot.rotation.z = -0.55 * sx;
    const m = mesh(earGeo, black, [0, 0.08, 0]);
    pivot.add(m);
    return { pivot, sx, a: 0, v: 0 };
  });

  // petite mèche sur le haut de la tête
  const tuft = joint('tuft', head, [0.02, 0.54, 0.12]);
  tuft.userData = { a: 0, v: 0 };
  const hair = memo('hair', curlGeo);
  [[-0.012, 0.25, 1], [0.03, -0.35, 0.8]].forEach(([x, rz, s]) => {
    const m = mesh(hair, white, [x, 0, 0], [0, 0, rz]);
    m.scale.setScalar(s);
    tuft.add(m);
  });

  // bras : épaule -> coude -> patte (formes en saucisse qui se recouvrent, sans couture visible)
  const upperGeo = memo('upper', () => new THREE.CapsuleGeometry(0.125, ARM.L1, 8, 20).translate(0, -ARM.L1 / 2, 0));
  const foreGeo = memo('fore', () => new THREE.CapsuleGeometry(0.115, ARM.L2, 8, 20).translate(0, -ARM.L2 / 2, 0));
  const pawMat = fur(FUR_BLACK, occ, {
    bump: [2, 2],
    patches: [{ c: [0, -0.02, 0.1], r: [0.07, 0.075, 0.08], color: PINK }],
  });
  const pawGeo = memo('paw', () => blob([ARM.paw, ARM.paw * 0.92, ARM.paw * 0.95], [32, 24]));
  const arms = {};
  for (const [side, sx] of [['R', 1], ['L', -1]]) {
    const shoulder = joint(`shoulder${side}`, torso, [SHOULDER[0] * sx, SHOULDER[1], SHOULDER[2]]);
    const upper = mesh(upperGeo, black);
    shoulder.add(upper);
    const elbow = joint(`elbow${side}`, shoulder, [0, -ARM.L1, 0]);
    const fore = mesh(foreGeo, black);
    elbow.add(fore);
    const hand = joint(`hand${side}`, elbow, [0, -ARM.L2, 0]);
    const paw = mesh(pawGeo, pawMat);
    hand.add(paw);
    arms[side] = { shoulder, upper, elbow, fore, hand, paw, sx };
  }

  // jambes courtes et dodues, gros pieds aux coussinets roses
  const legGeo = memo('leg', () => new THREE.CapsuleGeometry(0.165, 0.16, 8, 20).translate(0, -0.12, 0));
  const footMat = fur(FUR_BLACK, occ, {
    bump: [2, 2],
    patches: [
      { c: [0, -0.1, 0.02], r: [0.11, 0.05, 0.13], color: PINK },
      { c: [0, -0.08, 0.17], r: [0.12, 0.05, 0.05], color: PINK, alpha: 0.9 },
    ],
  });
  const footGeo = memo('foot', () => blob([0.17, 0.115, 0.23], [32, 24], (x, y, z) => [x, y < 0 ? y * 0.7 : y, z]));
  const legs = {};
  for (const [side, sx] of [['R', 1], ['L', -1]]) {
    const hip = joint(`hip${side}`, pelvis, [0.23 * sx, -0.12, 0.04]);
    hip.add(mesh(legGeo, black));
    const ankle = joint(`ankle${side}`, hip, [0, -0.3, 0]);
    const foot = mesh(footGeo, footMat, [0, -0.01, 0.06]);
    ankle.add(foot);
    legs[side] = { hip, ankle, foot, sx };
  }

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });

  return {
    root, pelvis, torso, body, neck, head, skull, muzzle, nose, mouth, eyes, ears, tuft, arms, legs, occ,
    materials: { white, black },
    mouthPoint: new THREE.Vector3(0, MOUTH_Y - 0.01, 0.63),
  };
}

// --- Bras : cinématique inverse à deux os, avec un léger étirement de dessin animé ---------------

const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);

// target et pole dans le repère du buste
export function reach(arm, target, pole) {
  const S = arm.shoulder.position;
  _d.subVectors(target, S);
  const dist = Math.max(1e-4, _d.length());
  const maxR = (ARM.L1 + ARM.L2) * 0.995;
  const s = clamp(dist / maxR, 1, 1.28);
  const l1 = ARM.L1 * s, l2 = ARM.L2 * s;
  const D = Math.min(dist, (l1 + l2) * 0.999);
  const cosA = clamp((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1);
  const a = Math.acos(cosA);
  _d.divideScalar(dist);
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
  _e.copy(S).addScaledVector(_d, Math.cos(a) * l1).addScaledVector(_p, Math.sin(a) * l1);
  // épaule : l'os du bras (vers -y) pointe vers le coude
  const toE = _p.subVectors(_e, S).normalize();
  arm.shoulder.quaternion.setFromUnitVectors(DOWN, toE);
  // coude : l'avant-bras pointe vers la cible, exprimé dans le repère de l'épaule
  const T = _d.copy(target).sub(S).multiplyScalar(Math.min(1, D / dist)).add(S);
  const toT = T.sub(_e).normalize();
  _q.setFromUnitVectors(DOWN, toT);
  _q2.copy(arm.shoulder.quaternion).invert();
  arm.elbow.quaternion.copy(_q2.multiply(_q));
  arm.elbow.position.y = -l1;
  arm.upper.scale.set(1, s, 1);
  arm.fore.scale.set(1, s, 1);
  arm.hand.position.y = -l2;
}

// --- Visage : expression lissée vers la cible ----------------------------------------------------

export function neutralFace() {
  // les joues remontent un peu les paupières du bas : il a toujours l'œil qui rit
  return { open: 0, smile: 0.95, wide: 1.12, teeth: 0, tongue: 0, round: 0, lidUp: 0.08, lidLo: 0.62, lidTilt: 0, lookX: 0, lookY: 0 };
}

export function applyFace(rig, f, blink) {
  rig.mouth.set(f);
  const close = Math.max(f.lidUp, blink);
  for (const e of rig.eyes) {
    // paupière du haut : -1,35 rad = grand ouvert, +1,5 = fermé ; inclinée pour froncer ou s'inquiéter
    e.upPivot.rotation.set(lerp(-1.35, 1.52, close), 0, f.lidTilt * e.sx * 0.5);
    e.loPivot.rotation.set(lerp(1.4, -0.35, f.lidLo * (1 - blink * 0.5)), 0, 0);
    e.ball.rotation.set(-f.lookY * 0.35, f.lookX * 0.4, 0);
  }
}

// --- Ombres de contact : positions des sphères voisines, dans le repère de la caméra --------------

const _w = new THREE.Vector3();
export function updateOcclusion(rig, camera) {
  const list = [
    [rig.skull, [0, -0.02, 0], 0.5],
    [rig.body, [0, 0.08, 0], 0.42],
    [rig.arms.R.paw, [0, 0, 0], 0.13],
    [rig.arms.L.paw, [0, 0, 0], 0.13],
    [rig.legs.R.foot, [0, 0, 0], 0.12],
    [rig.legs.L.foot, [0, 0, 0], 0.12],
  ];
  list.forEach(([o, off, r], i) => {
    o.localToWorld(_w.set(...off)).applyMatrix4(camera.matrixWorldInverse);
    rig.occ.value[i].set(_w.x, _w.y, _w.z, r);
  });
}

export { lerp, clamp, smoothstep };
