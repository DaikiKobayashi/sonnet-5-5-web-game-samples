// 測定本体: node run.mjs <effort> [テストID ...]
// 全実装に同じ手順を適用する。実装ごとの差は config.mjs(ポート・タッチボタンのセレクタ)だけ。
import fs from 'fs';
import path from 'path';
import { PORTS, ROOT_PORTS, TOUCH_GAS, EVAL_DIR } from './config.mjs';
import {
  launch, newPage, openTitle, toPlaying, waitScene, sceneEntry, st, dbg, hold, press, sleep, now,
  startSampling, stopSampling, at, nearest, rawShot, getCaps, saveDataUrl, contactSheet, zoomCrop,
  errCount, errTotal, gameUrl,
} from './lib.mjs';

const effort = process.argv[2];
const only = process.argv.slice(3);
const port = PORTS[effort];
const SHOT = path.join(EVAL_DIR, 'screenshots', effort);
const RAW = path.join(EVAL_DIR, 'raw', effort + '.json');
fs.mkdirSync(SHOT, { recursive: true });
const b = await launch();
const sheetCtx = await b.newContext();
const sheet = await sheetCtx.newPage();
const sp = (n) => path.join(SHOT, n);
const R = fs.existsSync(RAW) ? JSON.parse(fs.readFileSync(RAW, 'utf8')) : {};
const SEEDS = [42, 7, 1234];
const r3 = (x) => (x == null ? x : Math.round(x * 1000) / 1000);

async function playing(params = {}, opts = {}) {
  const P = await openTitle(b, port, params, opts);
  P.playOk = await toPlaying(P.page);
  return P;
}
async function withSeeds(fn) {
  const tries = [];
  for (const seed of SEEDS) {
    const r = await fn(seed);
    tries.push({ seed, valid: r.valid });
    if (r.valid) return { ...r, seed, tries };
    if (seed === SEEDS[SEEDS.length - 1]) return { ...r, seed, tries };
  }
}
async function saveCaps(page, prefix, name) {
  const caps = await getCaps(page, prefix);
  const out = [];
  for (const [k, v] of Object.entries(caps)) if (!k.endsWith('_t')) out.push(await saveDataUrl(v, sp(`raw-${name}-${k.slice(prefix.length)}.png`)));
  return out;
}
const sceneLog = (page) => page.evaluate(() => window.__ev.sceneLog.map((x) => ({ t: x.t, scene: x.scene, st: x.st })));

// ---------------- W ルート(§1.3) ----------------
const WARP = { 1: 2950, 2: 3550, 3: 4150 };
async function wRoute(P, { shots = true, tag = 'w' } = {}) {
  const { page } = P;
  const L = { ok: true, steps: [], stages: {} };
  const fail = (m) => { L.ok = false; L.steps.push('FAIL ' + m); };
  await page.evaluate(() => { window.__ev.fillText = 0; window.__ev.strokeText = 0; });
  if (shots) {
    await page.evaluate(() => {
      window.__ev.captureAfter("st.scene==='countdown'", [0, 100, 200, 300, 500], 'trans-cd-', false);
      window.__ev.captureAfter("st.scene==='countdown'&&st.stage===2", [500], 's2start-', false);
    });
  }
  const t0 = await now(page);
  await press(page, 'Enter');
  for (const s of [1, 2, 3]) {
    const S = (L.stages[s] = {});
    if (!(await waitScene(page, 'countdown', 12000))) { fail('countdown s' + s); return L; }
    await sleep(50);
    S.countdown = (await sceneEntry(page, 'countdown'))?.st;
    if (!(await waitScene(page, 'playing', 8000))) { fail('playing s' + s); return L; }
    await page.evaluate((s) => {
      window.__ev.stateAfter("st.scene==='stageclear'", [0, 100, 2100], 'sc' + s + '-');
      window.__ev.captureAfter("st.scene==='stageclear'", [1200, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200], 'sc' + s + '-', false);
    }, s);
    await dbg(page, 'warp', WARP[s]);
    await hold(page, { x: 0.333 });
    await page.keyboard.down('ArrowUp');
    const ok = await waitScene(page, 'stageclear', 20000);
    await page.keyboard.up('ArrowUp');
    await hold(page, null);
    if (!ok) { fail('stageclear s' + s); S.state = await st(page); return L; }
    await sleep(2450);
    S.rec = await page.evaluate((s) => ({ a: window.__ev.rec['sc' + s + '-0'], b: window.__ev.rec['sc' + s + '-100'], c: window.__ev.rec['sc' + s + '-2100'] }), s);
    S.beforeEnter = await st(page);
    if (shots) S.shots = await saveCaps(page, 'sc' + s + '-', `${tag}-s${s}-clear`);
    await press(page, 'Enter');
  }
  if (!(await waitScene(page, 'ending', 8000))) { fail('ending'); return L; }
  await sleep(900);
  L.ending = await st(page);
  if (shots) L.endingShot = await rawShot(page, sp(`raw-${tag}-ending.png`));
  await press(page, 'Enter');
  if (!(await waitScene(page, 'title', 8000))) { fail('ending->title'); return L; }
  L.fillText = await page.evaluate(() => ({ fill: window.__ev.fillText, stroke: window.__ev.strokeText }));
  // タイムアップ経路
  await sleep(300);
  const tB = await now(page);
  await press(page, 'Enter');
  if (!(await waitScene(page, 'countdown', 5000))) { fail('countdown 2nd'); return L; }
  await sleep(50);
  L.run2Countdown = (await sceneEntry(page, 'countdown', tB))?.st;
  if (!(await waitScene(page, 'playing', 8000))) { fail('playing 2nd'); return L; }
  await dbg(page, 'setTime', 1);
  if (!(await waitScene(page, 'timeup', 4000))) { fail('timeup'); return L; }
  if (!(await waitScene(page, 'gameover', 6000))) { fail('gameover'); return L; }
  await sleep(500);
  L.gameover = await st(page);
  const tR = await now(page);
  await press(page, 'KeyR');
  if (!(await waitScene(page, 'countdown', 4000))) { fail('R->countdown'); return L; }
  await sleep(50);
  L.afterR = (await sceneEntry(page, 'countdown', tR))?.st;
  // M41: R 直後の playing で 2.0 秒の timeLeft 減少
  if (!(await waitScene(page, 'playing', 8000))) { fail('playing after R'); return L; }
  const d = await page.evaluate(() => new Promise((res) => {
    const g = window.__game; const t0 = performance.now(); const a = g.getState().timeLeft;
    const f = () => { const t = performance.now(); if (t - t0 >= 2000) res({ dt: t - t0, dTime: a - g.getState().timeLeft }); else window.__ev.rawRAF(f); };
    window.__ev.rawRAF(f);
  }));
  L.timerAfterR = d;
  L.sceneLog = (await sceneLog(page)).filter((x) => x.t >= t0).map((x) => ({ t: Math.round(x.t - t0), scene: x.scene, stage: x.st.stage, timeLeft: r3(x.st.timeLeft), score: x.st.score, trafficTotal: x.st.trafficTotal, cp: x.st.checkpointsPassed, goalRemainingM: r3(x.st.goalRemainingM), bgm: x.st.audio && x.st.audio.bgm }));
  if (shots) { await saveCaps(page, 'trans-cd-', `${tag}-trans-cd`); await saveCaps(page, 's2start-', `${tag}-s2start`); }
  return L;
}

// ---------------- B ルート(ボット) ----------------
async function bRoute(P, { sheetSec = 60, tag = 'b', maxSec = 320, stopAtStageEnd = false } = {}) {
  const { page } = P;
  const t0 = await now(page);
  await press(page, 'Enter');
  await waitScene(page, 'playing', 8000);
  await page.evaluate(() => window.__ev.startBot('synthetic'));
  const caps = []; const tStart = Date.now(); let last = null;
  const firstStage = (await st(page)).stage;
  while (Date.now() - tStart < maxSec * 1000) {
    await sleep(1000);
    const s = await st(page);
    if (caps.length < sheetSec && s.stage === firstStage && s.scene === 'playing') {
      const d = await page.evaluate(() => { window.__ev.capture('_b'); return window.__ev.caps._b; });
      caps.push({ d, label: `${caps.length + 1}s ${s.speedKmh.toFixed(0)}km/h` });
    }
    last = s;
    if (s.scene === 'ending' || s.scene === 'gameover' || s.scene === 'timeup') break;
    if (stopAtStageEnd && caps.length >= sheetSec) break;
  }
  await page.evaluate(() => window.__ev.stopBot());
  const log = (await sceneLog(page)).filter((x) => x.t >= t0);
  const stages = {};
  for (let i = 0; i < log.length; i++) {
    const x = log[i];
    if (x.scene === 'playing' && (!log[i - 1] || log[i - 1].scene === 'countdown')) stages[x.st.stage] = { start: x.t };
    if (x.scene === 'stageclear' && stages[x.st.stage]) Object.assign(stages[x.st.stage], { clear: true, sec: r3((x.t - stages[x.st.stage].start) / 1000), timeLeft: r3(x.st.timeLeft), crashes: x.st.crashes, overtakes: x.st.overtakes, score: x.st.score });
    if (x.scene === 'timeup' && stages[x.st.stage]) Object.assign(stages[x.st.stage], { clear: false, distanceM: r3(x.st.distanceM), crashes: x.st.crashes });
  }
  for (const k of Object.keys(stages)) delete stages[k].start;
  const fin = await st(page);
  return { stages, final: { scene: fin.scene, score: fin.score, rank: fin.rank, crashes: fin.crashes, overtakes: fin.overtakes }, caps, last };
}

