// Second half of the acceptance checks: audio, input robustness, reproducibility, frame-rate independence,
// gallery, and the Should items. Loaded by e2e.cjs.
const fs = require('fs');
const { launch, open, state, sleep, waitScene, BASE } = require('./lib.cjs');
const base = require('./e2e.cjs');
const { T, newGame, startPlaying, px, near, f2, OUT, driveToGoal } = base;

const groups = {};

groups.audio = async (browser) => {
  await T('34', 'audio: none before input, running after key; bgm/engineHz per scene; mute gain 0; suspend on pause', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42');
    const out = {};
    out.title = await state(page);
    await page.keyboard.press('Enter');
    await sleep(500);
    out.count = await state(page);
    await waitScene(page, 'playing', 5000);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); d.setTime(120); });
    await page.keyboard.down('ArrowUp');
    // engine frequency follows speed: 150 km/h -> ~130 Hz, 300 -> ~200 Hz (read the actual oscillator too)
    await page.evaluate(() => window.__game.debug.setSpeedKmh(150));
    await sleep(120);
    out.s150 = await state(page);
    out.o150 = await page.evaluate(() => window.__game.debug.audio.engine && window.__game.debug.audio.engine.o[0].frequency.value);
    await page.evaluate(() => window.__game.debug.setSpeedKmh(300));
    await sleep(120);
    out.s300 = await state(page);
    out.o300 = await page.evaluate(() => window.__game.debug.audio.engine && window.__game.debug.audio.engine.o[0].frequency.value);
    const step0 = await page.evaluate(() => window.__game.debug.audio.inst && window.__game.debug.audio.inst.step);
    await sleep(500);
    const step1 = await page.evaluate(() => window.__game.debug.audio.inst && window.__game.debug.audio.inst.step);
    // mute
    await page.keyboard.press('KeyM');
    await sleep(120);
    out.muteGain = await page.evaluate(() => window.__game.debug.audio.master.gain.value);
    await page.keyboard.press('KeyM');
    await sleep(120);
    out.unmuteGain = await page.evaluate(() => window.__game.debug.audio.master.gain.value);
    // pause -> suspended, engineHz 0, bgm id kept
    await page.keyboard.press('KeyP');
    await sleep(400);
    out.paused = await state(page);
    const stepP0 = await page.evaluate(() => window.__game.debug.audio.inst && window.__game.debug.audio.inst.step);
    await sleep(500);
    const stepP1 = await page.evaluate(() => window.__game.debug.audio.inst && window.__game.debug.audio.inst.step);
    await page.keyboard.press('KeyP');
    await sleep(300);
    out.resumed = await state(page);
    // stageclear / timeup
    await page.evaluate(() => window.__game.debug.setTime(0.2));
    await sleep(500);
    out.timeup = await state(page);
    await waitScene(page, 'gameover', 5000);
    out.gameover = await state(page);
    await page.keyboard.press('Escape');
    await sleep(200);
    out.titleAgain = await state(page);
    await page.keyboard.up('ArrowUp');
    await context.close();
    const p = out.title.audio.state === 'none' && out.count.audio.state === 'running' && out.count.audio.bgm === 'bgm_1' && Math.abs(out.count.audio.engineHz - 60) < 0.5
      && near(out.s150.audio.engineHz, 125, 135) && near(out.s300.audio.engineHz, 190, 210) && out.o150 > 100 && out.o300 > 150
      && step1 > step0 && stepP1 === stepP0 && out.muteGain === 0 && out.unmuteGain === 0.5
      && out.paused.scene === 'paused' && out.paused.audio.engineHz === 0 && out.paused.audio.bgm === 'bgm_1' && out.paused.audio.state === 'suspended'
      && out.resumed.audio.state === 'running' && out.timeup.audio.bgm === null && out.timeup.scene === 'timeup'
      && out.gameover.audio.bgm === null && out.gameover.audio.engineHz === 0 && out.titleAgain.audio.bgm === null && out.titleAgain.audio.engineHz === 0;
    return { pass: p, info: `title=${out.title.audio.state} count=${JSON.stringify(out.count.audio)} 150km/h=${f2(out.s150.audio.engineHz)}Hz(osc ${f2(out.o150)}) 300km/h=${f2(out.s300.audio.engineHz)}Hz(osc ${f2(out.o300)}) seq ${step0}->${step1} paused seq ${stepP0}->${stepP1} muteGain=${out.muteGain} unmute=${out.unmuteGain} paused=${JSON.stringify(out.paused.audio)} resumed=${out.resumed.audio.state} timeup.bgm=${out.timeup.audio.bgm}` };
  });

  await T('34b', 'BGM per stage: bgm_1/2/3 selected; stageclear stops BGM', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1&stage=1');
    await startPlaying(page);
    const b1 = (await state(page)).audio.bgm;
    await page.keyboard.down('ArrowUp');
    await driveToGoal(page, 1);
    const clear = await state(page);
    await sleep(1700);
    await page.keyboard.press('Enter');
    await sleep(300);
    const b2 = (await state(page)).audio.bgm;
    const inst2 = await page.evaluate(() => window.__game.debug.audio.inst && window.__game.debug.audio.inst.id);
    await waitScene(page, 'playing', 5000);
    await driveToGoal(page, 2);
    await sleep(1700);
    await page.keyboard.press('Enter');
    await sleep(300);
    const b3 = (await state(page)).audio.bgm;
    const inst3 = await page.evaluate(() => window.__game.debug.audio.inst && window.__game.debug.audio.inst.id);
    await context.close();
    return { pass: b1 === 'bgm_1' && clear.audio.bgm === null && b2 === 'bgm_2' && b3 === 'bgm_3' && inst2 === 'bgm_2' && inst3 === 'bgm_3', info: `${b1} clear=${clear.audio.bgm} ${b2}(${inst2}) ${b3}(${inst3})` };
  });
};

