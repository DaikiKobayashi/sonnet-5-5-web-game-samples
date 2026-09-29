// Song data for bgm_1 / bgm_2 / bgm_3. Each song is 16 bars of 16 sixteenth-note steps.
// buildSong() expands the compact definition into per-step event lists that the sequencer plays.

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// "E5:2 G5:2 -:4" -> [{step, midi|null, len}], validated to fill exactly 16 steps
function parseLine(line, where) {
  let step = 0;
  const out = [];
  for (const tok of line.trim().split(/\s+/)) {
    const [n, l] = tok.split(':');
    const len = Number(l);
    if (n !== '-') out.push({ step, midi: midi(n), len });
    step += len;
  }
  if (step !== 16) throw new Error('bar ' + where + ' has ' + step + ' steps: ' + line);
  return out;
}

// bass pattern: [step, semitone offset from root, length]
const BASS = {
  A: [[0, 0, 2], [3, 0, 2], [6, 12, 1], [8, 0, 2], [11, 0, 2], [14, 7, 1]],
  B: [[0, 0, 2], [2, 12, 1], [4, 7, 2], [8, 0, 2], [10, 12, 1], [12, 7, 2], [15, 10, 1]],
  F: [[0, 0, 2], [3, 0, 2], [6, 7, 2], [8, 12, 2], [10, 10, 2], [12, 7, 2], [14, 4, 2]],
  D: [[0, 0, 2], [2, 0, 2], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 12, 2], [14, 7, 2]],
  E: [[0, 0, 2], [2, 0, 2], [4, 0, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 0, 2], [14, 12, 2]],
};

// drum kits: step lists for kick/snare/hat/open hat
const DRUMS = {
  a: { kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ohat: [] },
  b: { kick: [0, 3, 8, 10], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], ohat: [] },
  c: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], ohat: [2, 6, 10, 14] },
  d: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], ohat: [] },
  fill: { kick: [0, 8], snare: [4, 12, 13, 14, 15], hat: [0, 2, 4, 6, 8, 10], ohat: [] },
};

