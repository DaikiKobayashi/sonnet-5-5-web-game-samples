/* verify-c.js : acceptance M1(deep), M3, M29-M35, M38-M40 (+ some Should) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const L = require('./verify-lib.js');
const { ok, info, sleep, open, closePage, snap, dbg, waitState, startGame, record, keysSameTick } = L;

const names = (s) => s.audio.sfxLog.map((x) => x.name);

async function groupTimer(browser) {
  let page = await open(browser, '?seed=5&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  const data = await record(page, 3300);
  const a = data.find((d) => d.t > 200), b = data[data.length - 1];
  const dTl = a.tl - b.tl, dT = (b.t - a.t) / 1000;
  ok('M29a', Math.abs(dTl - dT) < 0.1 * dT, `timer dropped ${dTl.toFixed(3)} in ${dT.toFixed(3)} real seconds`);
  let s = await snap(page);
  ok('M29b', s.texts.includes('TIME 2:26') || s.texts.includes('TIME 2:27'), 'TIME text = ' + s.texts.find((t) => t.startsWith('TIME')));
  await dbg(page, 'godMode', false);
  await dbg(page, 'setTimeLeft', 127.3);
  await sleep(100);
  s = await snap(page);
  ok('M29c', s.texts.includes('TIME 2:08'), 'ceil(127.2) -> ' + s.texts.find((t) => t.startsWith('TIME')));
  /* time up */
  await dbg(page, 'setTimeLeft', 1.5);
  const lv = (await snap(page)).lives;
  await page.waitForFunction(() => !window.__GAME__.snapshot().player.alive, null, { timeout: 4000, polling: 15 });
  s = await snap(page);
  ok('M29d', s.lives === lv - 1 && s.timeLeft === 0, `time-up death: lives ${lv}->${s.lives}, timeLeft=${s.timeLeft}`);
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive, null, { timeout: 3000, polling: 15 });
  s = await snap(page);
  ok('M29e', s.timeLeft > 59 && s.timeLeft <= 60 && s.texts.includes('TIME 1:00'), `respawn resets timer: ${s.timeLeft.toFixed(2)} ${s.texts.find((t) => t.startsWith('TIME'))}`);
  /* time-up ignores respawn invincibility */
  await dbg(page, 'setTimeLeft', 0.5);
  await page.waitForFunction(() => !window.__GAME__.snapshot().player.alive, null, { timeout: 3000, polling: 15 });
  s = await snap(page);
  ok('M29f', !s.player.alive || s.lives < lv - 1, 'time-up kills even while invincible (lives=' + s.lives + ')');
  await closePage(page);
  /* lives 1 -> gameOver */
  page = await open(browser, '?seed=5&debug=1');
  await startGame(page);
  await dbg(page, 'setLives', 1);
  await dbg(page, 'setTimeLeft', 1);
  await waitState(page, 'gameOver', 4000);
  s = await snap(page);
  ok('M29g', s.state === 'gameOver' && s.lives === 0, 'time-up at 1 life -> gameOver');
  await closePage(page);
  /* damage does not reset the timer: die by bomb, timer continues */
  page = await open(browser, '?seed=5&debug=1');
  await startGame(page);
  await dbg(page, 'killAllEnemies');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__GAME__.snapshot().player.alive, null, { timeout: 4000, polling: 15 });
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive, null, { timeout: 3000, polling: 15 });
  s = await snap(page);
  ok('M29h', s.timeLeft < 148 && s.timeLeft > 140, 'flame death keeps the timer running: ' + s.timeLeft.toFixed(1));
  await closePage(page);
}

