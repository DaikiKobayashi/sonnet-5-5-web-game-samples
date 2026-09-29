/* Headless simulation of the ghost AI (logic only, no browser):  node tools/sim-ghost.js */
'use strict';
const path = require('path');
global.window = undefined;
const dist = path.join(__dirname, '..', 'dist', 'js');
['util.js', 'level.js', 'game.js'].forEach((f) => {
  if (f === 'game.js') { globalThis.DM.Font = { texts: [] }; }
  require(path.join(dist, f));
});
const DM = globalThis.DM, G = DM.Game;

function trial(seed, gx, gy, secs) {
  G.init({ seed, stage: 1, debug: true });
  G.startNewGame();
  for (let i = 0; i < 120; i++) G.update(1 / 60);
  G.debug.godMode(true);
  G.debug.clearBlocks();
  G.debug.killAllEnemies();
  for (let i = 0; i < 40; i++) G.update(1 / 60);
  G.debug.spawnEnemy('ghost', gx, gy);
  const out = [];
  for (let i = 0; i < secs * 60; i++) {
    G.update(1 / 60);
    const e = G.enemies.find((q) => q.type === 'ghost');
    out.push(Math.abs(e.x - G.player.x) + Math.abs(e.y - G.player.y));
  }
  return out;
}

[[5, 3], [7, 1], [3, 5], [5, 5], [1, 7], [7, 3]].forEach(([gx, gy]) => {
  const N = 200, secs = 6;
  const sum = new Array(secs * 60).fill(0);
  let closerAt25 = 0, closerAvg = 0, minLt2 = 0;
  for (let s = 0; s < N; s++) {
    const tr = trial(1000 + s * 17, gx, gy, secs);
    tr.forEach((d, i) => { sum[i] += d; });
    const d0 = Math.abs(gx - 1) + Math.abs(gy - 1);
    if (tr[150] < d0) closerAt25++;
    const avg = tr.slice(60, 240).reduce((a, b) => a + b, 0) / 180;
    if (avg < d0) closerAvg++;
    if (Math.min.apply(null, tr) < 1.5) minLt2++;
  }
  const d0 = Math.abs(gx - 1) + Math.abs(gy - 1);
  const mean = (a, b) => (sum.slice(a, b).reduce((x, y) => x + y, 0) / (b - a) / N).toFixed(2);
  console.log(`ghost@(${gx},${gy}) d0=${d0}: mean dist 0-1s ${mean(0, 60)}  1-3s ${mean(60, 180)}  3-6s ${mean(180, 360)} | closer at 2.5s: ${closerAt25}/${N}, avg(1-4s)<d0: ${closerAvg}/${N}, reached <1.5: ${minLt2}/${N}`);
});
