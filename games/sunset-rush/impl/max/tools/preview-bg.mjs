import { Px } from '../dist/js/pixel.js';
import { writePx } from './png.mjs';
import { drawSky, drawFar, drawNear } from '../dist/js/art/backgrounds.js';

const out = process.argv[2] || '/tmp/bg.png';
const stage = Number(process.argv[3] || 1);
const offs = [0, 0, 0];
const scr = new Px(640, 360);
scr.rect(0, 0, 640, 360, 0x000000);
const sky = drawSky(stage), far = drawFar(stage), near = drawNear(stage);
scr.blit(sky, 0, 0);
scr.blit(far, 0, 180 - 96);
scr.blit(near, 0, 180 - 56);
// crude ground
const ground = [0xf2b878, 0x34754a, 0x1c2c50][stage - 1];
scr.rect(0, 180, 640, 180, ground);
writePx(out, scr, 2);
console.log('ok', out);
