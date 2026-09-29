// Web Audio synthesis: engine, sfx, bgm. Everything is generated.
export const audio = { ctx: null, muted: false, engineHz: 0, hold: false, bgmId: null };
let master, bgmGain, sfxGain, engGain, engOscs = [], engFilter, noiseBuf, cur = null;

const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function initAudio() {
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = audio.ctx = new AC();
    master = ctx.createGain(); master.gain.value = audio.muted ? 0 : 0.5; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.35; bgmGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
    engGain = ctx.createGain(); engGain.gain.value = 0; engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 700;
    const eg2 = ctx.createGain(); eg2.gain.value = 0.4; engGain.connect(engFilter); engFilter.connect(eg2); eg2.connect(master);
    ['sawtooth', 'square'].forEach((t, i) => { const o = ctx.createOscillator(); o.type = t; o.frequency.value = 60; const g = ctx.createGain(); g.gain.value = i ? 0.4 : 0.7; o.connect(g); g.connect(engGain); o.start(); engOscs.push(o); });
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingBgm) { const id = pendingBgm; pendingBgm = null; startBgm(id); }
  } else if (audio.ctx.state === 'suspended' && !audio.hold) audio.ctx.resume();
}
let pendingBgm = null;
export function setMuted(m) { audio.muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function suspend() { audio.hold = true; if (audio.ctx) audio.ctx.suspend(); }
export function resume() { audio.hold = false; if (audio.ctx) audio.ctx.resume(); }
export function ctxState() { return audio.ctx ? audio.ctx.state : 'none'; }

export function setEngine(on, sp) {
  if (!audio.ctx) { audio.engineHz = on ? 60 + 140 * sp : 0; return; }
  const t = audio.ctx.currentTime;
  if (on) {
    const hz = 60 + 140 * sp; audio.engineHz = hz;
    engOscs[0].frequency.setTargetAtTime(hz, t, 0.03); engOscs[1].frequency.setTargetAtTime(hz * 0.5, t, 0.03);
    engFilter.frequency.setTargetAtTime(500 + 900 * sp, t, 0.05);
    engGain.gain.setTargetAtTime(0.05 + 0.07 * sp, t, 0.05);
  } else { audio.engineHz = 0; engGain.gain.setTargetAtTime(0, t, 0.03); }
}

function tone(t, f, dur, type, vol, dest, f2, atk = 0.005) {
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, vol, ftype, ff, dest) {
  const ctx = audio.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = ftype; f.frequency.value = ff;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

export function sfx(id) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime + 0.01;
  switch (id) {
    case 'sfx_beep': tone(t, 440, 0.15, 'square', 0.4); break;
    case 'sfx_go': tone(t, 880, 0.4, 'square', 0.4); break;
    case 'sfx_checkpoint': [660, 880, 1320].forEach((f, i) => tone(t + i * 0.1, f, 0.16, 'square', 0.35)); break;
    case 'sfx_crash': noise(t, 0.4, 0.9, 'lowpass', 1400); tone(t, 140, 0.4, 'sawtooth', 0.6, null, 40); break;
    case 'sfx_goal': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.16, f, i === 6 ? 0.6 : 0.2, 'square', 0.32)); tone(t, 262, 1.4, 'triangle', 0.3); break;
    case 'sfx_timeup': [660, 554, 440, 330, 220].forEach((f, i) => tone(t + i * 0.22, f, 0.3, 'sawtooth', 0.3)); break;
    case 'sfx_menu': tone(t, 1000, 0.06, 'square', 0.3); tone(t + 0.06, 1500, 0.08, 'square', 0.3); break;
    case 'sfx_overtake': tone(t, 900, 0.08, 'square', 0.2, null, 1500); break;
    case 'sfx_timewarn': tone(t, 1300, 0.04, 'square', 0.25); break;
  }
}