// ---------------- 衝突記録(M18/M19 共通) ----------------
async function crashRecord(P, seekHold, timeoutMs, name) {
  const { page } = P;
  await page.evaluate((h) => {
    const ev = window.__ev; ev.hold = h;
    const m = (ev.m18 = { phase: 'seek', rec: [], caps: [] });
    const c = document.getElementById('game');
    ev.hooks.push((st, t) => {
      if (m.phase === 'seek') {
        if (m.c0 == null) m.c0 = st.crashes;
        if (st.scene !== 'playing') return;
        if (st.crashes > m.c0) { ev.hold = null; m.phase = 'inv'; m.tc = t; m.first = JSON.parse(JSON.stringify(st)); m.prevSpeed = m.lastSpeed; } else { m.lastSpeed = st.speedKmh; return; }
      }
      m.rec.push({ t: Math.round(t - m.tc), speed: +st.speedKmh.toFixed(2), inv: st.invulnerable, crashes: st.crashes, ov: st.overtakes, x: +st.playerX.toFixed(3), scene: st.scene });
      if (t - m.tc <= 400) m.caps.push({ d: c.toDataURL('image/png'), label: Math.round(t - m.tc) + 'ms' });
      const d = ev.dbg();
      if (m.phase === 'inv') {
        // 無敵の終わり = invulnerable が false になった最初のフレーム、または次の衝突が起きたフレーム
        // (タイマー切れと同じステップで再衝突すると false が観測されないため)。後者の時刻で「無敵中の衝突」かを判定する
        if (!st.invulnerable && t - m.tc > 30) { m.phase = 'post'; m.tInvEnd = t; m.crInvEnd = st.crashes; m.endBy = 'flag'; }
        else if (st.crashes > m.first.crashes) { m.phase = 'post'; m.tInvEnd = t; m.crInvEnd = m.first.crashes; m.endBy = 'recrash'; }
        else { d.setPlayerX(1.8); d.setSpeedKmh(250); }
      }
      if (m.phase === 'post') { d.setPlayerX(1.8); d.setSpeedKmh(250); if (t - m.tInvEnd > 1500) { m.phase = 'done'; return 'done'; } }
    });
  }, seekHold);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs + 4000) {
    await sleep(250);
    const ph = await page.evaluate(() => window.__ev.m18.phase);
    if (ph === 'done') break;
    if (ph === 'seek' && Date.now() - t0 > timeoutMs) break;
  }
  const m = await page.evaluate(() => { const m = window.__ev.m18; return { phase: m.phase, first: m.first, prevSpeed: m.prevSpeed, rec: m.rec, caps: m.caps, c0: m.c0, crInvEnd: m.crInvEnd, endBy: m.endBy, tInv: m.tInvEnd != null ? m.tInvEnd - m.tc : null }; });
  const out = { crashed: m.phase !== 'seek', phase: m.phase, invEndBy: m.endBy };
  if (!out.crashed) return out;
  out.speedAfter = r3(m.first.speedKmh);
  out.speedBefore = r3(m.prevSpeed);
  out.crashesDelta = m.first.crashes - m.c0;
  out.invFirst = m.first.invulnerable;
  out.invDurationMs = Math.round(m.tInv);
  out.crashesDuringInv = (m.crInvEnd ?? m.first.crashes) - m.first.crashes;
  const lastRec = m.rec[m.rec.length - 1];
  out.crashesAfterInv = lastRec ? lastRec.crashes - (m.crInvEnd ?? m.first.crashes) : null;
  const r300 = m.rec.filter((x) => x.t <= 300);
  out.overtakesIn300ms = r300.length ? r300[r300.length - 1].ov - m.first.overtakes : null;
  out.sceneAtEnd = lastRec && lastRec.scene;
  out.xAfterPush = m.rec[0] && m.rec[0].x;
  out.sheet = m.caps.length ? await contactSheet(sheet, m.caps.slice(0, 24), 6, 320, sp(`${name}-crash-sheet.png`)) : null;
  if (m.caps[0]) await saveDataUrl(m.caps[Math.min(3, m.caps.length - 1)].d, sp(`raw-${name}-crash-50ms.png`));
  out.recSample = m.rec.filter((_, i) => i % 6 === 0).slice(0, 30);
  return out;
}

// =========================== テスト ===========================
const T = {};

T.O1 = async () => {
  const sub = await openTitle(b, port);
  const subRes = { titleOk: sub.titleOk, errors: errCount(sub.errs), errList: { ...sub.errs } };
  await sub.context.close();
  const rp = ROOT_PORTS[effort];
  const root = await openTitle(b, rp, {}, { root: true, port: rp });
  const rootRes = { titleOk: root.titleOk, errors: errCount(root.errs), errList: { ...root.errs } };
  await root.context.close();
  return { sub: subRes, root: rootRes, launch: sub.titleOk };
};

T.O2 = async () => {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const P = await newPage(b, { port });
    await P.page.goto(gameUrl(port));
    await waitScene(P.page, 'title', 10000);
    await sleep(300);
    runs.push(await P.page.evaluate(() => ({ loadEventEnd: performance.getEntriesByType('navigation')[0].loadEventEnd, titleAt: window.__ev.titleAt })));
    await P.context.close();
  }
  const med = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[1];
  return { runs, loadEventEndMed: r3(med('loadEventEnd')), titleAtMed: r3(med('titleAt')) };
};

T.W = async () => {
  const P = await openTitle(b, port);
  const L = await wRoute(P, { shots: true, tag: 'w' });
  L.errors = errCount(P.errs); L.errList = P.errs;
  await P.context.close();
  return L;
};

T.B = async () => {
  const P = await openTitle(b, port);
  const r = await bRoute(P, { sheetSec: 60, tag: 'b' });
  const sheet30 = await contactSheet(sheet, r.caps.slice(0, 30), 6, 320, sp('m16-b-s1-30s-sheet.png'));
  const sheet60 = await contactSheet(sheet, r.caps.slice(0, 60), 10, 256, sp('m42-b-s1-60s-sheet.png'));
  delete r.caps;
  r.errors = errCount(P.errs);
  await P.context.close();
  return { ...r, sheet30, sheet60 };
};

T.B3 = async () => { // M42 ステージ 3 を 60 秒
  const P = await openTitle(b, port, { stage: 3 });
  const r = await bRoute(P, { sheetSec: 60, tag: 'b3', maxSec: 75, stopAtStageEnd: true });
  const sheet60 = await contactSheet(sheet, r.caps.slice(0, 60), 10, 256, sp('m42-b-s3-60s-sheet.png'));
  // S-12 / 主観用に数枚保存
  for (const i of [10, 30, 50]) if (r.caps[i]) await saveDataUrl(r.caps[i].d, sp(`raw-b3-s3-run-${i}s.png`));
  delete r.caps;
  await P.context.close();
  return { ...r, sheet60 };
};

T.O4 = async () => {
  const res = {};
  const stats = (fr, cb, dur) => {
    const n = fr.length; const secs = dur / 1000;
    const win = []; const tA = fr[0];
    for (let w = 0; w < Math.floor(secs); w++) win.push(fr.filter((t) => t >= tA + w * 1000 && t < tA + (w + 1) * 1000).length);
    const iv = []; for (let i = 1; i < n; i++) iv.push(fr[i] - fr[i - 1]); iv.sort((a, b) => a - b);
    const cs = cb.slice().sort((a, b) => a - b);
    return { avgFps: r3(n / secs), minFps: Math.min(...win), windows: win, maxIntervalMs: r3(iv[iv.length - 1]), p99IntervalMs: r3(iv[Math.floor(iv.length * 0.99)]), cbAvgMs: r3(cb.reduce((a, b) => a + b, 0) / cb.length), cbP95Ms: r3(cs[Math.floor(cs.length * 0.95)]), cbMaxMs: r3(cs[cs.length - 1]) };
  };
  // P1
  const P = await openTitle(b, port, { stage: 3 });
  await toPlaying(P.page);
  await P.page.evaluate(() => window.__ev.startBot('synthetic'));
  await sleep(2000);
  await P.page.evaluate(() => { window.__ev.frames = []; window.__ev.cbDur = []; window.__ev.longtasks = 0; window.__ev.recFrames = true; });
  await sleep(20000);
  const d1 = await P.page.evaluate(() => { const e = window.__ev; e.recFrames = false; return { fr: e.frames, cb: e.cbDur, lt: e.longtasks, st: window.__game.getState() }; });
  res.P1 = { ...stats(d1.fr, d1.cb, 20000), longtasks: d1.lt, sceneAtEnd: d1.st.scene, crashes: d1.st.crashes };
  await P.context.close();
  // P2
  const Q = await openTitle(b, port);
  await Q.page.evaluate(() => { window.__ev.frames = []; window.__ev.cbDur = []; window.__ev.longtasks = 0; window.__ev.recFrames = true; });
  await sleep(10000);
  const d2 = await Q.page.evaluate(() => { const e = window.__ev; e.recFrames = false; return { fr: e.frames, cb: e.cbDur, lt: e.longtasks }; });
  res.P2 = { ...stats(d2.fr, d2.cb, 10000), longtasks: d2.lt };
  await Q.context.close();
  return res;
};

