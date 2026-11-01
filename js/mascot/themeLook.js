// La tenue de Pandi pendant un thème de la boutique, et les soirs d'anniversaire (elle passe avant celle
// du thème) : elle remplace le « Pandi du jour » sur tous les écrans. Module léger (sans three.js) :
// l'app y range les périodes, gear.js les lit en habillant Pandi.
let ranges = []; // [{ start, end, look: { tete, yeux, cou, dos } }] : la première qui convient l'emporte

// Le soir d'un anniversaire : chapeau de fête, nœud papillon et un bouquet de ballons dans le dos
export const BIRTHDAY_LOOK = { tete: 'fete', cou: 'papillon', dos: 'ballons' };

export function setThemeLooks(list) {
  ranges = Array.isArray(list) ? list : [];
}

export const themeLookFor = (dateISO) => ranges.find((r) => r.start <= dateISO && dateISO <= r.end)?.look || null;
