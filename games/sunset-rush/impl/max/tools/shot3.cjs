// Gate approach views + title + touch layout screenshots.
const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
const OUT = process.argv[2];
(async () => {
  const browser = await launch();
  {
    const { page, context } = await open(browser, 'debug=1&seed=42&mute=1');
    await sleep(800);
    await page.screenshot({ path: `${OUT}/title_new.png` });
    await page.keyboard.press('Enter');
    await waitScene(page, 'playing', 6000);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); d.setTime(120); });
    for (const [name, m, s] of [['gate_cp_far', 880, 0], ['gate_cp_near', 960, 0], ['gate_cp_under', 985, 0], ['gate_goal_far', 2880, 0], ['gate_goal_near', 2940, 0]]) {
      await page.evaluate(([m, s]) => { const d = window.__game.debug; d.warp(m); d.setSpeedKmh(s); d.setPlayerX(0); }, [m, s]);
      await sleep(200);
      await page.screenshot({ path: `${OUT}/${name}.png` });
    }
    await context.close();
  }
  {
    const { page, context } = await open(browser, 'debug=1&seed=42&mute=1', { viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });
    await sleep(500);
    await page.screenshot({ path: `${OUT}/touch_title.png` });
    await context.close();
  }
  {
    const { page, context } = await open(browser, 'debug=1&seed=42&mute=1', { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
    await sleep(500);
    await page.touchscreen.tap(190, 100);
    await sleep(4200);
    await page.screenshot({ path: `${OUT}/touch_portrait.png` });
    await context.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