T.O5 = async () => { // O-5 + M03
  const out = {};
  const measure = (page) => page.evaluate(() => {
    const c = document.getElementById('game'); const r = c.getBoundingClientRect(); const cs = getComputedStyle(c);
    return { w: c.width, h: c.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom, dw: r.width, dh: r.height, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, ir: cs.imageRendering };
  });
  const judge = (m) => {
    const e = 0.5; const issues = [];
    if (!(m.w === 640 && m.h === 360)) issues.push('backing ' + m.w + 'x' + m.h);
    if (!(m.left >= -e && m.right <= m.iw + e && m.top >= -e && m.bottom <= m.ih + e)) issues.push('overflow');
    if (!(m.sw <= m.iw && m.sh <= m.ih)) issues.push('scroll');
    const ar = m.dw / m.dh; if (Math.abs(ar / (16 / 9) - 1) > 0.01) issues.push('aspect ' + ar.toFixed(3));
    if (m.ir !== 'pixelated') issues.push('image-rendering ' + m.ir);
    const maxW = Math.min(m.iw, m.ih * 16 / 9);
    return { ok: issues.length === 0, issues, maxSizeOk: Math.abs(m.dw - maxW) <= 2 };
  };
  for (const [w, h] of [[390, 844], [1280, 720], [1920, 1080], [375, 667]]) {
    const P = await openTitle(b, port, {}, { viewport: { width: w, height: h } });
    const mt = await measure(P.page);
    if (w === 390) await P.page.screenshot({ path: sp('o5-390x844-title.png') });
    await toPlaying(P.page); await sleep(800);
    const mp = await measure(P.page);
    if (w === 390) await P.page.screenshot({ path: sp('o5-390x844-play.png') });
    out[`${w}x${h}`] = { title: { ...mt, ...judge(mt) }, play: { ...mp, ...judge(mp) } };
    await P.context.close();
  }
  return out;
};

T.M04 = async () => {
  const P = await newPage(b, { port });
  await P.page.goto(gameUrl(port));
  await P.page.evaluate(() => {
    window.__ev.captureAfter("st.scene==='title'", [500, 750, 1500], 'm04-', true);
    window.__ev.captureAfter("st.scene==='title'", Array.from({ length: 12 }, (_, i) => 2000 + i * 125), 'm04s-', false);
  });
  await waitScene(P.page, 'title');
  await sleep(4000);
  const diff = await P.page.evaluate(() => window.__ev.diff('m04-500', 'm04-1500', 200, 359, 8));
  // 補足: 180 km/h では 1.0 秒でちょうど縞 6 周期ぶん進むため 0.5/1.5 秒の縞が一致する。0.25 秒差(1.5 周期)も測る
  const diff2 = await P.page.evaluate(() => window.__ev.diff('m04-500', 'm04-750', 200, 359, 8));
  const a = await getCaps(P.page, 'm04-');
  await saveDataUrl(a['m04-500'], sp('raw-m04-title-0.5s.png'));
  await saveDataUrl(a['m04-1500'], sp('raw-m04-title-1.5s.png'));
  const s = await getCaps(P.page, 'm04s-');
  const items = Object.keys(s).filter((k) => !k.endsWith('_t')).map((k) => ({ d: s[k], label: k.slice(5) + 'ms' }));
  const sh = await contactSheet(sheet, items, 4, 320, sp('m04-title-blink-sheet.png'));
  const logo = await contactSheet(sheet, items, 4, 320, sp('s18-title-logo-sheet.png'), [120, 10, 400, 110]);
  await P.context.close();
  return { roadChangedRatio: r3(diff.changedRatio), roadMad: r3(diff.mad), autoPass: diff.changedRatio >= 0.05, roadChangedRatio025: r3(diff2.changedRatio), autoPass025: diff2.changedRatio >= 0.05, shots: ['raw-m04-title-0.5s.png', 'raw-m04-title-1.5s.png', sh, logo] };
};

T.M05 = async () => {
  const P = await openTitle(b, port);
  await P.page.evaluate(() => window.__ev.captureAfter("st.scene==='countdown'", [200, 500, 1500, 2500], 'm05-', false));
  await startSampling(P.page);
  await P.page.keyboard.down('Enter'); await P.page.keyboard.down('ArrowUp'); await sleep(40); await P.page.keyboard.up('Enter');
  const c = await waitScene(P.page, 'countdown', 3000);
  await waitScene(P.page, 'playing', 6000);
  await P.page.keyboard.up('ArrowUp');
  const smp = await stopSampling(P.page);
  const cd = smp.filter((x) => x.scene === 'countdown');
  const shots = await saveCaps(P.page, 'm05-', 'm05-countdown');
  const t0 = cd.length ? cd[0].t : 0;
  const m21 = { at0_2: at(cd, t0 + 200, 'timeLeft'), at2_2: at(cd, t0 + 2200, 'timeLeft') };
  await P.context.close();
  const Q = await openTitle(b, port);
  await press(Q.page, 'Space');
  const spaceOk = await waitScene(Q.page, 'countdown', 3000);
  await Q.context.close();
  return { enterOk: c, spaceOk, maxSpeed: Math.max(...cd.map((x) => x.speedKmh)), timeLeftMin: Math.min(...cd.map((x) => x.timeLeft)), timeLeftMax: Math.max(...cd.map((x) => x.timeLeft)), nSamples: cd.length, m21, shots };
};

async function m06(opts = {}) {
  const P = await openTitle(b, port, {}, opts);
  await P.page.evaluate(() => { window.__ev.captureAfter("st.scene==='playing'", [300, 1200], 'm06-', false); window.__ev.recFrames = true; window.__ev.frames = []; });
  await startSampling(P.page);
  await press(P.page, 'Enter');
  await waitScene(P.page, 'playing', 8000);
  await sleep(5600);
  const smp = await stopSampling(P.page);
  const fr = await P.page.evaluate(() => { window.__ev.recFrames = false; return window.__ev.frames; });
  const log = await sceneLog(P.page);
  const cd = log.find((x) => x.scene === 'countdown'), pl = log.find((x) => x.scene === 'playing');
  const res = { countdownSec: r3((pl.t - cd.t) / 1000), timeLeftAt5s: r3(at(smp, pl.t + 5000, 'timeLeft')) };
  const span = fr.length > 1 ? (fr[fr.length - 1] - fr[0]) / 1000 : 0; res.fps = r3((fr.length - 1) / span);
  res.shots = await saveCaps(P.page, 'm06-', opts.fps ? `m37-${opts.fps}fps-go` : 'm06-go');
  await P.context.close();
  return res;
}
T.M06 = () => m06();

async function m07(seed, opts = {}) {
  const P = await playing({ seed }, opts);
  await dbg(P.page, 'setPlayerX', 0.333);
  await P.page.evaluate(() => { window.__ev.recFrames = true; window.__ev.frames = []; });
  await startSampling(P.page);
  await P.page.keyboard.down('ArrowUp');
  await sleep(3300);
  const tp = await P.page.evaluate(() => { window.__game.debug.setSpeedKmh(280); return performance.now(); });
  await sleep(2100);
  await P.page.keyboard.up('ArrowUp');
  const smp = await stopSampling(P.page);
  const fr = await P.page.evaluate(() => { window.__ev.recFrames = false; return window.__ev.frames; });
  const kd = await P.page.evaluate(() => window.__ev.keyLog.filter((k) => k.type === 'keydown' && k.code === 'ArrowUp').pop().t);
  const s3 = at(smp, kd + 3000, 'speedKmh');
  const after = smp.filter((x) => x.t >= tp);
  const span = fr.length > 1 ? (fr[fr.length - 1] - fr[0]) / 1000 : 0;
  const crashes = smp.length ? smp[smp.length - 1].crashes - smp[0].crashes : 0;
  await P.context.close();
  return { valid: crashes === 0, speedAt3s: r3(s3), maxAfter280: r3(Math.max(...after.map((x) => x.speedKmh))), crashes, fps: r3((fr.length - 1) / span) };
}
T.M07 = () => withSeeds((s) => m07(s));

T.M08 = () => withSeeds(async (seed) => {
  const P = await playing({ seed });
  await startSampling(P.page);
  await P.page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(0.333); d.setSpeedKmh(200); });
  await P.page.keyboard.down('ArrowDown'); await sleep(1100); await P.page.keyboard.up('ArrowDown');
  await sleep(100);
  const smp = await stopSampling(P.page);
  const kd = await P.page.evaluate(() => window.__ev.keyLog.filter((k) => k.type === 'keydown' && k.code === 'ArrowDown').pop().t);
  const v0 = at(smp, kd, 'speedKmh'), v1 = at(smp, kd + 1000, 'speedKmh');
  const crashes = smp[smp.length - 1].crashes - smp[0].crashes;
  await P.context.close();
  return { valid: crashes === 0, v0: r3(v0), v1: r3(v1), decrease: r3(v0 - v1), crashes };
});

T.M09 = () => withSeeds(async (seed) => {
  const P = await playing({ seed });
  await startSampling(P.page);
  const t = await P.page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(0.333); d.setSpeedKmh(200); return performance.now(); });
  await sleep(2300);
  const smp = await stopSampling(P.page);
  const v = at(smp, t + 2000, 'speedKmh');
  const crashes = smp[smp.length - 1].crashes - smp[0].crashes;
  await P.context.close();
  return { valid: crashes === 0, speedAt2s: r3(v), crashes };
});

