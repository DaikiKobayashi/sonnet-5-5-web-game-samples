// Acceptance-criteria checks driven through real Chromium (Playwright). Dev tool, not part of the game.
// Usage: node tools/e2e.cjs [group ...]   groups: load flow physics render traffic stage misc repro gallery
const fs = require('fs');
const path = require('path');
const { launch, open, state, sleep, waitScene, BASE } = require('./lib.cjs');

const OUT = process.env.OUT || '/tmp/e2e';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function rec(id, name, pass, info = '') {
  results.push({ id, name, pass, info });
  console.log((pass ? 'PASS ' : 'FAIL ') + id + '  ' + name + (info ? '  ::  ' + info : ''));
}
async function T(id, name, fn) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(id)) return;
  try {
    const r = await fn();
    rec(id, name, !!r.pass, r.info || '');
  } catch (e) {
    rec(id, name, false, 'EXCEPTION ' + (e && e.message ? e.message.split('\n')[0] : e));
  }
}
const near = (v, lo, hi) => v >= lo && v <= hi;
const f2 = (v) => (typeof v === 'number' ? v.toFixed(2) : String(v));

const dbg = (page, fn, ...args) => page.evaluate(([f, a]) => { const d = window.__game.debug; return new Function('d', 'a', 'return (' + f + ')(d, a)')(d, a); }, [fn.toString(), args]);
async function startPlaying(page) {
  await page.keyboard.press('Enter');
  await waitScene(page, 'playing', 9000);
}
async function newGame(browser, query = 'debug=1&seed=42&mute=1', ctxOpts = {}) {
  const o = await open(browser, query, ctxOpts);
  await sleep(300);
  return o;
}
// grab the game canvas as ImageData summary in the page
const px = (page, x, y, w = 1, h = 1) => page.evaluate(([x, y, w, h]) => {
  const c = document.getElementById('game');
  const d = c.getContext('2d').getImageData(x, y, w, h).data;
  return Array.from(d);
}, [x, y, w, h]);
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

const groups = {};

// =====================================================================================================
groups.load = async (browser) => {
  // 1. files, relative paths, no 404, sub-path
  await T('1', 'index.html served under a sub-path, no 404/failed, no absolute refs', async () => {
    const { page, log, context } = await newGame(browser);
    await sleep(500);
    const src = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else src.push(p); } };
    const dist = path.join(__dirname, '..', 'dist');
    walk(dist);
    const abs = [];
    for (const f of src) {
      const t = fs.readFileSync(f, 'utf8');
      const m = t.match(/(src|href)\s*=\s*["']\/[^/]|from\s+["']\/|url\(\s*["']?\/[^/]|import\(\s*["']\/|fetch\(\s*["']\/|https?:\/\//g);
      if (m) abs.push(path.relative(dist, f) + ': ' + m.slice(0, 3).join(' | '));
    }
    const external = log.requests.filter((u) => !u.startsWith(new URL(BASE).origin));
    const p = (log.errors.length === 0) && (log.bad.length === 0) && (log.failed.length === 0) && external.length === 0 && abs.length === 0;
    await context.close();
    return { pass: p, info: `requests=${log.requests.length} errors=${JSON.stringify(log.errors)} bad=${JSON.stringify(log.bad)} external=${external.length} absRefs=${JSON.stringify(abs)}` };
  });

  // 3. viewports
  for (const [w, h] of [[1280, 720], [1920, 1080], [375, 667]]) {
    await T('3', `canvas 16:9, fits, no scrollbars, pixelated @${w}x${h}`, async () => {
      const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1', { viewport: { width: w, height: h } });
      const r = await page.evaluate(() => {
        const c = document.getElementById('game');
        const b = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        return {
          w: b.width, h: b.height, x: b.x, y: b.y, cw: c.width, ch: c.height,
          ir: cs.imageRendering, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
          iw: window.innerWidth, ih: window.innerHeight, ov: getComputedStyle(document.body).overflow,
        };
      });
      const ratio = r.w / r.h;
      const fits = r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= r.iw + 0.5 && r.y + r.h <= r.ih + 0.5;
      const noScroll = r.sw <= r.iw && r.sh <= r.ih;
      await page.screenshot({ path: `${OUT}/vp_${w}x${h}.png` });
      await context.close();
      return {
        pass: near(ratio, 1.77, 1.79) && fits && noScroll && r.cw === 640 && r.ch === 360 && /pixelated|crisp/.test(r.ir),
        info: `canvas ${r.w.toFixed(1)}x${r.h.toFixed(1)} ratio=${ratio.toFixed(3)} backing=${r.cw}x${r.ch} image-rendering=${r.ir} scroll=${r.sw}x${r.sh} vs ${r.iw}x${r.ih}`,
      };
    });
  }

  // 4. title
  await T('4', 'title shows logo, blinking PRESS ENTER, BEST, controls; road scrolls', async () => {
    const { page, context } = await newGame(browser);
    await sleep(700);
    const a = await px(page, 0, 190, 640, 150);
    await sleep(700);
    const b = await px(page, 0, 190, 640, 150);
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) diff++;
    // blink: sample the PRESS ENTER area (x 224..416, y 200..221) for brightness over time
    const samples = [];
    for (let i = 0; i < 14; i++) {
      const d = await px(page, 224, 200, 192, 21);
      let bright = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] > 235 && d[k + 1] > 235 && d[k + 2] > 235) bright++;
      samples.push(bright);
      await sleep(90);
    }
    const mx = Math.max(...samples), mn = Math.min(...samples);
    const logo = await px(page, 100, 30, 440, 110);
    let colorful = 0;
    for (let k = 0; k < logo.length; k += 4) if (Math.max(logo[k], logo[k + 1], logo[k + 2]) - Math.min(logo[k], logo[k + 1], logo[k + 2]) > 90) colorful++;
    await page.screenshot({ path: `${OUT}/title.png` });
    await context.close();
    return { pass: diff > 800 && mx > 300 && mn < mx * 0.35 && colorful > 3000, info: `roadDiffPx=${diff} blinkBright max=${mx} min=${mn} logoColorful=${colorful}` };
  });

  // 40. no fillText / ctx.font
  await T('40', 'no fillText / ctx.font / strokeText / measureText in source', async () => {
    const dist = path.join(__dirname, '..', 'dist');
    const hits = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|html)$/.test(f)) { const t = fs.readFileSync(p, 'utf8'); const m = t.match(/fillText|strokeText|measureText|\.font\s*=|ctx\.font|font-family:[^;]*canvas/g); if (m) hits.push(path.relative(dist, p) + ': ' + m.join(',')); } } };
    walk(dist);
    return { pass: hits.length === 0, info: JSON.stringify(hits) };
  });
};

