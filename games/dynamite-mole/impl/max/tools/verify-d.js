/* verify-d.js : Should items S1-S15 (touch UI, shake, particles, popups, warnings, blink, BGM variety, auto-pause, ...) */
'use strict';
const L = require('./verify-lib.js');
const { ok, info, sleep, open, closePage, snap, dbg, waitState, startGame, record } = L;

async function rect(page, sel) {
  return page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(e).display !== 'none' && r.width > 0 }; }, sel);
}
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

async function groupTouch(browser) {
  /* desktop without ?touch: no touch UI */
  let page = await open(browser, '?seed=12345&debug=1');
  let t = await rect(page, '#touch');
  ok('S1a', !t.vis, 'no touch UI on a desktop pointer by default');
  await closePage(page);

  /* mobile emulation (pointer: coarse) shows it automatically */
  page = await open(browser, '?seed=12345&debug=1', { viewport: { width: 390, height: 844 }, touch: true });
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  t = await rect(page, '#touch');
  ok('S1b', coarse && t.vis, 'coarse pointer -> touch UI shown automatically (coarse=' + coarse + ')');
  await closePage(page);

  page = await open(browser, '?seed=12345&debug=1&touch=1', { viewport: { width: 390, height: 844 }, touch: true });
  const cvr = await rect(page, '#game');
  t = await rect(page, '#touch');
  const names = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'BOMB', 'PAUSE'];
  const btn = {};
  for (const n of names) btn[n] = await rect(page, `button[aria-label="${n}"]`);
  const allShown = names.every((n) => btn[n] && btn[n].vis && btn[n].w > 20 && btn[n].h > 12);
  ok('S1c', allShown, 'all six buttons visible: ' + names.map((n) => n + ' ' + Math.round(btn[n].w) + 'x' + Math.round(btn[n].h)).join(', '));
  const fits = cvr.y + cvr.h <= t.y + 0.5 && t.y + t.h <= 844.5 && cvr.x >= -0.5 && cvr.x + cvr.w <= 390.5 && t.x >= -0.5 && t.x + t.w <= 390.5;
  ok('S1d', fits, `canvas ${cvr.w.toFixed(0)}x${cvr.h.toFixed(0)} above touch UI (top ${t.y.toFixed(0)}) inside 390x844`);
  const inTouch = names.every((n) => btn[n].x >= t.x - 0.5 && btn[n].y >= t.y - 0.5 && btn[n].x + btn[n].w <= t.x + t.w + 0.5 && btn[n].y + btn[n].h <= t.y + t.h + 0.5);
  ok('S1e', inTouch, 'buttons lie inside the touch area');

  const client = await page.context().newCDPSession(page);
  const tp = (id, r) => ({ x: center(r).x, y: center(r).y, id, radiusX: 4, radiusY: 4, force: 1 });
  /* tap on the canvas starts the game */
  await page.touchscreen.tap(cvr.x + cvr.w / 2, cvr.y + cvr.h / 2);
  await waitState(page, 'playing', 6000);
  ok('S1f', true, 'canvas tap on the title starts the game');
  await dbg(page, 'godMode', true);
  await dbg(page, 'killAllEnemies');
  /* hold RIGHT */
  const rec = record(page, 1300);
  await sleep(100);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(1, btn.RIGHT)] });
  await sleep(700);
  const mid = await snap(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(500);
  const end = await snap(page);
  await rec;
  ok('S1g', mid.player.x > 1.5 && Number.isInteger(end.player.x) && end.player.x >= 3 && end.player.x <= 5, `RIGHT held: x ${mid.player.x.toFixed(2)} -> stops at ${end.player.x}`);
  await sleep(300);
  const still = await snap(page);
  ok('S1h', still.player.x === end.player.x, 'released -> no more movement');
  /* BOMB tap */
  await page.touchscreen.tap(center(btn.BOMB).x, center(btn.BOMB).y);
  await sleep(200);
  let s = await snap(page);
  ok('S1i', s.bombs.length === 1, 'BOMB button places a bomb');
  /* two fingers: LEFT held while BOMB tapped (needs maxBombs 2) */
  await dbg(page, 'setPowerups', { maxBombs: 3 });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(1, btn.LEFT)] });
  await sleep(120);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(1, btn.LEFT), tp(2, btn.BOMB)] });
  await sleep(80);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [tp(1, btn.LEFT)] });
  await sleep(500);
  s = await snap(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok('S1j', s.bombs.length >= 2, 'multi-touch: moving while pressing BOMB works (bombs=' + s.bombs.length + ')');
  /* PAUSE */
  await page.touchscreen.tap(center(btn.PAUSE).x, center(btn.PAUSE).y);
  await sleep(200);
  s = await snap(page);
  const p1 = s.state;
  await page.touchscreen.tap(center(btn.PAUSE).x, center(btn.PAUSE).y);
  await sleep(200);
  s = await snap(page);
  ok('S1k', p1 === 'paused' && s.state === 'playing', `PAUSE button toggles (${p1} -> ${s.state})`);
  /* gameOver: canvas tap retries */
  await dbg(page, 'godMode', false); await dbg(page, 'setLives', 1); await dbg(page, 'setTimeLeft', 0.2);
  await waitState(page, 'gameOver', 4000);
  await sleep(800);
  await page.touchscreen.tap(cvr.x + cvr.w / 2, cvr.y + cvr.h / 2);
  await sleep(200);
  s = await snap(page);
  ok('S1l', s.state === 'stageIntro' && s.score === 0, 'canvas tap on gameOver retries -> ' + s.state);
  ok('S1m', page._errors.length === 0, 'no console errors in touch session: ' + JSON.stringify(page._errors));
  await closePage(page);
}

