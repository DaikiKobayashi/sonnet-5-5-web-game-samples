/* node tools/export-favicon.js
 * Renders the favicon (32x32, drawn by dist/js/art_ui.js with the same pixel toolkit as every other sprite)
 * and writes it to dist/favicon.png. Needs the static server on :5105. */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./verify-lib.js');
(async () => {
  const browser = await L.launch();
  const page = await L.open(browser, '');
  const data = await page.evaluate(() => DM.Spr.favicon.toDataURL('image/png'));
  const dst = path.join(__dirname, '..', 'dist', 'favicon.png');
  fs.writeFileSync(dst, Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', dst, fs.statSync(dst).size, 'bytes');
  await browser.close();
})();