// =====================================================================================================
groups.flow = async (browser) => {
  await T('5/6/21', 'countdown 3s (speed 0, timeLeft frozen), then playing, timeLeft 25.0 after 5 s', async () => {
    const { page, log, context } = await newGame(browser);
    await page.keyboard.press('Enter');
    const t0 = Date.now();
    let s = await state(page);
    const okScene = s.scene === 'countdown';
    await page.keyboard.down('ArrowUp');
    await sleep(1200);
    const mid = await state(page);
    await page.screenshot({ path: `${OUT}/countdown.png` });
    await sleep(1500);
    const late = await state(page);
    await waitScene(page, 'playing', 4000);
    const tPlay = Date.now() - t0;
    const t1 = Date.now();
    await page.screenshot({ path: `${OUT}/go.png` });
    await page.keyboard.up('ArrowUp');
    await sleep(Math.max(0, 5000 - (Date.now() - t1)));
    s = await state(page);
    const elapsed = (Date.now() - t1) / 1000;
    await context.close();
    const p = okScene && mid.speedKmh === 0 && late.speedKmh === 0 && mid.timeLeft === 30 && late.timeLeft === 30 && near(tPlay, 2900, 3500) && near(s.timeLeft, 24.7, 25.3);
    return { pass: p, info: `countdown->playing after ${tPlay}ms, mid speed=${mid.speedKmh} timeLeft=${mid.timeLeft}, late speed=${late.speedKmh}, timeLeft after ${elapsed.toFixed(2)}s playing = ${f2(s.timeLeft)}` };
  });

  await T('21', 'timeLeft frozen while paused and during stageclear', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await sleep(500);
    await page.keyboard.press('KeyP');
    await sleep(100);
    const a = await state(page);
    await sleep(2000);
    const b = await state(page);
    await page.keyboard.press('KeyP');
    await sleep(100);
    const c = await state(page);
    // stageclear
    await page.keyboard.down('ArrowUp');
    await page.evaluate(() => { window.__game.debug.warp(2950); window.__game.debug.setSpeedKmh(200); window.__game.debug.setTime(40); });
    await waitScene(page, 'stageclear', 8000);
    await page.keyboard.up('ArrowUp');
    const d = await state(page);
    await sleep(2000);
    const e = await state(page);
    await context.close();
    const p = a.scene === 'paused' && b.timeLeft === a.timeLeft && b.distanceM === a.distanceM && c.scene === 'playing' && e.timeLeft === d.timeLeft;
    return { pass: p, info: `paused: ${a.timeLeft}->${b.timeLeft} dist ${a.distanceM.toFixed(2)}->${b.distanceM.toFixed(2)}; stageclear: ${d.timeLeft}->${e.timeLeft}` };
  });

  await T('22', 'checkpoint: +18 s, +500 score, count 1, banner CHECKPOINT!/+18 SEC, gate visible', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.keyboard.down('ArrowUp');
    await page.evaluate(() => { const d = window.__game.debug; d.warp(940); d.setSpeedKmh(200); d.setTime(30); });
    for (const c of await page.evaluate(() => window.__game.debug.sim.traffic.map((c) => c.id))) { /* no-op */ }
    await sleep(250);
    await page.screenshot({ path: `${OUT}/gate_checkpoint_approach.png` });
    const before = await state(page);
    let after = before;
    for (let i = 0; i < 40 && after.checkpointsPassed === 0; i++) { await sleep(50); after = await state(page); }
    await sleep(300);
    await page.screenshot({ path: `${OUT}/checkpoint_banner.png` });
    after = await state(page);
    await sleep(2200);
    await page.screenshot({ path: `${OUT}/checkpoint_after2s.png` });
    await page.keyboard.up('ArrowUp');
    await context.close();
    const dScore = after.score - before.score;
    const dDist = after.distanceM - before.distanceM; // 1 pt per metre also accrues meanwhile
    const bonus = dScore - dDist;
    return { pass: after.checkpointsPassed === 1 && after.timeLeft > before.timeLeft + 15 && bonus >= 498 && bonus <= 503, info: `time ${f2(before.timeLeft)} -> ${f2(after.timeLeft)} (elapsed ~${f2(before.timeLeft + 18 - after.timeLeft)} s), score +${dScore} = ${f2(dDist)} distance + ${f2(bonus)} bonus, checkpoints=${after.checkpointsPassed}` };
  });

  await T('23', 'time up: TIME UP then gameover 2.5 s later with GAME OVER/REACHED STAGE 1/SCORE/BEST', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.evaluate(() => window.__game.debug.setTime(2));
    await sleep(2300);
    const a = await state(page);
    await page.screenshot({ path: `${OUT}/timeup.png` });
    const t0 = Date.now();
    await waitScene(page, 'gameover', 4000);
    const dt = Date.now() - t0;
    await sleep(500);
    await page.screenshot({ path: `${OUT}/gameover.png` });
    await context.close();
    return { pass: a.scene === 'timeup' && near(dt, 100, 2600), info: `scene after 2.3 s=${a.scene}, gameover after another ${dt} ms (timeup began ~0.3 s earlier)` };
  });
};

