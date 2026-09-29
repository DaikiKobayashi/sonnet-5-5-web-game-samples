/* node tools/sheet-shot.js <kind> <out.png> [zoom] [theme]
 * Renders tools/sheet.html?kind=... in headless Chromium and saves the canvas as a PNG.
 * Requires the static server on :5105 (cd impl/max && python3 -m http.server 5105). */
'use strict';
const L = require('./verify-lib.js');
(async () => {
  const [kind, out, z, theme] = process.argv.slice(2);
  const browser = await L.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${L.BASE}/tools/sheet.html?kind=${kind || 'chars'}&z=${z || 3}&theme=${theme || 0}`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 15000 }).catch(() => {});
  const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  require('fs').writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  if (errs.length) console.log('ERRORS', errs);
  await browser.close();
})();
