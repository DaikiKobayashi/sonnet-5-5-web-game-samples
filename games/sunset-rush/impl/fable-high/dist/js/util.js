// Small shared helpers (no DOM dependencies).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// mulberry32: tiny seeded PRNG returning [0,1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit hash of a string -> 8 hex chars.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function pad(n, w) {
  return String(Math.max(0, Math.floor(n))).padStart(w, '0');
}

// Parse '#rgb' / '#rrggbb' / '#rrggbbaa' into [r,g,b,a].
const colorCache = new Map();
export function rgba(c) {
  if (Array.isArray(c)) return c;
  let v = colorCache.get(c);
  if (v) return v;
  let h = c.slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  if (h.length === 8) v = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  else v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  colorCache.set(c, v);
  return v;
}

export function hex([r, g, b]) {
  return '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
}

export function mixColor(a, b, t) {
  const A = rgba(a), B = rgba(b);
  return hex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}