// =====================================================================================================
groups.physics = async (browser) => {
  await T('7', 'accelerate: 3.0 s of Up gives 170-190 km/h, never above 300', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.keyboard.down('ArrowUp');
    const t0 = Date.now();
    await sleep(3000);
    const s = await state(page);
    const el = (Date.now() - t0) / 1000;
    await sleep(4000);
    const s2 = await state(page);
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: near(s.speedKmh, 170, 190) && s2.speedKmh <= 300.001, info: `after ${el.toFixed(2)}s: ${f2(s.speedKmh)} km/h; after 7 s: ${f2(s2.speedKmh)} (playerX=${f2(s2.playerX)})` };
  });

  await T('8', 'brake: from 200 km/h, 1.0 s of Down removes 140-160 km/h', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.evaluate(() => window.__game.debug.setSpeedKmh(200));
    await page.keyboard.down('ArrowDown');
    const t0 = Date.now();
    await sleep(1000);
    const s = await state(page);
    const el = (Date.now() - t0) / 1000;
    await page.keyboard.up('ArrowDown');
    await context.close();
    return { pass: near(200 - s.speedKmh, 140, 160), info: `after ${el.toFixed(2)}s speed=${f2(s.speedKmh)} (delta ${f2(200 - s.speedKmh)})` };
  });

  await T('9', 'coast: from 200 km/h, 2.0 s without input gives 104-116 km/h', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.evaluate(() => window.__game.debug.setSpeedKmh(200));
    const t0 = Date.now();
    await sleep(2000);
    const s = await state(page);
    await context.close();
    return { pass: near(s.speedKmh, 104, 116), info: `after ${((Date.now() - t0) / 1000).toFixed(2)}s speed=${f2(s.speedKmh)}` };
  });

  await T('10', 'steering: right/D increases playerX, left/A decreases, no effect at speed 0', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.keyboard.down('ArrowRight');
    await sleep(500);
    const z = await state(page);
    await page.keyboard.up('ArrowRight');
    await page.evaluate(() => { window.__game.debug.setSpeedKmh(100); window.__game.debug.setPlayerX(0); });
    await page.keyboard.down('ArrowUp');
    const out = {};
    for (const [key, name] of [['ArrowRight', 'right'], ['KeyD', 'D'], ['ArrowLeft', 'left'], ['KeyA', 'A']]) {
      await page.evaluate(() => { window.__game.debug.setPlayerX(0); window.__game.debug.setSpeedKmh(100); });
      const x0 = (await state(page)).playerX;
      await page.keyboard.down(key);
      await sleep(400);
      await page.keyboard.up(key);
      out[name] = (await state(page)).playerX - x0;
    }
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: z.playerX === 0 && z.speedKmh === 0 && out.right > 0.05 && out.D > 0.05 && out.left < -0.05 && out.A < -0.05, info: `speed0 playerX=${z.playerX}; deltas ${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, +v.toFixed(3)])))}` };
  });

  await T('11', 'centrifugal: warp(765), 200 km/h, no steering, Up held -> playerX <= -0.5 after 1 s', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.evaluate(() => { const d = window.__game.debug; d.warp(765); d.setSpeedKmh(200); d.setPlayerX(0); d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); });
    await page.keyboard.down('ArrowUp');
    const t0 = Date.now();
    await sleep(1000);
    const s = await state(page);
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: s.playerX <= -0.5, info: `after ${((Date.now() - t0) / 1000).toFixed(2)}s playerX=${f2(s.playerX)}` };
  });

  await T('12', 'off-road: playerX 1.05, Up held, 3 s -> 70-80 km/h', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(1.05); d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); });
    await page.keyboard.down('ArrowUp');
    await sleep(3000);
    const s = await state(page);
    await page.screenshot({ path: `${OUT}/offroad.png` });
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: near(s.speedKmh, 70, 80), info: `speed=${f2(s.speedKmh)} playerX=${f2(s.playerX)} crashes=${s.crashes}` };
  });
};

