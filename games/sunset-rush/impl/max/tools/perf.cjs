// Measures the CPU cost of one rendered frame (world + HUD) per stage, plus rAF cadence.
const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const stage of [1, 2, 3]) {
    const { page, context } = await open(browser, `debug=1&seed=42&mute=1&stage=${stage}`);
    await sleep(300);
    await page.keyboard.press('Enter');
    await waitScene(page, 'playing', 6000);
    const res = await page.evaluate(() => {
      const d = window.__game.debug, sim = d.sim;
      sim.traffic.forEach((c) => (c.hit = true));
      sim.roadside.forEach((o) => (o.hit = true));
      const out = {};
      for (const m of [100, 600, 1500]) {
        d.warp(m);
        sim.speed = 280 * 40;
        sim.step();
        const N = 200;
        const t0 = performance.now();
        for (let i = 0; i < N; i++) { d.renderer.drawWorld(sim); d.hud.draw(sim, {}); }
        out[m + 'm'] = +((performance.now() - t0) / N).toFixed(2);
      }
      return out;
    });
    const fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 > 2000) resolve(n / 2); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
    console.log(`stage ${stage}: ms/frame (world+HUD) ${JSON.stringify(res)}  rAF fps=${fps}`);
    await context.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
