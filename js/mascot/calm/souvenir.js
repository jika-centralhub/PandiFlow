// Un souvenir qui fait du bien : une boule à souvenirs sur un petit guéridon. Les yeux fermés, elle est
// toute sombre ; puis le souvenir apparaît dedans (une petite plage, un palmier, le soleil), des
// paillettes tourbillonnent, des notes s'envolent, des cœurs vont jusqu'à Pandi.
// ctx : { phase: 'yeux' | 'ou' | 'sens' | 'coeur' | 'raconte', step, secs }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, lathe, taperTube, slab, glide, hero, particles, toLocal } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GLOBE_Y = 1.18, GLOBE_R = 0.4;

function frond() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.08, 0.05, 0.2, -0.02);
  s.quadraticCurveTo(0.09, -0.01, 0, 0);
  return s;
}

export function createSouvenir() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.scale.set(0.9, 1, 0.8);
    // le guéridon en bois
    const wood = skin(occ, '#B8743F', { rough: 0.6, coat: 0.4, sheen: '#FFE0C0', sheenK: 0.3 });
    root.add(mesh(memo('sTop', () => new THREE.CylinderGeometry(0.4, 0.38, 0.05, 40)), wood, [0, 0.7, 0]));
    [0, 1, 2].forEach((i) => {
      const a = (i / 3) * TAU + 0.5;
      const leg = mesh(memo('sLeg', () => new THREE.CylinderGeometry(0.03, 0.025, 0.7, 10)), wood, [Math.cos(a) * 0.24, 0.35, Math.sin(a) * 0.24]);
      leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
      root.add(leg);
    });
    // le socle doré de la boule
    const gold = skin(occ, '#F2B84A', { rough: 0.25, coat: 0.8, sheenK: 0 });
    gold.metalness = 0.6;
    root.add(mesh(memo('sBase', () => lathe([[0.0005, 0.725], [0.3, 0.725], [0.31, 0.76], [0.27, 0.84], [0.25, 0.88], [0.0005, 0.88]], 40)), wood));
    const ring = mesh(memo('sRing', () => new THREE.TorusGeometry(0.265, 0.025, 10, 40).rotateX(Math.PI / 2)), gold, [0, 0.86, 0]);
    root.add(ring);
    // le souvenir à l'intérieur : une petite île, la mer, un palmier, le soleil
    const inside = joint('inside', root, [0, GLOBE_Y - 0.1, 0]);
    const sea = mesh(memo('sSea', () => new THREE.CylinderGeometry(0.33, 0.33, 0.02, 40)), skin(occ, '#5EC8F2', { rough: 0.2, coat: 1 }), [0, -0.18, 0]);
    inside.add(sea);
    const sand = mesh(memo('sSand', () => blob([0.19, 0.07, 0.15], [24, 14])), skin(occ, '#FFD98A', { rough: 0.8, sheenK: 0.3 }), [-0.03, -0.15, 0.02]);
    inside.add(sand);
    const palm = joint('palm', inside, [-0.08, -0.12, 0]);
    palm.add(mesh(taperTube([[0, 0, 0], [0.02, 0.1, 0], [0.06, 0.2, 0.01], [0.1, 0.27, 0.01]], 0.022, 0.014, 16, 8).geo, skin(occ, '#A46A3A', { rough: 0.8 })));
    const leafMat = skin(occ, '#4DC25A', { rough: 0.5, sheen: '#E0FFD8' });
    const leafGeo = memo('sFrond', () => slab(frond(), 0.006, 0.004));
    for (let i = 0; i < 6; i++) {
      const l = mesh(leafGeo, leafMat, [0.1, 0.27, 0.01], [0.3 * Math.sin(i), (i / 6) * TAU, -0.35]);
      palm.add(l);
    }
    const castle = mesh(memo('sCastle', () => new THREE.ConeGeometry(0.045, 0.08, 10)), skin(occ, '#F7C66E', { rough: 0.8 }), [0.08, -0.09, 0.06]);
    inside.add(castle);
    const sunMat = new THREE.MeshBasicMaterial({ color: '#FFD84A', toneMapped: false });
    const sun = mesh(memo('sSun', () => new THREE.SphereGeometry(0.06, 16, 12)), sunMat, [0.17, 0.14, -0.12]);
    inside.add(sun);
    inside.add(mesh(memo('sHeart', () => new THREE.SphereGeometry(0.02, 8, 6)), new THREE.MeshBasicMaterial({ color: '#FF6FA8', toneMapped: false }), [0.12, -0.1, 0.1]));
    // le verre : une bulle transparente qui reflète la lumière, et une lueur derrière
    const glass = new THREE.Mesh(memo('sGlass', () => new THREE.SphereGeometry(GLOBE_R, 48, 32)), new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false, envMapIntensity: 1.6 }));
    glass.position.y = GLOBE_Y;
    glass.renderOrder = 9;
    root.add(glass);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: memo('sHalo', haloTex), color: '#FFD9A0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.setScalar(1.6);
    halo.position.set(0, GLOBE_Y, -0.2);
    root.add(halo);
    const sparkle = particles(80, { additive: true, grow: [0.035, 0.02], drag: 0.2, lift: 0, ramp: [[0, 1, 1, 0.8, 0], [0.2, 1, 0.95, 0.7, 0.9], [1, 1, 0.9, 0.6, 0]] });
    sparkle.points.renderOrder = 10;
    root.add(sparkle.points);

    const S = { show: 0, glow: 0 };
    const acc = { sp: 0, note: 0, heart: 0 };
    const _a = V(0, 0, 0);
    return {
      parts: { sparkle },
      update(H, dt, camera) {
        const { ctx, pt, time: T } = H;
        const ph = ctx.phase || 'yeux';
        const show = ph === 'yeux' ? 0 : 1;
        const glow = { yeux: 0.15, ou: 0.7, sens: 0.8, coeur: 1, raconte: 0.8 }[ph] ?? 0.3;
        glide(S, { show, glow }, dt, ph === 'ou' ? 1.6 : 3);
        inside.scale.setScalar(Math.max(0.001, ease(clamp(S.show, 0, 1))));
        inside.rotation.y = Math.sin(T * 0.4) * 0.5;
        sun.scale.setScalar(1 + Math.sin(T * 2) * 0.08);
        sea.scale.set(1 + Math.sin(T * 1.7) * 0.02, 1, 1 + Math.cos(T * 1.5) * 0.02);
        halo.material.opacity = 0.15 + S.glow * 0.55 * (0.9 + Math.sin(T * 2.2) * 0.1);
        ring.rotation.y = T * 0.3;
        // paillettes qui tourbillonnent dans la boule
        acc.sp += dt * (6 + 22 * S.glow);
        while (acc.sp >= 1) {
          acc.sp -= 1;
          const a = Math.random() * TAU, r = Math.random() * 0.3;
          sparkle.spawn(V(Math.cos(a) * r, GLOBE_Y + (Math.random() - 0.4) * 0.5, Math.sin(a) * r), V(-Math.sin(a) * 0.2, -0.05 - Math.random() * 0.06, Math.cos(a) * 0.2), 1.6 + Math.random(), 0.6 + Math.random() * 0.8);
        }
        sparkle.update(dt, camera);
        // des notes et des cœurs qui sortent de la boule
        if (H.fx) {
          root.updateWorldMatrix(true, false);
          const top = () => root.localToWorld(V((Math.random() - 0.5) * 0.4, GLOBE_Y + 0.35, 0.1));
          if (ph === 'sens') {
            acc.note += dt * 1.3;
            if (acc.note >= 1) {
              acc.note -= 1;
              H.fx.emoji(top(), Math.random() < 0.5 ? '🎵' : '🎶', { size: 0.2 });
            }
          }
          if (ph === 'coeur' && H.actor) {
            acc.heart += dt * 1.6;
            if (acc.heart >= 1) {
              acc.heart -= 1;
              const to = H.actor.rig.torso.localToWorld(V(0, 0.4, 0.5));
              const from = top();
              H.fx.emoji(from, '💖', { size: 0.22, v: to.sub(from).multiplyScalar(0.7), life: 1.5 });
            }
          }
        }
        if (camera) updateOcc(occ, [[glass, [0, 0, 0], 0.35]], camera);
      },
      dispose() {
        sparkle.dispose();
      },
    };
  }, { shadow: [0.9, 0.8] });
}

function haloTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,.4)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