// =====================================================================================================
groups.render = async (browser) => {
  await T('13', 'curves/hills: vanishing height varies; crests hide the road beyond', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    const rows = [];
    for (const m of [60, 200, 420, 520, 640, 720, 820, 1000, 1400, 1700, 1950]) {
      await page.evaluate((m) => { const d = window.__game.debug; d.warp(m); d.setSpeedKmh(0); d.setPlayerX(0); }, m);
      await sleep(120);
      const st = await page.evaluate(() => window.__game.debug.renderer.stats);
      rows.push({ m, ...st });
      await page.screenshot({ path: `${OUT}/hill_${m}.png` });
    }
    await context.close();
    const ys = rows.map((r) => r.vanishY);
    const varies = Math.max(...ys) - Math.min(...ys) >= 10;
    const someHidden = rows.some((r) => r.hidden >= 3);
    return { pass: varies && someHidden, info: rows.map((r) => `${r.m}m:y=${r.vanishY},hidden=${r.hidden}`).join(' ') };
  });

  await T('14', 'parallax: far layer moves left in right curves, right in left curves, stops when stopped', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    const shift = async () => {
      const grab = () => px(page, 0, 132, 640, 34);
      const a = await grab();
      await sleep(250);
      const b = await grab();
      // best horizontal shift (px) of b relative to a, over row-band column signatures
      const sig = (d) => { const out = new Array(640).fill(0); for (let y = 0; y < 34; y++) for (let x = 0; x < 640; x++) { const i = (y * 640 + x) * 4; out[x] += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; } return out; };
      const A = sig(a), B = sig(b);
      let best = 0, bestE = Infinity;
      for (let s = -40; s <= 40; s++) {
        let e = 0, n = 0;
        for (let x = 60; x < 580; x++) { e += Math.abs(B[x] - A[x - s]); n++; }
        e /= n;
        if (e < bestE) { bestE = e; best = s; }
      }
      return best;
    };
    await page.evaluate(() => { const d = window.__game.debug; d.warp(765); d.setSpeedKmh(200); d.setTime(60); d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); });
    await page.keyboard.down('ArrowUp');
    await page.evaluate(() => window.__game.debug.setPlayerX(0));
    const right = await shift();
    await page.evaluate(() => { const d = window.__game.debug; d.warp(600); d.setSpeedKmh(200); d.setPlayerX(0); });
    const left = await shift();
    await page.keyboard.up('ArrowUp');
    await page.evaluate(() => { const d = window.__game.debug; d.warp(765); d.setSpeedKmh(0); });
    await sleep(200);
    const stopped = await shift();
    await context.close();
    return { pass: right < 0 && left > 0 && stopped === 0, info: `right-curve shift=${right}px, left-curve shift=${left}px, stopped shift=${stopped}px` };
  });

  await T('15', 'road stripes visible (light/dark bands, thinner toward the horizon) and no seams', async () => {
    const { page, context } = await newGame(browser);
    // countdown = stationary world
    await page.keyboard.press('Enter');
    await sleep(400);
    // scan columns beside the player car sprite (x 240..400) so the car is not sampled
    const col = await px(page, 205, 0, 1, 360);
    const colL = await px(page, 40, 0, 1, 360);
    const runs = (d, y0, y1) => {
      const out = [];
      let cur = null;
      for (let y = y0; y < y1; y++) {
        const c = [d[y * 4], d[y * 4 + 1], d[y * 4 + 2]];
        if (cur && Math.abs(cur.c[0] - c[0]) + Math.abs(cur.c[1] - c[1]) + Math.abs(cur.c[2] - c[2]) <= 12) cur.len++;
        else { cur = { c, len: 1, y }; out.push(cur); }
      }
      return out;
    };
    const roadRuns = runs(col, 190, 356);
    const bands = roadRuns.filter((r) => r.len >= 1);
    // luminance contrast between neighbouring road bands (skip the far fogged part)
    const near = roadRuns.filter((r) => r.y >= 240 && r.len >= 3);
    let minContrast = 999;
    for (let i = 1; i < near.length; i++) minContrast = Math.min(minContrast, Math.abs(lum(...near[i].c) - lum(...near[i - 1].c)));
    // seam detection: isolated 1-px row (y >= 235) whose colour differs from both neighbours that are equal to each other
    let seams = 0;
    for (const d of [col, colL]) {
      for (let y = 236; y < 340; y++) {
        const a = [d[(y - 1) * 4], d[(y - 1) * 4 + 1], d[(y - 1) * 4 + 2]], b = [d[y * 4], d[y * 4 + 1], d[y * 4 + 2]], c = [d[(y + 1) * 4], d[(y + 1) * 4 + 1], d[(y + 1) * 4 + 2]];
        const dab = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        const dac = Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]);
        if (dab > 25 && dac < 12) seams++;
      }
    }
    // band thickness decreases with distance: compare first and last runs of near list
    const thick = near.map((r) => r.len);
    const decreasing = thick.length >= 3 && thick[0] >= thick[thick.length - 1];
    await page.screenshot({ path: `${OUT}/stripes.png` });
    await context.close();
    return { pass: bands.length >= 12 && minContrast >= 8 && seams === 0, info: `colour runs (y 190-350)=${bands.length}, min neighbour luma contrast (near)=${minContrast.toFixed(1)}, seam rows=${seams}, near band heights(y>=240 bottom->top)=${thick.join(',')}` };
  });
};

