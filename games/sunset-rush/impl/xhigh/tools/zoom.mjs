// 継ぎ目(1px の隙間・ちらつき)の目視確認用: 4 倍拡大でスクリーンショットを撮る
import { open, OUT } from './lib.mjs';

const g = await open({ query: 'debug=1&seed=42', viewport: { width: 640, height: 360 }, dpr: 4 });
await g.press('Enter');
await g.waitScene('playing', 6000);
await g.dbg('setTime', 99);
await g.dbg('warp', 600);
await g.dbg('setSpeedKmh', 0);
await g.wait(300);
await g.page.screenshot({ path: OUT + 'z_road.png', clip: { x: 160, y: 176, width: 320, height: 120 } });
await g.dbg('warp', 330);
await g.wait(300);
await g.page.screenshot({ path: OUT + 'z_hill.png', clip: { x: 160, y: 176, width: 320, height: 120 } });
await g.close();
