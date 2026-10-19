// Stockage du mode démo : tout est gardé dans le localStorage du navigateur.
import { uid } from './util.js';
import { DEFAULT_SETTINGS } from '../domain.js';
import { PRIMARY_KEYS, sameKey, matches } from './tables.js';

const KEY = 'pandiflow-demo-v1';
const TABLES = Object.keys(PRIMARY_KEYS);

function emptyDb() {
  const db = { family: null };
  for (const t of TABLES) db[t] = [];
  return db;
}

export class LocalRepo {
  constructor() {
    this.mode = 'demo';
    try {
      this.db = { ...emptyDb(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
    } catch {
      this.db = emptyDb();
    }
  }

  save() {
    localStorage.setItem(KEY, JSON.stringify(this.db));
  }

  async getUser() {
    return { id: 'demo', email: 'demo@pandiflow.com' };
  }

  async getFamily() {
    return this.db.family;
  }

  async createFamily(name) {
    this.db.family = {
      id: uid(),
      name,
      settings: { ...DEFAULT_SETTINGS },
      created_at: new Date().toISOString(),
    };
    this.save();
    return this.db.family;
  }

  async loadAll() {
    const d = this.db;
    return {
      family: d.family,
      children: [...d.children],
      tasks: [...d.tasks],
      childTasks: [...d.child_tasks],
      ratings: [...d.ratings],
      ledger: [...d.ledger],
      owned: [...d.owned_items],
      challenges: [...d.challenges],
    };
  }

  async put(table, rows) {
    const list = this.db[table];
    for (const row of rows) {
      const i = list.findIndex((r) => sameKey(table, r, row));
      if (i >= 0) list[i] = { ...list[i], ...row };
      else list.push({ ...row });
    }
    this.save();
  }

  async del(table, match) {
    this.db[table] = this.db[table].filter((r) => !matches(r, match));
    this.save();
  }

  async updateFamily(_familyId, patch) {
    this.db.family = { ...this.db.family, ...patch };
    this.save();
  }

  // Mode démo : un seul parent, des invitations factices (rien n'est partagé)
  async listMembers() {
    return [{ user_id: 'demo', role: 'owner', email: 'demo@pandiflow.com', created_at: this.db.family?.created_at }];
  }

  async listInvites() {
    this.invites = (this.invites || []).filter((i) => i.expires_at > new Date().toISOString());
    return this.invites;
  }

  async createInvite() {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    const inv = { code, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() };
    this.invites = [inv, ...(this.invites || [])];
    return inv;
  }

  async revokeInvite(code) {
    this.invites = (this.invites || []).filter((i) => i.code !== code);
  }

  async removeMember() {}

  reset() {
    localStorage.removeItem(KEY);
    this.db = emptyDb();
  }
}