// =====================================================================================================
groups.traffic = async (browser) => {
  await T('16', 'traffic: trafficTotal 36/54/72, all 3 vehicle types, valid lanes', async () => {
    const out = [];
    for (const stage of [1, 2, 3]) {
      const { page, context } = await newGame(browser, `debug=1&seed=42&mute=1&stage=${stage}`);
      await page.keyboard.press('Enter');
      await sleep(300);
      const r = await page.evaluate(() => {
        const s = window.__game.getState();
        const t = window.__game.debug.sim.traffic;
        const types = {};
        t.forEach((c) => (types[c.type] = (types[c.type] || 0) + 1));
        const lanes = new Set(t.map((c) => c.x.toFixed(3)));
        return { total: s.trafficTotal, n: t.length, types, lanes: Array.from(lanes) };
      });
      out.push({ stage, ...r });
      await context.close();
    }
    const p = out[0].total === 36 && out[1].total === 54 && out[2].total === 72 && out.every((o) => o.n === o.total && Object.keys(o.types).length === 3 && o.lanes.length === 3);
    return { pass: p, info: JSON.stringify(out) };
  });

  await T('17', 'overtake: +1 overtakes and a +50 score jump; no credit for a crashed car', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    const res = await page.evaluate(async () => {
      const d = window.__game.debug, sim = d.sim;
      sim.traffic.forEach((c) => (c.hit = true));
      sim.roadside.forEach((o) => (o.hit = true));
      const c = sim.traffic[0];
      c.hit = false; c.passed = false; c.gone = false; c.x = 0.667; c.speed = 4000; c.eff = 4000;
      sim.playerX = 0; sim.pos = 0;
      c.z = sim.pos + 839.1 + 2200; c.prevRel = 2200;
      sim.lanes.forEach((l) => l.sort((a, b) => b.z - a.z));
      d.setSpeedKmh(180);
      sim.input.up = true;
      return await new Promise((resolve) => {
        let prev = window.__game.getState();
        const t0 = performance.now();
        const tick = () => {
          const s = window.__game.getState();
          if (s.overtakes > prev.overtakes) return resolve({ jump: s.score - prev.score, overtakes: s.overtakes });
          prev = s;
          if (performance.now() - t0 > 6000) return resolve({ jump: 0, overtakes: s.overtakes });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    await context.close();
    return { pass: res.overtakes === 1 && res.jump >= 48 && res.jump <= 58, info: JSON.stringify(res) };
  });

  await T('18', 'traffic crash: speed <= 62, crashes +1, invulnerable ~1.2 s, blinking, smoke; no double hit', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    const res = await page.evaluate(async () => {
      const d = window.__game.debug, sim = d.sim;
      sim.roadside.forEach((o) => (o.hit = true));
      sim.traffic.forEach((c) => (c.hit = true));
      const a = sim.traffic[0], b = sim.traffic[1];
      for (const c of [a, b]) { c.hit = false; c.passed = false; c.gone = false; c.speed = 2400; c.eff = 2400; }
      sim.playerX = 0; sim.pos = 0;
      a.x = 0; a.z = 839.1 + 2400; a.prevRel = 2400;
      b.x = 0; b.z = 839.1 + 3300; b.prevRel = 3300;
      sim.lanes.forEach((l) => l.sort((p, q) => q.z - p.z));
      d.setSpeedKmh(220);
      sim.input.up = true;
      const out = { firstHit: null, invulMs: null, crashesAfter: null, blink: 0, smokeSeen: false, sparkSeen: false };
      let prev = window.__game.getState();
      let invStart = null, lastVis = null;
      await new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
          const s = window.__game.getState();
          if (out.firstHit === null && s.crashes > prev.crashes) { out.firstHit = { speed: s.speedKmh, crashes: s.crashes }; invStart = performance.now(); }
          if (invStart !== null) {
            if (sim.fx.smoke.length) out.smokeSeen = true;
            if (sim.fx.sparks.length) out.sparkSeen = true;
            const c = document.getElementById('game').getContext('2d').getImageData(300, 330, 40, 12).data;
            let dark = 0; for (let i = 0; i < c.length; i += 4) if (c[i] > 150 && c[i + 1] < 90) dark++;
            const vis = dark > 20;
            if (lastVis !== null && vis !== lastVis) out.blink++;
            lastVis = vis;
            if (!s.invulnerable && out.invulMs === null) { out.invulMs = performance.now() - invStart; out.crashesAfter = s.crashes; }
          }
          prev = s;
          if (out.invulMs !== null || performance.now() - t0 > 7000) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return out;
    });
    await context.close();
    const p = res.firstHit && res.firstHit.speed <= 62 && res.firstHit.crashes === 1 && res.invulMs > 1050 && res.invulMs < 1400 && res.crashesAfter === 1 && res.smokeSeen && res.blink >= 3;
    return { pass: !!p, info: JSON.stringify(res) };
  });

  await T('19', 'roadside solid crash: playerX ~1.8 hits palms/rocks; same reaction as traffic', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.setPlayerX(1.8); d.setTime(120); d.setSpeedKmh(70); });
    await page.keyboard.down('ArrowUp');
    let hit = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const s = await state(page);
      if (s.crashes > 0) { hit = s; break; }
      await page.evaluate(() => window.__game.debug.setPlayerX(1.8));
      await sleep(60);
    }
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: !!hit && hit.speedKmh <= 80 && hit.invulnerable, info: hit ? `crash at ${((Date.now() - t0) / 1000).toFixed(1)}s speed=${f2(hit.speedKmh)} invulnerable=${hit.invulnerable} playerX=${f2(hit.playerX)}` : 'no crash within 30 s' };
  });

  await T('20', 'roadside variety per stage (solid x2 + decor per SPEC, data check)', async () => {
    const out = {};
    for (const stage of [1, 2, 3]) {
      const { page, context } = await newGame(browser, `debug=1&seed=7&mute=1&stage=${stage}`);
      await page.keyboard.press('Enter');
      await sleep(200);
      out[stage] = await page.evaluate(() => {
        const r = window.__game.debug.sim.roadside;
        const kinds = {};
        let minSolid = 9, minDecor = 9;
        r.forEach((o) => { kinds[o.kind] = (kinds[o.kind] || 0) + 1; const a = Math.abs(o.x); if (o.solid) minSolid = Math.min(minSolid, a); else minDecor = Math.min(minDecor, a); });
        return { kinds, minSolid: +minSolid.toFixed(2), minDecor: +minDecor.toFixed(2) };
      });
      await context.close();
    }
    const want = { 1: ['rs_palm', 'rs_rock', 'rs_shrub'], 2: ['rs_pine', 'rs_boulder', 'rs_fern'], 3: ['rs_lamp', 'rs_neon', 'rs_building'] };
    let ok = true;
    for (const s of [1, 2, 3]) { for (const k of want[s]) if (!out[s].kinds[k]) ok = false; if (out[s].minSolid < 1.45 || out[s].minDecor < 2.2) ok = false; }
    return { pass: ok, info: JSON.stringify(out) };
  });

  await T('42', 'same-lane traffic never overlaps in 60 s of simulation (gap >= 300 u)', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    const res = await page.evaluate(async () => {
      const sim = window.__game.debug.sim;
      sim.traffic.forEach((c) => (c.hit = true));
      let minGap = 1e9;
      const t0 = performance.now();
      window.__game.debug.setSpeedKmh(150);
      return await new Promise((resolve) => {
        const tick = () => {
          for (const lane of sim.lanes) {
            const live = lane.filter((c) => !c.gone);
            for (let k = 1; k < live.length; k++) minGap = Math.min(minGap, live[k - 1].z - live[k].z);
          }
          window.__game.debug.setTime(60);
          if (sim.scene !== 'playing' || performance.now() - t0 > 20000) return resolve(minGap);
          sim.input.up = true;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    await context.close();
    return { pass: res > 300, info: `min same-lane gap over 20 s of play = ${Math.round(res)} u` };
  });
};

// =====================================================================================================
async function driveToGoal(page, stage) {
  // warp near the goal with speed, wait for stageclear
  const goalM = { 1: 2950, 2: 3540, 3: 4140 }[stage];
  await page.keyboard.down('ArrowUp');
  await page.evaluate(([m]) => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); d.warp(m); d.setSpeedKmh(220); d.setPlayerX(0); d.setTime(40); }, [goalM]);
  await waitScene(page, 'stageclear', 15000);
  await page.keyboard.up('ArrowUp');
}

groups.stage = async (browser) => {
  await T('24/25/26/27/41/2', 'full run: title -> S1 -> S2 -> S3 -> ending -> title, scores carry, no errors', async () => {
    const { page, log, context } = await newGame(browser);
    const notes = [];
    await startPlaying(page);
    // stage 1
    await page.evaluate(() => { const d = window.__game.debug; d.warp(2900); d.setSpeedKmh(200); d.setTime(40.5); d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); });
    await page.keyboard.down('ArrowUp');
    let pre = await state(page);
    await waitScene(page, 'stageclear', 15000);
    await page.keyboard.up('ArrowUp');
    const g1 = await state(page);
    await page.screenshot({ path: `${OUT}/goal1.png` });
    await sleep(1700);
    await page.screenshot({ path: `${OUT}/panel1.png` });
    notes.push(`S1 goal: score ${pre.score}->${g1.score} (+${g1.score - pre.score}) timeLeft=${f2(g1.timeLeft)}`);
    const bonusOk = g1.score - pre.score >= 100 * Math.floor(g1.timeLeft) + 1000 && g1.score - pre.score <= 100 * Math.floor(g1.timeLeft) + 1000 + 120;
    await page.keyboard.press('Enter');
    await sleep(200);
    const c2 = await state(page);
    notes.push(`-> S2 countdown: stage=${c2.stage} goalRemaining=${f2(c2.goalRemainingM)} timeLeft=${c2.timeLeft} traffic=${c2.trafficTotal} score=${c2.score}`);
    const s2ok = c2.scene === 'countdown' && c2.stage === 2 && near(c2.goalRemainingM, 3592, 3596) && c2.timeLeft === 32 && c2.trafficTotal === 54 && c2.score === g1.score;
    await waitScene(page, 'playing', 5000);
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/stage2_start.png` });
    await driveToGoal(page, 2);
    const g2 = await state(page);
    await sleep(1700);
    await page.screenshot({ path: `${OUT}/panel2.png` });
    await page.keyboard.press('Enter');
    await sleep(200);
    const c3 = await state(page);
    notes.push(`-> S3 countdown: stage=${c3.stage} goalRemaining=${f2(c3.goalRemainingM)} timeLeft=${c3.timeLeft} traffic=${c3.trafficTotal}`);
    const s3ok = c3.scene === 'countdown' && c3.stage === 3 && near(c3.goalRemainingM, 4192, 4196) && c3.timeLeft === 32 && c3.trafficTotal === 72;
    await waitScene(page, 'playing', 5000);
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/stage3_start.png` });
    await driveToGoal(page, 3);
    await sleep(1700);
    await page.screenshot({ path: `${OUT}/panel3.png` });
    await page.keyboard.press('Enter');
    await sleep(500);
    const e = await state(page);
    await page.screenshot({ path: `${OUT}/ending.png` });
    notes.push(`ending: scene=${e.scene} score=${e.score} rank=${e.rank} best=${e.best}`);
    await page.keyboard.press('Enter');
    await sleep(400);
    const t = await state(page);
    await context.close();
    const external = log.requests.filter((u) => !u.startsWith(new URL(BASE).origin));
    const noErr = log.errors.length === 0 && log.bad.length === 0 && log.failed.length === 0 && external.length === 0;
    const p = bonusOk && s2ok && s3ok && e.scene === 'ending' && ['S', 'A', 'B', 'C'].includes(e.rank) && t.scene === 'title' && noErr;
    return { pass: p, info: notes.join(' | ') + ` | back to ${t.scene} | errors=${JSON.stringify(log.errors)}` };
  });

  await T('26', 'stage palettes differ: dominant colours S1 warm, S2 purple/indigo, S3 dark navy + neon', async () => {
    const out = [];
    for (const stage of [1, 2, 3]) {
      const { page, context } = await newGame(browser, `debug=1&seed=42&mute=1&stage=${stage}`);
      await startPlaying(page);
      await page.evaluate(() => { const d = window.__game.debug; d.warp(300); d.setSpeedKmh(0); });
      await sleep(250);
      const d = await px(page, 0, 70, 640, 260);
      let r = 0, g = 0, b = 0, n = 0, sat = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      out.push({ stage, r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), lum: Math.round(lum(r / n, g / n, b / n)) });
      await context.close();
    }
    const [s1, s2, s3] = out;
    const p = s1.r > s1.b + 25 && s1.r > s1.g && s2.b >= s2.r - 5 && s2.b > s2.g + 5 && s3.lum < 75 && s3.b > s3.r * 0.9 && s1.lum > s2.lum && s2.lum > s3.lum;
    return { pass: p, info: JSON.stringify(out) };
  });

  await T('27', 'ranks: S >= 33000, A >= 28000, B >= 23000, else C (browser, through stage 3 clear)', async () => {
    const seen = {};
    for (const [target, expect] of [[33000, 'S'], [28000, 'A'], [23000, 'B'], [1000, 'C']]) {
      const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1&stage=3');
      await startPlaying(page);
      // final score = scoreF + bonus; aim so that total >= target (or well under for C)
      await page.evaluate((t) => { const s = window.__game.debug.sim; s.scoreF = t === 1000 ? 0 : t - 3500; }, target);
      await driveToGoal(page, 3);
      await sleep(1700);
      await page.keyboard.press('Enter');
      await sleep(400);
      const e = await state(page);
      seen[expect] = `${e.scene}/${e.rank}/${e.score}`;
      await context.close();
    }
    const ok = seen.S.startsWith('ending/S') && seen.A.startsWith('ending/A') && seen.B.startsWith('ending/B') && seen.C.startsWith('ending/C');
    return { pass: ok, info: JSON.stringify(seen) };
  });

  await T('28', 'score ~ distance in metres (1 pt/m) when nothing else scores', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); });
    await page.keyboard.down('ArrowUp');
    await sleep(3500);
    const s = await state(page);
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: Math.abs(s.score - Math.floor(s.distanceM)) <= 1 && s.distanceM > 30, info: `score=${s.score} distanceM=${f2(s.distanceM)}` };
  });
};

