// raw/<effort>.json(自動測定)+ visual.json(目視判定)→ results.json
// 合否 = 自動条件 AND 目視条件(目視のない項目は自動のみ、自動のない項目は目視のみ)
import fs from 'fs';
import path from 'path';
import { EFFORTS, EVAL_DIR } from './config.mjs';

const ST = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'raw', 'static.json'), 'utf8'));
const VIS = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'scripts', 'visual.json'), 'utf8'));
const inR = (v, a, b) => typeof v === 'number' && v >= a && v <= b;
const MUST_ASSETS = { car_player: 3, car_sedan: 1, car_truck: 1, car_sports: 1, rs_palm: 1, rs_rock: 1, rs_shrub: 1, rs_pine: 1, rs_boulder: 1, rs_fern: 1, rs_lamp: 1, rs_neon: 1, rs_building: 1, gate_checkpoint: 1, gate_goal: 1, bg_sky_1: 1, bg_sky_2: 1, bg_sky_3: 1, bg_far_1: 1, bg_far_2: 1, bg_far_3: 1, logo_title: 1, font_pixel: 50, fx_smoke: 4 };
const NATIVE = { car_player: [40, 22], car_sedan: [36, 20], car_truck: [44, 34], car_sports: [38, 18], rs_palm: [40, 72], rs_rock: [32, 22], rs_shrub: [32, 20], rs_pine: [40, 88], rs_boulder: [40, 28], rs_fern: [28, 16], rs_lamp: [20, 88], rs_neon: [56, 52], rs_building: [64, 128], gate_checkpoint: [160, 64], gate_goal: [160, 64], bg_sky_1: [640, 180], bg_sky_2: [640, 180], bg_sky_3: [640, 180], bg_far_1: [640, 96], bg_far_2: [640, 96], bg_far_3: [640, 96], font_pixel: [5, 7], fx_smoke: [12, 12], bg_near_1: [640, 56], bg_near_2: [640, 56], bg_near_3: [640, 56], rs_billboard: [48, 56], rs_signpost: [20, 44], rs_bollard: [12, 16], rs_building_b: [64, 112], gate_start: [160, 64], car_player_brake: [40, 22], car_player_wheel: [40, 22], fx_dust: [8, 8], fx_spark: [6, 6] };
const SHOULD_ASSETS = ['bg_near_1', 'bg_near_2', 'bg_near_3', 'rs_billboard', 'rs_signpost', 'rs_bollard', 'rs_building_b', 'gate_start', 'car_player_brake', 'car_player_wheel', 'fx_dust', 'fx_spark'];
const MUST_SOUNDS = ['bgm_1', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu'];
const SHOULD_SOUNDS = ['bgm_2', 'bgm_3', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title'];
const rankOf = (s) => (s >= 33000 ? 'S' : s >= 28000 ? 'A' : s >= 23000 ? 'B' : 'C');

// 引数で variant を指定した場合はその variant だけを判定し、既存の results.json に追記する(既存キーの値は変えない)
const ONLY = process.argv.slice(2);
const OUT = path.join(EVAL_DIR, 'results.json');
const results = ONLY.length && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
for (const e of ONLY.length ? ONLY : EFFORTS) {
  if (!fs.existsSync(path.join(EVAL_DIR, 'raw', e + '.json'))) continue;
  const R = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'raw', e + '.json'), 'utf8'));
  const V = VIS[e] || {};
  const S = ST[e];
  const must = {}, should = {};
  const put = (tbl, id, auto, data, visKey) => {
    const v = V[visKey || id];
    let pass;
    if (auto === 'unmeasured') pass = 'unmeasured';
    else if (auto == null) pass = v ? v.pass : 'pending';
    else pass = v && v.pass !== undefined ? (auto && v.pass) : auto;
    if (v && v.pass === 'unmeasured') pass = 'unmeasured';
    tbl[id] = { pass, auto, visual: v ? v.pass : undefined, note: v ? v.note : undefined, data };
  };
  const W = R.W || {}; const ws = W.stages || {};
  const assets = Object.fromEntries((R.O7?.assets || []).map((a) => [a.id, a]));
  // 「空でも全面同色でもない」: 不透明画素があり、かつ(不透明画素が 2 色以上、または透明画素もある)
  const drawn = (a) => a && a.opaque > 0 && (a.colors >= 2 || a.opaque < Math.floor(a.cw * a.ch / 3) - 1);
  const snd = R.O7?.snd || {}; const sounds = R.O7?.sounds || [];

  // ---- Must
  put(must, 'M01', S.indexExists && R.O1?.sub?.titleOk && R.O1?.root?.titleOk && R.O1.sub.errors.requestfailed === 0 && R.O1.root.errors.requestfailed === 0 && S.rootAbsoluteRefs.length === 0, { sub: R.O1?.sub?.errors, root: R.O1?.root?.errors, absRefs: S.rootAbsoluteRefs });
  const we = W.errors || {};
  put(must, 'M02', W.ok && we.console === 0 && we.pageerror === 0 && we.requestfailed === 0 && we.external === 0, { ok: W.ok, errors: we });
  const o5 = R.O5 || {};
  put(must, 'M03', ['1280x720', '1920x1080', '375x667'].every((k) => o5[k]?.title?.ok && o5[k]?.play?.ok), Object.fromEntries(Object.entries(o5).filter(([k]) => k !== '_ms').map(([k, v]) => [k, { title: v.title.issues, play: v.play.issues, maxSizeOk: v.title.maxSizeOk }])));
  put(must, 'M04', !!(R.M04?.autoPass || R.M04?.autoPass025), { roadChanged_0_5vs1_5: R.M04?.roadChangedRatio, roadChanged_0_5vs0_75: R.M04?.roadChangedRatio025 });
  const m5 = R.M05 || {};
  put(must, 'M05', m5.enterOk && m5.spaceOk && m5.maxSpeed === 0 && Math.abs(m5.timeLeftMin - 30) < 1e-6 && Math.abs(m5.timeLeftMax - 30) < 1e-6, { maxSpeed: m5.maxSpeed, timeLeft: [m5.timeLeftMin, m5.timeLeftMax], space: m5.spaceOk });
  put(must, 'M06', inR(R.M06?.countdownSec, 2.9, 3.1) && inR(R.M06?.timeLeftAt5s, 24.7, 25.3), { countdownSec: R.M06?.countdownSec, timeLeftAt5s: R.M06?.timeLeftAt5s });
  put(must, 'M07', R.M07?.valid && inR(R.M07?.speedAt3s, 170, 190) && R.M07?.maxAfter280 <= 300.01, { speedAt3s: R.M07?.speedAt3s, max: R.M07?.maxAfter280, seed: R.M07?.seed });
  put(must, 'M08', R.M08?.valid && inR(R.M08?.decrease, 140, 160), { decrease: R.M08?.decrease, seed: R.M08?.seed });
  put(must, 'M09', R.M09?.valid && inR(R.M09?.speedAt2s, 104, 116), { speedAt2s: R.M09?.speedAt2s, seed: R.M09?.seed });
  const m10 = R.M10 || {};
  put(must, 'M10', m10.right && m10.left && m10.D && m10.A && m10.zeroSpeedDelta < 1e-6, { seq: m10.seq, zero: m10.zeroSpeedDelta });
  put(must, 'M11', R.M11?.xAt1s <= -0.5, { xAt1s: R.M11?.xAt1s });
  const m12 = R.M12 || {};
  put(must, 'M12', inR(m12.speedAt3s, 70, 80) && m12.crashesDelta === 0 && m12.xMin >= 1.0 && m12.xMax <= 1.15, { speedAt3s: m12.speedAt3s, x: [m12.xMin, m12.xMax], crashes: m12.crashesDelta, ref0: m12.ref0SpeedAt3s });
  put(must, 'M13', null, {});
  const m14 = R.M14 || {};
  const m14ok = m14.run && m14.run.B.s <= -5 && (m14.run.A.s < 0 || Math.abs(m14.run.A.s) > Math.abs(m14.stop.A.s)) && Math.abs(m14.stop.A.s) <= 1 && Math.abs(m14.stop.B.s) <= 1;
  put(must, 'M14', !!m14ok, { run: m14.run && { A: m14.run.A.s, B: m14.run.B.s, C: m14.run.C.s }, stop: m14.stop && { A: m14.stop.A.s, B: m14.stop.B.s, C: m14.stop.C.s } });
  put(must, 'M15', null, {});
  const tt = [R.M36?.s1?.traffic, R.M36?.s2?.traffic, R.M36?.s3?.traffic];
  const ttW = [ws[1]?.countdown?.trafficTotal, ws[2]?.countdown?.trafficTotal, ws[3]?.countdown?.trafficTotal];
  put(must, 'M16', tt.join() === '36,54,72' && ttW.join() === '36,54,72', { stageParam: tt, wRoute: ttW });
  const ev17 = R.M17?.events || [];
  put(must, 'M17', R.M17?.valid && ev17.length > 0 && ev17.every((x) => x.dOv === 1 && Math.abs(x.bonus - 50) <= 1) && R.M18?.overtakesIn300ms === 0, { events: ev17.map((x) => x.bonus), seed: R.M17?.seed, crashedCarOvertakes: R.M18?.overtakesIn300ms });
  const crashOk = (m) => m && m.crashed && m.speedAfter <= 62 && m.crashesDelta === 1 && m.invFirst && inR(m.invDurationMs, 1100, 1300) && m.crashesDuringInv === 0 && m.sceneAtEnd === 'playing';
  const crashData = (m) => m && { speedAfter: m.speedAfter, crashesDelta: m.crashesDelta, invMs: m.invDurationMs, invEndBy: m.invEndBy, duringInv: m.crashesDuringInv, afterInv: m.crashesAfterInv, pushX: m.xAfterPush, confirmInvuln: m.crashesAfterInv > 0 ? 'ok' : '確認不十分' };
  put(must, 'M18', !!crashOk(R.M18), crashData(R.M18));
  put(must, 'M19', !!crashOk(R.M19), crashData(R.M19));
  put(must, 'M20', null, {});
  const sc1 = ws[1]?.rec || {};
  const m21 = [Math.abs((R.M05?.m21?.at0_2 ?? NaN) - (R.M05?.m21?.at2_2 ?? NaN)), R.M21?.diff, Math.abs((sc1.b?.timeLeft ?? NaN) - (sc1.c?.timeLeft ?? NaN))];
  put(must, 'M21', m21.every((d) => d <= 1e-6) && R.M21?.pausedScene === 'paused', { countdown: m21[0], paused: m21[1], stageclear: m21[2] });
  const m22 = R.M22 || {};
  put(must, 'M22', m22.valid && m22.secAfterWarp <= 1 && m22.cpBefore === 0 && m22.cpAfter === 1 && inR(m22.dTime, 17.9, 18.05) && inR(m22.dScore, 500, 505), { sec: m22.secAfterWarp, dTime: m22.dTime, dScore: m22.dScore, seed: m22.seed });
  put(must, 'M23', inR(R.M23?.toTimeup, 1.8, 2.2) && inR(R.M23?.toGameover, 2.3, 2.7), { toTimeup: R.M23?.toTimeup, toGameover: R.M23?.toGameover });
  const m24 = R.M24 || {};
  put(must, 'M24', m24.valid && m24.stageclear && m24.scoreOk, { dScore: m24.dScore, expect: m24.expect, T0: m24.T0, seed: m24.seed });
  const m25 = m24.m25 || {};
  put(must, 'M25', m25.scene === 'countdown' && m25.stage === 2 && inR(m25.goalRemainingM, 3592.2, 3596.2) && m25.timeLeft === 32 && m25.trafficTotal === 54 && m25.score === m25.scoreBefore && m25.cp === 0, m25);
  const c3 = ws[3]?.countdown || {};
  put(must, 'M26', inR(c3.goalRemainingM, 4192.2, 4196.2) && c3.timeLeft === 32, { s3goal: c3.goalRemainingM, s3time: c3.timeLeft, color: R.M26 && { s1: R.M26.s1.sky, s2: R.M26.s2.sky, s3sky: R.M26.s3.sky, s3neonFull: R.M26.s3.full.neon, numeric: R.M26.numeric } });
  const en = W.ending || {};
  put(must, 'M27', en.scene === 'ending' && en.rank === rankOf(en.score) && W.ok, { score: en.score, rank: en.rank, expected: en.score != null ? rankOf(en.score) : null, bRank: R.B?.final?.rank, bScore: R.B?.final?.score });
  put(must, 'M28', R.M28 && Math.abs(R.M28.diff) <= 1, { score: R.M28?.score, dist: R.M28?.distanceM, ov: R.M28?.overtakes, diff: R.M28?.diff });
  const m29 = R.M29 || {};
  const pk = (k) => m29[k] && m29[k].paused === 'paused' && m29[k].dTime <= 1e-6 && m29[k].dDist <= 1e-6 && m29[k].imgMad < 1 && m29[k].resumed === 'playing';
  put(must, 'M29', pk('KeyP') && pk('Escape') && m29.R?.scene === 'countdown' && m29.R?.stage === 1 && m29.R?.score === 0 && m29.Q === 'title', m29);
  const m30 = R.M30 || {};
  const rOk = (x, stg = 1) => x && x.scene === 'countdown' && x.stage === stg && x.score === 0 && x.overtakes === 0 && x.crashes === 0;
  put(must, 'M30', rOk(m30.playing) && rOk(m30.paused) && rOk(m30.gameoverR) && rOk(m30.ending) && rOk(m30.gameoverEnter) && m30.gameoverEsc === 'title' && m30.gameoverQ === 'title' && rOk(m30.stage2, 2), m30);
  const m31 = R.M31 || {};
  let lsm = null; try { lsm = JSON.parse(m31.mute1ls); } catch (x) {}
  put(must, 'M31', m31.after === !m31.before && m31.afterReload === m31.after && m31.lsShape && m31.mute1 === true && (m31.mute1ls == null || (lsm && lsm.muted === false)), m31);
  const m32 = R.M32 || {};
  let b32 = null; try { b32 = JSON.parse(m32.ls).best; } catch (x) {}
  put(must, 'M32', m32.score > 0 && b32 === m32.score && m32.bestAfterReload === m32.score && m32.throwRoute?.ok && m32.throwErrors?.console === 0 && m32.throwErrors?.pageerror === 0, { score: m32.score, lsBest: b32, reload: m32.bestAfterReload, throwOk: m32.throwRoute?.ok, throwErrors: m32.throwErrors });
  put(must, 'M33', null, {});
  const a = R.M34 || {};
  const m34 = {
    stateNone: a.beforeInput?.state === 'none', running: a.after05?.state === 'running',
    bgmCd: a.after05?.bgm != null && a.countdownScene === 'countdown', bgmPlay: a.playing?.bgm != null,
    bgmNull: a.stageclear?.bgm == null && a.timeup?.bgm == null && a.title?.bgm == null,
    hzCd: inR(a.after05?.engineHz, 50, 70), hz150: inR(a.at150?.engineHz, 120, 140), hz300: inR(a.at300?.engineHz, 190, 210),
    hzZero: a.title?.engineHz === 0 && a.paused?.engineHz === 0,
    mute: a.rmsMuted?.rms < 0.0005 && a.rmsBeforeMute?.rms > 0.001,
  };
  put(must, 'M34', Object.values(m34).every(Boolean), { checks: m34, hz: [a.after05?.engineHz, a.at150?.engineHz, a.at300?.engineHz, a.title?.engineHz, a.paused?.engineHz], rms: [a.rmsBeforeMute?.rms, a.rmsMuted?.rms], peak: a.rmsBeforeMute?.peak, bgm: { cd: a.after05?.bgm, pl: a.playing?.bgm, sc: a.stageclear?.bgm, tu: a.timeup?.bgm, ti: a.title?.bgm } });
  const m35 = R.M35 || {};
  put(must, 'M35', m35.defaultPrevented && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].every((k) => m35.defaultPrevented[k] === true) && m35.scrollY === 0 && m35.speedAfter1s <= m35.speedBefore && m35.repeatScene === 'title' && m35.controlScene === 'countdown', m35);
  const m36 = R.M36 || {};
  put(must, 'M36', m36.s1?.same && m36.s2?.same && m36.s3?.same && m36.seed43Differs && m36.rSame, m36);
  const f30 = R.M37?.fps30 || {};
  put(must, 'M37', inR(f30.m06?.fps, 25, 35) && inR(f30.m07?.fps, 25, 35) && inR(f30.m06?.timeLeftAt5s, 24.7, 25.3) && f30.m07?.valid && inR(f30.m07?.speedAt3s, 170, 190), { fps30: { fps: [f30.m06?.fps, f30.m07?.fps], timeLeftAt5s: f30.m06?.timeLeftAt5s, speedAt3s: f30.m07?.speedAt3s }, fps144: R.M37?.fps144 && { fps: [R.M37.fps144.m06.fps, R.M37.fps144.m07.fps], timeLeftAt5s: R.M37.fps144.m06.timeLeftAt5s, speedAt3s: R.M37.fps144.m07.speedAt3s } });
  const assetTbl = Object.fromEntries([...Object.keys(MUST_ASSETS), ...SHOULD_ASSETS].map((id) => { const x = assets[id]; return [id, x ? { frames: x.frames, size: `${x.fw}x${x.fh}`, nativeMatch: id === 'logo_title' ? x.fw >= 200 && x.fh >= 40 : NATIVE[id] ? x.fw === NATIVE[id][0] && x.fh === NATIVE[id][1] : null, drawn: drawn(x), label: x.label } : null]; }));
  const m38 = Object.entries(MUST_ASSETS).every(([id, n]) => assets[id] && assets[id].frames >= n && drawn(assets[id])) && MUST_SOUNDS.every((s) => sounds.includes(s) && snd[s] && snd[s].errors === 0);
  put(must, 'M38', m38, { missingAssets: Object.keys(MUST_ASSETS).filter((id) => !(assets[id] && assets[id].frames >= MUST_ASSETS[id] && drawn(assets[id]))), missingSounds: MUST_SOUNDS.filter((s) => !sounds.includes(s)), silentSounds: sounds.filter((s) => snd[s] && !snd[s].sounded) });
  put(must, 'M39', null, {});
  put(must, 'M40', S.textApiHits.length === 0 && W.fillText && W.fillText.fill === 0 && W.fillText.stroke === 0, { staticHits: S.textApiHits, runtime: W.fillText });
  put(must, 'M41', W.ok && inR(W.timerAfterR?.dTime, 1.9, 2.1) && ws[2]?.countdown?.trafficTotal === 54 && ws[3]?.countdown?.trafficTotal === 72 && ws[2]?.countdown?.timeLeft === 32 && ws[3]?.countdown?.timeLeft === 32 && W.afterR?.stage === 1 && W.afterR?.score === 0, { ok: W.ok, timerAfterR: W.timerAfterR, afterR: W.afterR && { stage: W.afterR.stage, score: W.afterR.score, timeLeft: W.afterR.timeLeft } });
  put(must, 'M42', null, {});

  // ---- Should
  put(should, 'S-01', null, {});
  const nearOk = ['bg_near_1', 'bg_near_2', 'bg_near_3'].every((id) => drawn(assets[id]));
  const bands = (fs.existsSync(path.join(EVAL_DIR, 'raw', 's02-bands.json')) ? JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'raw', 's02-bands.json'), 'utf8')) : {})[e] || {};
  const nearBand = Math.max(Math.abs(bands['160-170'] || 0), Math.abs(bands['170-178'] || 0));
  // 帯 C(y=130〜176)は遠景と重なるので、行ごとの推定(s02-bands.mjs)の下端帯のずれが遠景(帯 B)より大きいかで判定する(RESULTS.md に逸脱として記載)
  const skyS = Math.abs(bands['100-120'] || 0);
  const farS = Math.min(Infinity, ...['120-140', '140-160', '160-170'].map((k) => Math.abs(bands[k] || 0)).filter((v) => v > skyS + 5 && v < Math.abs(bands['170-178'] || 0) - 5));
  const farOk = Number.isFinite(farS);
  // 行ごとの推定で「空 < 遠景 < 近景(最下段 y=170〜178)」の 3 段の速さが分かれ、近景が遠景の 1.5 倍以上なら合格
  put(should, 'S-02', nearOk && farOk && Math.abs(bands['170-178'] || 0) >= 1.5 * farS, { near: nearOk, shift: m14.run && { A: m14.run.A.s, B: m14.run.B.s, C: m14.run.C.s }, rowBands: bands });
  put(should, 'S-03', null, { galleryBrake: !!assets.car_player_brake });
  put(should, 'S-04', null, { galleryWheel: !!assets.car_player_wheel });
  put(should, 'S-05', null, { galleryspark: !!assets.fx_spark, shakeFramesWithin300ms: R.S05X?.skyShiftFramesWithin300ms, shakeFramesAfter350ms: R.S05X?.skyShiftFramesAfter350ms });
  put(should, 'S-06', null, {});
  put(should, 'S-07', !!R.S07?.nearMiss, { events: R.S07?.events?.map((x) => x.bonus) });
  const bg = [W.sceneLog?.find((x) => x.scene === 'playing' && x.stage === 1)?.bgm, W.sceneLog?.find((x) => x.scene === 'playing' && x.stage === 2)?.bgm, W.sceneLog?.find((x) => x.scene === 'playing' && x.stage === 3)?.bgm];
  put(should, 'S-08', sounds.includes('bgm_2') && sounds.includes('bgm_3') && sounds.includes('jingle_title') && bg[1] === 'bgm_2' && bg[2] === 'bgm_3', { buttons: SHOULD_SOUNDS.filter((s) => sounds.includes(s)), wRouteBgm: bg, spect: R.S08 });
  const s9 = R.S09 || {};
  put(should, 'S-09', !!(s9.coarse && s9.tapStart && s9.gasButton && s9.accelWhilePressed && s9.stopsAfterRelease), s9);
  put(should, 'S-10', sounds.includes('sfx_offroad') && !!assets.fx_dust, { sfx_offroad: sounds.includes('sfx_offroad'), fx_dust: !!assets.fx_dust });
  put(should, 'S-11', null, { button: sounds.includes('sfx_timewarn') });
  put(should, 'S-12', null, {});
  put(should, 'S-13', null, {});
  put(should, 'S-14', null, { variants: Object.keys(assets).filter((k) => /^car_(sedan|truck|sports)/.test(k)).map((k) => `${k}:${assets[k].frames}`) });
  put(should, 'S-15', R.S15?.blur === 'paused' && R.S15?.visibility === 'paused', { blur: R.S15?.blur, visibility: R.S15?.visibility });
  put(should, 'S-16', null, { fullscreen: R.S15?.fullscreen });
  put(should, 'S-17', !!assets.gate_start, { gate_start: !!assets.gate_start });
  put(should, 'S-18', null, { logoDy: R.S18X?.distinctDy });

  const cnt = (t) => ({ pass: Object.values(t).filter((x) => x.pass === true).length, fail: Object.values(t).filter((x) => x.pass === false).length, unmeasured: Object.values(t).filter((x) => x.pass === 'unmeasured').length, pending: Object.values(t).filter((x) => x.pass === 'pending').length });
  const o4 = R.O4 || {};
  results[e] = {
    objective: {
      launch: R.O1?.launch, errorsWRoute: we, errorsFavicon: we.favicon,
      loadMs: R.O2?.titleAtMed, loadEventEndMs: R.O2?.loadEventEndMed,
      perf: o4, mobile390: o5['390x844'] && { title: o5['390x844'].title.issues, play: o5['390x844'].play.issues },
      scale: { distFiles: S.distFiles, distBytes: S.distBytes, srcLines: S.srcLines, srcNonEmptyLines: S.srcNonEmptyLines, outsideDistFiles: S.outsideDistFiles, perFile: S.perFile },
      bRoute: R.B && { stages: R.B.stages, final: R.B.final }, b3: R.B3 && { final: R.B3.final },
      assets: assetTbl, sounds: { list: sounds, snd, mute: R.O7?.mute, galleryErrors: R.O7?.errors },
    },
    mustCount: cnt(must), shouldCount: cnt(should), must, should,
    subjective: VIS[e]?.subjective || null,
  };
  const c1 = cnt(must), c2 = cnt(should);
  console.log(e, 'Must', c1, 'Should', c2);
  console.log('  fail M:', Object.entries(must).filter(([, v]) => v.pass === false).map(([k]) => k).join(' '), '| pending:', Object.entries(must).filter(([, v]) => v.pass === 'pending').map(([k]) => k).join(' '));
  console.log('  fail S:', Object.entries(should).filter(([, v]) => v.pass === false).map(([k]) => k).join(' '), '| pending:', Object.entries(should).filter(([, v]) => v.pass === 'pending').map(([k]) => k).join(' '));
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
