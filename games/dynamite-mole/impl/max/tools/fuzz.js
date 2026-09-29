/* node tools/fuzz.js [seconds=60] [seed=1]
 * Random key mashing + random debug calls for a while; fails on any console error / exception, NaN, or invalid state. */
'use strict';
const L = require('./verify-lib.js');
const { ok, sleep, open, closePage } = L;

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

(async () => {
  const secs = parseInt(process.argv[2] || '60', 10), seed = parseInt(process.argv[3] || '1', 10);
  const R = rng(seed * 7919 + 13);
  const browser = await L.launch();
  const page = await open(browser, `?seed=${seed}&debug=1&stage=${1 + (seed % 5)}`);
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyZ', 'Space', 'KeyZ', 'Enter'];
  const rare = ['KeyP', 'Escape', 'KeyR', 'KeyM'];
  const types = ['slime', 'bat', 'ghost', 'golem'], items = ['fire', 'bomb', 'boots', 'life'];
  const t0 = Date.now();
  let steps = 0, bad = [];
  const check = async () => {
    const s = await page.evaluate(() => window.__GAME__.snapshot());
    const nums = [s.timeLeft, s.score, s.lives, s.player.x, s.player.y, s.player.speed];
    if (!nums.every(Number.isFinite)) bad.push('NaN in snapshot ' + JSON.stringify(nums));
    if (s.player.x < 0 || s.player.x > 14 || s.player.y < 0 || s.player.y > 10) bad.push('player out of bounds');
    if (s.grid[Math.round(s.player.y)][Math.round(s.player.x)] === '#') bad.push('player inside a wall at ' + s.player.x + ',' + s.player.y);
    s.enemies.forEach((e) => { if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || s.grid[e.row][e.col] === '#') bad.push('enemy invalid ' + JSON.stringify(e)); });
    if (s.lives < 0 || s.lives > 5 || s.player.maxBombs < 1 || s.player.maxBombs > 5 || s.player.range < 2 || s.player.range > 6 || s.player.boots < 0 || s.player.boots > 3) bad.push('stat out of range');
    if (s.bombs.length > s.player.maxBombs + 5) bad.push('too many bombs');
    return s;
  };
  while (Date.now() - t0 < secs * 1000) {
    const r = R();
    if (r < 0.62) await page.keyboard.press(keys[Math.floor(R() * keys.length)]);
    else if (r < 0.70) { const k = keys[Math.floor(R() * 8)]; await page.keyboard.down(k); await sleep(30 + R() * 250); await page.keyboard.up(k); }
    else if (r < 0.76) await page.keyboard.press(rare[Math.floor(R() * rare.length)]);
    else if (r < 0.90) {
      const fn = ['godMode', 'setLives', 'setTimeLeft', 'setPowerups', 'teleport', 'spawnEnemy', 'spawnItem', 'clearBlocks', 'killAllEnemies', 'revealExit'][Math.floor(R() * 10)];
      const c = 1 + Math.floor(R() * 13), rr = 1 + Math.floor(R() * 9);
      const args = { godMode: [R() < 0.5], setLives: [1 + Math.floor(R() * 5)], setTimeLeft: [R() < 0.5 ? 3 + R() * 5 : 20 + R() * 120], setPowerups: [{ maxBombs: 1 + Math.floor(R() * 5), range: 2 + Math.floor(R() * 5), boots: Math.floor(R() * 4) }],
        teleport: [c, rr], spawnEnemy: [types[Math.floor(R() * 4)], c, rr], spawnItem: [items[Math.floor(R() * 4)], c, rr], clearBlocks: [], killAllEnemies: [], revealExit: [] }[fn];
      if ((fn === 'clearBlocks' || fn === 'killAllEnemies') && R() < 0.7) continue;
      await page.evaluate(([f, a]) => { try { window.__GAME__.debug[f](...a); } catch (e) { throw e; } }, [fn, args]);
    } else await sleep(20 + R() * 120);
    steps++;
    if (steps % 25 === 0) await check();
    await sleep(8 + R() * 40);
  }
  const final = await check();
  ok('fuzz-errors', page._errors.length === 0 && page._bad.length === 0, `${steps} random actions in ${secs}s (seed ${seed}); errors=${JSON.stringify(page._errors)} bad=${JSON.stringify(page._bad)}`);
  ok('fuzz-state', bad.length === 0, 'invalid states seen: ' + JSON.stringify(bad.slice(0, 3)));
  console.log('final state:', final.state, 'stage', final.stage, 'score', final.score, 'lives', final.lives);
  await closePage(page);
  await browser.close();
  process.exit(L.summary() ? 1 : 0);
})();