T.M10 = async () => {
  const P = await playing();
  const x = async () => (await st(P.page)).playerX;
  await P.page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(0); d.setSpeedKmh(100); });
  const r = {};
  let x0 = await x();
  await press(P.page, 'ArrowRight', 300); const x1 = await x();
  await press(P.page, 'ArrowLeft', 600); const x2 = await x();
  await press(P.page, 'KeyD', 300); const x3 = await x();
  await press(P.page, 'KeyA', 600); const x4 = await x();
  r.seq = [x0, x1, x2, x3, x4].map(r3);
  r.right = x1 > x0; r.left = x2 < x1; r.D = x3 > x2; r.A = x4 < x3;
  await P.page.evaluate(() => window.__game.debug.setSpeedKmh(0));
  await sleep(150);
  const z0 = await x(); await press(P.page, 'ArrowRight', 500); const z1 = await x();
  r.zeroSpeedDelta = Math.abs(z1 - z0);
  await P.context.close();
  return r;
};

T.M11 = async () => {
  const P = await playing();
  await P.page.keyboard.down('ArrowUp');
  await startSampling(P.page);
  const t = await P.page.evaluate(() => { const d = window.__game.debug; d.warp(765); d.setSpeedKmh(200); d.setPlayerX(0); return performance.now(); });
  await sleep(1200);
  await P.page.keyboard.up('ArrowUp');
  const smp = await stopSampling(P.page);
  await P.context.close();
  return { xAt1s: r3(at(smp, t + 1000, 'playerX')), crashes: smp[smp.length - 1].crashes };
};

T.M12 = async () => {
  const P = await playing();
  await P.page.keyboard.down('ArrowUp');
  await startSampling(P.page);
  const t = await P.page.evaluate(() => { const d = window.__game.debug; d.warp(20); d.setSpeedKmh(200); d.setPlayerX(1.05); window.__ev.captureAfter('true', [1500], 'm12-', false); return performance.now(); });
  await sleep(3200);
  const smp = await stopSampling(P.page);
  const win = smp.filter((s) => s.t >= t && s.t <= t + 3000);
  const res = { speedAt3s: r3(at(smp, t + 3000, 'speedKmh')), crashesDelta: win[win.length - 1].crashes - win[0].crashes, xMin: r3(Math.min(...win.map((s) => s.playerX))), xMax: r3(Math.max(...win.map((s) => s.playerX))) };
  res.shots = await saveCaps(P.page, 'm12-', 'm12-offroad');
  await startSampling(P.page);
  const t2 = await P.page.evaluate(() => { const d = window.__game.debug; d.setSpeedKmh(0); d.setPlayerX(1.05); return performance.now(); });
  await sleep(3200);
  const s2 = await stopSampling(P.page);
  res.ref0SpeedAt3s = r3(at(s2, t2 + 3000, 'speedKmh')); res.ref0X = r3(at(s2, t2 + 3000, 'playerX'));
  await P.page.keyboard.up('ArrowUp');
  await P.context.close();
  return res;
};

T.M13 = async () => { // + M15
  const P = await playing();
  // GO! とステージ名の表示(playing 開始から約 1.8 秒)が写り込まないように待つ
  await hold(P.page, { x: 0, v: 0 }); await sleep(2000);
  const pts = [[20, 'flat'], [236, 'right'], [389, 'up'], [597, 'left'], [1420, 'crest'], [1778, 'down']];
  const shots = [];
  const res = {};
  for (const [m, n] of pts) {
    await hold(P.page, { x: 0, v: 0 });
    await dbg(P.page, 'warp', m);
    await sleep(450);
    shots.push(await rawShot(P.page, sp(`raw-m13-s1-${n}.png`), 'm13-' + n));
    if (n === 'flat') {
      const d = await P.page.evaluate(() => window.__ev.caps['m13-flat']);
      await zoomCrop(sheet, d, [200, 180, 240, 90], 4, sp('m15-flat-zoom4.png'));
      await hold(P.page, { x: 0, v: 150 });
      await sleep(900);
      await rawShot(P.page, sp('raw-m15-run150.png'), 'm15run');
      const d2 = await P.page.evaluate(() => window.__ev.caps['m15run']);
      await zoomCrop(sheet, d2, [200, 180, 240, 90], 4, sp('m15-run150-zoom4.png'));
    }
  }
  // 道路の最上端(消失位置)の推定は目視で行う。参考に horizon 付近の画像を並べたシートを作る
  const caps = await getCaps(P.page, 'm13-');
  await contactSheet(sheet, pts.map(([, n]) => ({ d: caps['m13-' + n], label: n })), 3, 426, sp('m13-s1-sheet.png'));
  res.state = await st(P.page);
  await P.context.close();
  return { shots, crashes: res.state.crashes };
};

T.M14 = async () => { // + S-02
  const P = await playing();
  // ステージ名(y≈60〜100)が空の帯 A に重ならないよう、playing 開始から 2 秒待ってから測る
  await hold(P.page, { x: 0, v: 0 }); await sleep(2000);
  await hold(P.page, { x: 0, v: 200 });
  await dbg(P.page, 'warp', 765);
  await sleep(300);
  await P.page.evaluate(() => window.__ev.captureAfter('true', [0, 500], 'm14r', true));
  await sleep(800);
  await hold(P.page, { x: 0, v: 0 });
  await sleep(700);
  await P.page.evaluate(() => window.__ev.captureAfter('true', [0, 500], 'm14s', true));
  await sleep(800);
  const r = await P.page.evaluate(() => {
    const e = window.__ev; const o = {};
    for (const [k, a, b2] of [['run', 'm14r0', 'm14r500'], ['stop', 'm14s0', 'm14s500']]) {
      o[k] = { A: e.shift(a, b2, 64, 110, 40, 600, 60), B: e.shift(a, b2, 120, 172, 40, 600, 60), C: e.shift(a, b2, 130, 176, 40, 600, 90), dtMs: e.caps[b2 + '_t'] - e.caps[a + '_t'] };
    }
    return o;
  });
  await saveCaps(P.page, 'm14r', 'm14-run');
  await saveCaps(P.page, 'm14s', 'm14-stop');
  const s = await st(P.page);
  await P.context.close();
  return { ...r, crashes: s.crashes };
};

T.M17 = () => withSeeds(async (seed) => { // + S-13
  const P = await playing({ seed });
  await hold(P.page, { x: 0.333, v: 170 });
  await P.page.evaluate(() => window.__ev.captureAfter('prev && st.overtakes>prev.overtakes', [100], 's13-', false));
  await startSampling(P.page);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) { await sleep(500); const s = await st(P.page); if (s.overtakes >= 3) break; }
  await sleep(300);
  const smp = await stopSampling(P.page);
  const ev = [];
  for (let i = 1; i < smp.length; i++) {
    if (smp[i].overtakes > smp[i - 1].overtakes) {
      ev.push({ dOv: smp[i].overtakes - smp[i - 1].overtakes, dScore: smp[i].score - smp[i - 1].score, dDist: Math.floor(smp[i].distanceM) - Math.floor(smp[i - 1].distanceM), bonus: smp[i].score - smp[i - 1].score - (Math.floor(smp[i].distanceM) - Math.floor(smp[i - 1].distanceM)) });
    }
  }
  const crashes = smp[smp.length - 1].crashes - smp[0].crashes;
  const shots = await saveCaps(P.page, 's13-', 's13-overtake');
  await P.context.close();
  return { valid: crashes === 0 && ev.length > 0, events: ev, crashes, shots };
});

T.M18 = async () => {
  const P = await playing();
  const r = await crashRecord(P, { x: 0, v: 200 }, 20000, 'm18');
  await P.context.close();
  return r;
};
T.M19 = async () => {
  const P = await playing();
  await dbg(P.page, 'warp', 60);
  const r = await crashRecord(P, { x: 1.8, v: 100 }, 15000, 'm19');
  await P.context.close();
  return r;
};

T.M20 = async () => {
  const LEN = { 1: 3000, 2: 3600, 3: 4200 }; const shots = [];
  for (const s of [1, 2, 3]) {
    const P = await playing({ stage: s });
    for (const pct of [0.2, 0.5, 0.8]) {
      await hold(P.page, { x: 0, v: 0 });
      await dbg(P.page, 'warp', LEN[s] * pct);
      await sleep(450);
      shots.push(await rawShot(P.page, sp(`raw-m20-s${s}-${Math.round(pct * 100)}.png`)));
    }
    await P.context.close();
  }
  return { shots };
};

T.M21 = async () => { // (2) 一時停止中
  const P = await playing();
  await P.page.keyboard.down('ArrowUp'); await sleep(1000); await P.page.keyboard.up('ArrowUp');
  await press(P.page, 'KeyP'); await sleep(200);
  const a = await st(P.page); await sleep(2000); const c = await st(P.page);
  await P.context.close();
  return { pausedScene: a.scene, diff: Math.abs(a.timeLeft - c.timeLeft) };
};

