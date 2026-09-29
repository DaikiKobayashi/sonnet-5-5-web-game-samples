/* node tools/shots.js <outDir> [scenario...]  - takes screenshots of the running game for visual review.
 * scenarios: title intro play stages pause clear over gclear touch mobile explode dying */
'use strict';
const path = require('path');
const L = require('./verify-lib.js');
const { open, closePage, snap, dbg, sleep, startGame, waitState } = L;

(async () => {
  const out = process.argv[2];
  const want = process.argv.slice(3);
  const has = (k) => !want.length || want.includes(k);
  const browser = await L.launch();
  const shot = async (page, name) => { await page.screenshot({ path: path.join(out, name + '.png') }); };
  let page;
  if (has('title')) {
    page = await open(browser, '?seed=12345&debug=1');
    await sleep(800); await shot(page, 'title');
    await sleep(1300); await shot(page, 'title2');
    await closePage(page);
  }
  if (has('intro')) {
    page = await open(browser, '?seed=12345&debug=1');
    await page.keyboard.press('Enter'); await sleep(900); await shot(page, 'intro');
    await closePage(page);
  }
  if (has('play')) {
    page = await open(browser, '?seed=12345&debug=1');
    await startGame(page); await sleep(400); await shot(page, 'play1');
    await closePage(page);
  }
  if (has('stages')) {
    for (let st = 1; st <= 5; st++) {
      page = await open(browser, `?seed=12345&debug=1&stage=${st}`);
      await startGame(page);
      await dbg(page, 'godMode', true);
      await sleep(600);
      await shot(page, 'stage' + st);
      await closePage(page);
    }
  }
  if (has('pause')) {
    page = await open(browser, '?seed=12345&debug=1');
    await startGame(page); await sleep(300); await page.keyboard.press('KeyP'); await sleep(200); await shot(page, 'pause');
    await closePage(page);
  }
  if (has('explode')) {
    page = await open(browser, '?seed=12345&debug=1');
    await startGame(page); await dbg(page, 'godMode', true); await dbg(page, 'setPowerups', { range: 4, maxBombs: 3 });
    await dbg(page, 'teleport', 5, 3); await sleep(100);
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft'); await sleep(300); await page.keyboard.press('ArrowLeft'); await sleep(300);
    await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 4000, polling: 10 });
    await sleep(70); await shot(page, 'explode');
    await sleep(200); await shot(page, 'explode2');
    await closePage(page);
  }
  if (has('dying')) {
    page = await open(browser, '?seed=12345&debug=1');
    await startGame(page); await dbg(page, 'killAllEnemies'); await sleep(500);
    await dbg(page, 'spawnEnemy', 'slime', 1, 1); await sleep(500); await shot(page, 'dying');
    await sleep(2000); await shot(page, 'respawn');
    await closePage(page);
  }
  if (has('clear')) {
    page = await open(browser, '?seed=12345&debug=1');
    await startGame(page); await dbg(page, 'godMode', true); await dbg(page, 'killAllEnemies'); await dbg(page, 'revealExit');
    const ex = (await snap(page)).exit;
    await dbg(page, 'teleport', ex.col, ex.row - 0);
    await waitState(page, 'stageClear', 2000); await sleep(800); await shot(page, 'clear');
    await closePage(page);
  }
  if (has('over')) {
    page = await open(browser, '?seed=12345&debug=1');
    await startGame(page); await dbg(page, 'killAllEnemies'); await dbg(page, 'setLives', 1); await sleep(500);
    await dbg(page, 'spawnEnemy', 'slime', 1, 1);
    await waitState(page, 'gameOver', 4000); await sleep(900); await shot(page, 'over');
    await closePage(page);
  }
  if (has('gclear')) {
    page = await open(browser, '?seed=12345&debug=1&stage=5');
    await startGame(page); await dbg(page, 'godMode', true); await dbg(page, 'killAllEnemies'); await dbg(page, 'revealExit');
    const ex = (await snap(page)).exit;
    await dbg(page, 'teleport', ex.col, ex.row);
    await waitState(page, 'gameClear', 6000); await sleep(900); await shot(page, 'gclear');
    await closePage(page);
  }
  if (has('touch')) {
    page = await open(browser, '?seed=12345&debug=1&touch=1', { viewport: { width: 390, height: 844 } });
    await sleep(300); await shot(page, 'touch_title');
    await startGame(page); await sleep(300); await shot(page, 'touch_play');
    await closePage(page);
  }
  if (has('mobile')) {
    page = await open(browser, '?seed=12345&debug=1', { viewport: { width: 390, height: 844 } });
    await startGame(page); await sleep(300); await shot(page, 'mobile_play');
    await closePage(page);
  }
  await browser.close();
})();