async function groupEffects(browser) {
  /* S2 shake + reduced motion, S3 particles, S4 popups, S13 flash */
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'teleport', 4, 1);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft'); await sleep(230); await page.keyboard.press('ArrowLeft'); await sleep(230);
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 4000, polling: 5 });
  await sleep(30);
  let fx = await page.evaluate(() => ({ shake: DM.Game.shakeT, kinds: Array.from(new Set(DM.Game.particles.map((p) => p.kind))) }));
  ok('S2a', fx.shake > 0.1, 'screen shake active after an explosion (shakeT=' + fx.shake.toFixed(3) + ')');
  ok('S3', fx.kinds.includes('rock') && fx.kinds.includes('spark') && fx.kinds.length >= 2, 'particle kinds: ' + JSON.stringify(fx.kinds));
  /* the canvas really moves: compare two frames of a static tile row */
  await sleep(1200);
  const walk = await page.evaluate(() => DM.Game.particles.some((p) => p.kind === 'dust'));
  info('dust particles currently alive: ' + walk);
  /* S4 popup */
  await dbg(page, 'killAllEnemies');
  const flashT = await page.evaluate(() => DM.Game.flashT);
  ok('S13b', flashT > 0.2, 'white flash when the exit opens (flashT=' + flashT.toFixed(2) + ')');
  const pop = await page.evaluate(() => DM.Game.popups.map((p) => p.text));
  ok('S4a', pop.includes('+100'), 'popup created on kill: ' + JSON.stringify(pop));
  await sleep(300);
  let sn = await snap(page);
  ok('S4b', sn.texts.includes('+100'), 'popup text drawn with the bitmap font');
  await sleep(700);
  sn = await snap(page);
  ok('S4c', !sn.texts.includes('+100'), 'popup gone after ~0.8 s');
  /* S13 flash on exit open (the kill above opened it) */
  ok('S13a', sn.exit.open, 'exit opened');
  await closePage(page);

  page = await open(browser, '?seed=12345&debug=1', { reducedMotion: 'reduce' });
  await startGame(page);
  await dbg(page, 'godMode', true);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__GAME__.snapshot().flames.length > 0, null, { timeout: 4000, polling: 5 });
  fx = await page.evaluate(() => ({ shake: DM.Game.shakeT, rm: DM.Game.reducedMotion }));
  ok('S2b', fx.rm && fx.shake === 0, 'prefers-reduced-motion: reduce -> no shake (' + JSON.stringify(fx) + ')');
  await closePage(page);
}

