import { writeSheet } from './png.mjs';
import { drawPlayerCar } from '../dist/js/art/cars.js';

const out = process.argv[2] || '/tmp/player.png';
const imgs = [drawPlayerCar({ lean: 0 }), drawPlayerCar({ lean: -1 }), drawPlayerCar({ lean: 1 })];
console.log(writeSheet(out, imgs, { scale: 12, gap: 12, cols: 3 }));
