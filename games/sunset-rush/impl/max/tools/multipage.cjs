// Two pages in the same browser context: interacting with page B must not pause the game running in page A.
const { launch, sleep, waitScene, BASE } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const a = await context.newPage();
  await a.goto(BASE + '?debug=1&seed=42&mute=1');
  await a.waitForFunction(() => window.__game);
  await a.keyboard.press('Enter');
  await waitScene(a, 'playing', 6000);
  await a.keyboard.down('ArrowUp');
  await sleep(500);
  const b = await context.newPage();
  await b.goto(BASE + '?debug=1&seed=43&mute=1');
  await b.waitForFunction(() => window.__game);
  await b.bringToFront();
  await b.keyboard.press('Enter');
  await sleep(1500);
  const sa = await a.evaluate(() => window.__game.getState());
  const sb = await b.evaluate(() => window.__game.getState());
  await a.bringToFront();
  await sleep(800);
  const sa2 = await a.evaluate(() => window.__game.getState());
  console.log('page A after B was opened and focused:', sa.scene, 'speed', sa.speedKmh.toFixed(1), '| page B:', sb.scene, '| page A after bringToFront:', sa2.scene, 'speed', sa2.speedKmh.toFixed(1), 'visibility', await a.evaluate(() => document.visibilityState));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