async function groupWarn(browser) {
  /* S6: TIME flashes red at <= 30 s, warn every second at <= 10 s */
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'setTimeLeft', 25);
  const reds = await page.evaluate(() => new Promise((res) => {
    const cv = document.getElementById('game'), c = document.createElement('canvas'); c.width = 130; c.height = 16;
    const x = c.getContext('2d'); let redFrames = 0, normFrames = 0; const t0 = performance.now();
    (function f() {
      x.drawImage(cv, 350, 9, 130, 16, 0, 0, 130, 16);
      const d = x.getImageData(0, 0, 130, 16).data; let red = 0, cream = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] > 220 && d[i + 1] < 110 && d[i + 2] < 100) red++; else if (d[i] > 240 && d[i + 1] > 225 && d[i + 2] > 180) cream++; }
      if (red > 15) redFrames++; else if (cream > 15) normFrames++;
      if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res({ redFrames, normFrames });
    })();
  }));
  ok('S6a', reds.redFrames > 10 && reds.normFrames > 10, `TIME blinks red/normal at 25 s left: red frames ${reds.redFrames}, normal ${reds.normFrames}`);
  await dbg(page, 'setTimeLeft', 40);
  await sleep(200);
  const calm = await page.evaluate(() => new Promise((res) => {
    const cv = document.getElementById('game'), c = document.createElement('canvas'); c.width = 130; c.height = 16;
    const x = c.getContext('2d'); let redFrames = 0; const t0 = performance.now();
    (function f() {
      x.drawImage(cv, 350, 9, 130, 16, 0, 0, 130, 16);
      const d = x.getImageData(0, 0, 130, 16).data; let red = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] < 110 && d[i + 2] < 100) red++;
      if (red > 15) redFrames++;
      if (performance.now() - t0 < 600) requestAnimationFrame(f); else res(redFrames);
    })();
  }));
  ok('S6b', calm === 0, 'no red TIME above 30 s (red frames ' + calm + ')');
  await dbg(page, 'setTimeLeft', 6.5);
  await sleep(4200);
  const warns = (await snap(page)).audio.sfxLog.filter((l) => l.name === 'warn').map((l) => l.time);
  const gaps = warns.slice(1).map((v, i) => v - warns[i]);
  ok('S6c', warns.length >= 4 && gaps.every((g) => g > 800 && g < 1250), `warn ticks: ${warns.length}, gaps ms ${gaps.map((g) => Math.round(g)).join(',')}`);
  await closePage(page);

  /* S7: the bomb flashes faster in the last 0.8 s */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'killAllEnemies');
  await dbg(page, 'teleport', 3, 3);
  await sleep(100);
  const tog = await page.evaluate(() => new Promise((res) => {
    const cv = document.getElementById('game'), c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
    const t0 = performance.now(); const series = [];
    setTimeout(() => window.__GAME__.debug.teleport(7, 5), 120);          // step away so the bomb sprite is not covered
    (function f() {
      const s = window.__GAME__.snapshot();
      const b = s.bombs[0];
      if (b) {
        x.drawImage(cv, 3 * 32, 64 + 3 * 32, 32, 32, 0, 0, 32, 32);
        const d = x.getImageData(0, 0, 32, 32).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        series.push([b.timeLeft, sum]);
      }
      if (performance.now() - t0 < 2900 && (!b || b.timeLeft > 0.02)) requestAnimationFrame(f); else res(series);
    })();
  }));
  const bright = tog.map((p) => p[1]);
  const thr = (Math.max.apply(null, bright) + Math.min.apply(null, bright)) / 2;
  function toggles(lo, hi) {
    const seg = tog.filter((p) => p[0] > lo && p[0] <= hi).map((p) => p[1] > thr ? 1 : 0);
    let n = 0; for (let i = 1; i < seg.length; i++) if (seg[i] !== seg[i - 1]) n++;
    return n;
  }
  const early = toggles(1.0, 1.7), late = toggles(0.05, 0.75);
  ok('S7', late > early * 1.5 && late >= 4, `brightness toggles per 0.7 s window: early(1.7-1.0 s left) ${early}, late(<0.75 s left) ${late}`);
  await closePage(page);
}

