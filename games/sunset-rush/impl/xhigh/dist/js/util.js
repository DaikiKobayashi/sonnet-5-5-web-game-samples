// 小さなユーティリティ

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const pad = (n, w) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

// mulberry32(§3.10)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRng(seed) {
  const next = mulberry32(seed);
  return {
    rand: next,
    randInt: (n) => Math.floor(next() * n),
  };
}

// '#rrggbb' -> [r,g,b]
export function parseHex(h) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function toHex(rgb) {
  return '#' + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

// 2 色の混合(t = 0 で a、1 で b)。'#rrggbb' 同士
export function mixHex(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}
