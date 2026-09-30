// effort とポートの対応、実装ごとの差(タッチボタンのセレクタのみ)
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
// 参考実装(別モデル・デフォルト effort)。既存 5 実装の一括処理(EFFORTS)には含めず、スクリプトの引数で明示して流す
export const REFS = ['opus-medium', 'fable-high'];
export const PORTS = { low: 5101, medium: 5102, high: 5103, xhigh: 5104, max: 5105, 'opus-medium': 5106, 'fable-high': 5107 };
export const ROOT_PORTS = { low: 5201, medium: 5202, high: 5203, xhigh: 5204, max: 5205, 'opus-medium': 5206, 'fable-high': 5207 };
// S-09 のアクセルボタン。DOM ボタンがない実装は null(その場合 S-09 は不合格扱い、画面の撮影のみ)
export const TOUCH_GAS = {
  low: null,
  medium: '#tg',
  high: '#tg',
  xhigh: '#tc-gas',
  max: '[data-btn="gas"]',
  'opus-medium': '.tb-gas',
  'fable-high': '#touch .gas',
};
export const GAME_ROOT = new URL('../../', import.meta.url).pathname; // games/sunset-rush/
export const EVAL_DIR = new URL('../', import.meta.url).pathname; // games/sunset-rush/eval/
