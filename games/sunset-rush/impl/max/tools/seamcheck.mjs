// Checks that every background layer tiles horizontally: the seam (col 639 -> col 0) must not differ more than
// typical neighbouring columns do.
import { drawSky, drawFar, drawNear } from '../dist/js/art/backgrounds.js';

function colDiff(p, xa, xb) {
  let d = 0;
  for (let y = 0; y < p.h; y++) {
    const a = (y * p.w + xa) * 4, b = (y * p.w + xb) * 4;
    d += Math.abs(p.data[a] - p.data[b]) + Math.abs(p.data[a + 1] - p.data[b + 1]) + Math.abs(p.data[a + 2] - p.data[b + 2]) + Math.abs(p.data[a + 3] - p.data[b + 3]);
  }
  return d / p.h;
}

let bad = 0;
for (const [name, fn] of [['sky', drawSky], ['far', drawFar], ['near', drawNear]]) {
  for (let s = 1; s <= 3; s++) {
    const p = fn(s);
    const seam = colDiff(p, 639, 0);
    let sum = 0, n = 0, mx = 0;
    for (let x = 0; x < 639; x++) { const d = colDiff(p, x, x + 1); sum += d; n++; if (d > mx) mx = d; }
    const avg = sum / n;
    const ok = seam <= Math.max(mx, avg * 4);
    if (!ok) bad++;
    console.log(`${name}_${s}: seam diff ${seam.toFixed(1)}, avg neighbour diff ${avg.toFixed(1)}, max neighbour diff ${mx.toFixed(1)} -> ${ok ? 'ok' : 'SEAM VISIBLE'}`);
  }
}
process.exit(bad ? 1 : 0);
