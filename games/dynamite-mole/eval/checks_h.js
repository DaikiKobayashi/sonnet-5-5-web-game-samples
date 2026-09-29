'use strict';
// H 群: 音の測定(聴取はできないので、AudioContext の出力を捕捉して数値化する)
//  - 無音でないこと、ピーク(仕様: SFX 0.35 以下 / BGM 0.2 以下)、ジングルの長さ
//  - ステージごとに別の曲か(スペクトルの時系列の相関)、残り 30 秒以下でのテンポ変化
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { sleep, snap, dbg, press, waitState, startPlaying } = L;
const D = require('./checks_d');

// destination へ接続されるノードの出力を横取りして録る(ゲームの挙動は変えない)
const AUD_INIT = () => {
  window.__aud = { chunks: [], on: false, sr: 0, taps: new Map() };
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = orig.call(this, dest, ...rest);
    try {
      if (dest && typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) {
        const ctx = dest.context;
        if (!window.__aud.taps.has(ctx)) {
          const sp = ctx.createScriptProcessor(2048, 2, 1);
          const mute = ctx.createGain();
          mute.gain.value = 0;
          sp.onaudioprocess = (e) => { if (window.__aud.on) window.__aud.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
          orig.call(sp, mute);
          orig.call(mute, ctx.destination);
          window.__aud.taps.set(ctx, sp);
          window.__aud.sr = ctx.sampleRate;
        }
        orig.call(this, window.__aud.taps.get(ctx));
      }
    } catch (e) { /* ignore */ }
    return r;
  };
};

async function capture(page, ms) {
  await page.evaluate(() => { window.__aud.chunks = []; window.__aud.on = true; });
  await sleep(ms);
  return page.evaluate(() => {
    window.__aud.on = false;
    const ch = window.__aud.chunks;
    const n = ch.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(n);
    let o = 0;
    for (const c of ch) { all.set(c, o); o += c.length; }
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) { const v = Math.abs(all[i]); if (v > peak) peak = v; sum += all[i] * all[i]; }
    const dec = 4, m = Math.floor(n / dec), pcm = new Array(m);
    for (let i = 0; i < m; i++) { let s = 0; for (let k = 0; k < dec; k++) s += all[i * dec + k]; pcm[i] = Math.round((s / dec) * 32767); }
    return { sr: window.__aud.sr, n, peak, rms: Math.sqrt(sum / Math.max(1, n)), dec, pcm };
  });
}

// ---- 解析 ----
const FREQS = Array.from({ length: 48 }, (_, i) => 80 * Math.pow(4000 / 80, i / 47));
function goertzel(x, off, N, fs, f) {
  const k = 2 * Math.cos((2 * Math.PI * f) / fs);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); const s = x[off + i] * w + k * s1 - s2; s2 = s1; s1 = s; }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - k * s1 * s2)) / N;
}
function fingerprint(a, seconds = 8, win = 0.25) {
  const fsr = a.sr / a.dec;
  const N = Math.round(fsr * win);
  const nWin = Math.min(Math.floor(a.pcm.length / N), Math.floor(seconds / win));
  const v = [];
  for (let w = 0; w < nWin; w++) for (const f of FREQS) v.push(Math.log(1e-3 + goertzel(a.pcm, w * N, N, fsr, f)));
  return v;
}
function corr(a, b) {
  const n = Math.min(a.length, b.length);
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return sab / Math.sqrt(saa * sbb + 1e-12);
}
function envelope(a, step = 0.01) {
  const fsr = a.sr / a.dec;
  const N = Math.round(fsr * step);
  const e = [];
  for (let i = 0; i + N <= a.pcm.length; i += N) { let s = 0; for (let k = 0; k < N; k++) s += a.pcm[i + k] * a.pcm[i + k]; e.push(Math.sqrt(s / N) / 32767); }
  return e;
}
function beatPeriod(a) {
  const e = envelope(a);
  const m = e.reduce((x, y) => x + y, 0) / e.length;
  const d = e.map((v) => v - m);
  const den = d.reduce((x, y) => x + y * y, 0) + 1e-12;
  let best = { lag: 0, r: -1 };
  for (let lag = 8; lag <= 150; lag++) {
    let s = 0;
    for (let i = 0; i + lag < d.length; i++) s += d[i] * d[i + lag];
    const r = s / den;
    if (r > best.r) best = { lag, r };
  }
  return { period: best.lag * 0.01, r: best.r };
}
// 音の長さ: 立ち上がりからエンベロープが最大値の 3% を下回り続けるまで
function soundDuration(a) {
  const e = envelope(a, 0.02);
  const mx = Math.max(...e);
  if (mx < 0.002) return 0;
  const thr = mx * 0.03;
  const first = e.findIndex((v) => v > thr);
  let last = first;
  for (let i = first; i < e.length; i++) if (e[i] > thr) last = i;
  return ((last - first + 1) * 0.02);
}