T.M22 = () => withSeeds(async (seed) => {
  const P = await playing({ seed });
  await hold(P.page, { x: 0, v: 0 });
  await sleep(2000); // GO! とステージ名が消えるまで待つ(ゲートの撮影に写り込ませない)
  await dbg(P.page, 'warp', 950);
  await sleep(450);
  const gate = await rawShot(P.page, sp('raw-m22-gate.png'));
  await hold(P.page, { x: 0.333 });
  await P.page.keyboard.down('ArrowUp');
  await startSampling(P.page);
  const t = await P.page.evaluate(() => { const d = window.__game.debug; d.warp(990); d.setSpeedKmh(200); window.__ev.captureAfter('prev && st.checkpointsPassed>prev.checkpointsPassed', [300, 1900, 2400], 'm22-', false); return performance.now(); });
  await sleep(3200);
  await P.page.keyboard.up('ArrowUp');
  const smp = await stopSampling(P.page);
  const i = smp.findIndex((s) => s.t >= t && s.checkpointsPassed >= 1);
  const res = { gate };
  if (i > 0) {
    res.secAfterWarp = r3((smp[i].t - t) / 1000);
    res.cpBefore = smp[i - 1].checkpointsPassed; res.cpAfter = smp[i].checkpointsPassed;
    res.dTime = r3(smp[i].timeLeft - smp[i - 1].timeLeft); res.dScore = smp[i].score - smp[i - 1].score;
  }
  const crashes = smp[smp.length - 1].crashes - smp[0].crashes;
  res.shots = await saveCaps(P.page, 'm22-', 'm22-cp');
  await P.context.close();
  return { valid: crashes === 0 && i > 0, crashes, ...res };
});

T.M23 = async () => {
  const P = await playing();
  const t = await P.page.evaluate(() => { window.__ev.captureAfter("st.scene==='timeup'", [500], 'm23tu-', false); window.__ev.captureAfter("st.scene==='gameover'", [500], 'm23go-', false); window.__game.debug.setTime(2); return performance.now(); });
  await waitScene(P.page, 'gameover', 9000);
  await sleep(800);
  const log = await sceneLog(P.page);
  const tu = log.find((x) => x.scene === 'timeup'), go = log.find((x) => x.scene === 'gameover');
  const res = { toTimeup: tu ? r3((tu.t - t) / 1000) : null, toGameover: tu && go ? r3((go.t - tu.t) / 1000) : null };
  res.shots = [...(await saveCaps(P.page, 'm23tu-', 'm23-timeup')), ...(await saveCaps(P.page, 'm23go-', 'm23-gameover'))];
  await P.context.close();
  return res;
};

T.M24 = () => withSeeds(async (seed) => { // + M25
  const P = await playing({ seed });
  await hold(P.page, { x: 0, v: 0 });
  await sleep(2000); // GO! とステージ名が消えるまで待つ(ゲートの撮影に写り込ませない)
  await dbg(P.page, 'warp', 2900);
  await sleep(450);
  const gate = await rawShot(P.page, sp('raw-m24-gate.png'));
  await hold(P.page, { x: 0.333 });
  await P.page.keyboard.down('ArrowUp');
  await startSampling(P.page);
  await P.page.evaluate(() => { const d = window.__game.debug; d.warp(2950); d.setSpeedKmh(200); window.__ev.captureAfter("st.scene==='stageclear'", [1200, 1800], 'm24-', false); });
  const ok = await waitScene(P.page, 'stageclear', 15000);
  await P.page.keyboard.up('ArrowUp'); await hold(P.page, null);
  await sleep(2000);
  const smp = await stopSampling(P.page);
  const i = smp.findIndex((s) => s.scene === 'stageclear');
  const res = { gate, stageclear: ok };
  if (i > 0) {
    const S0 = smp[i - 1].score, T0 = smp[i - 1].timeLeft;
    res.S0 = S0; res.T0 = r3(T0); res.dScore = smp[i].score - S0;
    res.expect = 100 * Math.floor(T0) + 1000; res.expectAlt = 100 * Math.floor(T0 - 1 / 60) + 1000;
    res.scoreOk = Math.abs(res.dScore - res.expect) <= 3 || Math.abs(res.dScore - res.expectAlt) <= 3;
  }
  res.shots = await saveCaps(P.page, 'm24-', 'm24-clear');
  const crashes = smp.length ? smp[smp.length - 1].crashes - smp[0].crashes : 0;
  // M25
  const pre = await st(P.page);
  const tE = await now(P.page);
  await press(P.page, 'Enter');
  await waitScene(P.page, 'countdown', 4000); await sleep(50);
  const cd = (await sceneEntry(P.page, 'countdown', tE))?.st;
  res.m25 = cd ? { scene: cd.scene, stage: cd.stage, goalRemainingM: r3(cd.goalRemainingM), timeLeft: cd.timeLeft, trafficTotal: cd.trafficTotal, score: cd.score, scoreBefore: pre.score, cp: cd.checkpointsPassed } : null;
  await P.context.close();
  return { valid: crashes === 0 && ok, crashes, ...res };
});

T.M26 = async () => {
  const out = {};
  for (const s of [1, 2, 3]) {
    const P = await playing({ stage: s });
    await hold(P.page, { x: 0.333 });
    await P.page.keyboard.down('ArrowUp'); await sleep(2000);
    await rawShot(P.page, sp(`raw-m26-s${s}-run2s.png`), 'm26');
    out['s' + s] = await P.page.evaluate(() => window.__ev.colorStats('m26'));
    await P.page.keyboard.up('ArrowUp');
    await P.context.close();
  }
  const h1 = out.s1.sky.hue, h2 = out.s2.sky.hue;
  out.numeric = { s1: h1 >= 320 || h1 <= 50, s2: h2 >= 220 && h2 <= 300, s3: out.s3.sky.lum < 0.25 && out.s3.full.neon >= 0.003 };
  return out;
};

T.M28 = async () => {
  const P = await playing();
  await hold(P.page, { x: 0.333, v: 170 });
  await sleep(10000);
  await press(P.page, 'KeyP'); await sleep(300);
  const s = await st(P.page);
  await rawShot(P.page, sp('raw-m28-paused-hud.png'), 'm28');
  const d = await P.page.evaluate(() => window.__ev.caps.m28);
  await zoomCrop(sheet, d, [200, 0, 240, 50], 3, sp('m28-score-zoom3.png'));
  await P.context.close();
  return { score: s.score, distanceM: r3(s.distanceM), overtakes: s.overtakes, crashes: s.crashes, diff: s.score - 50 * s.overtakes - Math.floor(s.distanceM), scene: s.scene };
};

T.M29 = async () => {
  const P = await playing();
  const pg = P.page; const r = {};
  await hold(pg, { x: 0.333 });
  await pg.keyboard.down('ArrowUp'); await sleep(2500); await pg.keyboard.up('ArrowUp');
  for (const key of ['KeyP', 'Escape']) {
    await press(pg, key); await sleep(300);
    const a = await st(pg); await rawShot(pg, sp(`raw-m29-paused-${key}.png`), 'pa' + key);
    await sleep(2000);
    const c = await st(pg); await rawShot(pg, sp(`raw-m29-paused-${key}-2s.png`), 'pb' + key);
    const diff = await pg.evaluate((k) => window.__ev.diff('pa' + k, 'pb' + k, 180, 359, 8), key);
    await press(pg, key); await sleep(300);
    const d = await st(pg);
    r[key] = { paused: a.scene, dTime: Math.abs(a.timeLeft - c.timeLeft), dDist: Math.abs(a.distanceM - c.distanceM), imgMad: r3(diff.mad), imgChanged: r3(diff.changedRatio), resumed: d.scene };
    await sleep(500);
  }
  await hold(pg, null);
  await press(pg, 'KeyP'); await sleep(200);
  const tR = await now(pg);
  await press(pg, 'KeyR'); await waitScene(pg, 'countdown', 3000); await sleep(50);
  const cr = (await sceneEntry(pg, 'countdown', tR))?.st;
  r.R = cr ? { scene: cr.scene, stage: cr.stage, score: cr.score } : null;
  await waitScene(pg, 'playing', 6000);
  await press(pg, 'KeyP'); await sleep(200);
  await press(pg, 'KeyQ');
  r.Q = (await waitScene(pg, 'title', 3000)) ? 'title' : (await st(pg)).scene;
  await P.context.close();
  return r;
};

async function checkR(pg, key = 'KeyR') {
  const t = await now(pg);
  await press(pg, key);
  const ok = await waitScene(pg, 'countdown', 3000); await sleep(50);
  const c = (await sceneEntry(pg, 'countdown', t))?.st;
  return ok && c ? { scene: c.scene, stage: c.stage, score: c.score, overtakes: c.overtakes, crashes: c.crashes } : { scene: (await st(pg)).scene };
}
async function drive(pg, ms) { await hold(pg, { x: 0.333, v: 170 }); await sleep(ms); await hold(pg, null); }
async function toGameover(pg) { await waitScene(pg, 'playing', 8000); await drive(pg, 2000); await dbg(pg, 'setTime', 0.2); await waitScene(pg, 'gameover', 6000); await sleep(300); return st(pg); }
T.M30 = async () => {
  const r = {};
  const P = await playing(); const pg = P.page;
  await drive(pg, 3000); r.playingBefore = (await st(pg)).score;
  r.playing = await checkR(pg);
  await waitScene(pg, 'playing', 8000); await drive(pg, 2000); await press(pg, 'KeyP'); await sleep(200);
  r.pausedBefore = (await st(pg)).score; r.paused = await checkR(pg);
  r.gameoverBefore = (await toGameover(pg)).score; r.gameoverR = await checkR(pg);
  await toGameover(pg); r.gameoverEnter = await checkR(pg, 'Enter');
  await toGameover(pg); await press(pg, 'Escape'); r.gameoverEsc = (await waitScene(pg, 'title', 3000)) ? 'title' : (await st(pg)).scene;
  await press(pg, 'Enter'); await toGameover(pg); await press(pg, 'KeyQ'); r.gameoverQ = (await waitScene(pg, 'title', 3000)) ? 'title' : (await st(pg)).scene;
  await P.context.close();
  // ending から R(W ルートと同じ warp 手順で ending を作る)
  const E2 = await openTitle(b, port);
  await press(E2.page, 'Enter');
  for (const s of [1, 2, 3]) {
    await waitScene(E2.page, 'playing', 12000); await dbg(E2.page, 'warp', WARP[s]); await hold(E2.page, { x: 0.333 });
    await E2.page.keyboard.down('ArrowUp'); await waitScene(E2.page, 'stageclear', 20000); await E2.page.keyboard.up('ArrowUp'); await hold(E2.page, null);
    await sleep(2000); await press(E2.page, 'Enter');
  }
  const reached = await waitScene(E2.page, 'ending', 8000);
  r.endingBefore = (await st(E2.page)).score;
  r.ending = reached ? await checkR(E2.page) : { error: 'no ending' };
  await E2.context.close();
  const S2 = await playing({ stage: 2 });
  await drive(S2.page, 2000); r.stage2Before = (await st(S2.page)).score;
  r.stage2 = await checkR(S2.page);
  await S2.context.close();
  return r;
};