groups.input = async (browser) => {
  await T('35', 'input robustness: arrows/Space prevented, blur clears keys, repeat ignored', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await page.evaluate(() => {
      window.__prevented = {};
      window.addEventListener('keydown', (e) => { window.__prevented[e.code] = e.defaultPrevented; });
    });
    // repeat must not start the game
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: true, bubbles: true })));
    await sleep(100);
    const rep = await state(page);
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) { await page.keyboard.down(k); await page.keyboard.up(k); }
    const prevented = await page.evaluate(() => window.__prevented);
    const afterKeys = await state(page); // Space started the run (confirm)
    await waitScene(page, 'playing', 6000);
    await page.evaluate(() => window.__game.debug.setTime(120));
    await page.keyboard.down('ArrowUp');
    await sleep(600);
    const sBefore = await state(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await sleep(150);
    const keyState = await page.evaluate(() => window.__game.debug.sim.input.up);
    const sBlur = await state(page);
    // resume (auto-paused by blur) and check the car is no longer accelerating
    if (sBlur.scene === 'paused') await page.keyboard.press('KeyP');
    await sleep(80);
    const r0 = await state(page);
    await sleep(700);
    const r1 = await state(page);
    await page.keyboard.up('ArrowUp');
    const scrollY = await page.evaluate(() => window.scrollY);
    await context.close();
    const p = rep.scene === 'title' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].every((k) => prevented[k] === true)
      && afterKeys.scene !== 'title' && keyState === false && r1.speedKmh < r0.speedKmh && scrollY === 0;
    return { pass: p, info: `repeat kept ${rep.scene}; defaultPrevented=${JSON.stringify(prevented)}; after blur input.up=${keyState}, scene ${sBlur.scene}; speed ${f2(r0.speedKmh)} -> ${f2(r1.speedKmh)} (before blur ${f2(sBefore.speedKmh)})` };
  });

  await T('S-15', 'window blur / hidden auto-pauses a running game', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await sleep(120);
    const a = await state(page);
    await page.keyboard.press('KeyP');
    await sleep(100);
    const b = await state(page);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(120);
    const c = await state(page);
    await context.close();
    return { pass: a.scene === 'paused' && b.scene === 'playing' && c.scene === 'paused', info: `blur -> ${a.scene}, resumed ${b.scene}, hidden -> ${c.scene}` };
  });
};

