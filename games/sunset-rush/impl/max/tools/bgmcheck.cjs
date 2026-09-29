// Prints a text envelope of each BGM (first 8 s) so the groove can be checked without listening.
const { launch, BASE } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.goto(BASE + '?gallery=1&mute=1');
  await page.waitForFunction(() => window.__gallery && window.__gallery.measureBgm);
  for (const id of ['bgm_1', 'bgm_2', 'bgm_3']) {
    const r = await page.evaluate((id) => window.__gallery.measureBgm(id, 24), id);
    const mx = Math.max(...r.env);
    const bars = ' .:-=+*#%@';
    let line = '';
    for (const v of r.env) line += bars[Math.min(bars.length - 1, Math.floor((v / mx) * (bars.length - 1)))];
    console.log(`${id} peak=${r.peak.toFixed(3)} rms=${r.rms.toFixed(3)}`);
    for (let i = 0; i < line.length; i += 80) console.log('  ' + line.slice(i, i + 80));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