const SONG_DEFS = {
  bgm_1: {
    name: 'SEASIDE',
    bpm: 128,
    // [root, chord tones]
    chords: [
      ['C2', ['E4', 'G4', 'B4', 'D5']], ['A1', ['C4', 'E4', 'G4', 'C5']], ['F2', ['A3', 'C4', 'E4', 'A4']], ['G1', ['B3', 'D4', 'F4', 'G4']],
      ['C2', ['E4', 'G4', 'B4', 'D5']], ['A1', ['C4', 'E4', 'G4', 'C5']], ['D2', ['F4', 'A4', 'C5', 'E5']], ['G1', ['B3', 'D4', 'F4', 'G4']],
      ['F2', ['A3', 'C4', 'E4', 'A4']], ['E2', ['G3', 'B3', 'D4', 'G4']], ['D2', ['F4', 'A4', 'C5', 'E5']], ['G1', ['B3', 'D4', 'F4', 'G4']],
      ['F2', ['A3', 'C4', 'E4', 'A4']], ['E2', ['G3', 'B3', 'D4', 'G4']], ['A1', ['C4', 'E4', 'G4', 'C5']], ['G1', ['B3', 'D4', 'F4', 'G4']],
    ],
    lead: [
      'E5:2 G5:2 B5:4 A5:2 G5:2 E5:4', 'C6:2 A5:2 E5:4 -:2 G5:2 A5:4', 'A5:2 C6:2 E6:4 D6:2 C6:2 A5:4', 'B5:2 D6:2 G5:4 -:4 D6:2 B5:2',
      'E6:4 D6:2 C6:2 B5:4 G5:4', 'A5:4 C6:2 E6:2 D6:4 C6:4', 'D6:2 F6:2 A6:4 G6:2 F6:2 D6:4', 'G6:4 F6:2 D6:2 B5:4 G5:4',
      'C6:6 A5:2 C6:4 E6:4', 'D6:6 B5:2 D6:4 G6:4', 'F6:6 D6:2 F6:4 A6:4', 'G6:4 -:2 F6:2 D6:4 B5:4',
      'A5:2 C6:2 F6:4 E6:2 C6:2 A5:4', 'G5:2 B5:2 E6:4 D6:2 B5:2 G5:4', 'E6:2 D6:2 C6:4 A5:4 -:2 C6:2', 'D6:2 B5:2 G5:4 A5:2 B5:2 D6:4',
    ],
    bass: ['A', 'B', 'A', 'F', 'A', 'B', 'A', 'F', 'A', 'B', 'A', 'F', 'A', 'B', 'A', 'F'],
    drums: ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'fill', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'fill'],
    stab: [2, 6, 10, 14],
    stabBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    arp: null,
    leadWave: 'square',
    echo: 0,
  },
  bgm_2: {
    name: 'PINE RIDGE',
    bpm: 138,
    chords: [
      ['A1', ['A3', 'C4', 'E4', 'A4']], ['F1', ['A3', 'C4', 'F4', 'A4']], ['C2', ['G3', 'C4', 'E4', 'G4']], ['G1', ['G3', 'B3', 'D4', 'G4']],
      ['A1', ['A3', 'C4', 'E4', 'A4']], ['F1', ['A3', 'C4', 'F4', 'A4']], ['D2', ['A3', 'D4', 'F4', 'A4']], ['E2', ['G#3', 'B3', 'D4', 'E4']],
      ['F1', ['A3', 'C4', 'F4', 'A4']], ['G1', ['G3', 'B3', 'D4', 'G4']], ['A1', ['A3', 'C4', 'E4', 'A4']], ['C2', ['G3', 'C4', 'E4', 'G4']],
      ['F1', ['A3', 'C4', 'F4', 'A4']], ['G1', ['G3', 'B3', 'D4', 'G4']], ['E2', ['G#3', 'B3', 'D4', 'E4']], ['E2', ['G#3', 'B3', 'D4', 'E4']],
    ],
    lead: [
      'E5:4 A5:2 C6:2 B5:4 A5:4', 'A5:4 C6:2 F6:2 E6:4 C6:4', 'G5:2 C6:2 E6:4 D6:2 C6:2 G5:4', 'B5:4 D6:2 G6:2 F6:2 D6:2 B5:4',
      'A5:2 -:2 C6:2 E6:2 A6:4 G6:2 E6:2', 'F6:4 E6:2 C6:2 A5:4 C6:4', 'D6:2 F6:2 A6:4 G6:2 F6:2 D6:4', 'E6:4 G#6:2 B6:2 A6:2 G#6:2 E6:4',
      'C6:6 A5:2 C6:4 F6:4', 'D6:6 B5:2 D6:4 G6:4', 'E6:6 C6:2 E6:4 A6:4', 'G6:4 E6:2 D6:2 C6:8',
      'A5:2 C6:2 F6:4 A6:4 G6:2 F6:2', 'B5:2 D6:2 G6:4 B6:4 A6:2 G6:2', 'G#5:2 B5:2 E6:4 D6:2 B5:2 G#5:4', 'E6:8 -:2 E6:2 D6:2 B5:2',
    ],
    bass: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'F', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'F'],
    drums: ['c', 'c', 'c', 'c', 'c', 'c', 'c', 'fill', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'fill'],
    stab: [],
    stabBars: [],
    arp: { pattern: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 2, 1], fromBar: 8, wave: 'triangle' },
    leadWave: 'sawtooth',
    echo: 0.22,
  },
  bgm_3: {
    name: 'NEON CITY',
    bpm: 152,
    chords: [
      ['E2', ['E4', 'G4', 'B4', 'E5']], ['C2', ['E4', 'G4', 'C5', 'E5']], ['G1', ['D4', 'G4', 'B4', 'D5']], ['D2', ['D4', 'F#4', 'A4', 'D5']],
      ['E2', ['E4', 'G4', 'B4', 'E5']], ['C2', ['E4', 'G4', 'C5', 'E5']], ['G1', ['D4', 'G4', 'B4', 'D5']], ['D2', ['D4', 'F#4', 'A4', 'D5']],
      ['A1', ['E4', 'A4', 'C5', 'E5']], ['E2', ['E4', 'G4', 'B4', 'E5']], ['C2', ['E4', 'G4', 'C5', 'E5']], ['D2', ['D4', 'F#4', 'A4', 'D5']],
      ['A1', ['E4', 'A4', 'C5', 'E5']], ['E2', ['E4', 'G4', 'B4', 'E5']], ['C2', ['E4', 'G4', 'C5', 'E5']], ['B1', ['D#4', 'F#4', 'A4', 'B4']],
    ],
    lead: [
      'B5:6 A5:2 G5:4 E5:4', 'E5:6 G5:2 C6:4 B5:4', 'D6:6 B5:2 G5:4 B5:4', 'A5:6 F#5:2 A5:4 D6:4',
      'B5:6 A5:2 G5:4 E5:4', 'E5:6 G5:2 C6:4 E6:4', 'D6:4 B5:4 G5:4 D5:4', 'F#5:4 A5:4 D6:4 C#6:4',
      'E6:2 C6:2 A5:4 C6:2 E6:2 A6:4', 'G6:4 E6:4 B5:4 E6:4', 'E6:2 G6:2 B6:4 A6:2 G6:2 E6:4', 'F#6:4 A6:4 D6:4 F#6:4',
      'A5:2 C6:2 E6:4 A6:4 G6:2 E6:2', 'G6:2 B6:2 E6:4 D6:4 B5:4', 'C6:4 E6:4 G6:4 E6:4', 'D#6:4 F#6:4 B6:4 A6:2 F#6:2',
    ],
    bass: ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'F', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'F'],
    drums: ['c', 'c', 'c', 'c', 'c', 'c', 'c', 'fill', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'fill'],
    stab: [],
    stabBars: [],
    arp: { pattern: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3], fromBar: 0, wave: 'sawtooth', loud: true },
    leadWave: 'square',
    echo: 0.34,
  },
};