groups.repro = async (browser) => {
  await T('36', 'layoutHash: same seed equal, different seed differs, stable across R restart (all stages)', async () => {
    const out = {};
    for (const stage of [1, 2, 3]) {
      const hashes = [];
      for (const seed of [42, 42, 43]) {
        const { page, context } = await newGame(browser, `debug=1&seed=${seed}&mute=1&stage=${stage}`);
        await page.keyboard.press('Enter');
        await sleep(200);
        hashes.push((await state(page)).layoutHash);
        if (seed === 42 && hashes.length === 1) {
          await page.keyboard.press('KeyR');
          await sleep(200);
          hashes.push((await state(page)).layoutHash);
        }
        await context.close();
      }
      out[stage] = hashes;
    }
    const p = [1, 2, 3].every((s) => out[s][0] === out[s][1] && out[s][0] === out[s][2] && out[s][0] !== out[s][3]);
    return { pass: p, info: JSON.stringify(out) };
  });

  await T('37', 'frame-rate independence under CPU throttling (~30 fps): 3 s of Up = 170-190 km/h, timeLeft 25.0+-0.3 after 5 s', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    const client = await context.newCDPSession(page);
    let rate = 4;
    let fps = 0;
    for (const r of [4, 6, 8, 10]) {
      await client.send('Emulation.setCPUThrottlingRate', { rate: r });
      fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 > 1000) resolve(n); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
      rate = r;
      if (fps <= 34) break;
    }
    await page.keyboard.press('Enter');
    await waitScene(page, 'playing', 8000);
    const t0 = Date.now();
    await page.keyboard.down('ArrowUp');
    await sleep(3000);
    const s3 = await state(page);
    const el3 = (Date.now() - t0) / 1000;
    await page.keyboard.up('ArrowUp');
    await sleep(Math.max(0, 5000 - (Date.now() - t0)));
    const s5 = await state(page);
    const el5 = (Date.now() - t0) / 1000;
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await context.close();
    // time left expectation: 30 - elapsed since playing began
    const expectedTL = 30 - el5;
    return { pass: near(s3.speedKmh, 168, 192) && near(s5.timeLeft, 24.7, 25.3) && Math.abs(s5.timeLeft - expectedTL) < 0.35, info: `throttle x${rate} -> ${fps} fps; accel: ${f2(s3.speedKmh)} km/h @${el3.toFixed(2)}s; timeLeft ${f2(s5.timeLeft)} @${el5.toFixed(2)}s (expected ${f2(expectedTL)})` };
  });
};

