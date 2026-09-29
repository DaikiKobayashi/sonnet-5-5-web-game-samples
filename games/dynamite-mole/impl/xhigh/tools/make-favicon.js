// Dev tool: renders dist/favicon.png (32x32) from the game's own mole sprite generator.
// usage (from impl/xhigh, with a static server on :5104): NODE_PATH=$(npm root -g) node tools/make-favicon.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5104/tools/sheet.html?set=none');
  const url = await p.evaluate(() => {
    const m = DM.buildMoleSprites();
    return m.down[0].toDataURL('image/png');
  });
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(path.join(__dirname, '..', 'dist', 'favicon.png'), buf);
  console.log('favicon.png', buf.length, 'bytes');
  await b.close();
})();
