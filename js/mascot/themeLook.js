// La tenue de Pandi pendant un thème de la boutique : elle remplace le « Pandi du jour » sur tous les
// écrans. Module léger (sans three.js) : l'app y range les périodes, gear.js les lit en habillant Pandi.
let ranges = []; // [{ start, end, look: { tete, yeux, cou, dos } }]

export function setThemeLooks(list) {
  ranges = Array.isArray(list) ? list : [];
}

export const themeLookFor = (dateISO) => ranges.find((r) => r.start <= dateISO && dateISO <= r.end)?.look || null;
