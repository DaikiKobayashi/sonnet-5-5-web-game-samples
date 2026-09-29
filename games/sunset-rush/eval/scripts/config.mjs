// effort とポートの対応、実装ごとの差(タッチボタンのセレクタのみ)
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const PORTS = { low: 5101, medium: 5102, high: 5103, xhigh: 5104, max: 5105 };
export const ROOT_PORTS = { low: 5201, medium: 5202, high: 5203, xhigh: 5204, max: 5205 };
// S-09 のアクセルボタン。DOM ボタンがない実装は null(その場合 S-09 は不合格扱い、画面の撮影のみ)
export const TOUCH_GAS = {
  low: null,
  medium: '#tg',
  high: '#tg',
  xhigh: '#tc-gas',
  max: '[data-btn="gas"]',
};
export const GAME_ROOT = new URL('../../', import.meta.url).pathname; // games/sunset-rush/
export const EVAL_DIR = new URL('../', import.meta.url).pathname; // games/sunset-rush/eval/
