// Real-time soak test: an in-page autopilot (synthetic key events) plays stage 1 to the goal in the browser.
// Reports frame-time statistics, console errors, and whether the run finished.
const { launch, open, state, sleep, waitScene } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const { page, log } = await open(browser, 'debug=1&seed=42');
  await sleep(300);
  await page.keyboard.press('Enter'); // trusted key: unlocks audio (sound is NOT muted in this test)
  await waitScene(page, 'playing', 6000);
  const res = await page.evaluate(() => new Promise((resolve) => {
    const d = window.__game.debug, sim = d.sim;
    const held = new Set();
    const set = (code, on) => {
      if (on && !held.has(code)) { held.add(code); window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); }
      if (!on && held.has(code)) { held.delete(code); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); }
    };
    const LANES = [-0.667, 0, 0.667];
    let target = 1, last = performance.now();
    const dts = [];
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now();
      dts.push(now - last);
      last = now;
      const s = sim;
      if (s.scene === 'stageclear' || s.scene === 'gameover' || s.scene === 'timeup' || now - t0 > 110000) {
        set('ArrowUp', false); set('ArrowLeft', false); set('ArrowRight', false); set('ArrowDown', false);
        dts.shift();
        dts.sort((a, b) => a - b);
        return resolve({ scene: s.scene, seconds: (now - t0) / 1000, frames: dts.length, p50: dts[Math.floor(dts.length * 0.5)], p99: dts[Math.floor(dts.length * 0.99)], max: dts[dts.length - 1], over33: dts.filter((x) => x > 33.4).length, crashes: s.crashes, overtakes: s.overtakes, score: s.scoreInt, timeLeft: s.timeLeft });
      }
      if (s.scene === 'playing') {
        const pz = s.pos + 839.1;
        const segs = s.course.segments;
        const i0 = Math.floor(pz / 200);
        let cur = 0;
        for (let k = 0; k < 25; k++) cur = Math.max(cur, Math.abs(segs[Math.min(segs.length - 1, i0 + k)].curve) * (1 - k / 40));
        const here = segs[Math.min(segs.length - 1, i0)].curve;
        const spLimit = cur < 0.6 ? 1 : Math.min(1, 3.0 / cur);
        const sp = s.speed / 12000;
        const free = [1e9, 1e9, 1e9];
        for (let l = 0; l < 3; l++) for (const c of s.lanes[l]) { if (c.gone) continue; const rel = c.z - pz; if (rel > -600 && rel < free[l]) free[l] = rel; }
        const curLane = LANES.reduce((b, x, l) => (Math.abs(x - s.playerX) < Math.abs(LANES[b] - s.playerX) ? l : b), 0);
        if (free[target] < 4000 + sp * 9000) {
          let best = target;
          for (const l of [1, curLane - 1, curLane + 1, 0, 2]) if (l >= 0 && l < 3 && free[l] > free[best] + 2500) best = l;
          target = best;
        }
        const want = LANES[target] - s.playerX + (here > 0 ? 0.12 : here < 0 ? -0.12 : 0) * Math.min(1, sp * 2) * Math.abs(here) / 4;
        set('ArrowRight', want > 0.05);
        set('ArrowLeft', want < -0.05);
        const blocked = free[curLane] < 1800 + sp * 3000 && Math.abs(LANES[target] - s.playerX) < 0.3;
        set('ArrowUp', sp < spLimit && !blocked);
        set('ArrowDown', sp > spLimit + 0.08 || (blocked && free[curLane] < 1500));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const st = await state(page);
  console.log(JSON.stringify(res));
  console.log('final state', st.scene, 'audio', JSON.stringify(st.audio));
  console.log('errors', JSON.stringify(log.errors), 'bad', JSON.stringify(log.bad));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
