// 音の自己チェック: OfflineAudioContext でレンダリングして、無音・音割れ(ピーク > 1)・NaN がないか確認する。
import { open } from './lib.mjs';

const g = await open({ query: 'debug=1&seed=42' });
const result = await g.page.evaluate(async () => {
  const { AudioSys, SOUND_IDS } = await import('./js/audio.js');
  const { Sequencer, SONGS } = await import('./js/music.js');
  const SR = 44100;
  const out = {};

  const analyze = (buf) => {
    let peak = 0; let sum = 0; let nan = 0; let n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        const v = d[i];
        if (Number.isNaN(v)) nan++;
        const a = Math.abs(v);
        if (a > peak) peak = a;
        sum += v * v; n++;
      }
    }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), nan };
  };

  // 効果音・ジングル: AudioContext を OfflineAudioContext に差し替えて AudioSys をそのまま使う
  for (const id of ['sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_timewarn', 'jingle_title', 'jingle_clear']) {
    const Orig = window.AudioContext;
    class Off extends OfflineAudioContext { constructor() { super(2, SR * 3, SR); } }
    window.AudioContext = Off;
    const a = new AudioSys(false);
    a.ensure();
    window.AudioContext = Orig;
    a.play(id);
    const buf = await a.ctx.startRendering();
    out[id] = analyze(buf);
  }

  // エンジン(速度 0 / 中 / 最大)
  for (const sp of [0, 0.5, 1]) {
    const Orig = window.AudioContext;
    class Off extends OfflineAudioContext { constructor() { super(2, SR * 1, SR); } }
    window.AudioContext = Off;
    const a = new AudioSys(false);
    a.ensure();
    window.AudioContext = Orig;
    a.startEngine();
    a.setEngine(sp);
    const buf = await a.ctx.startRendering();
    out['engine_' + sp] = analyze(buf);
  }

  // BGM(16 小節ぶんをレンダリング)
  for (const id of Object.keys(SONGS)) {
    const song = SONGS[id];
    const stepDur = 60 / song.bpm / 4;
    const bars = 16;
    const dur = stepDur * 16 * bars + 1;
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
    const noise = ctx.createBuffer(1, SR, SR);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    const master = ctx.createGain(); master.gain.value = 0.5; master.connect(comp); comp.connect(ctx.destination);
    const bgm = ctx.createGain(); bgm.gain.value = 0.35; bgm.connect(master);
    const seq = new Sequencer(ctx, bgm, noise, id);
    for (let s = 0; s < bars * 16; s++) seq.schedule(0.05 + s * stepDur, s);
    const buf = await ctx.startRendering();
    out[id] = { ...analyze(buf), seconds: +dur.toFixed(1), bpm: song.bpm, bars };
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('errors', JSON.stringify(g.log.errors));
await g.close();