T.M31 = async () => {
  const P = await playing(); const pg = P.page; const r = {};
  await sleep(1300);
  r.before = (await st(pg)).muted;
  await rawShot(pg, sp('raw-m31-sound-on.png'));
  await press(pg, 'KeyM'); await sleep(300);
  r.after = (await st(pg)).muted;
  await rawShot(pg, sp('raw-m31-sound-off.png'));
  await pg.reload(); await waitScene(pg, 'title', 10000); await sleep(300);
  r.afterReload = (await st(pg)).muted;
  r.ls = await pg.evaluate(() => { try { return localStorage.getItem('sunset-rush:v1'); } catch (e) { return 'ERR ' + e; } });
  try { const j = JSON.parse(r.ls); r.lsShape = typeof j.best === 'number' && typeof j.muted === 'boolean'; } catch (e) { r.lsShape = false; }
  await P.context.close();
  const Q = await openTitle(b, port, { mute: 1 });
  r.mute1 = (await st(Q.page)).muted;
  r.mute1ls = await Q.page.evaluate(() => localStorage.getItem('sunset-rush:v1'));
  await Q.context.close();
  return r;
};

T.M32 = async () => {
  const r = {};
  const P = await playing(); const pg = P.page;
  await hold(pg, { x: 0.333 }); await pg.keyboard.down('ArrowUp'); await sleep(5000); await pg.keyboard.up('ArrowUp'); await hold(pg, null);
  await dbg(pg, 'setTime', 1);
  await waitScene(pg, 'gameover', 8000); await sleep(700);
  const g = await st(pg); r.score = g.score; r.bestState = g.best;
  await rawShot(pg, sp('raw-m32-gameover-newbest.png'));
  r.ls = await pg.evaluate(() => localStorage.getItem('sunset-rush:v1'));
  await pg.reload(); await waitScene(pg, 'title', 10000); await sleep(800);
  r.bestAfterReload = (await st(pg)).best;
  await rawShot(pg, sp('raw-m32-title-best.png'));
  await P.context.close();
  const Q = await openTitle(b, port, {}, { throwStorage: true });
  r.throwTitleOk = Q.titleOk;
  const L = await wRoute(Q, { shots: false });
  r.throwRoute = { ok: L.ok, steps: L.steps, endingScore: L.ending && L.ending.score };
  r.throwErrors = errCount(Q.errs); r.throwErrList = { console: Q.errs.console.slice(0, 5), pageerror: Q.errs.pageerror.slice(0, 5) };
  await Q.context.close();
  return r;
};

T.M33 = async () => {
  const P = await playing(); const pg = P.page;
  await hold(pg, { x: 0.333 }); await pg.keyboard.down('ArrowUp'); await sleep(3000);
  await rawShot(pg, sp('raw-m33-hud.png'));
  await pg.evaluate(() => { window.__game.debug.setTime(9.9); window.__ev.captureAfter('true', Array.from({ length: 12 }, (_, i) => i * 125), 'm33t-', false); });
  await sleep(1800);
  await pg.keyboard.up('ArrowUp');
  const c = await getCaps(pg, 'm33t-');
  const items = Object.keys(c).filter((k) => !k.endsWith('_t')).map((k) => ({ d: c[k], label: k.slice(5) + 'ms' }));
  await contactSheet(sheet, items, 4, 320, sp('m33-timewarn-sheet.png'), [0, 0, 200, 80]);
  await P.context.close();
  return { shots: ['raw-m33-hud.png', 'm33-timewarn-sheet.png'] };
};

T.M34 = async () => {
  const P = await openTitle(b, port); const pg = P.page; const r = {};
  const A = async () => (await st(pg)).audio;
  r.beforeInput = await A();
  await press(pg, 'Enter'); await sleep(500);
  r.after05 = await A(); r.countdownScene = (await st(pg)).scene;
  await waitScene(pg, 'playing', 6000); await sleep(300);
  r.playing = await A();
  await hold(pg, { x: 0.333, v: 150 }); await sleep(250); r.at150 = await A();
  await hold(pg, { x: 0.333, v: 300 }); await sleep(250); r.at300 = await A();
  const lv = async () => { const out = []; for (let i = 0; i < 10; i++) { out.push(await pg.evaluate(() => window.__ev.level())); await sleep(50); } return { rms: Math.max(...out.map((o) => o.rms)), peak: Math.max(...out.map((o) => o.peak)), states: out[0].states, taps: out[0].n }; };
  r.rmsBeforeMute = await lv();
  await hold(pg, { x: 0.333, v: 150 });
  await press(pg, 'KeyP'); await sleep(300); r.paused = await A(); r.pausedScene = (await st(pg)).scene;
  await press(pg, 'KeyP'); await sleep(200);
  await press(pg, 'KeyM'); await sleep(1000);
  r.rmsMuted = await lv(); r.mutedFlag = (await st(pg)).muted;
  await press(pg, 'KeyM'); await sleep(200);
  await dbg(pg, 'warp', 2950); await pg.keyboard.down('ArrowUp');
  await waitScene(pg, 'stageclear', 15000); await pg.keyboard.up('ArrowUp'); await hold(pg, null); await sleep(300);
  r.stageclear = await A();
  await sleep(1800); await press(pg, 'Enter');
  await waitScene(pg, 'playing', 8000); await sleep(200);
  r.s2playing = await A();
  await dbg(pg, 'setTime', 0.5); await waitScene(pg, 'timeup', 3000); await sleep(300);
  r.timeup = await A();
  await waitScene(pg, 'gameover', 5000); await sleep(300); r.gameover = await A();
  await press(pg, 'Escape'); await waitScene(pg, 'title', 3000); await sleep(300);
  r.title = await A();
  // ピークの記録(音割れ)
  await P.context.close();
  return r;
};

T.M35 = async () => {
  const P = await playing(); const pg = P.page; const r = {};
  await pg.evaluate(() => { window.__m35 = {}; window.addEventListener('keydown', (e) => { window.__m35[e.code] = e.defaultPrevented; }); });
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) await press(pg, k, 50);
  r.defaultPrevented = await pg.evaluate(() => window.__m35);
  r.scrollY = await pg.evaluate(() => window.scrollY);
  await sleep(300);
  await pg.keyboard.down('ArrowUp'); await sleep(800);
  await pg.evaluate(() => window.dispatchEvent(new Event('blur')));
  await sleep(100);
  r.afterBlurScene = (await st(pg)).scene;
  if (r.afterBlurScene === 'paused') { await press(pg, 'KeyP'); await sleep(50); }
  const a = await st(pg); await sleep(1000); const c = await st(pg);
  r.speedBefore = r3(a.speedKmh); r.speedAfter1s = r3(c.speedKmh); r.sceneDuring = c.scene;
  await pg.keyboard.up('ArrowUp');
  await P.context.close();
  const Q = await openTitle(b, port); const q = Q.page;
  await q.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: true, bubbles: true, cancelable: true })));
  await sleep(400); r.repeatScene = (await st(q)).scene;
  await q.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: false, bubbles: true, cancelable: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', key: 'Enter', bubbles: true })); });
  await sleep(400); r.controlScene = (await st(q)).scene;
  await Q.context.close();
  return r;
};

T.M36 = async () => { // + M16(trafficTotal)
  const r = {};
  const hashOf = async (params, doR) => {
    const P = await openTitle(b, port, params);
    await press(P.page, 'Enter'); await waitScene(P.page, 'countdown', 3000); await sleep(50);
    const c = (await sceneEntry(P.page, 'countdown'))?.st;
    let rh = null;
    if (doR) { await waitScene(P.page, 'playing', 6000); await sleep(500); const t = await now(P.page); await press(P.page, 'KeyR'); await waitScene(P.page, 'countdown', 3000); await sleep(50); rh = (await sceneEntry(P.page, 'countdown', t))?.st.layoutHash; }
    await P.context.close();
    return { hash: c.layoutHash, traffic: c.trafficTotal, rHash: rh };
  };
  for (const s of [1, 2, 3]) {
    const a = await hashOf({ seed: 42, stage: s }, s === 1);
    const a2 = await hashOf({ seed: 42, stage: s }, false);
    r['s' + s] = { a: a.hash, b: a2.hash, same: a.hash === a2.hash, traffic: a.traffic, rHash: a.rHash };
  }
  const c = await hashOf({ seed: 43, stage: 1 }, false);
  r.seed43 = c.hash; r.seed43Differs = c.hash !== r.s1.a; r.rSame = r.s1.rHash === r.s1.a;
  return r;
};

