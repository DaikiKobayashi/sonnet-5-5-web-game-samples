/* verify-b.js : acceptance M16-M28 (death/respawn, enemies, score/items, exit/stage flow) */
'use strict';
const L = require('./verify-lib.js');
const { ok, info, sleep, open, closePage, snap, dbg, waitState, startGame, record } = L;

async function openField(page) {
  await dbg(page, 'godMode', true);
  await dbg(page, 'clearBlocks');
  await dbg(page, 'killAllEnemies');
  await sleep(600);
}

function names(s) { return s.audio.sfxLog.map((x) => x.name); }

async function groupDeath(browser) {
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'setPowerups', { maxBombs: 3, range: 4, boots: 2 });
  /* break a rock first so we can check the field is preserved */
  let s = await snap(page);
  const enemiesBefore = s.enemies.length;
  await page.keyboard.press('Space');            // bomb at (1,1); we stay -> die at ~2.5 s
  const rec = record(page, 6200);
  await sleep(2300);
  /* while dead: try to move and place bombs */
  let deadStart = null;
  const t0 = Date.now();
  await page.waitForFunction(() => !window.__GAME__.snapshot().player.alive, null, { timeout: 4000, polling: 15 });
  s = await snap(page);
  const livesAfter = s.lives, tlAtDeath = s.timeLeft;
  ok('M16a', livesAfter === 2 && !s.player.alive, `lives 3->${livesAfter}, alive=${s.player.alive}`);
  ok('M17a', s.player.maxBombs === 2 && s.player.range === 3 && s.player.boots === 1, `powerups after death: bombs ${s.player.maxBombs} range ${s.player.range} boots ${s.player.boots}`);
  ok('M34-playerDie', names(s).includes('playerDie'), 'sfxLog has playerDie');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await sleep(500);
  s = await snap(page);
  ok('M16b', s.player.x === 1 && s.player.y === 1 && s.bombs.length === 0, `no movement/bomb while dead: (${s.player.x},${s.player.y}) bombs=${s.bombs.length}`);
  ok('M16c', Math.abs(s.timeLeft - tlAtDeath) < 0.001, `timeLeft frozen during death anim: ${tlAtDeath.toFixed(3)} -> ${s.timeLeft.toFixed(3)}`);
  const data = await rec;
  const dIdx = data.findIndex((d) => !d.alive);
  const rIdx = data.findIndex((d, i) => i > dIdx && d.alive);
  const deathLen = (data[rIdx].t - data[dIdx].t) / 1000;
  ok('M16d', deathLen > 1.1 && deathLen < 1.35, 'death animation lasted ' + deathLen.toFixed(3) + 's');
  const inv = data[rIdx];
  ok('M17b', Math.abs(inv.px - 1) < 1e-9 && Math.abs(inv.py - 1) < 1e-9 && inv.face === 'down' && inv.inv > 1.85 && inv.inv <= 2.0, `respawn at (${inv.px},${inv.py}) facing ${inv.face} invincible=${inv.inv.toFixed(3)}`);
  const invEnd = data.find((d, i) => i > rIdx && d.inv === 0);
  ok('M17c', invEnd && (invEnd.t - inv.t) / 1000 > 1.85 && (invEnd.t - inv.t) / 1000 < 2.15, 'invincibility lasted ' + (invEnd ? ((invEnd.t - inv.t) / 1000).toFixed(3) : 'n/a') + 's');
  s = await snap(page);
  ok('M17d', s.enemies.length === enemiesBefore && s.state === 'playing', 'field preserved (enemies ' + enemiesBefore + '->' + s.enemies.length + ')');
  await closePage(page);

  /* M17e: field kept: destroyed rock stays destroyed, invincible from enemy contact */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'teleport', 4, 1);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft'); await sleep(230);
  await page.keyboard.press('ArrowLeft'); await sleep(230);
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 4000, polling: 15 });
  s = await snap(page);
  const rockGone = s.grid[1][5] === '.';
  await dbg(page, 'spawnEnemy', 'slime', s.player.col, s.player.row);   // touching -> die (if flame did not kill already)
  await page.waitForFunction(() => window.__GAME__.snapshot().player.invincible > 1, null, { timeout: 5000, polling: 15 });
  s = await snap(page);
  ok('M17e', rockGone && s.grid[1][5] === '.' && s.lives < 3, `rock stays destroyed after respawn; lives=${s.lives}`);
  /* invincible: spawn slime on the player, no death for a second */
  const lv = s.lives;
  await dbg(page, 'spawnEnemy', 'slime', 1, 1);
  await sleep(1000);
  s = await snap(page);
  ok('M17f', s.lives === lv && s.player.alive, `contact with enemy while invincible: lives ${lv}->${s.lives}`);
  await closePage(page);

  /* M18: contact kills; enemy survives */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'killAllEnemies');
  await sleep(600);
  await dbg(page, 'spawnEnemy', 'slime', 1, 1);
  await sleep(300);
  s = await snap(page);
  const sl = s.enemies.filter((e) => e.type === 'slime' && e.alive);
  ok('M18', s.lives === 2 && !s.player.alive && sl.length === 1 && sl[0].hp === 1, `touching slime: lives=${s.lives} alive=${s.player.alive}; slime alive=${sl.length}`);
  await closePage(page);

  /* M19: gameOver */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'setLives', 1);
  await dbg(page, 'killAllEnemies'); await sleep(600);
  await dbg(page, 'spawnEnemy', 'slime', 1, 1);
  await waitState(page, 'gameOver', 4000);
  s = await snap(page);
  const need = ['GAME OVER', 'SCORE 000300', 'BEST  000300', 'REACHED STAGE 1', 'ENTER  RETRY', 'ESC    TITLE'];
  const miss = need.filter((t) => !s.texts.includes(t));
  ok('M19', miss.length === 0 && s.lives === 0, 'gameOver texts missing=' + JSON.stringify(miss) + ' got=' + JSON.stringify(s.texts));
  ok('M32-newrecord', s.texts.includes('NEW RECORD!'), 'NEW RECORD! shown when beating 0');
  ok('M34-gameOver', names(s).includes('gameOver'), 'sfx gameOver logged');
  await closePage(page);
}