// ---- BGM ----
const CH = { maj: [0, 4, 7, 12, 16, 19, 24], min: [0, 3, 7, 12, 15, 19, 24] };
const SONGS = {
  bgm_1: {
    bpm: 128, key: 60, roots: [0, 9, 5, 7, 0, 9, 5, 7], types: ['maj', 'min', 'maj', 'maj', 'maj', 'min', 'maj', 'maj'],
    lead: [[3, -1, 4, -1, 5, 4, 3, -1, 4, -1, 3, 2, 3, -1, -1, -1], [5, -1, 6, 5, 4, -1, 3, -1, 4, 5, 4, 3, 2, -1, 3, -1]],
    leadWave: 'square', arp: false, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  bgm_2: {
    bpm: 138, key: 57, roots: [0, 8, 5, 7, 0, 8, 7, 7], types: ['min', 'maj', 'min', 'maj', 'min', 'maj', 'maj', 'maj'],
    lead: [[3, -1, -1, 4, 5, -1, 4, 3, 2, -1, 3, -1, 0, -1, 2, -1], [5, -1, 4, -1, 3, 4, 5, -1, 6, -1, 5, 4, 3, -1, -1, -1]],
    leadWave: 'sawtooth', arp: false, kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  bgm_3: {
    bpm: 150, key: 52, roots: [0, 8, 3, 10, 0, 8, 3, 10], types: ['min', 'maj', 'maj', 'maj', 'min', 'maj', 'maj', 'maj'],
    lead: [[0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 3, 2, 1, 2, 1], [0, 2, 4, 5, 4, 2, 1, 2, 3, 5, 6, 5, 3, 2, 3, 1]],
    leadWave: 'sawtooth', arp: true, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14, 15],
  },
};
export const BGM_IDS = Object.keys(SONGS);

function playStep(c, step, t) {
  const S = c.song, ctx = audio.ctx, bar = Math.floor(step / 16) % 8, s = step % 16;
  const root = S.key + S.roots[bar], ch = CH[S.types[bar]];
  const bus = c.bus, sd = 60 / S.bpm / 4;
  if (s % 2 === 0) tone(t, MIDI(root - 24 + (s % 4 === 2 && !S.arp ? 7 : 0)), sd * 1.8, 'triangle', 0.7, bus);
  else if (S.arp) tone(t, MIDI(root - 24), sd * 0.8, 'triangle', 0.5, bus);
  const li = S.lead[(bar >> 1) % 2 ? 1 : 0][s];
  if (li >= 0) tone(t, MIDI(root + 12 + ch[li]), sd * (S.arp ? 1.1 : 1.6), S.leadWave, S.arp ? 0.16 : 0.2, bus, null, 0.008);
  if (bar % 2 === 1 && s % 4 === 0) tone(t, MIDI(root + 12 + ch[2]), sd * 3, 'square', 0.06, bus);
  if (S.kick.includes(s)) tone(t, 150, 0.12, 'sine', 1.0, bus, 40);
  if (S.snare.includes(s)) noise(t, 0.12, 0.5, 'highpass', 1500, bus);
  if (S.hat.includes(s)) noise(t, 0.04, 0.22, 'highpass', 7000, bus);
}
export function startBgm(id) {
  stopBgm(); audio.bgmId = id;
  if (!audio.ctx) { pendingBgm = id; return; }
  const bus = audio.ctx.createGain(); bus.connect(bgmGain);
  const c = { song: SONGS[id], bus, step: 0, next: audio.ctx.currentTime + 0.05 };
  c.timer = setInterval(() => {
    while (c.next < audio.ctx.currentTime + 0.15) { playStep(c, c.step, c.next); c.next += 60 / c.song.bpm / 4; c.step++; }
  }, 25);
  cur = c;
}
export function stopBgm() {
  pendingBgm = null; audio.bgmId = null;
  if (cur) { clearInterval(cur.timer); const b = cur.bus; try { b.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02); } catch (e) { } setTimeout(() => { try { b.disconnect(); } catch (e) { } }, 300); cur = null; }
}
