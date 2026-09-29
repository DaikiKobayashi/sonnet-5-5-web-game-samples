/* node tools/verify-audio.js
 * Renders every sound effect and BGM loop offline (OfflineAudioContext inside headless Chromium) and reports
 * peak level, audible length and whether the mix clips. Optionally writes WAV files: node tools/verify-audio.js <outDir> */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./verify-lib.js');
const { ok, info, open, closePage } = L;

const SFX_LEN = {   // target lengths in seconds from spec 6.3 [min, max]
  start: [0.15, 0.45], place: [0.05, 0.16], explode: [0.35, 0.7], break: [0.08, 0.22], enemyDie: [0.2, 0.4], hit: [0.08, 0.22],
  playerDie: [0.7, 1.05], item: [0.12, 0.3], life: [0.45, 0.75], exitOpen: [0.35, 0.65], stageClear: [1.5, 2.5], gameOver: [2.0, 3.0],
  gameClear: [3.0, 4.0], pause: [0.06, 0.16], warn: [0.03, 0.09]
};

(async () => {
  const outDir = process.argv[2];
  const browser = await L.launch();
  const page = await open(browser, '');
  const res = await page.evaluate(async () => {
    const out = { sfx: {}, bgm: {}, wav: {} };
    async function render(fn, secs) {
      const oc = new OfflineAudioContext(1, Math.ceil(44100 * secs), 44100);
      const g = oc.createGain(); g.connect(oc.destination);
      fn(oc, g);
      const buf = await oc.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0, last = 0, first = -1, sum = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (a > 0.004) { last = i; if (first < 0) first = i; } sum += d[i] * d[i]; }
      return { peak, dur: last / 44100, first: first / 44100, rms: Math.sqrt(sum / d.length), data: Array.from(d.filter((_, i) => i % 1 === 0)).length };
    }
    for (const name of Object.keys(DM.Synth.sfx)) out.sfx[name] = await render((oc, g) => DM.Synth.sfx[name](oc, g, 0.01), 5);
    for (const id of Object.keys(DM.Synth.tracks)) {
      const tr = DM.Synth.tracks[id];
      const secs = tr.steps * tr.stepDur * 2 + 1;
      out.bgm[id] = await render((oc, g) => { for (let s = 0; s < tr.steps * 2; s++) DM.Synth.bgmStep(oc, g, tr, s % tr.steps, 0.05 + s * tr.stepDur, tr.stepDur, false); }, secs);
      out.bgm[id].loop = tr.steps * tr.stepDur;
      out.bgm[id].fastLoop = tr.steps * tr.stepDur * 0.8;
    }
    return out;
  });
  let allSfxOk = true;
  Object.keys(res.sfx).forEach((n) => {
    const r = res.sfx[n], lim = SFX_LEN[n];
    const good = r.peak <= 0.35 && r.peak > 0.05 && (!lim || (r.dur >= lim[0] && r.dur <= lim[1]));
    if (!good) allSfxOk = false;
    info(`sfx ${n.padEnd(11)} peak ${r.peak.toFixed(3)}  length ${r.dur.toFixed(2)} s  (target ${lim ? lim.join('-') : '?'})`);
  });
  ok('audio-sfx', allSfxOk, 'all sound effects: peak <= 0.35 and length within the spec range');
  let allBgmOk = true;
  Object.keys(res.bgm).forEach((id) => {
    const r = res.bgm[id];
    const good = r.peak <= 0.2 && r.loop >= (id === 'title' ? 4 : 8);
    if (!good) allBgmOk = false;
    info(`bgm ${id.padEnd(7)} peak ${r.peak.toFixed(3)}  rms ${r.rms.toFixed(3)}  loop ${r.loop.toFixed(1)} s (fast ${r.fastLoop.toFixed(1)} s)`);
  });
  ok('audio-bgm', allBgmOk, 'BGM peak <= 0.2 and loop length >= 4 s (title) / 8 s (stages)');
  ok('audio-errors', page._errors.length === 0, JSON.stringify(page._errors));
  await closePage(page);
  await browser.close();
  process.exit(L.summary() ? 1 : 0);
})();