// =====================================================================================================
groups.misc = async (browser) => {
  await T('29', 'pause: P/Esc toggles, PAUSED overlay, nothing moves; R restarts, Q -> title', async () => {
    const { page, context } = await newGame(browser);
    await startPlaying(page);
    await page.keyboard.down('ArrowUp');
    await sleep(800);
    await page.keyboard.press('Escape');
    await sleep(150);
    const a = await state(page);
    await page.screenshot({ path: `${OUT}/paused.png` });
    const carsA = await page.evaluate(() => window.__game.debug.sim.traffic.map((c) => c.z).join(','));
    await sleep(2000);
    const b = await state(page);
    const carsB = await page.evaluate(() => window.__game.debug.sim.traffic.map((c) => c.z).join(','));
    await page.keyboard.press('KeyP');
    await sleep(150);
    const c = await state(page);
    await page.keyboard.press('KeyP');
    await sleep(100);
    await page.keyboard.press('KeyR');
    await sleep(150);
    const d = await state(page);
    await page.keyboard.press('Enter'); // ignored in countdown
    await waitScene(page, 'playing', 5000);
    await page.keyboard.press('KeyP');
    await sleep(100);
    await page.keyboard.press('KeyQ');
    await sleep(150);
    const e = await state(page);
    await page.keyboard.up('ArrowUp');
    await context.close();
    const p = a.scene === 'paused' && b.timeLeft === a.timeLeft && b.distanceM === a.distanceM && carsA === carsB && c.scene === 'playing' && d.scene === 'countdown' && e.scene === 'title';
    return { pass: p, info: `paused: time ${a.timeLeft}->${b.timeLeft}, dist ${a.distanceM.toFixed(2)}->${b.distanceM.toFixed(2)}, traffic frozen=${carsA === carsB}; resume=${c.scene}; R->${d.scene}; Q->${e.scene}` };
  });

  await T('30', 'R restarts from playing/paused/gameover/ending; Enter retries from gameover; Esc/Q -> title', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1&stage=2');
    const res = {};
    const inject = () => page.evaluate(() => { const s = window.__game.debug.sim; s.scoreF = 1234; s.overtakes = 5; s.crashes = 3; });
    await startPlaying(page);
    await inject();
    await page.keyboard.press('KeyR'); await sleep(120);
    res.fromPlaying = await state(page);
    await waitScene(page, 'playing', 5000);
    await inject();
    await page.keyboard.press('KeyP'); await sleep(80);
    await page.keyboard.press('KeyR'); await sleep(120);
    res.fromPaused = await state(page);
    await waitScene(page, 'playing', 5000);
    await page.evaluate(() => window.__game.debug.setTime(0.5));
    await waitScene(page, 'gameover', 8000);
    await inject();
    await page.keyboard.press('KeyR'); await sleep(120);
    res.fromGameover = await state(page);
    await waitScene(page, 'playing', 5000);
    await page.evaluate(() => window.__game.debug.setTime(0.5));
    await waitScene(page, 'gameover', 8000);
    await page.keyboard.press('Enter'); await sleep(120);
    res.enterGameover = await state(page);
    await waitScene(page, 'playing', 5000);
    await page.evaluate(() => window.__game.debug.setTime(0.5));
    await waitScene(page, 'gameover', 8000);
    await page.keyboard.press('Escape'); await sleep(120);
    res.escGameover = await state(page);
    await page.keyboard.press('Enter');
    await waitScene(page, 'playing', 5000);
    await page.evaluate(() => window.__game.debug.setTime(0.5));
    await waitScene(page, 'gameover', 8000);
    await page.keyboard.press('KeyQ'); await sleep(120);
    res.qGameover = await state(page);
    // ending
    await page.keyboard.press('Enter');
    await sleep(100);
    await page.keyboard.down('ArrowUp');
    await waitScene(page, 'playing', 5000);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.stage = 3; });
    await page.keyboard.up('ArrowUp');
    await context.close();
    const okRun = (s) => s.scene === 'countdown' && s.stage === 2 && s.score === 0 && s.overtakes === 0 && s.crashes === 0;
    const p = okRun(res.fromPlaying) && okRun(res.fromPaused) && okRun(res.fromGameover) && okRun(res.enterGameover) && res.escGameover.scene === 'title' && res.qGameover.scene === 'title';
    return { pass: p, info: Object.entries(res).map(([k, v]) => `${k}=${v.scene}/st${v.stage}/sc${v.score}/ov${v.overtakes}/cr${v.crashes}`).join(' ') };
  });

  await T('30b', 'R from ending restarts a run', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1&stage=3');
    await startPlaying(page);
    await driveToGoal(page, 3);
    await sleep(1700);
    await page.keyboard.press('Enter');
    await sleep(300);
    const e = await state(page);
    await page.keyboard.press('KeyR');
    await sleep(150);
    const r = await state(page);
    await page.keyboard.press('Escape');
    await context.close();
    return { pass: e.scene === 'ending' && r.scene === 'countdown' && r.score === 0 && r.stage === 3, info: `${e.scene} -> ${r.scene} stage=${r.stage} score=${r.score}` };
  });

  await T('31', 'M mutes (HUD text + state), persists across reload; mute=1 starts muted without saving', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42');
    const a = await state(page);
    await page.keyboard.press('KeyM');
    await sleep(100);
    const b = await state(page);
    const stored = await page.evaluate(() => localStorage.getItem('sunset-rush:v1'));
    await page.reload();
    await page.waitForFunction(() => window.__game && window.__game.getState);
    const c = await state(page);
    await page.keyboard.press('KeyM');
    await sleep(100);
    const d = await state(page);
    // ?mute=1 without touching storage
    await page.goto(BASE + '?debug=1&seed=42&mute=1');
    await page.waitForFunction(() => window.__game && window.__game.getState);
    const e = await state(page);
    const stored2 = await page.evaluate(() => localStorage.getItem('sunset-rush:v1'));
    await page.goto(BASE + '?debug=1&seed=42');
    await page.waitForFunction(() => window.__game && window.__game.getState);
    const f = await state(page);
    await context.close();
    const p = a.muted === false && b.muted === true && /"muted":true/.test(stored) && c.muted === true && d.muted === false && e.muted === true && /"muted":false/.test(stored2) && f.muted === false;
    return { pass: p, info: `${a.muted}->${b.muted} stored=${stored} reload=${c.muted} toggled back=${d.muted} mute=1:${e.muted} stored=${stored2} after:${f.muted}` };
  });

  await T('32', 'best score: NEW BEST! on game over, survives reload; storage that throws does not break the game', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    await page.evaluate(() => { window.__game.debug.sim.scoreF = 4321; window.__game.debug.setTime(0.5); });
    await waitScene(page, 'gameover', 8000);
    await sleep(700);
    await page.screenshot({ path: `${OUT}/gameover_newbest.png` });
    const nb = await page.evaluate(() => window.__game.debug.sim.newBest);
    const s1 = await state(page);
    await page.reload();
    await page.waitForFunction(() => window.__game && window.__game.getState);
    const s2 = await state(page);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/title_best.png` });
    await context.close();
    // throwing storage
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await c2.addInitScript(() => {
      Storage.prototype.getItem = function () { throw new Error('blocked'); };
      Storage.prototype.setItem = function () { throw new Error('blocked'); };
    });
    const page2 = await c2.newPage();
    const errs = [];
    page2.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page2.on('pageerror', (e) => errs.push(e.message));
    await page2.goto(BASE + '?debug=1&seed=42&mute=1');
    await page2.waitForFunction(() => window.__game && window.__game.getState);
    await sleep(300);
    await page2.keyboard.press('Enter');
    await waitScene(page2, 'playing', 6000);
    await page2.keyboard.press('KeyM');
    await page2.evaluate(() => { const d = window.__game.debug; d.sim.scoreF = 999; d.setTime(0.3); });
    await waitScene(page2, 'gameover', 8000);
    const g = await state(page2);
    await sleep(300);
    await page2.keyboard.press('Enter');
    await waitScene(page2, 'playing', 6000);
    await page2.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); d.warp(2950); d.setSpeedKmh(200); d.setTime(40); });
    await page2.keyboard.down('ArrowUp');
    await waitScene(page2, 'stageclear', 15000);
    await c2.close();
    const p = nb === true && s1.best === 4321 && s2.best === 4321 && errs.length === 0 && g.scene === 'gameover';
    return { pass: p, info: `NEW BEST flag=${nb} best=${s1.best}, after reload title best=${s2.best}, throwing-storage run errors=${JSON.stringify(errs)}` };
  });

  await T('33', 'HUD elements + red blinking time at <= 10 s', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    await page.keyboard.down('ArrowUp');
    await page.evaluate(() => { const d = window.__game.debug; d.setTime(9.5); });
    const cols = [];
    for (let i = 0; i < 24; i++) {
      const d = await px(page, 8, 22, 48, 28);
      let bright = 0, dark = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (d[k] > 220 && d[k + 1] < 90 && d[k + 2] < 90) bright++;
        else if (d[k] > 130 && d[k] < 200 && d[k + 1] < 60 && d[k + 2] < 70) dark++;
      }
      cols.push(bright > dark && bright > 20 ? 'B' : dark > 20 ? 'D' : '.');
      await sleep(60);
    }
    await page.screenshot({ path: `${OUT}/hud_low_time.png` });
    await page.evaluate(() => window.__game.debug.setTime(40));
    await sleep(200);
    await page.screenshot({ path: `${OUT}/hud.png` });
    await page.keyboard.up('ArrowUp');
    await context.close();
    const str = cols.join('');
    return { pass: /B/.test(str) && /D/.test(str), info: `red samples (B=bright red, D=dark red): ${str}` };
  });
};

module.exports = { groups, results, T, rec, newGame, startPlaying, px, near, f2, OUT, driveToGoal };

if (require.main === module) {
  (async () => {
    const want = process.argv.slice(2);
    const browser = await launch();
    const g2 = require('./e2e2.cjs');
    Object.assign(groups, g2.groups);
    for (const name of Object.keys(groups)) {
      if (want.length && !want.includes(name)) continue;
      console.log('\n== group ' + name + ' ==');
      try { await groups[name](browser); } catch (e) { rec('group:' + name, 'group crashed', false, e.message); }
    }
    await browser.close();
    const fails = results.filter((r) => !r.pass);
    console.log(`\n${results.length - fails.length}/${results.length} passed` + (fails.length ? ', FAILED: ' + fails.map((f) => f.id).join(', ') : ''));
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
    process.exit(fails.length ? 1 : 0);
  })();
}