async function groupPause(browser) {
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  await page.keyboard.press('Space');
  await sleep(500);
  let s = await snap(page);
  await page.keyboard.press('KeyP');
  await sleep(150);
  s = await snap(page);
  const need = ['PAUSED', 'P / ESC  RESUME', 'R  RESTART', 'M  SOUND'];
  ok('M30a', s.state === 'paused' && need.every((t) => s.texts.includes(t)) && names(s).includes('pause'), 'paused overlay texts, pause sfx; missing=' + JSON.stringify(need.filter((t) => !s.texts.includes(t))));
  ok('M33-paused', s.audio.bgm === 'stage1', 'bgm stays while paused: ' + s.audio.bgm);
  const snapA = await snap(page);
  await sleep(3000);
  const snapB = await snap(page);
  const same = snapA.timeLeft === snapB.timeLeft && JSON.stringify(snapA.bombs) === JSON.stringify(snapB.bombs) && JSON.stringify(snapA.enemies) === JSON.stringify(snapB.enemies) && JSON.stringify(snapA.player) === JSON.stringify(snapB.player);
  ok('M30b', same, `3 s paused: timeLeft ${snapA.timeLeft.toFixed(3)}->${snapB.timeLeft.toFixed(3)}; bomb ${snapA.bombs[0] && snapA.bombs[0].timeLeft.toFixed(3)}->${snapB.bombs[0] && snapB.bombs[0].timeLeft.toFixed(3)}`);
  await page.keyboard.press('Escape');
  await sleep(120);
  s = await snap(page);
  ok('M30c', s.state === 'playing' && snapB.timeLeft - s.timeLeft < 0.3 && snapB.timeLeft - s.timeLeft >= 0, `resumed with Esc; no time jump (${(snapB.timeLeft - s.timeLeft).toFixed(3)} s)`);
  await sleep(500);
  const s3 = await snap(page);
  ok('M30d', s3.timeLeft < s.timeLeft, 'timer runs again after resume');
  /* Escape pauses, P resumes */
  await page.keyboard.press('Escape'); await sleep(100);
  const p1 = (await snap(page)).state;
  await page.keyboard.press('KeyP'); await sleep(100);
  const p2 = (await snap(page)).state;
  ok('M30e', p1 === 'paused' && p2 === 'playing', `Esc pauses (${p1}); P resumes (${p2})`);
  await closePage(page);
}

async function groupRestart(browser) {
  let page = await open(browser, '?seed=777&stage=3&debug=1');
  const grid0 = (await snap(page)).grid.join('|');
  await startGame(page);
  await dbg(page, 'killAllEnemies'); await sleep(500);
  await dbg(page, 'setPowerups', { maxBombs: 3, range: 4, boots: 2 });
  await dbg(page, 'clearBlocks');
  let s = await snap(page);
  ok('M31-pre', s.score > 0 && s.stage === 3, 'score before restart=' + s.score);
  await page.keyboard.press('KeyR');
  await sleep(100);
  s = await snap(page);
  ok('M31a', s.state === 'stageIntro' && s.stage === 3 && s.score === 0 && s.lives === 3 && s.player.maxBombs === 1 && s.player.range === 2 && s.player.boots === 0 && s.timeLeft === 165 && s.grid.join('|') === grid0 && s.enemies.length === 6,
    `R from playing: state=${s.state} stage=${s.stage} score=${s.score} time=${s.timeLeft} sameGrid=${s.grid.join('|') === grid0}`);
  ok('M34-start', names(s).filter((n) => n === 'start').length >= 2, 'start sfx on restart: ' + names(s).join(','));
  await waitState(page, 'playing', 3000);
  await page.keyboard.press('KeyP'); await sleep(100);
  await page.keyboard.press('KeyR'); await sleep(100);
  s = await snap(page);
  ok('M31b', s.state === 'stageIntro', 'R from paused -> ' + s.state);
  await page.keyboard.press('KeyR'); await sleep(100);
  s = await snap(page);
  ok('M31c', s.state === 'stageIntro', 'R during stageIntro restarts -> ' + s.state);
  await waitState(page, 'playing', 3000);
  await dbg(page, 'killAllEnemies'); await dbg(page, 'revealExit');
  s = await snap(page);
  await dbg(page, 'teleport', s.exit.col, s.exit.row);
  await waitState(page, 'stageClear', 2000);
  await page.keyboard.press('KeyR'); await sleep(100);
  s = await snap(page);
  ok('M31d', s.state === 'stageIntro' && s.stage === 3 && s.score === 0, `R from stageClear -> ${s.state} stage ${s.stage} score ${s.score}`);
  await waitState(page, 'playing', 3000);
  await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.3);
  await waitState(page, 'gameOver', 4000);
  await page.keyboard.press('KeyR'); await sleep(150);
  s = await snap(page);
  ok('M31e', s.state === 'gameOver', 'R within 0.6 s of gameOver is ignored');
  await sleep(600);
  await page.keyboard.press('KeyR'); await sleep(100);
  s = await snap(page);
  ok('M31f', s.state === 'stageIntro' && s.stage === 3 && s.lives === 3, 'R after lock -> ' + s.state);
  await waitState(page, 'playing', 3000);
  await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.3);
  await waitState(page, 'gameOver', 4000);
  await sleep(700);
  await page.keyboard.press('Enter'); await sleep(100);
  s = await snap(page);
  ok('M31g', s.state === 'stageIntro' && s.score === 0, 'Enter on gameOver -> new game');
  await waitState(page, 'playing', 3000);
  await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.3);
  await waitState(page, 'gameOver', 4000);
  await sleep(700);
  await page.keyboard.press('Space'); await sleep(100);
  s = await snap(page);
  ok('M31h', s.state === 'stageIntro', 'Space on gameOver -> new game');
  /* R at title does nothing */
  await closePage(page);
  page = await open(browser, '');
  await page.keyboard.press('KeyR'); await sleep(100);
  s = await snap(page);
  ok('M31i', s.state === 'title', 'R at title does nothing');
  await closePage(page);
}

