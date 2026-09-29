// Close-up of the three traffic types and the player steering / braking frames in-game.
const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
const OUT = process.argv[2];
(async () => {
  const browser = await launch();
  const { page } = await open(browser, 'debug=1&seed=42&mute=1');
  await sleep(300);
  await page.keyboard.press('Enter');
  await waitScene(page, 'playing', 6000);
  await page.evaluate(() => {
    const d = window.__game.debug, sim = d.sim;
    sim.roadside.forEach((o) => (o.hit = true));
    sim.traffic.forEach((c) => (c.hit = true));
    d.setTime(99);
    d.warp(120);
    d.setSpeedKmh(0);
    sim.playSteps = 999;
    // one car of each type in the three lanes, at increasing distance
    const pick = (type) => sim.traffic.find((c) => c.type === type);
    const s = pick('sedan'), t = pick('truck'), p = pick('sports');
    const base = sim.pos + 839.1;
    const place = (c, lane, dz) => { c.gone = false; c.x = [-0.667, 0, 0.667][lane]; c.z = base + dz; c.speed = 0; c.eff = 0; c.prevRel = dz; c.hit = true; };
    place(s, 0, 2600); place(t, 1, 3400); place(p, 2, 2000);
    sim.lanes.forEach((l) => l.sort((a, b) => b.z - a.z));
    // freeze traffic
    sim.traffic.forEach((c) => { c.speed = 0; c.eff = 0; });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/close_traffic.png` });
  await page.evaluate(() => { const sim = window.__game.debug.sim; sim.traffic.forEach((c) => { c.z += 0; }); });
  // steering frames while moving slowly
  await page.evaluate(() => window.__game.debug.setSpeedKmh(60));
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  await sleep(150);
  await page.screenshot({ path: `${OUT}/steer_left.png`, clip: { x: 380, y: 480, width: 520, height: 240 } });
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await sleep(150);
  await page.screenshot({ path: `${OUT}/steer_right.png`, clip: { x: 380, y: 480, width: 520, height: 240 } });
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
  await page.evaluate(() => window.__game.debug.setSpeedKmh(120));
  await page.keyboard.down('ArrowDown');
  await sleep(120);
  await page.screenshot({ path: `${OUT}/brake_frame.png`, clip: { x: 380, y: 480, width: 520, height: 240 } });
  await page.keyboard.up('ArrowDown');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
