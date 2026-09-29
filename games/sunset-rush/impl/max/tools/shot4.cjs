// Night lighting review: warp next to street lamps / neon signs on stage 3.
const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
const OUT = process.argv[2];
(async () => {
  const browser = await launch();
  const { page } = await open(browser, 'debug=1&seed=11&mute=1&stage=3');
  await sleep(300);
  await page.keyboard.press('Enter');
  await waitScene(page, 'playing', 6000);
  const picks = await page.evaluate(() => {
    const sim = window.__game.debug.sim;
    sim.traffic.forEach((c) => (c.hit = true));
    sim.roadside.forEach((o) => (o.hit = true));
    const lamps = sim.roadside.filter((o) => o.kind === 'rs_lamp' && o.z > 20000).slice(0, 3).map((o) => ({ z: o.z, x: o.x }));
    const neons = sim.roadside.filter((o) => o.kind === 'rs_neon' && o.z > 20000).slice(0, 2).map((o) => ({ z: o.z, x: o.x }));
    return { lamps, neons };
  });
  let i = 0;
  for (const o of [...picks.lamps, ...picks.neons]) {
    await page.evaluate((o) => {
      const d = window.__game.debug;
      d.setTime(99);
      d.warp((o.z - 900 - 4200) / 144);
      d.setSpeedKmh(150);
      d.setPlayerX(o.x > 0 ? 0.35 : -0.35);
    }, o);
    await page.keyboard.down('ArrowUp');
    await sleep(120);
    await page.evaluate(() => window.__game.debug.setSpeedKmh(150));
    await sleep(60);
    await page.screenshot({ path: `${OUT}/night_${i++}.png` });
    await page.keyboard.up('ArrowUp');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