async function speedOf(page, type, col, row, ms) {
  await dbg(page, 'spawnEnemy', type, col, row);
  const data = await record(page, ms);
  let dist = 0, tt = 0;
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1].en.find((e) => e[0] === type && e[4]), b = data[i].en.find((e) => e[0] === type && e[4]);
    if (!a || !b) continue;
    dist += Math.abs(b[1] - a[1]) + Math.abs(b[2] - a[2]);
    tt += (data[i].t - data[i - 1].t) / 1000;
  }
  return dist / tt;
}

async function groupEnemies(browser) {
  let s;
  const EXP = { slime: 2.0, bat: 3.2, ghost: 2.4, golem: 1.5 };
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await openField(page);
  const sp = {};
  for (const [t, base] of Object.entries(EXP)) {
    /* far from the player at (1,1) so the ghost stays in wander mode: manhattan >= 7 */
    sp[t] = await speedOf(page, t, 13, 9, 3000);
    ok('M20-' + t, sp[t] > base * 0.8 && sp[t] < base * 1.2, `${t} speed ${sp[t].toFixed(2)} (expect ${base})`);
    await dbg(page, 'killAllEnemies'); await sleep(500);
  }
  ok('M20-bat>slime', sp.bat > sp.slime * 1.3, 'bat is clearly faster than slime');
  /* enemies never enter walls/rocks/bombs: sample a run on the real map */
  await closePage(page);

  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  const data = await record(page, 8000);
  let bad = 0;
  const g = (await snap(page)).grid;
  data.forEach((d) => d.en.forEach((e) => {
    /* while stepping between two tiles both tiles must be free */
    const c0 = Math.floor(e[1] + 1e-9), c1 = Math.ceil(e[1] - 1e-9), r0 = Math.floor(e[2] + 1e-9), r1 = Math.ceil(e[2] - 1e-9);
    [[c0, r0], [c1, r1]].forEach(([c, r]) => { if (g[r][c] === '#') bad++; });
  }));
  ok('M20-walls', bad === 0, 'enemy positions never inside walls (violations=' + bad + ')');
  await closePage(page);

  /* M21 ghost chases (stochastic: 25% wander + no U-turn rule) -> majority of 5 trials */
  let good21 = 0; const notes21 = [];
  for (let trial = 0; trial < 5; trial++) {
    page = await open(browser, '?seed=' + (100 + trial * 31) + '&debug=1');
    await startGame(page);
    await openField(page);
    await dbg(page, 'spawnEnemy', 'ghost', 5, 3);            // manhattan distance 6 from (1,1)
    const gd = await record(page, 3000);
    const dist = (d) => { const e = d.en.find((q) => q[0] === 'ghost'); return Math.abs(e[1] - d.px) + Math.abs(e[2] - d.py); };
    const d0 = dist(gd[0]);
    const win = gd.filter((d) => d.t > 1000 && d.t < 3000).map(dist);
    const avg = win.reduce((a, b) => a + b, 0) / win.length;
    const dMin = Math.min.apply(null, gd.map(dist));
    if (avg < d0 - 1.5 && dMin < 1.5) good21++;
    notes21.push(`d0=${d0.toFixed(1)} avg(1-3s)=${avg.toFixed(1)} min=${dMin.toFixed(1)}`);
    await closePage(page);
  }
  ok('M21', good21 >= 3, `ghost closes in on the player in ${good21}/5 trials: ${notes21.join(' | ')}`);

  /* M22 golem hp, others die in one hit, death anim 0.4s */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await openField(page);
  const scoreOpen = (await snap(page)).score;
  await dbg(page, 'setPowerups', { maxBombs: 2 });
  await page.keyboard.press('Space');                       // bomb at (1,1), range 2 -> covers (2,1),(3,1)
  await page.waitForFunction(() => { const b = window.__GAME__.snapshot().bombs[0]; return b && b.timeLeft < 0.2; }, null, { timeout: 4000, polling: 10 });
  await dbg(page, 'spawnEnemy', 'golem', 3, 1);
  await dbg(page, 'spawnEnemy', 'slime', 2, 1);
  const r22 = await record(page, 1600);
  const golem = (d) => d.en.find((e) => e[0] === 'golem');
  const afterHit = r22.find((d) => d.flames.length > 0);
  const gh = golem(afterHit);
  ok('M22a', gh && gh[3] === 2 && gh[4], `golem hp 3->${gh && gh[3]} alive=${gh && gh[4]}`);
  const slimeAtBoom = afterHit.en.find((e) => e[0] === 'slime');
  ok('M22b', slimeAtBoom && slimeAtBoom[4] === false, 'slime died from a single blast (alive=false during death anim)');
  const slimeGone = r22.find((d) => d.t > afterHit.t && !d.en.find((e) => e[0] === 'slime'));
  const slimeLen = slimeGone ? (slimeGone.t - afterHit.t) / 1000 : NaN;
  ok('M22c', slimeLen > 0.3 && slimeLen < 0.55, 'slime death animation ~' + slimeLen.toFixed(3) + 's before removal');
  s = await snap(page);
  ok('M34-enemyDie/hit', names(s).includes('enemyDie') && names(s).includes('hit'), 'enemyDie and hit logged: ' + names(s).join(','));
  ok('M23-slime', s.score - scoreOpen === 100, 'slime +100 -> +' + (s.score - scoreOpen));
  await closePage(page);

  /* M22d: white-box: golem takes 3 damages with 0.8 s invulnerability after each; scores 500 at the third */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await openField(page);
  await dbg(page, 'spawnEnemy', 'golem', 9, 5);
  const flameOnGolem = () => page.evaluate(() => {
    const e = DM.Game.enemies.find((q) => q.type === 'golem' && q.alive);
    if (!e) return null;
    DM.Game.flames.push({ col: Math.round(e.x), row: Math.round(e.y), timeLeft: 0.5, kind: 'center', dir: null, age: 0 });
    return true;
  });
  const hpNow = () => page.evaluate(() => { const e = DM.Game.enemies.find((q) => q.type === 'golem'); return e ? [e.hp, e.alive, e.hitT] : null; });
  await flameOnGolem(); await sleep(60);
  let h1 = await hpNow();
  await flameOnGolem(); await sleep(60);                    // 60 ms later: must be ignored (invulnerable)
  let h1b = await hpNow();
  await sleep(900);
  await flameOnGolem(); await sleep(60);
  let h2 = await hpNow();
  await sleep(900);
  const before = (await snap(page)).score;
  await flameOnGolem(); await sleep(60);
  let h3 = await hpNow();
  s = await snap(page);
  ok('M22d', h1[0] === 2 && h1[2] > 0.6 && h1b[0] === 2 && h2[0] === 1 && h3[0] === 0 && h3[1] === false && s.score - before === 500,
    `hp sequence ${h1[0]},${h1b[0]}(ignored),${h2[0]},${h3[0]}; golem +${s.score - before}`);
  await closePage(page);

  /* M23 scores of bat/ghost via white-box flame; bomb natural for others done above */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await openField(page);
  const before2 = (await snap(page)).score;
  await dbg(page, 'spawnEnemy', 'bat', 9, 5);
  await page.evaluate(() => { const e = DM.Game.enemies.find((q) => q.type === 'bat'); DM.Game.flames.push({ col: Math.round(e.x), row: Math.round(e.y), timeLeft: 0.5, kind: 'center', dir: null, age: 0 }); });
  await sleep(80);
  const afterBat = (await snap(page)).score;
  await dbg(page, 'spawnEnemy', 'ghost', 9, 5);
  await page.evaluate(() => { const e = DM.Game.enemies.find((q) => q.type === 'ghost'); DM.Game.flames.push({ col: Math.round(e.x), row: Math.round(e.y), timeLeft: 0.5, kind: 'center', dir: null, age: 0 }); });
  await sleep(80);
  const afterGhost = (await snap(page)).score;
  ok('M23-bat/ghost', afterBat - before2 === 200 && afterGhost - afterBat === 300, `bat +${afterBat - before2}, ghost +${afterGhost - afterBat}`);
  await closePage(page);
}

