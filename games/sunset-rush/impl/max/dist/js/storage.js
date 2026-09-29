// localStorage persistence: key "sunset-rush:v1", value {"best": number, "muted": boolean}.
// Every access is wrapped in try/catch so the game runs even when storage is unavailable or throws.

import { STORAGE_KEY } from './config.js';

export function loadSave() {
  const out = { best: 0, muted: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return out;
    const d = JSON.parse(raw);
    if (d && typeof d === 'object') {
      if (Number.isFinite(d.best) && d.best > 0) out.best = Math.floor(d.best);
      out.muted = d.muted === true;
    }
  } catch (e) { /* unavailable or corrupt: fall back to defaults */ }
  return out;
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ best: Math.floor(data.best || 0), muted: !!data.muted }));
  } catch (e) { /* not saved, game continues */ }
}
