// Close views of roadside objects in stage 2 (pine, boulder, signpost) and stage 1 (palm, rock).
const { launch, open, sleep, waitScene } = require('./lib.cjs');
const OUT = process.argv[2];
(async () => {
  const browser = await launch();
  for (const [stage, kinds] of [[2, ['rs_pine', 'rs_boulder', 'rs_signpost']], [1, ['rs_palm', 'rs_rock']]]) {
    const { page, context } = await open(browser, `debug=1&seed=5&mute=1&stage=${stage}`);
    await sleep(300);
    await page.keyboard.press('Enter');
    await waitScene(page, 'playing', 6000);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); d.setTime(99); });
    for (const kind of kinds) {
      const o = await page.evaluate((kind) => { const r = window.__game.debug.sim.roadside.find((o) => o.kind === kind && o.z > 12000); return { z: r.z, x: r.x }; }, kind);
      await page.evaluate((o) => {
        const d = window.__game.debug;
        d.warp((o.z - 2600 - 839) / 144);
        d.setSpeedKmh(0);
        d.setPlayerX(o.x > 0 ? o.x - 1.1 : o.x + 1.1);
        d.sim.playSteps = 999;
      }, o);
      await sleep(250);
      await page.screenshot({ path: `${OUT}/rs_close_${kind}.png` });
    }
    await context.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
