/* node tools/measure-art.js
 * Measures (1) how long the procedural art takes to build and time-to-title, (2) the mean hue of floor / wall / pillar / rock
 * for each stage theme (acceptance M28), and (3) the luminance contrast of characters against every floor (M37).
 * Requires the static server on :5105. */
'use strict';
const L = require('./verify-lib.js');
const { ok, info, open, closePage } = L;

(async () => {
  const browser = await L.launch();
  const page = await open(browser, '');
  const res = await page.evaluate(async () => {
    const out = {};
    const t0 = performance.now();
    DM.Art.build();
    out.buildMs = performance.now() - t0;
    const nav = performance.getEntriesByType('navigation')[0];
    out.domContentLoaded = nav ? nav.domContentLoadedEventEnd : null;
    function stats(cv, maskFn) {
      const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
      const x = c.getContext('2d'); x.drawImage(cv, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
        if (maskFn && !maskFn(px, py)) continue;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      r /= n; g /= n; b /= n;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let h = 0;
      if (mx !== mn) {
        if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
        h *= 60; if (h < 0) h += 360;
      }
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return { hue: Math.round(h), sat: +(mx === 0 ? 0 : (mx - mn) / mx).toFixed(2), lum: Math.round(lum), rgb: [Math.round(r), Math.round(g), Math.round(b)] };
    }
    out.themes = DM.Spr.themes.map((th) => ({
      floor: stats(th.floor[0]), wall: stats(th.wall.plain), pillar: stats(th.pillar, (x, y) => y < 28), rock: stats(th.rock[0])
    }));
    /* character luminance vs each floor */
    function lum(cv) { return stats(cv, (x, y) => y < 28).lum; }
    out.chars = {
      mole: lum(DM.Spr.player.walk.down[0]), slime: lum(DM.Spr.slime[0]), bat: lum(DM.Spr.bat[0]), ghost: lum(DM.Spr.ghost[0]),
      golem: lum(DM.Spr.golem[0]), bomb: lum(DM.Spr.bomb[0]), flame: lum(DM.Spr.flame.center[0]), fire: lum(DM.Spr.item.fire[0])
    };
    out.floorLum = DM.Spr.themes.map((th) => stats(th.floor[0]).lum);
    return out;
  });
  info('sprite build: ' + res.buildMs.toFixed(0) + ' ms (DOMContentLoaded at ' + (res.domContentLoaded ? res.domContentLoaded.toFixed(0) : '?') + ' ms)');
  ok('M-boot', res.buildMs < 1500 && (res.domContentLoaded == null || res.domContentLoaded < 2000), 'art build + page ready well under 2 s');
  const names = ['SHALLOW TUNNELS', 'MUSHROOM GROTTO', 'CRYSTAL VEIN', 'LAVA DEPTHS', 'THE DEEP DARK'];
  res.themes.forEach((t, i) => info(`${names[i].padEnd(16)} floor hue ${String(t.floor.hue).padStart(3)} lum ${String(t.floor.lum).padStart(3)} | wall hue ${String(t.wall.hue).padStart(3)} lum ${String(t.wall.lum).padStart(3)} | pillar hue ${String(t.pillar.hue).padStart(3)} | rock hue ${String(t.rock.hue).padStart(3)} lum ${String(t.rock.lum).padStart(3)}`));
  const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  let minFloor = 999, minWall = 999;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    /* dark themes are compared by hue+luminance together */
    const fd = hueDiff(res.themes[i].floor.hue, res.themes[j].floor.hue) + Math.abs(res.themes[i].floor.lum - res.themes[j].floor.lum) * 0.5;
    const wd = hueDiff(res.themes[i].wall.hue, res.themes[j].wall.hue) + Math.abs(res.themes[i].wall.lum - res.themes[j].wall.lum) * 0.5;
    minFloor = Math.min(minFloor, fd); minWall = Math.min(minWall, wd);
  }
  ok('M28', minFloor > 25 && minWall > 25, `themes differ clearly: min floor distance ${minFloor.toFixed(0)}, min wall distance ${minWall.toFixed(0)} (hue deg + 0.5*luma)`);
  info('character mean luminance: ' + JSON.stringify(res.chars) + ' ; floors: ' + JSON.stringify(res.floorLum));
  await closePage(page);
  await browser.close();
  process.exit(L.summary() ? 1 : 0);
})();
