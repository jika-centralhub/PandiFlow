// Le bocal à paillettes : un vrai bocal en verre plein d'eau, au couvercle doré, avec des centaines de
// paillettes (or, rose, bleu, lilas). On touche l'écran : il se secoue et tout tourbillonne ; puis les
// paillettes retombent tout doucement en tournant sur elles-mêmes, pendant qu'on respire.
// ctx : { phase: 'wait' | 'shake' | 'settle', shakes, secs }
import { THREE, blob, mesh, joint, lerp, clamp, TAU, ease, memo, occlusion, updateOcc, skin, lathe, glide, hero } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const N = 260, R = 0.33, BOTTOM = 0.08, TOP = 0.86;
const COLORS = ['#FFD23F', '#FF7EB6', '#5EC8FF', '#B9A9FF', '#FFFFFF', '#7CFFB2'];

export function createBocal() {
  return hero((H) => {
    const occ = occlusion();
    const root = H.root;
    H.shadow.scale.set(1, 1, 0.9);
    const jar = joint('jar', root);
    // le verre, l'eau, le couvercle
    const glassGeo = memo('jGlass', () => lathe([[0.0005, 0.0], [0.3, 0.0], [0.36, 0.05], [0.37, 0.15], [0.37, 0.8], [0.34, 0.87], [0.31, 0.9], [0.31, 0.95]], 48));
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.18, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }));
    glass.renderOrder = 9;
    jar.add(glass);
    const water = new THREE.Mesh(memo('jWater', () => lathe([[0.0005, 0.02], [0.33, 0.02], [0.35, 0.1], [0.35, 0.84], [0.0005, 0.84]], 40)), new THREE.MeshPhysicalMaterial({ color: '#B8E4FF', transparent: true, opacity: 0.16, roughness: 0.1, depthWrite: false }));
    water.renderOrder = 8;
    jar.add(water);
    const lidMat = skin(occ, '#F2B84A', { rough: 0.22, coat: 0.9, sheenK: 0 });
    lidMat.metalness = 0.65;
    const lid = mesh(memo('jLid', () => lathe([[0.0005, 0.0], [0.33, 0.0], [0.345, 0.02], [0.345, 0.1], [0.32, 0.12], [0.0005, 0.12]], 48)), lidMat, [0, 0.93, 0]);
    jar.add(lid);
    for (let i = 0; i < 3; i++) jar.add(mesh(memo('jRidge', () => new THREE.TorusGeometry(0.347, 0.008, 6, 48).rotateX(Math.PI / 2)), lidMat, [0, 0.95 + i * 0.03, 0]));
    // une petite étiquette en forme de cœur
    const label = mesh(memo('jLabel', () => new THREE.CircleGeometry(0.085, 32)), skin(occ, '#FFF4E0', { rough: 0.8, sheenK: 0.3 }), [0, 0.5, 0.372]);
    jar.add(label);
    const heart = new THREE.Mesh(memo('jHeart', () => new THREE.CircleGeometry(0.035, 20)), new THREE.MeshBasicMaterial({ color: '#FF7EB6' }));
    heart.position.set(0, 0.5, 0.375);
    jar.add(heart);

    // les paillettes : de petits disques brillants
    const flakeMat = new THREE.MeshPhysicalMaterial({ roughness: 0.18, metalness: 0.75, iridescence: 0.8, iridescenceIOR: 1.6, clearcoat: 1, emissiveIntensity: 0.15 });
    const flakes = new THREE.InstancedMesh(memo('jFlake', () => new THREE.CylinderGeometry(0.016, 0.016, 0.003, 8)), flakeMat, N);
    flakes.frustumCulled = false;
    flakes.renderOrder = 7;
    const col = new THREE.Color();
    const F = Array.from({ length: N }, (_, i) => {
      flakes.setColorAt(i, col.set(COLORS[i % COLORS.length]));
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (R - 0.04);
      return { p: V(Math.cos(a) * r, BOTTOM + Math.random() * 0.06, Math.sin(a) * r), v: V(0, 0, 0), rot: V(Math.random() * 3, Math.random() * 3, Math.random() * 3), spin: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6), fall: 0.02 + Math.random() * 0.03, rest: BOTTOM + Math.random() * 0.07, s: 0.7 + Math.random() * 0.8 };
    });
    jar.add(flakes);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = V(1, 1, 1);
    let shakeT = -9, swirl = 0;
    const S = { wob: 0 };
    return {
      set(H, c, prev) {
        if ((c.shakes || 0) > (prev.shakes || 0)) {
          // on secoue : toutes les paillettes partent en tourbillon
          shakeT = H.time;
          swirl = 1;
          for (const f of F) f.v.set((Math.random() - 0.5) * 1.6, 0.8 + Math.random() * 1.8, (Math.random() - 0.5) * 1.6);
        }
      },
      update(H, dt, camera) {
        const { ctx, time: T } = H;
        const ph = ctx.phase || 'wait';
        const sh = clamp((T - shakeT) / 0.8, 0, 1);
        const shaking = sh < 1 ? Math.sin(sh * Math.PI) : 0;
        jar.rotation.set(Math.sin(T * 26) * 0.12 * shaking, 0, Math.sin(T * 21) * 0.16 * shaking);
        jar.position.y = Math.abs(Math.sin(T * 13)) * 0.06 * shaking;
        // en attendant : le bocal se dandine un peu pour qu'on ait envie de le toucher
        if (ph === 'wait') jar.rotation.z += Math.sin(T * 3) * 0.04 * (Math.sin(T * 0.8) > 0.4 ? 1 : 0);
        swirl *= Math.exp(-dt * (ph === 'settle' ? 0.12 : 0.5));
        for (let i = 0; i < N; i++) {
          const f = F[i];
          const r = Math.hypot(f.p.x, f.p.z) || 1e-4;
          // tourbillon autour de l'axe du bocal, puis chute lente et frein de l'eau
          const tang = swirl * 0.9;
          f.v.x += (-f.p.z / r) * tang * dt * 2 + (Math.random() - 0.5) * swirl * dt * 2;
          f.v.z += (f.p.x / r) * tang * dt * 2 + (Math.random() - 0.5) * swirl * dt * 2;
          f.v.multiplyScalar(1 - Math.min(0.9, dt * 2.2));
          f.v.y -= f.fall * dt * 2.2;
          f.v.y = Math.max(f.v.y, -f.fall - swirl * 0.4);
          f.p.addScaledVector(f.v, dt);
          if (f.p.y < f.rest) {
            f.p.y = f.rest;
            f.v.set(0, 0, 0);
          }
          if (f.p.y > TOP) {
            f.p.y = TOP;
            f.v.y = -Math.abs(f.v.y) * 0.3;
          }
          const rr = Math.hypot(f.p.x, f.p.z);
          if (rr > R - 0.03) {
            f.p.x *= (R - 0.03) / rr;
            f.p.z *= (R - 0.03) / rr;
          }
          const moving = f.p.y > f.rest + 0.002;
          f.rot.addScaledVector(f.spin, dt * (moving ? 1 : 0.05));
          Q.setFromEuler(E.set(f.rot.x, f.rot.y, f.rot.z));
          M.compose(f.p, Q, SC.setScalar(f.s));
          flakes.setMatrixAt(i, M);
        }
        flakes.instanceMatrix.needsUpdate = true;
        if (camera) updateOcc(occ, [[lid, [0, 0, 0], 0.2]], camera);
      },
    };
  }, { shadow: [1, 0.9] });
}
