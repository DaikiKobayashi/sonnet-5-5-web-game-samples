/* node tools/hash-art.js
 * Prints a hash over every generated canvas in DM.Spr (pixel data). Used to prove that a refactor did not change any art. */
'use strict';
const L = require('./verify-lib.js');
(async () => {
  const browser = await L.launch();
  const page = await L.open(browser, '');
  const res = await page.evaluate(() => {
    let h = 2166136261 >>> 0, n = 0;
    const seen = new Set();
    function feed(v) { h = Math.imul(h ^ v, 16777619) >>> 0; }
    function visit(o) {
      if (!o || typeof o !== 'object' || seen.has(o)) return;
      seen.add(o);
      if (o instanceof HTMLCanvasElement) {
        const d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data;
        feed(o.width); feed(o.height);
        for (let i = 0; i < d.length; i++) feed(d[i]);
        n++;
        return;
      }
      if (o.d instanceof Uint32Array) return;          // Pix helper objects kept for reuse
      Object.keys(o).sort().forEach((k) => visit(o[k]));
    }
    visit(DM.Spr);
    return { hash: h.toString(16), canvases: n };
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