async function groupItems(browser) {
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'killAllEnemies'); await sleep(600);
  let s;
  const walkTo = async (key) => { await page.keyboard.press(key); await sleep(350); };
  /* hidden item under (5,1) is 'fire' for seed 12345 stage 1 (see tools/test-level.js): bomb it */
  await dbg(page, 'teleport', 4, 1);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft'); await sleep(230);
  await page.keyboard.press('ArrowLeft'); await sleep(230);
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 4000, polling: 15 });
  s = await snap(page);
  ok('M24a', s.items.some((i) => i.type === 'fire' && i.col === 5 && i.row === 1), 'hidden item appears where the rock was: ' + JSON.stringify(s.items));
  await sleep(700);
  const sc0 = (await snap(page)).score;
  await dbg(page, 'teleport', 4, 1);
  await walkTo('ArrowRight');
  s = await snap(page);
  ok('M24b', s.player.range === 3 && s.items.length === 0 && s.score - sc0 === 50, `fire: range ${s.player.range}, +${s.score - sc0}`);
  ok('M34-item', names(s).includes('item'), 'item sfx logged');
  /* bomb / boots / life */
  await dbg(page, 'teleport', 1, 1);
  await dbg(page, 'spawnItem', 'bomb', 2, 1);
  await dbg(page, 'spawnItem', 'boots', 3, 1);
  await walkTo('ArrowRight');
  s = await snap(page);
  ok('M24c', s.player.maxBombs === 2, 'bomb item: maxBombs=' + s.player.maxBombs);
  await walkTo('ArrowRight');
  s = await snap(page);
  ok('M24d', s.player.boots === 1 && Math.abs(s.player.speed - 5.1) < 1e-9, `boots: boots=${s.player.boots} speed=${s.player.speed}`);
  await dbg(page, 'spawnItem', 'life', 3, 2);
  await dbg(page, 'teleport', 3, 1);
  await walkTo('ArrowDown');
  s = await snap(page);
  ok('M24e', s.lives === 4 && names(s).includes('life'), 'life item: lives=' + s.lives);
  /* caps */
  await dbg(page, 'setPowerups', { maxBombs: 5, range: 6, boots: 3 });
  await dbg(page, 'setLives', 5);
  await dbg(page, 'teleport', 1, 1);
  await dbg(page, 'spawnItem', 'fire', 2, 1);
  await dbg(page, 'spawnItem', 'bomb', 3, 1);
  await dbg(page, 'spawnItem', 'boots', 4, 1);
  await dbg(page, 'spawnItem', 'life', 5, 1);
  const sc1 = (await snap(page)).score;
  await page.keyboard.down('ArrowRight'); await sleep(900); await page.keyboard.up('ArrowRight'); await sleep(300);
  s = await snap(page);
  ok('M24f', s.player.range === 6 && s.player.maxBombs === 5 && s.player.boots === 3 && s.lives === 5 && s.items.length === 0 && s.score - sc1 === 200, `caps hold: range ${s.player.range} bombs ${s.player.maxBombs} boots ${s.player.boots} lives ${s.lives}, +${s.score - sc1}`);
  ok('M24g', Math.abs(s.player.speed - 6.3) < 1e-9, 'max speed 6.3: ' + s.player.speed);
  await closePage(page);
}

