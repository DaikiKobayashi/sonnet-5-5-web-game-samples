import { writeSheet } from './png.mjs';
import { drawGateCheckpoint, drawGateGoal, drawGateStart, drawSmokeFrames, drawDustFrames, drawSparkFrames, drawLogo } from '../dist/js/art/ui.js';
import { Px } from '../dist/js/pixel.js';
import { glyphSheetPx } from '../dist/js/font.js';

const out = process.argv[2] || '/tmp/ui.png';
const imgs = [drawLogo(), drawGateCheckpoint(), drawGateGoal(), drawGateStart(), ...drawSmokeFrames(), ...drawDustFrames(), ...drawSparkFrames(), glyphSheetPx(Px)];
console.log(writeSheet(out, imgs, { scale: 3, gap: 10, cols: 5 }));