async function groupSave(browser) {
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'killAllEnemies');                // +300
  await sleep(300);
  let s = await snap(page);
  const sc = s.score;
  await page.keyboard.press('KeyR');                // abandon -> saves
  await sleep(200);
  const stored = await page.evaluate(() => localStorage.getItem('dynamiteMole.hiScore'));
  ok('M32a', stored === String(sc), `R saves hi-score: stored=${stored} expect ${sc}`);
  await page.reload();
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot);
  s = await snap(page);
  ok('M32b', s.texts.includes('HI-SCORE ' + String(sc).padStart(6, '0')) && s.hiScore === sc, 'title after reload: ' + s.texts.find((t) => t.startsWith('HI-SCORE')));
  await startGame(page);
  s = await snap(page);
  ok('M32c', s.texts.includes('HI ' + String(sc).padStart(6, '0')), 'HUD HI after reload: ' + s.texts.find((t) => t.startsWith('HI ')));
  /* a worse run: no NEW RECORD */
  await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.3);
  await waitState(page, 'gameOver', 4000);
  s = await snap(page);
  ok('M32d', !s.texts.includes('NEW RECORD!') && s.texts.includes('BEST  ' + String(sc).padStart(6, '0')), 'no NEW RECORD when not beaten; BEST kept');
  await sleep(700);
  await page.keyboard.press('Enter');
  await waitState(page, 'playing', 4000);
  /* HUD HI follows current score above the record */
  await dbg(page, 'killAllEnemies'); await dbg(page, 'clearBlocks');
  await dbg(page, 'spawnItem', 'fire', 2, 1);
  await dbg(page, 'spawnEnemy', 'golem', 9, 5); await sleep(50);
  await page.evaluate(() => { const e = DM.Game.enemies.find((q) => q.type === 'golem'); e.hp = 1; DM.Game.flames.push({ col: Math.round(e.x), row: Math.round(e.y), timeLeft: 0.5, kind: 'center', dir: null, age: 0 }); });
  await sleep(100);
  s = await snap(page);
  ok('M32e', s.hiScore === Math.max(sc, s.score) && s.texts.some((t) => t.startsWith('HI ') && parseInt(t.slice(3), 10) === s.hiScore), `HUD HI=max(saved,current): hi=${s.hiScore} score=${s.score}`);
  await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.3);
  await waitState(page, 'gameOver', 4000);
  s = await snap(page);
  ok('M32f', s.score > sc ? s.texts.includes('NEW RECORD!') : true, `beating the record shows NEW RECORD! (score ${s.score} > ${sc})`);
  const st2 = await page.evaluate(() => localStorage.getItem('dynamiteMole.hiScore'));
  ok('M32g', st2 === String(Math.max(sc, s.score)), 'stored after gameOver: ' + st2);
  await closePage(page);
}

