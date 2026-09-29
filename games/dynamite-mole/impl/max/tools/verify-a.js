/* verify-a.js : acceptance M1-M15 (boot, layout, map generation, movement, bombs) */
'use strict';
const L = require('./verify-lib.js');
const { ok, info, sleep, open, closePage, snap, dbg, waitState, startGame, record, keysSameTick } = L;

async function groupBoot(browser) {
  /* M1 (root form) + M5 title texts + M4 layout */
  let page = await open(browser, '');
  let s = await snap(page);
  ok('M1a', s.state === 'title' && page._bad.length === 0, 'title at /dist/index.html, bad responses=' + JSON.stringify(page._bad));
  const cv = await page.evaluate(() => { const c = document.getElementById('game'); return { w: c.width, h: c.height, ir: getComputedStyle(c).imageRendering }; });
  ok('M4a', cv.w === 480 && cv.h === 416 && cv.ir === 'pixelated', JSON.stringify(cv));
  const need = ['PRESS ENTER TO START', 'HI-SCORE 000000', 'ARROWS / WASD  MOVE', 'SPACE / Z      BOMB', 'P / ESC        PAUSE', 'R              RESTART', 'M              SOUND'];
  const miss = need.filter((t) => !s.texts.includes(t));
  ok('M5', miss.length === 0, 'title texts missing=' + JSON.stringify(miss));
  ok('M2/M3-title', page._errors.length === 0, JSON.stringify(page._errors));
  await closePage(page);

  /* M4: viewports */
  for (const vp of [{ width: 1280, height: 720 }, { width: 800, height: 600 }, { width: 390, height: 844 }]) {
    page = await open(browser, '', { viewport: vp });
    const r = await page.evaluate(() => {
      const c = document.getElementById('game').getBoundingClientRect();
      const de = document.documentElement;
      return { x: c.x, y: c.y, w: c.width, h: c.height, iw: innerWidth, ih: innerHeight, sw: de.scrollWidth, sh: de.scrollHeight, bw: document.body.scrollWidth, bh: document.body.scrollHeight };
    });
    const ratio = r.w / r.h;
    const fits = r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= r.iw + 0.5 && r.y + r.h <= r.ih + 0.5;
    ok('M4-' + vp.width + 'x' + vp.height, Math.abs(ratio - 480 / 416) < 0.01 && fits && r.sw <= r.iw && r.sh <= r.ih,
      `canvas ${r.w.toFixed(1)}x${r.h.toFixed(1)} at (${r.x.toFixed(1)},${r.y.toFixed(1)}) viewport ${r.iw}x${r.ih} scroll ${r.sw}x${r.sh}`);
    await closePage(page);
  }
  /* resize follow */
  page = await open(browser, '');
  await page.setViewportSize({ width: 600, height: 500 });
  await sleep(150);
  const r2 = await page.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(); return { w: c.width, h: c.height }; });
  ok('M4-resize', r2.w <= 600 && r2.h <= 500 && Math.abs(r2.w / r2.h - 480 / 416) < 0.01 && Math.abs(r2.h - 500) < 2, JSON.stringify(r2));
  await closePage(page);

  /* M6: stage intro timing, input ignored, timer frozen */
  page = await open(browser, '');
  await page.keyboard.press('Enter');
  const t0 = Date.now();
  await waitState(page, 'stageIntro', 2000);
  s = await snap(page);
  const introTexts = ['STAGE 1', 'SHALLOW TUNNELS', 'ENEMIES 3'].filter((t) => !s.texts.includes(t));
  ok('M6a', s.state === 'stageIntro' && introTexts.length === 0, 'intro texts missing=' + JSON.stringify(introTexts));
  const tl0 = s.timeLeft, x0 = s.player.x;
  await page.keyboard.down('ArrowRight');
  await sleep(300);
  s = await snap(page);
  ok('M6b', s.player.x === x0 && s.timeLeft === tl0 && s.state === 'stageIntro', `x ${x0}->${s.player.x} timeLeft ${tl0}->${s.timeLeft}`);
  await page.keyboard.up('ArrowRight');
  await waitState(page, 'playing', 4000);
  const dt = (Date.now() - t0) / 1000;
  ok('M6c', dt > 1.5 && dt < 2.1, 'stageIntro lasted ~' + dt.toFixed(2) + 's');
  /* P during stageIntro must not pause: restart and try */
  await page.keyboard.press('KeyR');
  await waitState(page, 'stageIntro', 2000);
  await page.keyboard.press('KeyP');
  await sleep(100);
  s = await snap(page);
  ok('M30-intro', s.state === 'stageIntro', 'state after P in stageIntro = ' + s.state);
  await closePage(page);

  /* M7 HUD at start */
  page = await open(browser, '?seed=1');
  await startGame(page);
  s = await snap(page);
  const hud = ['SCORE 000000', 'HI 000000', 'TIME 2:30', 'STAGE 1/5', 'X3', 'BOMB 1', 'FIRE 2', 'SPD 0', 'SND ON'].filter((t) => !s.texts.includes(t));
  ok('M7', hud.length === 0, 'HUD missing=' + JSON.stringify(hud) + ' texts=' + JSON.stringify(s.texts));
  await closePage(page);
}

