// Measures asset generation time and time-to-first-frame.
const { launch, open, sleep, BASE } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const { page } = await open(browser, 'debug=1&seed=42&mute=1');
  const ms = await page.evaluate(async () => {
    const m = await import('./js/assets.js');
    const out = [];
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); new m.Assets(); out.push(+(performance.now() - t0).toFixed(1)); }
    return out;
  });
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  console.log('Assets() build ms (3 runs):', JSON.stringify(ms), 'navigation', JSON.stringify(nav));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