async function groupAudio(browser) {
  let page = await open(browser, '?seed=12345&debug=1');
  let s = await snap(page);
  ok('M33a', s.audio.unlocked === false && s.audio.bgm === 'title' && s.audio.muted === false, 'before input: unlocked=' + s.audio.unlocked + ' bgm=' + s.audio.bgm);
  await page.keyboard.press('Enter');
  await sleep(100);
  s = await snap(page);
  ok('M33b', s.audio.unlocked === true && s.audio.bgm === null && s.state === 'stageIntro', 'after Enter: unlocked=' + s.audio.unlocked + ' bgm=' + s.audio.bgm);
  await waitState(page, 'playing', 3000);
  s = await snap(page);
  ok('M33c', s.audio.bgm === 'stage1', 'playing -> stage1: ' + s.audio.bgm);
  await closePage(page);
  for (const st of [2, 3, 4, 5]) {
    page = await open(browser, '?stage=' + st + '&debug=1');
    await startGame(page);
    s = await snap(page);
    ok('M33-stage' + st, s.audio.bgm === 'stage' + st, 'bgm=' + s.audio.bgm);
    await closePage(page);
  }
  /* M35 mute */
  page = await open(browser, '?seed=12345&debug=1');
  await page.keyboard.press('KeyM');
  await sleep(100);
  s = await snap(page);
  ok('M35a', s.audio.muted === true && s.texts.every((t) => t !== 'SND ON') && !s.texts.includes('SND ON'), 'M at title toggles muted=' + s.audio.muted);
  await startGame(page);
  s = await snap(page);
  ok('M35b', s.audio.muted && s.texts.includes('SND OFF') && s.audio.bgm === 'stage1', 'HUD SND OFF, bgm still selected: ' + s.audio.bgm);
  await dbg(page, 'godMode', true);
  await page.keyboard.press('Space');
  await sleep(150);
  s = await snap(page);
  ok('M35c', names(s).includes('place') && s.bombs.length === 1, 'muted: game runs and sfx logged');
  await page.reload();
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot);
  s = await snap(page);
  ok('M35d', s.audio.muted === true, 'mute persists over reload');
  await startGame(page);
  s = await snap(page);
  ok('M35e', s.texts.includes('SND OFF'), 'HUD SND OFF after reload');
  await page.keyboard.press('KeyM'); await sleep(100);
  s = await snap(page);
  ok('M35f', s.audio.muted === false && s.texts.includes('SND ON'), 'M toggles back');
  await page.reload();
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.snapshot);
  s = await snap(page);
  ok('M35g', s.audio.muted === false, 'unmuted persists');
  await closePage(page);
  page = await open(browser, '?mute=1');
  s = await snap(page);
  ok('M35h', s.audio.muted === true, '?mute=1 starts muted');
  await closePage(page);
  page = await open(browser, '?mute=1', { init: () => { try { localStorage.setItem('dynamiteMole.muted', '0'); } catch (e) { /* ignore */ } } });
  s = await snap(page);
  ok('M35i', s.audio.muted === true, '?mute=1 wins over stored 0');
  await closePage(page);
  page = await open(browser, '', { init: () => { try { localStorage.setItem('dynamiteMole.muted', '1'); } catch (e) { /* ignore */ } } });
  s = await snap(page);
  ok('M35j', s.audio.muted === true, 'stored 1 restores muted');
  await closePage(page);
}