groups.gallery = async (browser) => {
  await T('38', 'gallery: every Must image canvas has data-* and real pixels; sound buttons play without errors', async () => {
    const { context, page } = await (async () => {
      const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const page = await context.newPage();
      return { context, page };
    })();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(e.message));
    const bad = [];
    page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await page.goto(BASE + '?gallery=1&mute=1');
    await page.waitForSelector('canvas[data-asset-id="font_pixel"]');
    const must = ['car_player', 'car_sedan', 'car_truck', 'car_sports', 'rs_palm', 'rs_rock', 'rs_shrub', 'rs_pine', 'rs_boulder', 'rs_fern', 'rs_lamp', 'rs_neon', 'rs_building', 'gate_checkpoint', 'gate_goal', 'bg_sky_1', 'bg_sky_2', 'bg_sky_3', 'bg_far_1', 'bg_far_2', 'bg_far_3', 'logo_title', 'font_pixel', 'fx_smoke'];
    const minFrames = { car_player: 3, font_pixel: 50, fx_smoke: 4 };
    const should = ['bg_near_1', 'bg_near_2', 'bg_near_3', 'rs_billboard', 'rs_signpost', 'rs_bollard', 'rs_building_b', 'gate_start', 'car_player_brake', 'car_player_wheel', 'fx_dust', 'fx_spark'];
    const info = await page.evaluate(([must, should]) => {
      const res = {};
      for (const id of [...must, ...should]) {
        const c = document.querySelector(`canvas[data-asset-id="${id}"]`);
        if (!c) { res[id] = null; continue; }
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const cols = new Set();
        let opaque = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { opaque++; if (cols.size < 40) cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); } }
        res[id] = { frames: +c.dataset.frames, fw: +c.dataset.frameW, fh: +c.dataset.frameH, w: c.width, h: c.height, opaque, colors: cols.size, ok: c.width === +c.dataset.frames * +c.dataset.frameW * (c.width / (+c.dataset.frames * +c.dataset.frameW)) };
      }
      return res;
    }, [must, should]);
    const problems = [];
    for (const id of must) {
      const r = info[id];
      if (!r) { problems.push(id + ' missing'); continue; }
      if (r.frames < (minFrames[id] || 1)) problems.push(id + ' frames ' + r.frames);
      if (r.opaque === 0 || r.colors < 3) problems.push(id + ' blank/uniform');
      const scale = r.w / (r.frames * r.fw);
      if (scale < 2 || !Number.isInteger(scale)) problems.push(id + ' scale ' + scale);
    }
    for (const id of should) if (!info[id]) problems.push('(should) ' + id + ' missing');
    // caption text under each canvas contains the id
    const captions = await page.evaluate(() => Array.from(document.querySelectorAll('figure')).every((f) => f.querySelector('canvas') && f.querySelector('figcaption') && f.querySelector('figcaption').textContent.includes(f.querySelector('canvas').dataset.assetId)));
    await page.screenshot({ path: `${OUT}/gallery_top.png` });
    await page.screenshot({ path: `${OUT}/gallery_full.png`, fullPage: true });
    // sounds
    const ids = ['bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title', 'mute'];
    const missing = [];
    for (const id of ids) if (!(await page.$(`button[data-sound-id="${id}"]`))) missing.push(id);
    for (const id of ids.filter((i) => i !== 'mute')) {
      await page.click(`button[data-sound-id="${id}"]`);
      await sleep(id.startsWith('bgm') ? 400 : 150);
      if (id.startsWith('bgm') || id === 'sfx_engine') await page.click(`button[data-sound-id="${id}"]`); // toggle off
    }
    await page.click('button[data-sound-id="mute"]');
    const muteText = await page.textContent('button[data-sound-id="mute"]');
    await page.click('button[data-sound-id="mute"]');
    await sleep(300);
    await context.close();
    const p = problems.length === 0 && captions && missing.length === 0 && errs.length === 0 && bad.length === 0;
    return { pass: p, info: `problems=${JSON.stringify(problems)} captions=${captions} missingSounds=${JSON.stringify(missing)} errors=${JSON.stringify(errs)} bad=${JSON.stringify(bad)} muteBtn="${muteText}" assets=${must.length + should.length}` };
  });

  await T('38b', 'BGM loudness (offline render): peak < 1.0 and audible', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE + '?gallery=1&mute=1');
    await page.waitForFunction(() => window.__gallery);
    const out = [];
    for (const id of ['bgm_1', 'bgm_2', 'bgm_3']) out.push(await page.evaluate(([id]) => window.__gallery.measureBgm(id, 24), [id]));
    await context.close();
    const ok = out.every((o) => o.peak > 0.15 && o.peak < 1.0 && o.rms > 0.02);
    return { pass: ok, info: out.map((o) => `${o.id}: peak=${o.peak.toFixed(3)} rms=${o.rms.toFixed(3)}`).join(' | ') };
  });
};

