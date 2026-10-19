// Clés primaires des tables (utilisées pour les "upsert" en démo comme en cloud).
export const PRIMARY_KEYS = {
  children: ['id'],
  tasks: ['id'],
  challenges: ['id'],
  ledger: ['id'],
  child_tasks: ['child_id', 'task_id'],
  ratings: ['child_id', 'task_id', 'evening_date'],
  owned_items: ['child_id', 'item_id'],
};

// Nom de la table -> clé dans l'état du store
export const STATE_KEYS = {
  children: 'children',
  tasks: 'tasks',
  challenges: 'challenges',
  ledger: 'ledger',
  child_tasks: 'childTasks',
  ratings: 'ratings',
  owned_items: 'owned',
};

export const sameKey = (table, a, b) => PRIMARY_KEYS[table].every((k) => a[k] === b[k]);

export const matches = (row, match) => Object.entries(match).every(([k, v]) => row[k] === v);