T.M37 = async () => {
  const r = {};
  for (const fps of [30, 144]) {
    r['fps' + fps] = { m06: await m06({ fps }), m07: await withSeeds((s) => m07(s, { fps })) };
  }
  return r;
};

T.O7 = async () => { // M38 + ギャラリー照合 + 音の照合
  const P = await newPage(b, { port });
  await P.page.goto(`http://localhost:${port}/dist/?gallery=1`);
  await sleep(2500);
  const assets = await P.page.evaluate(() => [...document.querySelectorAll('canvas[data-asset-id]')].map((c) => {
    let opaque = 0; const colors = new Set();
    try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4 * 3) { if (d[i + 3] > 0) { opaque++; if (colors.size < 50) colors.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); } } } catch (e) {}
    const parentText = (c.parentElement && c.parentElement.textContent || '') + ' ' + (c.nextElementSibling && c.nextElementSibling.textContent || '') + ' ' + (c.parentElement && c.parentElement.nextElementSibling && c.parentElement.nextElementSibling.textContent || '');
    return { id: c.dataset.assetId, frames: +c.dataset.frames, fw: +c.dataset.frameW, fh: +c.dataset.frameH, cw: c.width, ch: c.height, opaque, colors: colors.size, label: parentText.includes(c.dataset.assetId) };
  }));
  const sounds = await P.page.evaluate(() => [...document.querySelectorAll('button[data-sound-id]')].map((x) => x.dataset.soundId));
  await P.page.screenshot({ path: sp('o7-gallery-full.png'), fullPage: true });
  const fontEl = await P.page.$('canvas[data-asset-id="font_pixel"]');
  if (fontEl) await fontEl.screenshot({ path: sp('m38-font-pixel.png') });
  // 音ボタン
  const lvl = () => P.page.evaluate(() => window.__ev.level());
  const snd = {};
  for (const id of sounds.filter((s) => s !== 'mute')) {
    // 前の音が消えるのを最大 4 秒待つ
    for (let i = 0; i < 40; i++) { const l = await lvl(); if (l.rms < 0.0005) break; await sleep(100); }
    const e0 = errTotal(P.errs);
    await P.page.click(`button[data-sound-id="${id}"]`);
    let mx = 0, pk = 0; const t0 = Date.now();
    while (Date.now() - t0 < 500) { const l = await lvl(); mx = Math.max(mx, l.rms); pk = Math.max(pk, l.peak); await sleep(20); }
    snd[id] = { rms: r3(mx * 1000) / 1000, peak: r3(pk), sounded: mx > 0.001, errors: errTotal(P.errs) - e0 };
    // BGM・エンジンは停止を待つ(再クリックで停止する実装もあるので待つだけにする)
  }
  for (let i = 0; i < 50; i++) { const l = await lvl(); if (l.rms < 0.0005) break; await sleep(100); }
  let mute = null;
  if (sounds.includes('mute')) {
    await P.page.click('button[data-sound-id="mute"]');
    await sleep(200);
    const target = sounds.includes('bgm_1') ? 'bgm_1' : sounds[0];
    await P.page.click(`button[data-sound-id="${target}"]`);
    let mx = 0; const t0 = Date.now();
    while (Date.now() - t0 < 800) { const l = await lvl(); mx = Math.max(mx, l.rms); await sleep(20); }
    mute = { target, rmsWhileMuted: mx, silent: mx < 0.0005 };
  }
  const r = { assets, sounds, snd, mute, errors: errCount(P.errs), errList: { console: P.errs.console.slice(0, 5), pageerror: P.errs.pageerror.slice(0, 5) } };
  await P.context.close();
  return r;
};

T.S03 = async () => { // + S-04, S-06
  const P = await playing(); const pg = P.page; const crop = [240, 262, 160, 96];
  await hold(pg, { x: 0.333, v: 200 }); await sleep(600);
  await pg.keyboard.down('ArrowDown'); await sleep(250);
  await rawShot(pg, sp('raw-s03-brake.png'), 's03b');
  await pg.keyboard.up('ArrowDown'); await sleep(350);
  await rawShot(pg, sp('raw-s03-nobrake.png'), 's03n');
  const c = await getCaps(pg, 's03');
  await contactSheet(sheet, [{ d: c.s03b, label: 'brake' }, { d: c.s03n, label: 'released' }], 2, 640, sp('s03-brake-compare.png'), crop);
  await hold(pg, { x: 0.333, v: 150 }); await sleep(500);
  await pg.evaluate(() => window.__ev.captureAfter('true', Array.from({ length: 18 }, (_, i) => i * 17), 's04-', false));
  await sleep(700);
  const w = await getCaps(pg, 's04-');
  const items = Object.keys(w).filter((k) => !k.endsWith('_t')).map((k) => ({ d: w[k], label: Math.round(w[k + '_t']) + 'ms' }));
  await contactSheet(sheet, items, 6, 320, sp('s04-wheel-sheet.png'), crop);
  await hold(pg, { x: 0.333, v: 200 }); await sleep(600); await rawShot(pg, sp('raw-s06-200kmh.png'));
  await hold(pg, { x: 0.333, v: 280 }); await sleep(600); await rawShot(pg, sp('raw-s06-280kmh.png'));
  // M39: 自車の左右フレーム
  await hold(pg, { v: 150 });
  await pg.keyboard.down('ArrowLeft'); await sleep(200); await rawShot(pg, sp('raw-m39-player-left.png'), 'pl'); await pg.keyboard.up('ArrowLeft');
  await pg.keyboard.down('ArrowRight'); await sleep(200); await rawShot(pg, sp('raw-m39-player-right.png'), 'pr'); await pg.keyboard.up('ArrowRight');
  await sleep(200); await rawShot(pg, sp('raw-m39-player-straight.png'), 'ps');
  const p = await pg.evaluate(() => ({ pl: window.__ev.caps.pl, ps: window.__ev.caps.ps, pr: window.__ev.caps.pr }));
  await contactSheet(sheet, [{ d: p.pl, label: 'left' }, { d: p.ps, label: 'straight' }, { d: p.pr, label: 'right' }], 3, 480, sp('m39-player-frames.png'), crop);
  const s = await st(pg);
  await P.context.close();
  return { crashes: s.crashes };
};

T.S07 = async () => {
  const P = await playing(); const pg = P.page;
  await hold(pg, { x: 0.30, v: 200 });
  await pg.evaluate(() => {
    const ev = window.__ev; let prev = null; let n = 0;
    ev.hooks.push((st, t) => { if (prev && st.overtakes > prev.overtakes && n < 4) { const k = n++; const t0 = t; ev.hooks.push((s2, t2) => { if (t2 - t0 >= 100) { ev.capture('s07-' + k); return 'done'; } }); } prev = st; });
  });
  await startSampling(pg);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { await sleep(500); const s = await st(pg); if (s.overtakes >= 4) break; }
  await sleep(300);
  const smp = await stopSampling(pg);
  const ev = [];
  for (let i = 1; i < smp.length; i++) if (smp[i].overtakes > smp[i - 1].overtakes) ev.push({ dScore: smp[i].score - smp[i - 1].score, dDist: Math.floor(smp[i].distanceM) - Math.floor(smp[i - 1].distanceM), bonus: smp[i].score - smp[i - 1].score - (Math.floor(smp[i].distanceM) - Math.floor(smp[i - 1].distanceM)) });
  const shots = await saveCaps(pg, 's07-', 's07-overtake');
  const crashes = smp[smp.length - 1].crashes - smp[0].crashes;
  await P.context.close();
  return { events: ev, crashes, shots, nearMiss: ev.some((e) => Math.abs(e.bonus - 70) <= 1) };
};

T.S08 = async () => { // スペクトログラム
  const out = {};
  for (const s of [1, 2, 3]) {
    const P = await playing({ stage: s }); const pg = P.page;
    await hold(pg, { x: 0.333, v: 0 });
    await sleep(300);
    const cols = await pg.evaluate(() => new Promise((res) => { const cols = []; const iv = setInterval(() => { cols.push(window.__ev.spectrum()); if (cols.length >= 160) { clearInterval(iv); res(cols); } }, 50); }));
    const bgm = (await st(pg)).audio.bgm;
    const img = await sheet.evaluate((cols) => {
      const c = document.createElement('canvas'); c.width = cols.length * 4; c.height = 256 * 2; const g = c.getContext('2d');
      cols.forEach((col, x) => { if (!col) return; col.forEach((v, y) => { g.fillStyle = `rgb(${v},${Math.max(0, v - 80)},${255 - v})`; g.fillRect(x * 4, (255 - y) * 2, 4, 2); }); });
      return c.toDataURL('image/png');
    }, cols);
    await saveDataUrl(img, sp(`s08-spectrogram-s${s}.png`));
    out['s' + s] = { bgm };
    await P.context.close();
  }
  return out;
};