async function groupAudioVariety(browser) {
  const page = await open(browser, '?seed=12345&debug=1');
  const r = await page.evaluate(() => {
    const T = DM.Synth.tracks, ids = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'title'];
    const sig = ids.map((id) => JSON.stringify(T[id].ev.map((e) => e.filter((n) => n.ch === 'lead').map((n) => n.midi))));
    const distinct = new Set(sig).size;
    const bpms = ids.map((id) => T[id].bpm);
    return { distinct, bpms, loops: ids.map((id) => +(T[id].steps * T[id].stepDur).toFixed(1)), voices: ids.map((id) => Array.from(new Set([].concat.apply([], T[id].ev).map((e) => e.ch))).length) };
  });
  ok('S8a', r.distinct === 6, 'title + 5 stage songs are all different tunes; bpm ' + r.bpms.join('/') + ', loops ' + r.loops.join('/') + ' s');
  ok('S8b', r.voices.every((v) => v >= 4), 'each song has lead + bass + arp/drums voices: ' + r.voices.join(','));
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'setTimeLeft', 60);
  await sleep(150);
  const before = await page.evaluate(() => DM.Audio.tempoUp);
  await dbg(page, 'setTimeLeft', 25);
  await sleep(150);
  const after = await page.evaluate(() => DM.Audio.tempoUp);
  ok('S8c', before === false && after === true, `tempo-up flag: 60 s left ${before} -> 25 s left ${after}`);
  await closePage(page);
}

