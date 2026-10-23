// La scène 3D d'un exercice du coin calme : le personnage de l'exercice (bébé dragon…) et Pandi à côté
// qui fait l'exercice avec lui, dans le même moteur WebGL que les autres Pandi (stage.js).
import { mountPandi } from '../stage.js';
import { ACTS } from '../acts.js';
import { CALM_ACTS } from './acts.js';
import { createDragon } from './dragon.js';
import { createFleur } from './fleur.js';
import { createBallon } from './ballon.js';
import { createTortue } from './tortue.js';
import { createCitron } from './citron.js';
import { createRobot } from './robot.js';
import { createMoutons } from './moutons.js';
import { createPapillon } from './papillon.js';
import { createSouvenir } from './souvenir.js';
import { createBulle } from './bulle.js';
import { createHibou } from './hibou.js';
import { createBocal } from './bocal.js';

Object.assign(ACTS, CALM_ACTS);

// at : place du héros ; pandi : place de Pandi (x, z, rotation) ; frame : cadrage { x, y, h, w }
const HEROES = {
  dragon: { make: createDragon, act: 'calmeDragon', at: [0.5, 0.1, 1.18], pandi: { x: -0.98, z: -0.3, turn: 0.42 }, frame: { x: 0.3, y: 1.1, h: 2.6, w: 4.1 } },
  fleur: { make: createFleur, act: 'calmeFleur', at: [0.38, 0.15, 1.35], pandi: { x: -1.3, z: -0.45, turn: 0.42 }, frame: { x: 0.15, y: 1.1, h: 2.55, w: 4.2 } },
  ballon: { make: createBallon, act: 'calmeBallon', at: [0.55, 0.15, 1.3], pandi: { x: -0.95, z: -0.35, turn: 0.35 }, frame: { x: 0.1, y: 1.25, h: 2.75, w: 3.7 } },
  tortue: { make: createTortue, act: 'calmeTortue', at: [0.6, 0.3, 1.6], pandi: { x: -1.05, z: -0.45, turn: 0.35 }, frame: { x: 0.05, y: 1.05, h: 2.55, w: 3.8 } },
  citron: { make: createCitron, act: 'calmeCitron', at: [0, 0, 1], pandi: { x: 0, z: 0, turn: 0 }, frame: { x: 0, y: 1.2, h: 2.6, w: 2.9 } },
  robot: { make: createRobot, act: 'calmeRobot', at: [0.6, 0.15, 1.45], pandi: { x: -0.95, z: -0.4, turn: 0.3 }, frame: { x: 0.05, y: 1.1, h: 2.6, w: 3.7 } },
  moutons: { make: createMoutons, act: 'calmeMoutons', at: [0.05, 0.15, 1.2], pandi: { x: -1.25, z: -0.45, turn: 0.4 }, frame: { x: 0.1, y: 1.0, h: 2.5, w: 4.0 } },
  papillon: { make: createPapillon, act: 'calmePapillon', at: [0, 0, 1], pandi: { x: -0.2, z: 0, turn: 0.1 }, frame: { x: 0.1, y: 1.2, h: 2.6, w: 3.0 } },
  souvenir: { make: createSouvenir, act: 'calmeSouvenir', at: [0.6, 0.15, 1.15], pandi: { x: -0.85, z: -0.35, turn: 0.3 }, frame: { x: 0.0, y: 1.15, h: 2.6, w: 3.6 } },
  bulle: { make: createBulle, act: 'calmeBulle', at: [0, 0, 1], pandi: { x: 0, z: 0, turn: 0 }, frame: { x: 0, y: 1.25, h: 2.9, w: 3.4 } },
  hibou: { make: createHibou, act: 'calmeHibou', at: [0.6, 0.15, 1.3], pandi: { x: -0.85, z: -0.35, turn: 0.3 }, frame: { x: 0.05, y: 1.15, h: 2.6, w: 3.6 } },
  bocal: { make: createBocal, act: 'calmeBocal', at: [0.6, 0.25, 1.45], pandi: { x: -0.85, z: -0.4, turn: 0.3 }, frame: { x: 0.05, y: 1.05, h: 2.5, w: 3.6 } },
};

export const hasHero = (id) => Boolean(HEROES[id]);

// ctx : l'étape de l'exercice ({ phase, secs, anger… }), passée à Pandi et au héros
// exclusive : les petits Pandi de l'écran du dessous s'arrêtent pendant l'exercice
export function mountCalm(canvas, { hero, ctx = {}, date, still = false, exclusive = true }) {
  const H = HEROES[hero];
  const cast = H.make();
  cast.place(...H.at);
  const ctl = mountPandi(canvas, { act: H.act, ctx, framing: 'calm', frames: { calm: H.frame }, spot: H.pandi, cast, date, still, maxDpr: 1.5, exclusive });
  cast.attach?.(ctl.actor);
  cast.set(ctx);
  // une nouvelle étape relance l'horloge d'étape de Pandi ; un tapotement ou une trouvaille la garde
  let last = `${ctx.phase}|${ctx.step}|${ctx.cycle}`;
  return {
    ...ctl,
    cast,
    set(c) {
      const k = `${c.phase}|${c.step}|${c.cycle}`;
      if (k !== last) ctl.play(H.act, c);
      else ctl.set(c);
      last = k;
      cast.set(c);
    },
  };
}
