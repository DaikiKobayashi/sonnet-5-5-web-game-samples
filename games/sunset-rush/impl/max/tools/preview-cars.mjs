import { writeSheet } from './png.mjs';
import { drawPlayerCar, trafficCar } from '../dist/js/art/cars.js';

const out = process.argv[2] || '/tmp/cars.png';
const imgs = [
  drawPlayerCar({ lean: 0 }), drawPlayerCar({ lean: -1 }), drawPlayerCar({ lean: 1 }),
  drawPlayerCar({ lean: 0, brake: true }), drawPlayerCar({ lean: 0, anim: 0 }), drawPlayerCar({ lean: 0, anim: 1 }),
];
for (const t of ['sedan', 'truck', 'sports']) for (let v = 0; v < 3; v++) imgs.push(trafficCar(t, v));
console.log(writeSheet(out, imgs, { scale: 6, gap: 10, cols: 6 }));
