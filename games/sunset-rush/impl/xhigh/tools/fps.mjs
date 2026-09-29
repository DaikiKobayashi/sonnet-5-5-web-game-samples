// 各ステージで高速走行中の rAF 間隔(fps)を測る
import { open } from './lib.mjs';

for (const stage of [1, 2, 3]) {
  const g = await open({
    query: `debug=1&seed=42&stage=${stage}`,
    init: `window.__ft = []; const o = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => o((t) => { const s = performance.now(); cb(t); window.__ft.push(performance.now() - s); });`,
  });
  await g.press('Enter');
  await g.waitScene('playing', 6000);
  await g.dbg('setTime', 99);
  await g.dbg('setSpeedKmh', 250);
  await g.down('ArrowUp');
  const r = await g.page.evaluate(() => new Promise((res) => {
    const ts = [];
    const f = (t) => { ts.push(t); if (ts.length < 240) requestAnimationFrame(f); else res(ts); };
    requestAnimationFrame(f);
  }));
  const d = r.slice(1).map((t, i) => t - r[i]).sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  console.log(`stage ${stage}: avg ${avg.toFixed(2)}ms p95 ${d[Math.floor(d.length * 0.95)].toFixed(1)}ms max ${d[d.length - 1].toFixed(1)}ms`);
  const ft = (await g.page.evaluate(() => window.__ft.slice(-200))).sort((a, b) => a - b);
  console.log(`   frame() cost: avg ${(ft.reduce((a, b) => a + b, 0) / ft.length).toFixed(2)}ms p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(2)}ms max ${ft[ft.length - 1].toFixed(2)}ms`);
  await g.close();
}
