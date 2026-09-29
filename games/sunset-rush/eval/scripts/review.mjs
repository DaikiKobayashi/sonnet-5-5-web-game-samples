// 目視判定用のまとめ画像(実装ごとのレビューシート、5 実装を並べた比較シート)を作る
import fs from 'fs';
import path from 'path';
import { EFFORTS, EVAL_DIR } from './config.mjs';
import { launch, contactSheet } from './lib.mjs';

const b = await launch();
const pg = await (await b.newContext()).newPage();
const dir = (e) => path.join(EVAL_DIR, 'screenshots', e);
const load = (e, f) => { const p = path.join(dir(e), f); return fs.existsSync(p) ? 'data:image/png;base64,' + fs.readFileSync(p).toString('base64') : null; };
const SETS = {
  'review-a-countdown': ['raw-m05-countdown-500.png', 'raw-m05-countdown-1500.png', 'raw-m05-countdown-2500.png', 'raw-m06-go-300.png', 'raw-m06-go-1200.png', 'raw-w-trans-cd-0.png', 'raw-w-trans-cd-100.png', 'raw-w-trans-cd-300.png'],
  'review-c-roadside': ['raw-m20-s1-20.png', 'raw-m20-s1-50.png', 'raw-m20-s1-80.png', 'raw-m20-s2-20.png', 'raw-m20-s2-50.png', 'raw-m20-s2-80.png', 'raw-m20-s3-20.png', 'raw-m20-s3-50.png', 'raw-m20-s3-80.png', 'raw-b3-s3-run-10s.png'],
  'review-d-clear': ['raw-m24-gate.png', 'raw-m24-clear-1200.png', 'raw-m24-clear-1800.png', 'raw-w-s1-clear-1500.png', 'raw-w-s1-clear-1600.png', 'raw-w-s1-clear-1700.png', 'raw-w-s3-clear-2200.png', 'raw-w-ending.png', 'raw-w-s2start-500.png', 'raw-m26-s1-run2s.png', 'raw-m26-s2-run2s.png', 'raw-m26-s3-run2s.png'],
  'review-e-cp': ['raw-m22-gate.png', 'raw-m22-cp-300.png', 'raw-m22-cp-1900.png', 'raw-m22-cp-2400.png', 'raw-m23-timeup-500.png', 'raw-m23-gameover-500.png', 'raw-m32-gameover-newbest.png', 'raw-m32-title-best.png'],
  'review-f-hud': ['raw-m33-hud.png', 'raw-m28-paused-hud.png', 'raw-m29-paused-KeyP.png', 'raw-m29-paused-Escape.png', 'raw-m31-sound-on.png', 'raw-m31-sound-off.png', 'raw-m12-offroad-1500.png', 'raw-s10-offroad-dust.png'],
  'review-g-fx': ['raw-s06-200kmh.png', 'raw-s06-280kmh.png', 'raw-s13-overtake-100.png', 'raw-s07-overtake-0.png', 'raw-s07-overtake-1.png', 'raw-s07-overtake-2.png', 'raw-m18-crash-50ms.png', 'raw-m19-crash-50ms.png', 'raw-m14-run-0.png', 'raw-m14-run-500.png'],
};
for (const e of EFFORTS) {
  for (const [name, files] of Object.entries(SETS)) {
    const items = files.map((f) => ({ d: load(e, f), label: f.replace('raw-', '').replace('.png', '') })).filter((x) => x.d);
    if (items.length) await contactSheet(pg, items, 2, 640, path.join(dir(e), name + '.png'));
  }
}
// 5 実装の比較シート(同じ条件の画像を縦に並べる)
const CMP = ['raw-m04-title-0.5s.png', 'raw-m13-s1-right.png', 'raw-m13-s1-crest.png', 'raw-m20-s1-50.png', 'raw-m20-s2-50.png', 'raw-m20-s3-50.png', 'raw-w-s1-clear-2200.png', 'raw-w-ending.png', 'raw-m33-hud.png', 'raw-m23-gameover-500.png', 'raw-m05-countdown-1500.png', 'raw-b3-s3-run-30s.png', 'raw-m29-paused-KeyP.png', 'raw-m24-clear-1200.png'];
fs.mkdirSync(path.join(EVAL_DIR, 'screenshots', 'compare'), { recursive: true });
for (const f of CMP) {
  const items = EFFORTS.map((e) => ({ d: load(e, f), label: e })).filter((x) => x.d);
  if (items.length) await contactSheet(pg, items, 2, 640, path.join(EVAL_DIR, 'screenshots', 'compare', 'cmp-' + f.replace('raw-', '')));
}
await b.close();
console.log('done');