function parseGrid(g) { return g.map((r) => r.split('')); }

async function groupMap(browser) {
  const SAFE = [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3], [3, 2], [2, 3]];
  const TABLE = { 1: { slime: 3 }, 2: { slime: 3, bat: 2 }, 3: { slime: 2, bat: 2, ghost: 2 }, 4: { slime: 2, bat: 2, ghost: 2, golem: 1 }, 5: { bat: 3, ghost: 3, golem: 2 } };
  let allOk = true, allOk9 = true;
  const layouts = {};
  for (let st = 1; st <= 5; st++) {
    const page = await open(browser, `?seed=777&stage=${st}&debug=1`);
    const s = await snap(page);
    const g = s.grid;
    let good = g.length === 11 && g.every((r) => r.length === 15);
    for (let r = 0; r < 11; r++) for (let c = 0; c < 15; c++) {
      const wall = r === 0 || r === 10 || c === 0 || c === 14 || (r % 2 === 0 && c % 2 === 0);
      if (wall !== (g[r][c] === '#')) good = false;
    }
    SAFE.forEach(([c, r]) => { if (g[r][c] === 'S') good = false; });
    if (!good) allOk = false;
    const counts = {};
    s.enemies.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
    const exp = TABLE[st];
    let good9 = JSON.stringify(Object.keys(exp).sort().map((k) => [k, exp[k]])) === JSON.stringify(Object.keys(counts).sort().map((k) => [k, counts[k]]));
    const seen = new Set();
    s.enemies.forEach((e) => {
      if (Math.abs(e.col - 1) + Math.abs(e.row - 1) < 7) good9 = false;
      if (g[e.row][e.col] !== '.') good9 = false;
      const k = e.col + ',' + e.row; if (seen.has(k)) good9 = false; seen.add(k);
    });
    if (g[s.exit.row][s.exit.col] !== 'S') good9 = false;
    if (!good9) allOk9 = false;
    ok('M8-stage' + st, good, 'grid valid');
    ok('M9-stage' + st, good9, JSON.stringify(counts) + ' exit=' + s.exit.col + ',' + s.exit.row);
    layouts[st] = JSON.stringify({ g: s.grid, e: s.exit, en: s.enemies.map((e) => [e.type, e.col, e.row]) });
    await closePage(page);
  }
  /* M10 reproducibility */
  let same = true;
  for (let st = 1; st <= 5; st++) {
    const page = await open(browser, `?seed=777&stage=${st}&debug=1`);
    const s = await snap(page);
    const again = JSON.stringify({ g: s.grid, e: s.exit, en: s.enemies.map((e) => [e.type, e.col, e.row]) });
    if (again !== layouts[st]) same = false;
    await closePage(page);
  }
  ok('M10a', same, 'same seed -> identical grid/exit/enemies for stages 1-5 after reload');
  const p1 = await open(browser, '?seed=1'), p2 = await open(browser, '?seed=2');
  const a = (await snap(p1)).grid.join(''), b = (await snap(p2)).grid.join('');
  ok('M10b', a !== b, 'different seeds differ');
  await closePage(p1); await closePage(p2);
  /* stage 2+ reproducible through a real run: play to stage 2 with debug and compare with ?stage=2 */
  const pg = await open(browser, '?seed=4242&debug=1');
  await startGame(pg);
  await dbg(pg, 'killAllEnemies');
  await dbg(pg, 'revealExit');
  const ex = (await snap(pg)).exit;
  await dbg(pg, 'teleport', ex.col, ex.row);
  await waitState(pg, 'stageClear', 2000);
  await waitState(pg, 'stageIntro', 5000);
  const viaRun = await snap(pg);
  const pg2 = await open(browser, '?seed=4242&stage=2&debug=1');
  const direct = await snap(pg2);
  ok('M10c', viaRun.stage === 2 && JSON.stringify(viaRun.grid) === JSON.stringify(direct.grid) && JSON.stringify(viaRun.exit) === JSON.stringify(direct.exit)
    && JSON.stringify(viaRun.enemies.map((e) => [e.type, e.col, e.row])) === JSON.stringify(direct.enemies.map((e) => [e.type, e.col, e.row])),
    'stage 2 reached in a run equals ?stage=2 with the same seed');
  await closePage(pg); await closePage(pg2);
  ok('M8/9-all', allOk && allOk9, '');
}