async function groupMisc(browser) {
  /* S9 hidden tab pauses */
  let page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(150);
  let s = await snap(page);
  ok('S9', s.state === 'paused', 'hidden tab while playing -> ' + s.state);
  await closePage(page);

  /* S10 title animates */
  page = await open(browser, '');
  const grab = () => page.evaluate(() => { const c = document.getElementById('game'); const x = c.getContext('2d'); return Array.from(x.getImageData(0, 0, 480, 220).data); });
  const a = await grab(); await sleep(700); const b = await grab();
  let diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
  ok('S10', diff > 800, `title screen moves (${diff} pixels changed in 0.7 s)`);
  await closePage(page);

  /* S11 frame counts, S14 separate jingles, S15 intro enemy icons */
  page = await open(browser, '?stage=4&seed=12345&debug=1');
  const fr = await page.evaluate(() => {
    const S = DM.Spr;
    return { walk: ['up', 'down', 'left', 'right'].map((d) => S.player.walk[d].length), idle: ['up', 'down', 'left', 'right'].map((d) => S.player.idle[d].length),
      death: S.player.death.length, joy: S.player.joy.length, enemies: [S.slime.length, S.bat.length, S.ghost.length, S.golem.length, S.ghostChase.length],
      crumble: S.themes.map((t) => t.crumble[0].length), poof: S.poof.slime.length, bomb: S.bomb.length, flame: S.flame.center.length, item: S.item.fire.length };
  });
  ok('S11', fr.walk.every((n) => n >= 4) && fr.idle.every((n) => n >= 2) && fr.enemies.every((n) => n >= 3) && fr.death >= 6 && fr.joy >= 2, JSON.stringify(fr));
  const jg = await page.evaluate(() => ({ same: DM.Synth.sfx.gameClear === DM.Synth.sfx.stageClear, ga: DM.Synth.sfx.gameClear.toString().length, sc: DM.Synth.sfx.stageClear.toString().length }));
  ok('S14', !jg.same, 'gameClear has its own jingle (different function from stageClear)');
  await page.keyboard.press('Enter');
  await sleep(900);
  const icon = await page.evaluate(() => {
    const c = document.getElementById('game'), x = c.getContext('2d');
    const d = x.getImageData(150, 262, 180, 40).data; let colored = 0;
    for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]); const mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx > 110 && mx - mn > 40) colored++; }
    return colored;
  });
  ok('S15', icon > 150, `enemy icons drawn on the stage intro (${icon} coloured pixels)`);
  await closePage(page);

  /* S5: chasing ghost looks different (red eyes / pink body) */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true);
  await dbg(page, 'killAllEnemies');
  await dbg(page, 'clearBlocks');
  await sleep(600);
  await dbg(page, 'spawnEnemy', 'ghost', 9, 5);           // far: wander
  /* which ghost sprite does the renderer actually draw? (hook drawImage for two frames) */
  const drawnSprite = () => page.evaluate(() => new Promise((res) => {
    const S = DM.Spr, proto = CanvasRenderingContext2D.prototype, orig = proto.drawImage;
    let chase = 0, normal = 0;
    proto.drawImage = function (img) {
      if (S.ghostChase.indexOf(img) >= 0) chase++; else if (S.ghost.indexOf(img) >= 0) normal++;
      return orig.apply(this, arguments);
    };
    let n = 0;
    (function f() { if (++n < 4) requestAnimationFrame(f); else { proto.drawImage = orig; res({ chase, normal, chasing: DM.Game.enemies.find((q) => q.type === 'ghost').chasing }); } })();
  }));
  await sleep(500);
  const far = await drawnSprite();
  await dbg(page, 'teleport', 9, 3);
  await sleep(900);
  const near = await drawnSprite();
  ok('S5', far.chasing === false && far.chase === 0 && far.normal > 0 && near.chasing === true && near.chase > 0 && near.normal === 0, `ghost far: ${JSON.stringify(far)}; near: ${JSON.stringify(near)}`);
  await closePage(page);

  /* S13: joy pose animates during stageClear */
  page = await open(browser, '?seed=12345&debug=1');
  await startGame(page);
  await dbg(page, 'godMode', true); await dbg(page, 'killAllEnemies'); await dbg(page, 'revealExit');
  const ex = (await snap(page)).exit;
  await dbg(page, 'teleport', ex.col, ex.row);
  await waitState(page, 'stageClear', 2000);
  const tileHash = () => page.evaluate(([c, r]) => {
    const x = document.getElementById('game').getContext('2d'); const d = x.getImageData(c * 32, 64 + r * 32, 32, 32).data; let h = 0;
    for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0; return h;
  }, [ex.col, ex.row]);
  const hs = new Set();
  for (let i = 0; i < 6; i++) { hs.add(await tileHash()); await sleep(130); }
  ok('S13c', hs.size >= 3, 'the mole animates (joy pose) on the exit tile during stageClear: ' + hs.size + ' distinct frames');
  await closePage(page);
}

module.exports = { groupTouch, groupEffects, groupWarn, groupAudioVariety, groupMisc };

if (require.main === module) {
  (async () => {
    const browser = await L.launch();
    try {
      const only = process.argv[2];
      const groups = { groupTouch, groupEffects, groupWarn, groupAudioVariety, groupMisc };
      for (const [k, fn] of Object.entries(groups)) if (!only || k === only) await fn(browser);
    } catch (e) { console.error(e); ok('runner', false, String(e)); }
    await browser.close();
    process.exit(L.summary() ? 1 : 0);
  })();
}
