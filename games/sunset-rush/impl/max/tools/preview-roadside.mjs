import { writeSheet } from './png.mjs';
import { ROADSIDE_DRAWERS } from '../dist/js/art/roadside.js';

const out = process.argv[2] || '/tmp/roadside.png';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const imgs = [];
for (const [id, fn] of Object.entries(ROADSIDE_DRAWERS)) {
  if (only && !only.includes(id)) continue;
  const im = fn();
  imgs.push(im);
}
console.log(writeSheet(out, imgs, { scale: 5, gap: 10, cols: 8 }));