/* a fully open field: no rocks, god mode, all enemies removed (exit stays where it is) */
async function openField(page) {
  await dbg(page, 'godMode', true);
  await dbg(page, 'clearBlocks');
  await dbg(page, 'killAllEnemies');
  await sleep(600);
}

async function groupMove(browser) {
  let s;
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  /* M11 continuous movement speed */
  let rec = record(page, 900);
  await sleep(100);
  await page.keyboard.down('ArrowRight');
  await sleep(500);
  await page.keyboard.up('ArrowRight');
  let data = await rec;
  const xs = data.map((d) => [d.t, d.px]);
  function tAt(x) {
    for (let i = 1; i < xs.length; i++) if (xs[i - 1][1] < x && xs[i][1] >= x) return xs[i - 1][0] + (xs[i][0] - xs[i - 1][0]) * (x - xs[i - 1][1]) / (xs[i][1] - xs[i - 1][1]);
    return null;
  }
  const tA = tAt(1.4), tB = tAt(2.4);
  const per = tA != null && tB != null ? tB - tA : NaN;
  const mids = xs.filter((p) => p[1] > 1.05 && p[1] < 1.95).length;
  ok('M11a', per > 178 && per < 267, `one tile takes ${per.toFixed(0)} ms (expect ~222)`);
  ok('M11b', mids > 3, 'intermediate x values seen: ' + mids);
  await sleep(300);
  s = await snap(page);
  ok('M11c', Number.isInteger(s.player.x) && Number.isInteger(s.player.y), `stopped at centre (${s.player.x},${s.player.y}) after key release`);
  const finalX = s.player.x;
  ok('M11d', finalX >= 3, 'moved right at least 2 tiles, x=' + finalX);

  /* walls: from (1,1) go up/left -> blocked; teleport next to pillar */
  await dbg(page, 'teleport', 1, 1);
  await page.keyboard.down('ArrowUp'); await sleep(250); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowLeft'); await sleep(250); await page.keyboard.up('ArrowLeft');
  s = await snap(page);
  ok('M11e', s.player.x === 1 && s.player.y === 1 && s.player.facing === 'left', `blocked by outer wall, facing=${s.player.facing}`);
  await dbg(page, 'teleport', 1, 1);
  await page.keyboard.down('ArrowRight'); await sleep(200); await page.keyboard.up('ArrowRight'); await sleep(250);
  await page.keyboard.down('ArrowDown'); await sleep(250); await page.keyboard.up('ArrowDown'); await sleep(200);
  s = await snap(page);
  ok('M11f', s.player.x === 2 && s.player.y === 1, `blocked by pillar (2,2): at (${s.player.x},${s.player.y})`);
  /* rock: find an S adjacent to a free tile */
  s = await snap(page);
  let found = null;
  for (let r = 1; r < 10 && !found; r++) for (let c = 1; c < 13 && !found; c++) {
    if (s.grid[r][c] === '.' && s.grid[r][c + 1] === 'S' && !(r % 2 === 0 && c % 2 === 0)) found = [c, r];
  }
  if (found) {
    /* teleport moves us next to a rock (rock left intact because target tile is free) */
    await dbg(page, 'teleport', found[0], found[1]);
    await page.keyboard.down('ArrowRight'); await sleep(300); await page.keyboard.up('ArrowRight');
    s = await snap(page);
    ok('M11g', s.player.x === found[0] && s.player.y === found[1], `blocked by rock at ${found[0] + 1},${found[1]}`);
  } else ok('M11g', false, 'no rock found');

  /* M12 tap */
  await dbg(page, 'teleport', 1, 1);
  await sleep(100);
  await page.keyboard.press('ArrowRight');
  await sleep(500);
  s = await snap(page);
  ok('M12a', s.player.x === 2 && s.player.y === 1, `tap moves exactly one tile: (${s.player.x},${s.player.y})`);
  await page.keyboard.press('ArrowRight');
  await sleep(500);
  s = await snap(page);
  ok('M12b', s.player.x === 3, 'second tap: x=' + s.player.x);
  /* tap issued mid-step is remembered */
  await dbg(page, 'teleport', 1, 1);
  await sleep(100);
  await page.keyboard.down('ArrowRight');
  await sleep(60);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('ArrowDown');       // pressed while the right step is running, released at once
  await sleep(600);
  s = await snap(page);
  ok('M12c', s.player.x === 2 && s.player.y === 2 || (s.player.x === 2 && s.player.y === 1), `buffered tap; at (${s.player.x},${s.player.y})`);
  /* two keys: last pressed wins (same tick) */
  await dbg(page, 'teleport', 1, 3);
  await sleep(100);
  await keysSameTick(page, [['keydown', 'ArrowRight'], ['keydown', 'ArrowDown']]);
  await sleep(120);
  await keysSameTick(page, [['keyup', 'ArrowRight'], ['keyup', 'ArrowDown']]);
  await sleep(300);
  s = await snap(page);
  ok('M12d', s.player.y === 4 && s.player.x === 1, `Right then Down pressed together -> went down: (${s.player.x},${s.player.y})`);
  await dbg(page, 'teleport', 1, 3);
  await sleep(100);
  await keysSameTick(page, [['keydown', 'ArrowDown'], ['keydown', 'ArrowRight']]);
  await sleep(120);
  await keysSameTick(page, [['keyup', 'ArrowRight'], ['keyup', 'ArrowDown']]);
  await sleep(300);
  s = await snap(page);
  ok('M12e', s.player.x === 2 && s.player.y === 3, `Down then Right pressed together -> went right: (${s.player.x},${s.player.y})`);
  /* WASD */
  await dbg(page, 'teleport', 1, 1);
  await sleep(100);
  await page.keyboard.press('KeyD'); await sleep(400);
  s = await snap(page);
  ok('M11h', s.player.x === 2, 'WASD: D moves right');
  await closePage(page);
}