/* every required sfx name shows up during a scripted session */
async function groupSfxCoverage(browser) {
  const page = await open(browser, '?seed=12345&debug=1');
  await page.evaluate(() => {
    window.__all = [];
    const o = DM.Audio.sfx;
    DM.Audio.sfx = function (n) { window.__all.push(n); return o.apply(this, arguments); };
  });
  await startGame(page);
  await page.keyboard.press('KeyP'); await sleep(100); await page.keyboard.press('KeyP');
  await dbg(page, 'setTimeLeft', 3);              // warn ticks
  await sleep(1200);
  await dbg(page, 'setTimeLeft', 100);
  await dbg(page, 'godMode', true);
  await dbg(page, 'teleport', 4, 1);
  await page.keyboard.press('Space');            // place
  await page.keyboard.press('ArrowLeft'); await sleep(230); await page.keyboard.press('ArrowLeft'); await sleep(230);
  await page.waitForFunction(() => window.__all.indexOf('explode') >= 0, null, { timeout: 4000, polling: 20 });   // explode + break
  await sleep(700);
  await dbg(page, 'spawnItem', 'fire', 3, 1);
  await dbg(page, 'spawnItem', 'life', 2, 1);
  await dbg(page, 'teleport', 1, 1);
  await sleep(100);
  await page.keyboard.press('ArrowRight'); await sleep(300);   // life item at (2,1)
  await page.keyboard.press('ArrowRight'); await sleep(300);   // fire item at (3,1)
  await dbg(page, 'spawnEnemy', 'golem', 9, 5);
  await page.evaluate(() => { const e = DM.Game.enemies.find((q) => q.type === 'golem'); DM.Game.flames.push({ col: Math.round(e.x), row: Math.round(e.y), timeLeft: 0.5, kind: 'center', dir: null, age: 0 }); });
  await sleep(100);
  await dbg(page, 'godMode', false);
  await dbg(page, 'spawnEnemy', 'slime', 1, 1);   // playerDie (may already have died elsewhere)
  await sleep(200);
  await dbg(page, 'godMode', true);
  await page.waitForFunction(() => window.__GAME__.snapshot().player.alive, null, { timeout: 4000, polling: 20 });
  await dbg(page, 'killAllEnemies');               // enemyDie + exitOpen
  await dbg(page, 'revealExit');
  let s = await snap(page);
  await dbg(page, 'teleport', s.exit.col, s.exit.row);     // stageClear
  await waitState(page, 'stageClear', 2000);
  await page.keyboard.press('KeyR'); await sleep(100);      // start
  await waitState(page, 'playing', 3000);
  await dbg(page, 'godMode', false);
  await dbg(page, 'setLives', 1);
  await dbg(page, 'killAllEnemies'); await sleep(500);
  await dbg(page, 'spawnEnemy', 'slime', 1, 1);
  await waitState(page, 'gameOver', 4000);                 // gameOver
  const all = await page.evaluate(() => window.__all);
  const req = ['start', 'place', 'explode', 'break', 'enemyDie', 'hit', 'playerDie', 'item', 'life', 'exitOpen', 'stageClear', 'gameOver', 'pause', 'warn'];
  const missing = req.filter((n) => all.indexOf(n) < 0);
  ok('M34-all', missing.length === 0, 'missing sfx names: ' + JSON.stringify(missing) + ' seen: ' + JSON.stringify([...new Set(all)]));
  await closePage(page);
}

async function groupFramerate(browser) {
  const page = await open(browser, '?seed=12345&debug=1');
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'killAllEnemies');
  let rec = record(page, 4200);
  await sleep(150);
  await page.keyboard.press('Space');
  await sleep(200);
  await page.keyboard.down('ArrowRight'); await sleep(120); await page.keyboard.up('ArrowRight');
  const data = await rec;
  const first = data.find((d) => d.bombs.length > 0);
  const boom = data.find((d) => d.flames.length > 0);
  const fuse = boom && first ? (boom.t - first.t) / 1000 : NaN;
  ok('M38a', fuse > 2.2 && fuse < 2.8, `fuse under 4x CPU throttle: ${fuse.toFixed(3)}s`);
  const a = data.find((d) => d.t > 300), b = data[data.length - 1];
  const dTl = a.tl - b.tl, dT = (b.t - a.t) / 1000;
  ok('M38b', Math.abs(dTl - dT) < 0.1 * dT, `timer under throttle: ${dTl.toFixed(3)} vs ${dT.toFixed(3)} real seconds`);
  /* one tile under throttle */
  await dbg(page, 'teleport', 1, 1);
  await sleep(200);
  rec = record(page, 700);
  await sleep(60);
  await page.keyboard.down('ArrowDown');
  await sleep(400);
  await page.keyboard.up('ArrowDown');
  const md = await rec;
  const xs = md.map((d) => [d.t, d.py]);
  const tAt = (y) => { for (let i = 1; i < xs.length; i++) if (xs[i - 1][1] < y && xs[i][1] >= y) return xs[i - 1][0] + (xs[i][0] - xs[i - 1][0]) * (y - xs[i - 1][1]) / (xs[i][1] - xs[i - 1][1]); return null; };
  const tA = tAt(1.3), tB = tAt(2.3);
  ok('M38c', tA != null && tB != null && (tB - tA) > 178 && (tB - tA) < 267, `1 tile under throttle: ${tB != null && tA != null ? (tB - tA).toFixed(0) : 'n/a'} ms`);
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); })(); }));
  info('rAF frames in 1 s at 4x throttle: ' + fps);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await closePage(page);
}