async function groupExit(browser) {
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  let s = await snap(page);
  ok('M25a', s.exit.revealed === false && s.exit.open === false, 'exit hidden at first');
  await dbg(page, 'revealExit');
  s = await snap(page);
  ok('M25b', s.exit.revealed === true && s.exit.open === false && s.grid[s.exit.row][s.exit.col] === '.', 'exit revealed but closed while enemies live');
  await dbg(page, 'teleport', s.exit.col, s.exit.row);
  await sleep(700);
  s = await snap(page);
  ok('M25c', s.state === 'playing', 'standing on a closed exit does nothing (state=' + s.state + ')');
  await dbg(page, 'godMode', false);
  await dbg(page, 'teleport', 1, 1);
  await sleep(100);
  const scoreBefore = (await snap(page)).score;
  await dbg(page, 'killAllEnemies');
  await sleep(100);
  s = await snap(page);
  ok('M25d', s.exit.open === true && names(s).includes('exitOpen'), 'all enemies dead -> exit.open, exitOpen logged');
  ok('M23-enemies', s.score - scoreBefore === 300, 'three slimes = +300, got ' + (s.score - scoreBefore));
  await sleep(700);
  const tlBefore = (await snap(page)).timeLeft;
  const sc = (await snap(page)).score;
  await dbg(page, 'teleport', s.exit.col, s.exit.row);
  await waitState(page, 'stageClear', 1500);
  s = await snap(page);
  const bonus = Math.floor(s.timeLeft) * 10;
  const t0 = Date.now();
  const need = ['STAGE CLEAR!', 'CLEAR BONUS +500', 'TIME BONUS +' + bonus];
  const miss = need.filter((t) => !s.texts.includes(t));
  ok('M26a', miss.length === 0 && s.score - sc === 500 + bonus, `stageClear texts missing=${JSON.stringify(miss)}; score +${s.score - sc} (expect ${500 + bonus})`);
  ok('M34-stageClear', names(s).includes('stageClear') && s.audio.bgm === null, 'stageClear sfx, bgm=' + s.audio.bgm);
  await waitState(page, 'stageIntro', 5000);
  const dt = (Date.now() - t0) / 1000;
  s = await snap(page);
  ok('M26b', dt > 2.7 && dt < 3.4 && s.stage === 2 && s.texts.includes('STAGE 2') && s.texts.includes('MUSHROOM GROTTO') && s.texts.includes('ENEMIES 5'), `stageClear lasted ${dt.toFixed(2)}s; next intro ${JSON.stringify(s.texts.slice(-3))}`);
  ok('M26c', s.lives === 3 && s.timeLeft === 150, 'lives/time carried: lives=' + s.lives + ' time=' + s.timeLeft);
  await closePage(page);
}

