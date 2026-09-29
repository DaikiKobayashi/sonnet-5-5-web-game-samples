// 操舵中・ブレーキ中のプレイヤー車のフレーム(左・右・ブレーキ)をゲーム内で撮る(目視確認用)
import { open, OUT } from './lib.mjs';

const g = await open({ query: 'debug=1&seed=42' });
await g.press('Enter');
await g.waitScene('playing', 6000);
await g.dbg('setTime', 99);
await g.dbg('setSpeedKmh', 120);
await g.down('ArrowLeft');
await g.wait(120);
await g.page.screenshot({ path: OUT + 'c_left.png', clip: { x: 400, y: 460, width: 480, height: 260 } });
await g.up('ArrowLeft');
await g.down('ArrowRight');
await g.wait(120);
await g.page.screenshot({ path: OUT + 'c_right.png', clip: { x: 400, y: 460, width: 480, height: 260 } });
await g.up('ArrowRight');
await g.dbg('setPlayerX', 0);
await g.down('ArrowDown');
await g.wait(120);
await g.page.screenshot({ path: OUT + 'c_brake.png', clip: { x: 400, y: 460, width: 480, height: 260 } });
await g.up('ArrowDown');
await g.close();
