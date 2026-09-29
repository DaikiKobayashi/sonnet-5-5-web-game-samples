// Captures the main scenes for visual review.
const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
const OUT = process.argv[2];
const STAGE = process.argv[3] || '1';
(async () => {
  const browser = await launch();
  const { page, log } = await open(browser, `debug=1&seed=42&mute=1&stage=${STAGE}`);
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(1300);
  await page.screenshot({ path: `${OUT}/s${STAGE}_count2.png` });
  await waitScene(page, 'playing');
  await sleep(250);
  await page.screenshot({ path: `${OUT}/s${STAGE}_go.png` });
  await page.keyboard.down('ArrowUp');
  await page.evaluate(() => window.__game.debug.setSpeedKmh(200));
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/s${STAGE}_run1.png` });
  // curve sections
  for (const m of [270, 765, 1200, 2000]) {
    await page.evaluate((m) => { window.__game.debug.warp(m); window.__game.debug.setSpeedKmh(200); window.__game.debug.setTime(60); }, m);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/s${STAGE}_w${m}.png` });
  }
  console.log('state', JSON.stringify(await state(page)));
  console.log('errors', JSON.stringify(log.errors), 'bad', JSON.stringify(log.bad));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