async function audio(env) {
  const out = { bgm: {}, sfx: {} };
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`[${env.effort}] audio.${name} failed: ${e.message.split('\n')[0]}`); env.extra.audioErrors = (env.extra.audioErrors || []).concat(`${name}: ${e.message.split('\n')[0]}`); } };
  const sum = (a) => ({ peak: +a.peak.toFixed(3), rms: +a.rms.toFixed(4), samples: a.n });
  const fps = {};

  await step('main', async () => {
    const p = await env.open('debug=1&seed=1', { init: AUD_INIT, tag: 'audio' });
    const page = p.page;
    await press(page, 'ArrowUp'); // 音のアンロック(ゲームは進まない)
    await sleep(500);
    const st = await snap(page);
    const t = await capture(page, 6500);
    out.bgm.title = { ...sum(t), state: st.state, bgm: st.audio.bgm };
    fps.title = fingerprint(t, 6);
    await press(page, 'Enter');
    await waitState(page, 'stageIntro', 3000);
    const si = await capture(page, 1700);
    out.sfx.start = { ...sum(si), dur: +soundDuration(si).toFixed(2) };
    await waitState(page, 'playing', 4000);
    await dbg(env, page, 'godMode', true);
    await sleep(300);
    const b1 = await capture(page, 8500);
    out.bgm.stage1 = { ...sum(b1) };
    fps.stage1 = fingerprint(b1, 8);
    out.bgm.stage1.beat = beatPeriod(b1);
    // テンポアップ: 残り 25 秒
    await dbg(env, page, 'setTimeLeft', 25);
    await sleep(600);
    const b1low = await capture(page, 8500);
    out.bgm.stage1_low = { ...sum(b1low), beat: beatPeriod(b1low), simToNormal: +corr(fps.stage1, fingerprint(b1low, 8)).toFixed(3) };
    await dbg(env, page, 'setTimeLeft', 120);
    await sleep(500);
    // 爆弾: place と explode(BGM 込みのピーク)
    const bomb = capture(page, 3400);
    await sleep(200);
    await press(page, 'Space');
    const bb = await bomb;
    out.sfx.bomb_with_bgm = { ...sum(bb), bgmPeak: out.bgm.stage1.peak };
    // ステージクリアのジングル(BGM なし)
    await dbg(env, page, 'clearBlocks');
    await dbg(env, page, 'killAllEnemies');
    await sleep(300);
    const nb = await D.neighborOfExit(env, page);
    await dbg(env, page, 'teleport', nb.c, nb.r);
    await sleep(200);
    const ex = (await snap(page)).exit;
    const key = nb.c > ex.col ? 'ArrowLeft' : nb.c < ex.col ? 'ArrowRight' : nb.r > ex.row ? 'ArrowUp' : 'ArrowDown';
    const clearCap = capture(page, 3600);
    await sleep(100);
    await page.keyboard.down(key);
    await waitState(page, 'stageClear', 3000);
    await page.keyboard.up(key);
    const sc = await clearCap;
    out.sfx.stageClear = { ...sum(sc), dur: +soundDuration(sc).toFixed(2) };
    fps.stageClear = fingerprint(sc, 2.5, 0.125);
    await env.done(p);
  });

  for (let n = 2; n <= 5; n++) {
    await step(`stage${n}`, async () => {
      const p = await env.open(`stage=${n}&seed=1&debug=1`, { init: AUD_INIT, tag: `audio s${n}` });
      const page = p.page;
      await press(page, 'Enter');
      await waitState(page, 'playing', 6000);
      await dbg(env, page, 'godMode', true);
      await sleep(300);
      const b = await capture(page, 8500);
      out.bgm[`stage${n}`] = { ...sum(b) };
      fps[`stage${n}`] = fingerprint(b, 8);
      out.bgm[`stage${n}`].beat = beatPeriod(b);
      if (n === 5) {
        // gameClear のジングル(ステージ 5 をクリア)
        await dbg(env, page, 'clearBlocks');
        await dbg(env, page, 'killAllEnemies');
        await sleep(300);
        const nb = await D.neighborOfExit(env, page);
        await dbg(env, page, 'teleport', nb.c, nb.r);
        await sleep(200);
        const ex = (await snap(page)).exit;
        const key = nb.c > ex.col ? 'ArrowLeft' : nb.c < ex.col ? 'ArrowRight' : nb.r > ex.row ? 'ArrowUp' : 'ArrowDown';
        await page.keyboard.down(key);
        await waitState(page, 'stageClear', 3000);
        await page.keyboard.up(key);
        await waitState(page, 'gameClear', 6000);
        const gc = await capture(page, 5200);
        out.sfx.gameClear = { ...sum(gc), dur: +soundDuration(gc).toFixed(2) };
        fps.gameClear = fingerprint(gc, 2.5, 0.125);
      }
      await env.done(p);
    });
  }

  await step('gameover', async () => {
    const p = await env.open('debug=1&seed=1', { init: AUD_INIT, tag: 'audio go' });
    const page = p.page;
    await press(page, 'Enter');
    await waitState(page, 'playing', 6000);
    await dbg(env, page, 'setLives', 1);
    await press(page, 'Space');
    await page.waitForFunction(() => window.__GAME__.snapshot().player.alive === false, null, { timeout: 6000, polling: 16 });
    await sleep(900);
    const cap = await capture(page, 4500);
    out.sfx.gameOver = { ...sum(cap), dur: +soundDuration(cap).toFixed(2) };
    await env.done(p);
  });

  // 曲の類似度(ステージ 1〜5 と title)
  const names = ['title', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5'].filter((k) => fps[k]);
  const sim = {};
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) sim[`${names[i]}~${names[j]}`] = +corr(fps[names[i]], fps[names[j]]).toFixed(2);
  out.similarity = sim;
  const stages = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5'].filter((k) => fps[k]);
  // 0.9 以上で「同じ曲」とみなしてクラスタ数を数える
  const parent = Object.fromEntries(stages.map((s) => [s, s]));
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let i = 0; i < stages.length; i++) for (let j = i + 1; j < stages.length; j++) if (sim[`${stages[i]}~${stages[j]}`] >= 0.9) parent[find(stages[j])] = find(stages[i]);
  out.stageClusters = new Set(stages.map(find)).size;
  if (fps.stageClear && fps.gameClear) out.jingleSimilarity = +corr(fps.stageClear, fps.gameClear).toFixed(2);
  env.extra.audio = out;

  // ---- 判定 ----
  const bgmPeaks = Object.entries(out.bgm).filter(([k]) => !k.endsWith('_low')).map(([k, v]) => [k, v.peak]);
  const silent = Object.entries(out.bgm).filter(([, v]) => !(v.rms > 0.001)).map(([k]) => k);
  const bgmOver = bgmPeaks.filter(([, v]) => v > 0.2 + 0.02).map(([k, v]) => `${k}=${v}`);
  const jingles = ['start', 'stageClear', 'gameOver', 'gameClear'].filter((k) => out.sfx[k]);
  const jSilent = jingles.filter((k) => !(out.sfx[k].rms > 0.001));
  const jOver = jingles.filter((k) => out.sfx[k].peak > 0.35 + 0.02).map((k) => `${k}=${out.sfx[k].peak}`);
  env.rec('AUDIO-level', silent.length === 0 && jSilent.length === 0 && bgmOver.length === 0 && jOver.length === 0, `出力を捕捉して測定(聴取はしていない)。BGM のピーク(仕様 0.2 以下): ${bgmPeaks.map(([k, v]) => `${k}=${v}`).join(' ')}。ジングルのピーク(仕様 0.35 以下)と長さ(目安 start ≤0.4s / stageClear 1.5〜2.5s / gameOver 2〜3s / gameClear 3〜4s): ${jingles.map((k) => `${k}=${out.sfx[k].peak}/${out.sfx[k].dur}s`).join(' ')}。無音の曲=${silent.join(',') || 'なし'}${bgmOver.length ? ' BGM 超過: ' + bgmOver.join(',') : ''}${jOver.length ? ' ジングル超過: ' + jOver.join(',') : ''}。爆弾(BGM 込み)ピーク ${out.sfx.bomb_with_bgm ? out.sfx.bomb_with_bgm.peak : '未取得'}`);
  const low = out.bgm.stage1_low, norm = out.bgm.stage1;
  const tempoRatio = low && norm ? norm.beat.period / low.beat.period : null;
  const tempoUp = low && (tempoRatio >= 1.1 || low.simToNormal < 0.9);
  env.rec('AUDIO-bgm-variety', out.stageClusters >= 3, `ステージ 1〜5 の BGM のスペクトル時系列の相関から、別の曲とみなせる数(相関 0.9 以上を同一とみなす): ${out.stageClusters} 種。相関: ${Object.entries(sim).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  env.rec('AUDIO-tempo', !!tempoUp, `残り 25 秒時と通常時の BGM: 拍の周期 ${norm && norm.beat.period.toFixed(2)}s → ${low && low.beat.period.toFixed(2)}s(比 ${tempoRatio && tempoRatio.toFixed(2)})、スペクトルの相関 ${low && low.simToNormal}。周期比 1.1 以上または相関 0.9 未満ならテンポアップ/別アレンジと判定`);
  env.rec('AUDIO-gameclear-jingle', out.jingleSimilarity !== undefined && out.jingleSimilarity < 0.9, `stageClear と gameClear のジングルの相関 ${out.jingleSimilarity}(0.9 未満なら別の曲と判定)`);
  fs.writeFileSync(path.join(env.shotDir, 'audio-metrics.json'), JSON.stringify(out, null, 1));
}

module.exports = { audio };
