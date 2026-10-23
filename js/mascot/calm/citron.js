// Presser le citron : deux petits citrons rigolos, un dans chaque patte de Pandi. Quand on serre, ils
// s'écrasent en grimaçant et le jus gicle ; quand on lâche, ils redeviennent tout ronds et tout mous.
// ctx : { phase: 'squeeze' | 'relax', step, secs }
import { THREE, blob, mesh, joint, lerp, clamp, ease, memo, occlusion, updateOcc, skin, slab, face, glide, hero, particles, toLocal, dimpleBump } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LE = { c: [0, 0, 0], r: [0.16, 0.125, 0.125] };

function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.06, 0.04, 0.12, 0);
  s.quadraticCurveTo(0.06, -0.04, 0, 0);
  return s;
}

export function createCitron() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.visible = false;
    const peel = skin(occ, '#FFE03A', { rough: 0.45, coat: 0.5, sheen: '#FFF8C8', sheenK: 0.5, bump: dimpleBump(5, 3), bumpScale: 0.5, patches: [
      { c: [0.07, -0.035, 0.1], r: [0.03, 0.022, 0.03], color: '#FF9A7A', alpha: 0.55, soft: 0.5 },
      { c: [-0.07, -0.035, 0.1], r: [0.03, 0.022, 0.03], color: '#FF9A7A', alpha: 0.55, soft: 0.5 },
    ] });
    const lid = skin(occ, '#FFE03A', { rough: 0.45, coat: 0.5 });
    const leafMat = skin(occ, '#5CC24E', { rough: 0.5, sheen: '#E8FFD8' });
    const lemonGeo = memo('cLemon', () => blob(LE.r, [40, 28], (x, y, z) => {
      const tip = 1 + 0.25 * Math.abs(x) ** 7;
      const k = 1 - 0.08 * x * x;
      return [x * tip, y * k, z * k];
    }));
    const leafGeo = memo('cLeaf', () => slab(leafShape(), 0.008, 0.005));
    const lemons = [1, -1].map((sx) => {
      const g = joint('lemon', root);
      g.scale.setScalar(1.65);
      const squish = joint('squish', g);
      squish.add(mesh(lemonGeo, peel));
      const leaf = mesh(leafGeo, leafMat, [0.02, 0.115, -0.01], [0.3, 0, 0.5]);
      squish.add(leaf);
      const f = face(squish, occ, { E: LE, eye: { x: 0.05, y: 0.03, z: 0.095, r: 0.038, iris: '#4A7A2A', turn: 0.25 }, lid, mouth: { y: -0.04, k: 0.62, line: '#7A5A10' } });
      return { g, squish, f, sx, k: 0 };
    });
    const juice = particles(90, { grow: [0.1, 0.06], drag: 0.6, lift: -3.2, ramp: [[0, 1, 0.93, 0.3, 0], [0.08, 1, 0.9, 0.2, 1], [0.8, 1, 0.86, 0.15, 0.9], [1, 1, 0.85, 0.15, 0]] });
    root.add(juice.points);
    const S = { sq: 0 };
    let acc = 0;
    const _a = V(0, 0, 0);
    return {
      parts: { juice },
      update(H, dt, camera) {
        const { ctx, pt, time: T } = H;
        const ph = ctx.phase || 'squeeze';
        const sq = ph === 'squeeze' ? ease(clamp((pt - 0.3) / 0.8, 0, 1)) : 0;
        glide(S, { sq }, dt, ph === 'squeeze' ? 7 : 4);
        const shake = ph === 'squeeze' ? Math.sin(T * 38) * 0.03 * S.sq : 0;
        for (const L of lemons) {
          // le citron est dans la patte de Pandi, juste devant
          if (H.actor) {
            const at = toLocal(root, H.actor.rig.arms[L.sx > 0 ? 'R' : 'L'].hand, [0, 0, 0], _a);
            L.g.position.set(at.x + L.sx * 0.03, at.y + 0.03, at.z + 0.16);
          }
          L.g.rotation.set(0, -0.2 * L.sx, (ph === 'relax' ? Math.sin(T * 2 + L.sx) * 0.12 : 0) + 0.15 * L.sx);
          L.squish.scale.set(1 + 0.2 * S.sq, 1 - 0.32 * S.sq + shake, 1 + 0.15 * S.sq);
          L.f.update(dt, ph === 'squeeze'
            ? { lidUp: 0.85 * S.sq + 0.1, lidLo: 0.9, smile: lerp(0.9, 0.1, S.sq), open: 0.025 * S.sq, wide: 1.1 + 0.25 * S.sq, teeth: 0.7 * S.sq, tongue: 0, round: 0, lookX: 0 }
            : { lidUp: 0.45, lidLo: 0.85, smile: 1, open: 0.02, wide: 1.15, teeth: 0, tongue: 0.6, round: 0, lookX: -0.1 * L.sx }, { noBlink: ph === 'squeeze' });
        }
        // le jus gicle tant qu'on serre fort
        acc += dt * (S.sq > 0.6 ? 40 : 0);
        while (acc >= 1) {
          acc -= 1;
          const L = lemons[Math.random() < 0.5 ? 0 : 1];
          const v = V(L.sx * (0.4 + Math.random() * 0.8), 0.6 + Math.random() * 1.2, 0.4 + Math.random() * 0.6);
          juice.spawn(L.g.position.clone().add(V(L.sx * 0.22, 0.03, 0.08)), v, 0.9, 0.7 + Math.random() * 0.6);
        }
        juice.update(dt, camera);
        if (camera) updateOcc(occ, [[lemons[0].squish, [0, 0, 0], 0.13], [lemons[1].squish, [0, 0, 0], 0.13]], camera);
      },
      dispose() {
        juice.dispose();
      },
    };
  });
}
