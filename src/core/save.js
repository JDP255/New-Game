// Persistent progress stored in localStorage (guarded — the game still runs if storage is blocked).
const KEY = 'valkimsmor-save-v1';

const DEFAULTS = () => ({
  unlocked: 1,
  completed: {},
  found: {},
  upgrades: {},
  settings: { quality: 'medium', music: 0.7, sfx: 0.85, sens: 1, invertY: false, difficulty: 'normal', shake: 1 },
  stats: { kills: 0, deaths: 0, parries: 0, playTime: 0, judgments: 0 },
  trialBest: 0,
  resume: null,
});

export class Save {
  constructor() {
    this.data = DEFAULTS();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = DEFAULTS();
        this.data = { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) }, stats: { ...def.stats, ...(d.stats || {}) } };
      }
    } catch (e) { /* storage unavailable */ }
  }
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  }
  reset() {
    const settings = this.data.settings;
    this.data = DEFAULTS();
    this.data.settings = settings;
    this.write();
  }
  has(id) { return !!this.data.found[id]; }
  mark(id) { this.data.found[id] = Date.now(); this.write(); }
  get hasProgress() { return this.data.unlocked > 1 || Object.keys(this.data.found).length > 0 || !!this.data.resume; }
}
