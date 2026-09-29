/* node tools/zoom.js <out.png> <query> <x> <y> <w> <h> <zoom> [action...]
 * Loads the game, optionally performs actions (enter | wait:<ms> | key:<Code> | dbg:<fn>:<json args>), then saves an
 * integer-zoomed (nearest neighbour) crop of the 480x416 canvas. */
'use strict';
const fs = require('fs');
const L = require('./verify-lib.js');
(async () => {
  const [out, qs, x, y, w, h, z, ...actions] = process.argv.slice(2);
  const browser = await L.launch();
  const page = await L.open(browser, qs || '');
  for (const a of actions) {
    if (a === 'enter') await page.keyboard.press('Enter');
    else if (a.startsWith('wait:')) await L.sleep(parseInt(a.slice(5), 10));
    else if (a.startsWith('key:')) await page.keyboard.press(a.slice(4));
    else if (a.startsWith('dbg:')) { const [, fn, args] = a.split(':'); await L.dbg(page, fn, ...(args ? JSON.parse('[' + args + ']') : [])); }
  }
  const data = await page.evaluate(([x, y, w, h, z]) => {
    const src = document.getElementById('game');
    const c = document.createElement('canvas'); c.width = w * z; c.height = h * z;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(src, x, y, w, h, 0, 0, w * z, h * z);
    return c.toDataURL('image/png');
  }, [+x, +y, +w, +h, +z]);
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  await browser.close();
})();
