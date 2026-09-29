const { launch, sleep, BASE } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => console.log('console', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '?gallery=1&mute=1');
  await page.waitForSelector('canvas[data-asset-id="font_pixel"]');
  const ids = ['bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title', 'mute'];
  for (const id of ids) {
    const t0 = Date.now();
    try {
      await page.click(`button[data-sound-id="${id}"]`, { timeout: 4000 });
      console.log('clicked', id, Date.now() - t0, 'ms');
    } catch (e) {
      console.log('FAILED click', id, e.message.split('\n')[0]);
      const box = await page.evaluate((id) => { const b = document.querySelector(`button[data-sound-id="${id}"]`); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(b).visibility }; }, id);
      console.log('box', JSON.stringify(box));
    }
    await sleep(150);
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