async function groupHooks(browser) {
  let page = await open(browser, '?seed=3');
  let has = await page.evaluate(() => ({ g: typeof window.__GAME__, d: typeof window.__GAME__.debug, s: typeof window.__GAME__.snapshot }));
  ok('M40a', has.g === 'object' && has.s === 'function' && has.d === 'undefined', JSON.stringify(has));
  await closePage(page);
  page = await open(browser, '?seed=3&debug=1');
  const fns = ['killAllEnemies', 'revealExit', 'clearBlocks', 'teleport', 'setLives', 'setTimeLeft', 'setPowerups', 'spawnItem', 'spawnEnemy', 'godMode'];
  has = await page.evaluate((f) => f.map((n) => typeof window.__GAME__.debug[n]), fns);
  ok('M40b', has.every((t) => t === 'function'), JSON.stringify(has));
  /* snapshot shape in each state */
  const shapeOk = (s) => {
    const keys = ['state', 'seed', 'stage', 'score', 'hiScore', 'lives', 'timeLeft', 'player', 'bombs', 'flames', 'enemies', 'items', 'exit', 'grid', 'texts', 'audio'];
    if (!keys.every((k) => k in s)) return 'missing key';
    const pk = ['col', 'row', 'x', 'y', 'facing', 'alive', 'invincible', 'maxBombs', 'activeBombs', 'range', 'boots', 'speed'];
    if (!pk.every((k) => k in s.player)) return 'missing player key';
    if (!['unlocked', 'muted', 'bgm', 'sfxLog'].every((k) => k in s.audio)) return 'missing audio key';
    if (!(Array.isArray(s.grid) && s.grid.length === 11 && s.grid.every((r) => r.length === 15))) return 'grid';
    if (JSON.stringify(s) === undefined) return 'json';
    return '';
  };
  const states = [];
  let s = await snap(page); states.push([s.state, shapeOk(s)]);
  await page.keyboard.press('Enter'); await sleep(100);
  s = await snap(page); states.push([s.state, shapeOk(s)]);
  await waitState(page, 'playing', 3000);
  s = await snap(page); states.push([s.state, shapeOk(s)]);
  await page.keyboard.press('KeyP'); await sleep(100);
  s = await snap(page); states.push([s.state, shapeOk(s)]);
  await page.keyboard.press('KeyP'); await sleep(100);
  await dbg(page, 'killAllEnemies'); await dbg(page, 'revealExit');
  s = await snap(page);
  await dbg(page, 'teleport', s.exit.col, s.exit.row);
  await waitState(page, 'stageClear', 2000);
  s = await snap(page); states.push([s.state, shapeOk(s)]);
  await page.keyboard.press('KeyR'); await waitState(page, 'playing', 3000);
  await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.2);
  await waitState(page, 'gameOver', 4000);
  s = await snap(page); states.push([s.state, shapeOk(s)]);
  ok('M40c', states.every((x) => x[1] === ''), JSON.stringify(states));
  /* debug functions do their job */
  await sleep(700); await page.keyboard.press('Enter'); await waitState(page, 'playing', 3000);
  await dbg(page, 'teleport', 7, 3);
  s = await snap(page);
  ok('M40d', s.player.col === 7 && s.player.row === 3 && s.player.x === 7 && s.player.y === 3, 'teleport');
  await dbg(page, 'setLives', 4); await dbg(page, 'setTimeLeft', 61.5); await dbg(page, 'setPowerups', { maxBombs: 9, range: 1, boots: 2 });
  s = await snap(page);
  ok('M40e', s.lives === 4 && Math.abs(s.timeLeft - 61.5) < 0.2 && s.player.maxBombs === 5 && s.player.range === 2 && s.player.boots === 2, `setLives/setTimeLeft/setPowerups clamp: lives ${s.lives} tl ${s.timeLeft.toFixed(2)} pu ${s.player.maxBombs}/${s.player.range}/${s.player.boots}`);
  await dbg(page, 'clearBlocks');
  s = await snap(page);
  ok('M40f', !s.grid.join('').includes('S'), 'clearBlocks removes every rock');
  await dbg(page, 'spawnEnemy', 'bat', 5, 3); await dbg(page, 'spawnItem', 'bomb', 5, 5);
  s = await snap(page);
  ok('M40g', s.enemies.some((e) => e.type === 'bat') && s.items.some((i) => i.type === 'bomb' && i.col === 5 && i.row === 5), 'spawnEnemy/spawnItem');
  await dbg(page, 'spawnEnemy', 'bat', 2, 2); await dbg(page, 'spawnItem', 'fire', 2, 2);     // pillar: refused
  s = await snap(page);
  ok('M40h', !s.enemies.some((e) => e.col === 2 && e.row === 2) && !s.items.some((i) => i.col === 2 && i.row === 2), 'spawn refused on wall');
  await closePage(page);
  /* ?stage */
  for (const [q, exp] of [['?stage=4', 4], ['?stage=0', 1], ['?stage=9', 1], ['?stage=abc', 1], ['?stage=5', 5], ['', 1]]) {
    page = await open(browser, q);
    s = await snap(page);
    let okk = s.stage === exp;
    if (q === '?stage=4') { await startGame(page); s = await snap(page); okk = okk && s.stage === 4 && s.texts.includes('STAGE 4/5'); }
    ok('M40-stage' + q, okk, 'stage=' + s.stage);
    await closePage(page);
  }
  /* keys: default prevented, no scroll, no click needed */
  page = await open(browser, '?seed=3');
  const dp = await page.evaluate(() => {
    const out = {};
    window.addEventListener('keydown', (e) => { out[e.code] = e.defaultPrevented; });
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].forEach((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true })));
    return out;
  });
  ok('M39a', Object.values(dp).length === 5 && Object.values(dp).every(Boolean), JSON.stringify(dp));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
  const sc = await page.evaluate(() => [window.scrollX, window.scrollY, document.documentElement.scrollTop, document.body.scrollTop]);
  ok('M39b', sc.every((v) => v === 0), 'scroll offsets ' + JSON.stringify(sc));
  await closePage(page);
}