async function groupFullRun(browser) {
  /* M2 + M26/M27: play stages 1-5 with debug shortcuts, then gameClear, retry, gameOver via lives, retry */
  const page = await open(browser, '?seed=99&debug=1');
  await startGame(page);
  let s;
  for (let st = 1; st <= 5; st++) {
    s = await snap(page);
    if (s.stage !== st) { ok('M2-stage' + st, false, 'stage mismatch ' + s.stage); break; }
    await dbg(page, 'godMode', true);
    await dbg(page, 'killAllEnemies');
    await dbg(page, 'revealExit');
    s = await snap(page);
    await dbg(page, 'teleport', s.exit.col, s.exit.row);
    await waitState(page, 'stageClear', 2500);
    if (st < 5) { await waitState(page, 'stageIntro', 5000); await waitState(page, 'playing', 4000); }
  }
  await waitState(page, 'gameClear', 5000);
  s = await snap(page);
  const need = ['CONGRATULATIONS!', 'YOU ESCAPED THE MINE'];
  const miss = need.filter((t) => !s.texts.includes(t)).concat(['SCORE ', 'BEST  ', 'ENTER  PLAY AGAIN', 'ESC    TITLE'].filter((p) => !s.texts.some((t) => t.startsWith(p))));
  ok('M27a', miss.length === 0, 'gameClear texts missing=' + JSON.stringify(miss) + ' got ' + JSON.stringify(s.texts));
  ok('M34-gameClear', names(s).includes('gameClear'), 'gameClear sfx logged');
  /* input lock 0.6 s */
  await page.keyboard.press('Enter');
  await sleep(100);
  s = await snap(page);
  ok('M27b', s.state === 'gameClear', 'Enter ignored during the 0.6 s lock');
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(100);
  s = await snap(page);
  ok('M27c', s.state === 'stageIntro' && s.stage === 1 && s.score === 0 && s.lives === 3 && s.player.maxBombs === 1 && s.player.range === 2 && s.player.boots === 0, `new game: state=${s.state} stage=${s.stage} score=${s.score} lives=${s.lives}`);
  /* back: gameClear -> Esc -> title */
  await dbg(page, 'godMode', true);
  await waitState(page, 'playing', 4000);
  for (let st = 1; st <= 5; st++) {
    await dbg(page, 'killAllEnemies'); await dbg(page, 'revealExit');
    s = await snap(page);
    await dbg(page, 'teleport', s.exit.col, s.exit.row);
    await waitState(page, 'stageClear', 2500);
    if (st < 5) { await waitState(page, 'stageIntro', 5000); await waitState(page, 'playing', 4000); }
  }
  await waitState(page, 'gameClear', 5000);
  await sleep(700);
  await page.keyboard.press('Escape');
  await sleep(100);
  s = await snap(page);
  ok('M27d', s.state === 'title' && s.audio.bgm === 'title' && s.stage === 1, 'Esc -> title, stage=' + s.stage);
  ok('M2-fullrun', page._errors.length === 0 && page._bad.length === 0, 'errors=' + JSON.stringify(page._errors) + ' bad=' + JSON.stringify(page._bad));
  await closePage(page);
}

module.exports = { groupDeath, groupEnemies, groupItems, groupExit, groupFullRun, openField };

if (require.main === module) {
  (async () => {
    const browser = await L.launch();
    try {
      const only = process.argv[2];
      const groups = { groupDeath, groupEnemies, groupItems, groupExit, groupFullRun };
      for (const [k, fn] of Object.entries(groups)) if (!only || k === only) await fn(browser);
    } catch (e) { console.error(e); ok('runner', false, String(e)); }
    await browser.close();
    process.exit(L.summary() ? 1 : 0);
  })();
}