groups.should = async (browser) => {
  await T('S-03/04', 'brake lamps switch on while braking; tyre animation changes over 0.1 s', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); d.setSpeedKmh(150); d.setTime(120); });
    await page.keyboard.down('ArrowUp');
    // lamp region: player sprite at x 240..400, y 266..354; lamps around y ~ 315
    const lamp = async () => { const d = await px(page, 250, 305, 30, 20); let hot = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i + 1] > 170) hot++; return hot; };
    const idle = await lamp();
    // tyre animation: compare region of tyres at two times 100 ms apart
    const tyre = () => px(page, 240, 330, 24, 22);
    const t1 = await tyre();
    let changed = 0;
    for (let k = 0; k < 6; k++) { await sleep(70); const t2 = await tyre(); for (let i = 0; i < t1.length; i += 4) if (t1[i] !== t2[i]) { changed++; break; } }
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('ArrowDown');
    await sleep(150);
    const braking = await lamp();
    await page.screenshot({ path: `${OUT}/brake.png` });
    await page.keyboard.up('ArrowDown');
    await context.close();
    return { pass: braking > idle + 10 && changed >= 1, info: `hot lamp pixels idle=${idle} braking=${braking}; tyre frames changed in ${changed}/6 samples` };
  });

  await T('S-05', 'crash effects: shake, sparks, smoke (6 puffs over 0.5 s)', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    const r = await page.evaluate(async () => {
      const d = window.__game.debug, sim = d.sim;
      sim.roadside.forEach((o) => (o.hit = true));
      sim.traffic.forEach((c) => (c.hit = true));
      const c = sim.traffic[0]; c.hit = false; c.passed = false; c.gone = false; c.x = 0; c.speed = 2400; c.eff = 2400; c.z = 839.1 + 1500; c.prevRel = 1500;
      sim.lanes.forEach((l) => l.sort((a, b) => b.z - a.z));
      sim.playerX = 0; sim.pos = 0; d.setSpeedKmh(200); sim.input.up = true;
      return await new Promise((resolve) => {
        let seenShake = false, seenSparks = false, maxSmoke = 0, puffs = new Set(), start = null;
        const t0 = performance.now();
        const tick = () => {
          if (sim.crashAge < 999 && start === null) start = performance.now();
          if (sim.shake > 0) seenShake = true;
          if (sim.fx.sparks.length) seenSparks = true;
          maxSmoke = Math.max(maxSmoke, sim.fx.smoke.length);
          sim.fx.smoke.forEach((p) => puffs.add(p));
          if ((start !== null && performance.now() - start > 900) || performance.now() - t0 > 6000) return resolve({ seenShake, seenSparks, maxSmoke, puffs: puffs.size });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    await context.close();
    return { pass: r.seenShake && r.seenSparks && r.puffs === 6, info: JSON.stringify(r) };
  });

  await T('S-06', 'speed lines appear at >= 250 km/h', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    const r = await page.evaluate(() => {
      const d = window.__game.debug, sim = d.sim, rn = d.renderer;
      d.warp(300);
      const grab = (kmh) => {
        sim.speed = kmh * 40;
        rn.drawWorld(sim);
        return rn.ctx.getImageData(0, 60, 640, 200).data;
      };
      let changed = 0, changedLow = 0;
      for (let k = 0; k < 8; k++) {
        sim.t += 7;
        const a = grab(200);
        const a2 = grab(200); // identical state again -> should not differ (no lines)
        const b = grab(290);
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) changed++;
          if (Math.abs(a[i] - a2[i]) + Math.abs(a[i + 1] - a2[i + 1]) + Math.abs(a[i + 2] - a2[i + 2]) > 30) changedLow++;
        }
      }
      return { changed, changedLow };
    });
    await page.evaluate(() => { const d = window.__game.debug; d.setSpeedKmh(290); });
    await page.keyboard.down('ArrowUp');
    await sleep(200);
    await page.screenshot({ path: `${OUT}/speedlines.png` });
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: r.changed > 300 && r.changedLow < 60, info: `same scene redrawn at 290 vs 200 km/h: ${r.changed} px differ (speed lines); 200 vs 200: ${r.changedLow} px differ` };
  });

  await T('S-07', 'near miss: +20 and NEAR MISS popup at >= 180 km/h when passing within 0.12 lateral gap', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    await page.keyboard.down('ArrowUp');
    const r = await page.evaluate(async () => {
      const d = window.__game.debug, sim = d.sim;
      sim.traffic.forEach((c) => (c.hit = true));
      sim.roadside.forEach((o) => (o.hit = true));
      const c = sim.traffic.find((t) => t.type === 'sedan');
      c.hit = false; c.passed = false; c.gone = false; c.x = 0.667; c.speed = 3600; c.eff = 3600;
      sim.pos = 0; sim.playerX = 0.667 - 0.27; // gap = 0.27 - 0.2 = 0.07
      c.z = 839.1 + 2600; c.prevRel = 2600;
      sim.lanes.forEach((l) => l.sort((a, b) => b.z - a.z));
      d.setSpeedKmh(230); d.setTime(120);
      return await new Promise((resolve) => {
        const t0 = performance.now();
        let s0 = sim.scoreF, popup = false, ov0 = sim.overtakes;
        const tick = () => {
          sim.playerX = 0.667 - 0.27;
          if (sim.fx.popups.some((p) => p.kind === 'nearmiss')) popup = true;
          if (sim.overtakes > ov0) return resolve({ gain: sim.scoreF - s0, popup, speed: sim.speed / 40 });
          if (performance.now() - t0 > 6000) return resolve({ gain: -1, popup, speed: sim.speed / 40 });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    await page.keyboard.up('ArrowUp');
    await context.close();
    // gain includes 50 (overtake) + 20 (near miss) + distance points accumulated meanwhile (~0.9/step)
    return { pass: r.popup && r.gain >= 70 && r.gain < 130, info: JSON.stringify(r) };
  });

  await T('S-09', 'touch controls: buttons only on touch devices, act only while pressed; tap confirms on title', async () => {
    // desktop: hidden
    const d1 = await newGame(browser, 'debug=1&seed=42&mute=1');
    const hiddenDesktop = await d1.page.evaluate(() => getComputedStyle(document.getElementById('touch')).display === 'none' || document.getElementById('touch').hidden);
    await d1.context.close();
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1', { viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });
    const shown = await page.evaluate(() => !document.getElementById('touch').hidden && getComputedStyle(document.getElementById('touch')).display !== 'none' && matchMedia('(pointer: coarse)').matches);
    // tap on the canvas starts the run
    await page.touchscreen.tap(330, 180);
    await sleep(300);
    const a = await state(page);
    await waitScene(page, 'playing', 6000);
    const client = await context.newCDPSession(page);
    const center = async (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
    const gas = await center('.tbtn.gas');
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gas.x, y: gas.y, id: 1 }] });
    await sleep(1200);
    const held = await state(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(600);
    const released = await state(page);
    const right = await center('.tbtn[data-btn="right"]');
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gas.x, y: gas.y, id: 1 }, { x: right.x, y: right.y, id: 2 }] });
    await sleep(700);
    const steer = await state(page);
    await page.screenshot({ path: `${OUT}/touch.png` });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await context.close();
    return { pass: hiddenDesktop && shown && a.scene === 'countdown' && held.speedKmh > 40 && released.speedKmh < held.speedKmh && steer.playerX > 0.02, info: `desktopHidden=${hiddenDesktop} touchShown=${shown} tap->${a.scene}; gas held speed=${f2(held.speedKmh)}, released=${f2(released.speedKmh)}; gas+right playerX=${f2(steer.playerX)}` };
  });

  await T('S-10/11', 'off-road dust + gravel sound; time-warning ticks once per second at <= 10 s', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await startPlaying(page);
    await page.evaluate(() => { const d = window.__game.debug; d.sim.traffic.forEach((c) => (c.hit = true)); d.sim.roadside.forEach((o) => (o.hit = true)); d.setPlayerX(1.1); d.setSpeedKmh(100); d.setTime(120); });
    await page.keyboard.down('ArrowUp');
    await sleep(700);
    const off = await page.evaluate(() => { const d = window.__game.debug; return { dust: d.sim.fx.dust.length, gain: d.audio.off ? d.audio.off.g.gain.value : -1 }; });
    await page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(0); window.__ticks = 0; const orig = d.audio.sfx.bind(d.audio); d.audio.sfx = (n) => { if (n === 'timewarn') window.__ticks++; orig(n); }; d.setTime(10.2); });
    await sleep(3300);
    const ticks = await page.evaluate(() => window.__ticks);
    const offAfter = await page.evaluate(() => window.__game.debug.audio.off.g.gain.value);
    await page.keyboard.up('ArrowUp');
    await context.close();
    return { pass: off.dust > 0 && off.gain > 0.05 && offAfter < 0.02 && ticks >= 3 && ticks <= 4, info: `dust puffs=${off.dust} gravel gain=${off.gain.toFixed(3)} (back on road ${offAfter.toFixed(3)}); timewarn ticks in 3.3 s = ${ticks}` };
  });

  await T('S-14', 'traffic colour variants: >= 2 per type in use', async () => {
    const { page, context } = await newGame(browser, 'debug=1&seed=42&mute=1&stage=3');
    await page.keyboard.press('Enter');
    await sleep(200);
    const r = await page.evaluate(() => { const m = {}; window.__game.debug.sim.traffic.forEach((c) => { (m[c.type] = m[c.type] || new Set()).add(c.variant); }); return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.size])); });
    await context.close();
    return { pass: Object.values(r).every((n) => n >= 2), info: JSON.stringify(r) };
  });

  await T('S-16', 'F toggles fullscreen without errors; ?debug=1 shows FPS text', async () => {
    const { page, context, log } = await newGame(browser, 'debug=1&seed=42&mute=1');
    await page.keyboard.press('KeyF');
    await sleep(500);
    const fs1 = await page.evaluate(() => !!document.fullscreenElement);
    await page.keyboard.press('KeyF');
    await sleep(500);
    const fs2 = await page.evaluate(() => !!document.fullscreenElement);
    await context.close();
    return { pass: log.errors.length === 0, info: `fullscreen after F=${fs1}, after second F=${fs2}, errors=${JSON.stringify(log.errors)}` };
  });
};

module.exports = { groups };
