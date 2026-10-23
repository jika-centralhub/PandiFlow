// Compter jusqu'à 10 : sur un petit carré d'herbe, des moutons tout doux sautent une barrière en bois,
// un à chaque nombre (deux moutons qui se relaient). Au dixième, le mouton fait coucou.
// ctx : { phase: 'count', step (0 -> 9), n (1 -> 10), secs }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, face, glide, hero } from './kit.js';
import { bumpRepeat } from '../pandi3d.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rbox = (w, h, d, e = 0.3) => blob([w, h, d], [20, 14], (x, y, z) => [x, y, z].map((v) => Math.sign(v) * Math.abs(v) ** e));
const FENCE_X = 0.3;

function sheep(occ, mats) {
  const g = new THREE.Group();
  const body = joint('body', g, [0, 0.42, 0]);
  // la laine : des boules qui se chevauchent
  const puff = memo('mPuff', () => new THREE.SphereGeometry(1, 24, 16));
  [[0, 0.02, 0, 0.24], [0.17, 0.04, 0.05, 0.17], [-0.17, 0.03, 0.04, 0.18], [0.06, 0.15, 0.02, 0.17], [-0.09, 0.14, 0.0, 0.16], [0.02, -0.04, 0.15, 0.17], [0.0, 0.02, -0.15, 0.18], [0.2, -0.04, -0.06, 0.13], [-0.2, -0.05, -0.07, 0.14]].forEach(([x, y, z, r]) => {
    const m = mesh(puff, mats.wool, [z, y, x]);
    m.scale.setScalar(r);
    body.add(m);
  });
  const tail = mesh(puff, mats.wool, [0, 0.06, -0.27]);
  tail.scale.setScalar(0.07);
  body.add(tail);
  // la tête noire, une houppette de laine, de grandes oreilles
  const head = joint('head', body, [0, 0.1, 0.26]);
  const HE = { c: [0, 0, 0], r: [0.12, 0.13, 0.12] };
  const headM = mesh(memo('mHead', () => blob(HE.r, [28, 20], (x, y, z) => [x * (1 - 0.15 * Math.max(0, -y)), y, z])), mats.face);
  head.add(headM);
  const tuft = mesh(puff, mats.wool, [0, 0.11, 0.0]);
  tuft.scale.set(0.11, 0.07, 0.1);
  head.add(tuft);
  const ears = [1, -1].map((sx) => {
    const e = joint('ear', head, [0.11 * sx, 0.05, -0.02]);
    e.add(mesh(memo('mEar', () => blob([0.07, 0.03, 0.035], [16, 10]).translate(0.06, 0, 0)), mats.face));
    e.scale.x = sx;
    return e;
  });
  const f = face(head, occ, { E: HE, eye: { x: 0.045, y: 0.025, z: 0.085, r: 0.042, iris: '#7A5230', turn: 0.25 }, lid: mats.face, mouth: { y: -0.065, k: 0.6, line: '#F2E4D8' } });
  // pattes fines et noires
  const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => {
    const j = joint('leg', g, [0.09 * sx, 0.3, 0.13 * sz]);
    j.add(mesh(memo('mLeg', () => new THREE.CapsuleGeometry(0.03, 0.2, 4, 10).translate(0, -0.13, 0)), mats.face));
    return { j, sx, sz };
  });
  return { g, body, head, ears, legs, f };
}