async function groupStorageFail(browser) {
  const inits = {
    'getter-throws': () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); },
    'methods-throw': () => { Storage.prototype.getItem = function () { throw new Error('nope'); }; Storage.prototype.setItem = function () { throw new Error('quota'); }; }
  };
  for (const [name, init] of Object.entries(inits)) {
    const page = await open(browser, '?seed=12345&debug=1', { init });
    await startGame(page);
    await dbg(page, 'killAllEnemies');
    await page.keyboard.press('KeyM'); await sleep(80);
    await page.keyboard.press('KeyR'); await waitState(page, 'stageIntro', 1500);
    await waitState(page, 'playing', 3000);
    await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.2);
    await waitState(page, 'gameOver', 4000);
    const s = await snap(page);
    ok('M3-' + name, page._errors.length === 0 && s.state === 'gameOver', 'errors=' + JSON.stringify(page._errors));
    await closePage(page);
  }
}

async function groupDeepPath(browser) {
  const scratch = process.env.SCRATCH || os.tmpdir();
  const site = fs.mkdtempSync(path.join(scratch, 'dm-site-'));
  const dist = path.resolve(__dirname, '..', 'dist');
  fs.mkdirSync(path.join(site, 'x', 'y'), { recursive: true });
  fs.symlinkSync(dist, path.join(site, 'x', 'y', 'dist'));
  const srv = cp.spawn('python3', ['-m', 'http.server', '5106', '--bind', '127.0.0.1', '--directory', site], { stdio: 'ignore' });
  await sleep(800);
  try {
    const page = await open(browser, '?seed=1&debug=1', { base: 'http://127.0.0.1:5106', path: '/x/y/dist/index.html' });
    let s = await snap(page);
    ok('M1b', s.state === 'title' && page._bad.length === 0, 'deep subpath boots; bad=' + JSON.stringify(page._bad));
    await startGame(page);
    await dbg(page, 'godMode', true);
    await page.keyboard.press('Space'); await sleep(300);
    s = await snap(page);
    ok('M1c', s.state === 'playing' && s.bombs.length === 1 && page._errors.length === 0, 'plays under /x/y/dist; errors=' + JSON.stringify(page._errors));
    await closePage(page);
  } finally { srv.kill('SIGTERM'); fs.rmSync(site, { recursive: true, force: true }); }
}

module.exports = { groupTimer, groupPause, groupRestart, groupSave, groupAudio, groupSfxCoverage, groupFramerate, groupHooks, groupStorageFail, groupDeepPath };

if (require.main === module) {
  (async () => {
    const browser = await L.launch();
    try {
      const only = process.argv[2];
      const groups = { groupTimer, groupPause, groupRestart, groupSave, groupAudio, groupSfxCoverage, groupFramerate, groupHooks, groupStorageFail, groupDeepPath };
      for (const [k, fn] of Object.entries(groups)) if (!only || k === only) await fn(browser);
    } catch (e) { console.error(e); ok('runner', false, String(e)); }
    await browser.close();
    process.exit(L.summary() ? 1 : 0);
  })();
}