async function groupBomb(browser) {
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  let s;
  /* M13 place (Space) */
  let rec = record(page, 3300);
  await sleep(150);
  await page.keyboard.press('Space');
  await sleep(120);
  await page.keyboard.press('Space');          // 2nd bomb must not appear (maxBombs 1)
  await page.keyboard.press('KeyZ');
  await sleep(100);
  await page.keyboard.press('ArrowRight');     // walk away
  await sleep(500);
  await page.keyboard.press('ArrowLeft');      // try to come back
  await sleep(500);
  let data = await rec;
  const first = data.find((d) => d.bombs.length > 0);
  const maxB = Math.max.apply(null, data.map((d) => d.bombs.length));
  ok('M13a', first && first.bombs[0][0] === 1 && first.bombs[0][1] === 1 && first.bombs[0][2] > 2.3 && first.bombs[0][2] <= 2.5, 'bomb at (1,1) timeLeft=' + (first && first.bombs[0][2].toFixed(3)));
  ok('M13b', maxB === 1, 'max simultaneous bombs = ' + maxB);
  const lastX = data[Math.floor(data.length * 0.6)].px;
  ok('M13c', lastX === 2, 'cannot walk back onto own bomb: x=' + lastX);
  /* M14 timing */
  const tPlace = first.t;
  const tBoom = data.find((d) => d.flames.length > 0);
  const boomDelay = tBoom ? (tBoom.t - tPlace) / 1000 : NaN;
  ok('M14a', boomDelay > 2.2 && boomDelay < 2.8, 'real-time fuse = ' + boomDelay.toFixed(3) + 's');
  const cells = new Set(tBoom.flames.map((f) => f[0] + ',' + f[1]));
  const exp = ['1,1', '2,1', '3,1', '1,2', '1,3'];
  ok('M14b', exp.every((c) => cells.has(c)) && cells.size === exp.length, 'flame cells ' + JSON.stringify([...cells]));
  const gone = data.find((d) => d.t > tBoom.t && d.flames.length === 0);
  const flameLife = gone ? (gone.t - tBoom.t) / 1000 : NaN;
  ok('M14c', flameLife > 0.35 && flameLife < 0.65, 'flame life = ' + flameLife.toFixed(3) + 's');
  await closePage(page);

  /* M14 rock: bomb next to a rock destroys it and stops there */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  s = await snap(page);
  /* row 1 of seed 12345 stage 1 is "#....S.S..S...#": rock at (5,1); tile (7,1) also rock */
  const rockAt = s.grid[1][5] === 'S';
  await dbg(page, 'teleport', 4, 1);
  await sleep(80);
  rec = record(page, 3600);
  await sleep(50);
  await page.keyboard.press('Space');
  await sleep(100);
  await page.keyboard.press('ArrowLeft'); await sleep(230);   // leave to (3,1)
  await page.keyboard.press('ArrowLeft'); await sleep(230);
  data = await rec;
  const boom = data.find((d) => d.flames.length > 0);
  s = await snap(page);
  const fc = boom ? boom.flames.map((f) => f[0] + ',' + f[1]) : [];
  ok('M14d', rockAt && s.grid[1][5] === '.' && fc.includes('5,1') && !fc.includes('6,1'), 'rock (5,1) destroyed and flame stops there; flames=' + JSON.stringify(fc));
  ok('M14e', fc.every((c) => { const [cc, rr] = c.split(',').map(Number); return !(rr === 0 || rr === 10 || cc === 0 || cc === 14 || (rr % 2 === 0 && cc % 2 === 0)); }), 'no flame on any wall tile');
  ok('M23a', s.score === 10, 'rock gives +10 -> score=' + s.score);
  await closePage(page);

  /* M15 chain reaction */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'clearBlocks');
  await dbg(page, 'setPowerups', { maxBombs: 2 });
  await dbg(page, 'teleport', 3, 1);
  await sleep(80);
  rec = record(page, 3800);
  await sleep(50);
  await page.keyboard.press('Space');          // bomb A at (3,1)
  await sleep(300);
  await page.keyboard.press('ArrowRight'); await sleep(250);   // (4,1)
  await page.keyboard.press('Space');          // bomb B at (4,1), inside A's range (2)
  await sleep(100);
  await page.keyboard.press('ArrowRight'); await sleep(230);
  data = await rec;
  const firstBoom = data.findIndex((d) => d.flames.length > 0);
  const before = data[firstBoom - 1];
  const at = data[firstBoom];
  ok('M15a', before && before.bombs.length === 2 && at.bombs.length === 0, `both bombs vanish in one frame (bombs ${before && before.bombs.length}->${at.bombs.length})`);
  ok('M15b', before.bombs.some((b) => b[2] > 0.25), 'chained bomb still had fuse left: ' + JSON.stringify(before.bombs.map((b) => +b[2].toFixed(2))));
  const cells2 = new Set(at.flames.map((f) => f[0] + ',' + f[1]));
  ok('M15c', cells2.has('6,1') && cells2.has('2,1') && cells2.has('1,1'), 'B (range 2) flames at 6,1 exist in the same frame: ' + JSON.stringify([...cells2]));
  await closePage(page);
}

module.exports = { groupBoot, groupMap, groupMove, groupBomb, openField };

if (require.main === module) {
  (async () => {
    const browser = await L.launch();
    try {
      await groupBoot(browser);
      await groupMap(browser);
      await groupMove(browser);
      await groupBomb(browser);
    } catch (e) { console.error(e); ok('runner', false, String(e)); }
    await browser.close();
    process.exit(L.summary() ? 1 : 0);
  })();
}