export function createMoutons() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.visible = false;
    const turn = joint('turn', root);
    turn.rotation.y = -0.55; // le chemin des moutons passe en biais : on voit bien la barrière
    const wool = skin(occ, '#FFFCF4', { rough: 0.95, sheen: '#FFFFFF', sheenK: 1, bump: bumpRepeat(3, 2), bumpScale: 1.4 });
    const faceMat = skin(occ, '#3B3542', { rough: 0.7, sheen: '#A9A2C0', sheenK: 0.6 });
    const wood = skin(occ, '#C98A4B', { rough: 0.75, sheen: '#FFE2C0', sheenK: 0.3 });
    const grass = skin(occ, '#5DBA4E', { rough: 0.95, sheen: '#D8FFC0', sheenK: 0.8, bump: bumpRepeat(6, 6), bumpScale: 0.8 });
    // le carré d'herbe et ses fleurs, la barrière
    const meadow = mesh(memo('mMeadow', () => blob([1.2, 0.05, 0.9], [48, 12])), grass, [0.3, -0.025, 0]);
    turn.add(meadow);
    const petal = skin(occ, '#FFFFFF', { rough: 0.6 }), heart = skin(occ, '#FFD23F', { rough: 0.5 });
    [[-0.6, 0.3], [0.9, 0.45], [1.3, -0.2], [-0.2, -0.45], [0.55, 0.55]].forEach(([x, z]) => {
      const fl = mesh(memo('mFlower', () => new THREE.SphereGeometry(0.035, 10, 8)), heart, [x, 0.04, z]);
      turn.add(fl);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const p = mesh(memo('mPetal', () => new THREE.SphereGeometry(0.03, 8, 6)), petal, [x + Math.cos(a) * 0.045, 0.035, z + Math.sin(a) * 0.045]);
        turn.add(p);
      }
    });
    const fence = joint('fence', turn, [FENCE_X, 0, -0.05]);
    [-0.32, 0.32].forEach((z) => fence.add(mesh(memo('mPost', () => rbox(0.045, 0.3, 0.045)), wood, [0, 0.3, z])));
    [0.2, 0.42].forEach((y) => fence.add(mesh(memo('mRail', () => rbox(0.03, 0.035, 0.42)), wood, [0, y, 0])));
    fence.rotation.y = 0.0;

    const mats = { wool, face: faceMat };
    const flock = [sheep(occ, mats), sheep(occ, mats)];
    flock.forEach((s) => turn.add(s.g));
    const S = {};
    return {
      update(H, dt, camera) {
        const { ctx, pt, time: T } = H;
        const secs = ctx.secs || 3, n = ctx.n || 1;
        const u = clamp(pt / secs, 0, 1);
        flock.forEach((sh, k) => {
          const mine = (n - 1) % 2 === k;
          let x, y = 0, s = 1, tilt = 0, legK = 0, run = 1;
          if (mine) {
            // il arrive en trottinant, saute la barrière, retombe et s'en va
            if (u < 0.3) x = lerp(-0.45, FENCE_X - 0.45, ease(u / 0.3));
            else if (u < 0.62) {
              const j = (u - 0.3) / 0.32;
              x = lerp(FENCE_X - 0.45, FENCE_X + 0.45, j);
              y = Math.sin(j * Math.PI) * 0.62;
              tilt = Math.cos(j * Math.PI) * 0.35;
              legK = Math.sin(j * Math.PI);
              run = 0;
            } else x = lerp(FENCE_X + 0.45, FENCE_X + 1.05, ease((u - 0.62) / 0.38));
            if (n === 10 && u > 0.62) x = FENCE_X + 0.75;
            s = n === 10 ? 1 : 1 - ease(clamp((u - 0.85) / 0.15, 0, 1));
            s *= ease(clamp(u / 0.08, 0, 1));
          } else {
            // l'autre mouton finit de s'éloigner
            x = FENCE_X + 1.05;
            s = 0;
          }
          sh.g.visible = s > 0.01;
          sh.g.position.set(x, y + (run ? Math.abs(Math.sin(T * 9)) * 0.03 : 0), 0.05);
          sh.g.scale.setScalar(s * 1.05);
          const wave = n === 10 && u > 0.7;
          sh.g.rotation.set(0, Math.PI / 2 - (wave ? 0.6 : 0.1), 0);
          sh.body.rotation.z = 0;
          sh.body.rotation.x = -tilt;
          sh.head.rotation.set(-tilt * 0.5 + (wave ? Math.sin(T * 5) * 0.1 : 0), wave ? 0 : -0.45 + Math.sin(T * 1.3) * 0.1, wave ? Math.sin(T * 4) * 0.12 : 0);
          sh.ears.forEach((e, i) => (e.rotation.z = -0.3 + Math.sin(T * 6 + i) * 0.15 + legK * 0.5));
          sh.legs.forEach((L, i) => {
            const ph = (i === 0 || i === 3 ? 0 : Math.PI);
            L.j.rotation.x = run ? Math.sin(T * 14 + ph) * 0.5 : legK * (L.sz > 0 ? -0.9 : 0.9);
          });
          sh.f.update(dt, legK > 0.3 ? { smile: 1, open: 0.04, tongue: 1, lidUp: 0, lidLo: 0.5, lookX: 0, lookY: 0.2 } : wave ? { smile: 1, open: 0.035, tongue: 1, lidUp: 0.05, lidLo: 0.8, lookX: 0 } : { smile: 0.9, open: 0.02, lidUp: 0.1, lidLo: 0.6, lookX: 0.2 });
        });
        if (camera) updateOcc(occ, [[flock[0].body, [0, 0, 0], 0.26], [flock[1].body, [0, 0, 0], 0.26], [meadow, [0, 0, 0], 0.4]], camera);
      },
    };
  });
}
