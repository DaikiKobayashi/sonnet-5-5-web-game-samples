// Seeded random numbers (mulberry32) and small hashing helpers.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRng(seed) {
  const r = mulberry32(seed);
  r.int = (n) => Math.floor(r() * n);
  return r;
}

// SPEC 3.10: rng = seededRng(seed XOR (stage * 0x9E3779B1))
export function stageSeed(seed, stage) {
  return (seed ^ Math.imul(stage, 0x9e3779b1)) >>> 0;
}

// FNV-1a over a list of integers -> 8 hex chars
export function fnv1a(list) {
  let h = 0x811c9dc5;
  for (let i = 0; i < list.length; i++) {
    let v = list[i] | 0;
    for (let b = 0; b < 4; b++) {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      v >>>= 8;
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function randomSeed() {
  let s = 0;
  try {
    s = (Date.now() ^ Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000)) >>> 0;
    s = (s ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  } catch (e) {
    s = 12345;
  }
  return s >>> 0;
}