export const SONGS = {};

function buildSong(id, def) {
  const stepDur = 60 / def.bpm / 4;
  const totalSteps = 16 * def.chords.length;
  const steps = Array.from({ length: totalSteps }, () => []);
  const push = (bar, step, ev) => steps[bar * 16 + step].push(ev);

  def.chords.forEach(([root, chord], bar) => {
    const rm = midi(root);
    const cm = chord.map(midi);
    // pad: whole bar
    push(bar, 0, { p: 'pad', m: cm, len: 16, v: 1 });
    // bass
    for (const [st, off, len] of BASS[def.bass[bar]]) push(bar, st, { p: 'bass', m: rm + off, len, v: 1 });
    // stabs (chord tones 1 & 3, short)
    if (def.stabBars.includes(bar)) for (const st of def.stab) push(bar, st, { p: 'stab', m: [cm[1], cm[3]], len: 1, v: 1 });
    // arpeggio
    if (def.arp && bar >= def.arp.fromBar) {
      def.arp.pattern.forEach((idx, st) => push(bar, st, { p: 'arp', m: cm[idx % cm.length] + (idx > 3 ? 12 : 0), len: 1, v: st % 4 === 0 ? 1 : 0.7, wave: def.arp.wave, loud: !!def.arp.loud }));
    }
    // lead
    for (const n of parseLine(def.lead[bar], id + ':' + bar)) push(bar, n.step, { p: 'lead', m: n.midi, len: n.len, v: 1 });
    // drums
    const k = DRUMS[def.drums[bar]];
    k.kick.forEach((s) => push(bar, s, { p: 'kick', v: 1 }));
    k.snare.forEach((s) => push(bar, s, { p: 'snare', v: s >= 13 ? 0.6 + (s - 13) * 0.12 : 1 }));
    k.hat.forEach((s) => { if (!k.ohat.includes(s)) push(bar, s, { p: 'hat', v: s % 4 === 0 ? 1 : s % 2 === 0 ? 0.7 : 0.45 }); });
    k.ohat.forEach((s) => push(bar, s, { p: 'ohat', v: 1 }));
  });
  return { id, name: def.name, bpm: def.bpm, stepDur, totalSteps, steps, leadWave: def.leadWave, echo: def.echo };
}

for (const [id, def] of Object.entries(SONG_DEFS)) SONGS[id] = buildSong(id, def);

export const JINGLES = {
  // [midi, start (s), duration (s)]
  title: [['C5', 0, 0.12], ['G5', 0.11, 0.12], ['C6', 0.22, 0.12], ['E6', 0.33, 0.12], ['G6', 0.44, 0.5]],
  goal: [
    ['C5', 0, 0.14], ['E5', 0.14, 0.14], ['G5', 0.28, 0.14], ['C6', 0.42, 0.34],
    ['G5', 0.82, 0.14], ['C6', 0.96, 0.14], ['E6', 1.1, 0.5],
  ],
  timeup: [['E5', 0, 0.26], ['C5', 0.28, 0.26], ['A4', 0.56, 0.26], ['F4', 0.84, 0.7]],
  checkpoint: [['C6', 0, 0.09], ['E6', 0.09, 0.09], ['G6', 0.18, 0.32]],
};