T.S09 = async () => {
  const P = await newPage(b, { port, viewport: { width: 390, height: 844 }, touch: true });
  const pg = P.page; const r = {};
  await pg.goto(gameUrl(port)); await waitScene(pg, 'title', 10000); await sleep(500);
  r.coarse = await pg.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await pg.screenshot({ path: sp('s09-touch-title.png') });
  const cdp = await pg.context().newCDPSession(pg);
  const tap = async (x, y, ms = 80) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const cb = await pg.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await tap(cb.x, cb.y);
  r.tapStart = await waitScene(pg, 'countdown', 3000);
  if (r.tapStart) {
    await waitScene(pg, 'playing', 6000); await sleep(300);
    await pg.screenshot({ path: sp('s09-touch-play.png') });
    const sel = TOUCH_GAS[effort];
    const box = sel ? await pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null; }, sel) : null;
    r.gasButton = box;
    if (box) {
      const s0 = (await st(pg)).speedKmh;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
      await sleep(1000);
      const s1 = (await st(pg)).speedKmh;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(1000);
      const s2 = (await st(pg)).speedKmh;
      r.speeds = [s0, s1, s2].map(r3); r.accelWhilePressed = s1 > s0 + 20; r.stopsAfterRelease = s2 <= s1;
    }
  }
  await P.context.close();
  return r;
};

T.S10 = async () => {
  const P = await playing(); const pg = P.page;
  await dbg(pg, 'warp', 20); await hold(pg, { x: 1.05 }); await dbg(pg, 'setSpeedKmh', 150);
  await pg.keyboard.down('ArrowUp'); await sleep(500);
  await rawShot(pg, sp('raw-s10-offroad-dust.png'));
  await pg.keyboard.up('ArrowUp');
  await P.context.close();
  return {};
};

T.S11 = async () => {
  const P = await playing(); const pg = P.page;
  await hold(pg, { x: 0.333, v: 0 }); await sleep(300);
  const series = await pg.evaluate(() => new Promise((res) => { window.__game.debug.setTime(10.5); const out = []; const t0 = performance.now(); const iv = setInterval(() => { const l = window.__ev.level(); out.push([Math.round(performance.now() - t0), +l.rms.toFixed(5)]); if (performance.now() - t0 > 3000) { clearInterval(iv); res(out); } }, 20); }));
  await P.context.close();
  return { series };
};

T.S15 = async () => { // + S-16
  const r = {};
  const P = await playing(); const pg = P.page;
  await sleep(500);
  await pg.evaluate(() => window.dispatchEvent(new Event('blur'))); await sleep(200);
  r.blur = (await st(pg)).scene;
  await P.context.close();
  const Q = await playing(); const q = Q.page;
  await sleep(500);
  await q.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(200);
  r.visibility = (await st(q)).scene;
  await Q.context.close();
  const F = await playing(); const f = F.page;
  await sleep(300); await press(f, 'KeyF'); await sleep(500);
  r.fullscreen = await f.evaluate(() => !!document.fullscreenElement);
  r.errorsAfterF = errCount(F.errs);
  await F.context.close();
  return r;
};

// 補足: エンディング画面を 0.5 秒間隔で 3 枚(点滅する PRESS ENTER の確認用)
T.M27X = async () => {
  const P = await openTitle(b, port);
  await P.page.evaluate(() => window.__ev.captureAfter("st.scene==='ending'", [800, 1300, 1800], 'm27x-', false));
  const L = await wRoute(P, { shots: false });
  const shots = await saveCaps(P.page, 'm27x-', 'm27x-ending');
  await P.context.close();
  return { ok: L.ok, shots };
};

// 補足: ゲームオーバー画面(NEW BEST! が点滅する実装があるため)を 0.15 秒間隔で 6 枚
T.M32X = async () => {
  const P = await playing(); const pg = P.page;
  await hold(pg, { x: 0.333 }); await pg.keyboard.down('ArrowUp'); await sleep(5000); await pg.keyboard.up('ArrowUp'); await hold(pg, null);
  await pg.evaluate(() => window.__ev.captureAfter("st.scene==='gameover'", [500, 650, 800, 950, 1100, 1250], 'm32x-', false));
  await dbg(pg, 'setTime', 1);
  await waitScene(pg, 'gameover', 8000); await sleep(1600);
  const c = await getCaps(pg, 'm32x-');
  const items = Object.keys(c).filter((k) => !k.endsWith('_t')).map((k) => ({ d: c[k], label: k.slice(5) + 'ms' }));
  const sh = await contactSheet(sheet, items, 3, 426, sp('m32x-gameover-sheet.png'));
  await P.context.close();
  return { sheet: sh };
};

// 補足: S-04 の拡大確認(自車左下のタイヤ付近を毎フレーム 8 倍で 12 枚)
T.S04Z = async () => {
  const P = await playing(); const pg = P.page;
  await hold(pg, { x: 0.333, v: 150 }); await sleep(2200);
  await pg.evaluate(() => window.__ev.captureAfter('true', Array.from({ length: 12 }, (_, i) => i * 17), 's04z-', false));
  await sleep(500);
  const w = await getCaps(pg, 's04z-');
  const items = Object.keys(w).filter((k) => !k.endsWith('_t')).map((k) => ({ d: w[k], label: Math.round(w[k + '_t']) + 'ms' }));
  await contactSheet(sheet, items, 6, 320, sp('s04z-tire-zoom-sheet.png'), [236, 300, 48, 60]);
  await P.context.close();
  return {};
};

// 補足: S-05 の画面シェイク検出。衝突直後 0.3 秒の各フレームで、空の帯(y=60〜110)の横ずれを直前フレームと比べる
T.S05X = async () => {
  const P = await playing(); const pg = P.page;
  await hold(pg, { x: 0, v: 200 });
  await pg.evaluate(() => {
    const ev = window.__ev; let c0 = null, tc = null, i = 0;
    ev.s05 = [];
    ev.hooks.push((st, t) => {
      if (c0 == null) c0 = st.crashes;
      if (tc == null) { if (st.crashes > c0) { tc = t; ev.hold = { v: 0 }; } else return; }
      ev.capture('s05-' + i, true);
      if (i > 0) { const a = ev.shift('s05-' + (i - 1), 's05-' + i, 60, 110, 40, 600, 8); const b2 = ev.shift('s05-' + (i - 1), 's05-' + i, 4, 20, 0, 200, 8); ev.s05.push({ t: Math.round(t - tc), sky: a && a.s, hud: b2 && b2.s }); }
      i++;
      if (t - tc > 450) return 'done';
    });
  });
  for (let k = 0; k < 80; k++) { await sleep(250); if ((await pg.evaluate(() => window.__ev.s05.length)) > 20) break; }
  await sleep(300);
  const r = await pg.evaluate(() => window.__ev.s05);
  await P.context.close();
  const within = r.filter((x) => x.t <= 300), after = r.filter((x) => x.t > 350);
  return { frames: r, skyShiftFramesWithin300ms: within.filter((x) => x.sky !== 0).length, skyShiftFramesAfter350ms: after.filter((x) => x.sky !== 0).length };
};

// 補足: S-18 のロゴの動き。タイトルで 0.1 秒おきに 16 枚撮り、ロゴ帯(x=200〜440, y=10〜110)の縦ずれ(-8〜8px)と
// 1 枚目との平均差を求める(背景の横スクロールの影響を避けるため縦方向だけを見る)
T.S18X = async () => {
  const P = await openTitle(b, port); const pg = P.page;
  await sleep(1000);
  await pg.evaluate(() => window.__ev.captureAfter('true', Array.from({ length: 16 }, (_, i) => i * 100), 's18-', true));
  await sleep(2000);
  const r = await pg.evaluate(() => {
    const ev = window.__ev; const A = ev.imgs['s18-0']; const W = A.width; const out = [];
    for (let i = 1; i < 16; i++) {
      const B = ev.imgs['s18-' + i * 100]; let best = null, bs = 0; let d0 = 0;
      for (let s = -8; s <= 8; s++) {
        let sum = 0, n = 0;
        for (let y = 20; y <= 100; y++) for (let x = 200; x <= 440; x += 2) { const ya = y - s; const ia = (ya * W + x) * 4, ib = (y * W + x) * 4; sum += Math.abs(A.data[ia] - B.data[ib]) + Math.abs(A.data[ia + 1] - B.data[ib + 1]) + Math.abs(A.data[ia + 2] - B.data[ib + 2]); n++; }
        const m = sum / n / 3; if (s === 0) d0 = m; if (best == null || m < best) { best = m; bs = s; }
      }
      out.push({ t: i * 100, dy: bs, mad0: +d0.toFixed(2) });
    }
    return out;
  });
  await P.context.close();
  return { frames: r, distinctDy: [...new Set(r.map((x) => x.dy))], maxMad0: Math.max(...r.map((x) => x.mad0)) };
};

// =========================== 実行 ===========================
const ORDER = ['O1', 'O2', 'W', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M17', 'M18', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24', 'M26', 'M28', 'M29', 'M30', 'M31', 'M32', 'M33', 'M34', 'M35', 'M36', 'M37', 'O5', 'O7', 'S03', 'S07', 'S08', 'S09', 'S10', 'S11', 'S15', 'B', 'B3'];
const list = only.length ? only : ORDER;
for (const id of list) {
  const t0 = Date.now();
  try { R[id] = await T[id](); } catch (e) { R[id] = { error: String(e && e.stack || e) }; }
  R[id]._ms = Date.now() - t0;
  console.log(effort, id, (R[id]._ms / 1000).toFixed(1) + 's', R[id].error ? 'ERROR ' + R[id].error.split('\n')[0] : '');
  fs.writeFileSync(RAW, JSON.stringify(R, null, 1));
}
await b.close();
