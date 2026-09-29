// Dev tool: renders every sound effect and BGM track through an OfflineAudioContext and reports
// duration / peak / RMS, to check the SPEC 6.3 loudness limits (sfx peak <= 0.35, bgm <= 0.2, no clipping).
// usage (static server on :5104 serving impl/xhigh): NODE_PATH=$(npm root -g) node tools/audio-check.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5104/dist/index.html');
  await p.waitForTimeout(300);
  const res = await p.evaluate(async () => {
    const A = DM.audio;
    const SR = 44100;
    function fresh(seconds) {
      const ctx = new OfflineAudioContext(2, SR * seconds, SR);
      let fake = 0;
      Object.defineProperty(ctx, 'state', { get: () => 'running' });
      Object.defineProperty(ctx, 'currentTime', { get: () => fake });
      ctx.__set = (v) => { fake = v; };
      ctx.resume = () => Promise.resolve();
      return ctx;
    }
    function analyse(buf) {
      let peak = 0, sum = 0, n = 0, last = 0;
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]);
        if (v > peak) peak = v;
        if (v > 0.002) last = i;
        sum += d[i] * d[i];
        n++;
      }
      return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(3), lengthSec: +(last / SR).toFixed(2) };
    }
    async function install(seconds) {
      const ctx = fresh(seconds);
      A.ctx = null;
      window.AudioContext = function () { return ctx; };
      A.setMuted(false);
      A.unlock();
      return ctx;
    }
    const out = { sfx: {}, bgm: {} };
    const names = ['start', 'place', 'explode', 'break', 'enemyDie', 'hit', 'playerDie', 'item', 'life', 'exitOpen', 'stageClear', 'gameOver', 'gameClear', 'pause', 'warn'];
    for (const n of names) {
      const ctx = await install(6);
      A.sfx(n);
      out.sfx[n] = analyse(await ctx.startRendering());
    }
    for (const id of A.trackList) {
      const ctx = await install(40);
      A.setBgm(id);
      for (let t = 0; t < 36; t += 0.03) {
        ctx.__set(t);
        A._tick();
      }
      const r = analyse(await ctx.startRendering());
      r.loopSec = +A._trackSeconds(id).toFixed(1);
      out.bgm[id] = r;
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
