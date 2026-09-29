// Offline-renders every sound effect and the engine in the browser and prints level statistics.
const { launch, BASE } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '?gallery=1&mute=1');
  await page.waitForFunction(() => window.__gallery && window.__gallery.measureSfx);
  const names = ['beep', 'go', 'checkpoint', 'crash', 'goal', 'timeup', 'menu', 'overtake', 'nearmiss', 'timewarn', 'jingle'];
  for (const n of names) {
    const r = await page.evaluate((n) => window.__gallery.measureSfx(n, 3), n);
    console.log(`${n.padEnd(11)} peak=${r.peak.toFixed(3)} rms=${r.rms.toFixed(3)} audible=${r.audibleSec.toFixed(2)}s zcHz~${Math.round(r.zcHz)}`);
  }
  for (const sp of [0, 0.5, 1]) {
    const r = await page.evaluate((sp) => window.__gallery.measureSfx('engine', 1.5, sp), sp);
    console.log(`engine sp=${sp} peak=${r.peak.toFixed(3)} rms=${r.rms.toFixed(3)} zcHz~${Math.round(r.zcHz)}`);
  }
  const r = await page.evaluate(() => window.__gallery.measureSfx('offroad', 1.5, 0.8));
  console.log(`offroad     peak=${r.peak.toFixed(3)} rms=${r.rms.toFixed(3)}`);
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
