# 目視判定の記録(visual.json を生成)。判定に使った画像名を note に残す
import json
E=['low','medium','high','xhigh','max']
common = {
 'M04': (True, 'raw-m04-title-0.5s.png, compare/cmp-m04-press-enter-crop.png: ロゴ画像・PRESS ENTER の点滅・BEST・操作説明あり'),
 'M05': (True, 'review-a-countdown.png(raw-m05-countdown-500/1500/2500): 3・2・1 と STAGE 1 / SEASIDE'),
 'M06': (True, 'raw-m06-go-300.png に GO!、raw-m06-go-1200.png に GO! なし'),
 'M12': (True, 'raw-m12-offroad-1500.png: 自車が道路外(草/砂の面)'),
 'M13': (True, 'm13-s1-sheet.png, compare/cmp-m13-hills-horizon.png: 右/左カーブ、頂上手前で奥が隠れる、消失位置が地点ごとに変化'),
 'M15': (True, 'compare/cmp-m15-zoom.png: 路肩 2 色交互・路面/草の明暗、隙間や別色の横線なし'),
 'M16': (True, 'm16-b-s1-30s-sheet.png: sedan/truck/sports が車線上に出現、遠いほど小さい'),
 'M18': (True, 'm18-crash-sheet.png: 自車の点滅と煙'),
 'M19': (True, 'm19-crash-sheet.png: 自車の点滅と煙'),
 'M20': (True, 'review-c-roadside.png(raw-m20-s*-*.png): 各ステージの solid 2 種と decor が両側に'),
 'M22': (True, 'review-e-cp.png: ゲートが道路をまたぐ、0.3/1.9 秒に CHECKPOINT! と +18 SEC、2.4 秒になし'),
 'M23': (True, 'raw-m23-timeup-500.png / raw-m23-gameover-500.png: TIME UP、GAME OVER / REACHED STAGE 1 / SCORE / BEST / ENTER: RETRY   ESC: TITLE'),
 'M24': (True, 'raw-m24-clear-1200.png に GOAL!(パネルなし)、raw-m24-clear-1800.png と raw-w-s1-clear-1600.png にパネル 5 行、raw-m24-gate.png にゴールゲート'),
 'M26': (True, 'raw-m26-s1/2/3-run2s.png: S1 橙〜桃、S2 紫〜藍、S3 黒〜濃紺+ネオン'),
 'M27': (True, 'raw-w-ending.png, compare/cmp-m27x-ending.png: ALL CLEAR!、スコア、ランク、BEST、PRESS ENTER'),
 'M28': (True, 'raw-m28-paused-hud.png の SCORE 000570 = getState().score 570'),
 'M29': (True, 'raw-m29-paused-KeyP.png / -Escape.png: PAUSED オーバーレイ'),
 'M31': (True, 'raw-m31-sound-on.png / raw-m31-sound-off.png: [M] SOUND ON → OFF'),
 'M32': (True, 'raw-m32-gameover-newbest.png(high は m32x-gameover-sheet.png。点滅のため): NEW BEST!、raw-m32-title-best.png の BEST'),
 'M33': (True, 'raw-m33-hud.png: 全 HUD 要素あり。m33-timewarn-sheet.png: 残り 10 秒以下で赤く明滅'),
 'M38': (True, 'compare/cmp-m38-font.png: A〜Z・0〜9 判読可'),
 'M39': (True, 'compare/cmp-m39-player-frames.png(左/直進/右)、m16 シート(3 車種)、review-c(空・遠景・路側物)、review-e(ゲート)、m18 シート(煙)、タイトル(ロゴ)、全画面(文字)'),
 'M42': (True, 'm42-b-s1-60s-sheet.png, m42-b-s3-60s-sheet.png: 同一レーンの重なりなし'),
 'S-01': (True, 'raw-m13-s1-flat.png ほか: 遠くの道路・スプライトが地平線色に溶ける'),
 'S-03': (True, 's03-brake-compare.png: ブレーキ中だけランプ点灯'),
 'S-06': (True, 'compare/cmp-s06-280kmh-zoom.png / raw-s06-280kmh.png: 250 km/h 以上で速度線'),
 'S-11': (True, 'sfx_timewarn ボタンあり。残り 10 秒以下で整数秒が変わるたびに sfx_timewarn を鳴らすコードを確認。出力タップの RMS は BGM に埋もれて 1 秒周期を分離できず'),
 'S-12': (True, 'review-c-roadside.png の S3: ヘッドライトの照射 / 街灯・ネオンの発光'),
 'S-13': (True, 'raw-s13-overtake-100.png: 自車付近に +50'),
 'S-14': (True, 'o7-gallery-cars.png に各車種 3 色、m16 シートで混在'),
 'S-16': (True, 'F で document.fullscreenElement が非 null、右下に FPS 表示'),
 'S-18': (True, 'S18X: タイトルロゴが縦に 3〜5 px 動く(浮遊)'),
}
V={e:{} for e in E}
for e in E:
  for k,(p,n) in common.items(): V[e][k]={'pass':p,'note':n}
# 実装ごとの差分
V['low']['M26']['note'] += '(数値条件も 3 つとも満たす)'
for e in ['medium','xhigh','max']:
  V[e]['M26']['note'] += '。数値条件は S1 の空の色相が 302〜308°(紫寄り)で 320〜360°/0〜50° を外れたが、上空の紫帯の影響で、目視では夕焼けの橙〜桃が支配的なため目視を優先(EVAL §2 M26)'
V['low']['S-06']['note'] += '(low は 1px の短い線 12 本のみで弱い)'
V['low']['S-04']={'pass':False,'note':'car_player_wheel なし(ギャラリーにも画面にもタイヤ/排気のアニメなし。s04-wheel-sheet.png)'}
V['medium']['S-04']={'pass':False,'note':'car_player_wheel なし(README でも未実装と記載。s04-wheel-sheet.png)'}
for e in ['high','xhigh','max']:
  V[e]['S-04']={'pass':True,'note':'s04z-tire-zoom-sheet.png: タイヤのトレッド模様が約 0.1 秒周期で 2 フレーム切り替わる'}
V['low']['S-05']={'pass':False,'note':'m18-crash-sheet.png に火花・スピン/傾きなし。コードに 0.3 秒のシェイク処理はあるが、S05X の空の帯の横ずれ推定では衝突後 0.3 秒のずれが 0 フレーム(シェイクを検出できず)'}
V['medium']['S-05']={'pass':True,'note':'m18-crash-sheet.png に火花。S05X で衝突後 0.3 秒に 8 フレームの横ずれ(シェイク)'}
V['high']['S-05']={'pass':True,'note':'m18-crash-sheet.png に火花と自車の傾き。S05X で 4 フレームの横ずれ'}
V['xhigh']['S-05']={'pass':True,'note':'m18-crash-sheet.png に火花。S05X で 10 フレームの横ずれ'}
V['max']['S-05']={'pass':True,'note':'m18-crash-sheet.png に火花と白フラッシュ。S05X で 13 フレームの横ずれ'}
V['low']['S-17']={'pass':False,'note':'gate_start はあるが、カウントダウンの信号ライト表示がない(review-a-countdown.png)'}
for e in ['medium','high','xhigh','max']:
  V[e]['S-17']={'pass':True,'note':'review-a-countdown.png: スタートゲート、信号ライト(3 灯が順に点灯)、GO!'}
V['medium']['M33']['note'] += '(medium は赤と白の交互で明滅)'
V['max']['M04']['note'] += '(max の PRESS ENTER は完全に消えず alpha 0.22 に減光する明滅)'
V['xhigh']['M22']['note'] += '(1.9 秒はフェードアウト中で薄いが判読可)'
V['max']['M22']['note'] += '(1.9 秒はフェードアウト中で薄いが判読可)'
# 主観評価
S={
 'low':{'画づくり':[3,'全アセット判別でき S1/S2/S3 の色調ははっきり違う(review-c-roadside.png)。ただし自車・交通車が矩形主体で陰影が平板、S1 のヤシが十字形のシルエットで粗い(m13-s1-sheet.png)'],
        'アニメ・演出':[4,'Must の演出は揃い、フォグ・近景・ブレーキランプ・速度線(弱い)・ロゴの浮遊あり。タイヤアニメ・火花なし、シェイクは検出できず(S05X)、フェード・カウントアップなし'],
        '手触り':[4,'M07〜M12 の実測値はすべて仕様どおり、FPS 平均 59.95 / 最小 59。ボットで全ステージクリア(S1 残り 26.6 秒と余裕が大きい)。スレスレ得点あり、シェイクは検出できず'],
        '音':[4,'Must 9 音+bgm_2/3・overtake・timewarn(ギャラリーで全ボタン発音・エラー 0)。engineHz は仕様どおり、エンジンはのこぎり波+矩形波+LPF(速度で開く)。BGM は 128/138/150 BPM、8 小節、ベース+リード+ドラム。sfx_offroad と jingle_title なし。ピーク最大 0.25(音割れなし)'],
        'UI':[3,'HUD と各画面の文言は揃い読める(review-f-hud.png)。KM/H とタイトルの操作説明が拡大 1 で小さい。タッチ UI なし']},
 'medium':{'画づくり':[4,'太陽のハロー・海・島の遠景、S2 の月と松林、S3 のネオン・月(review-c-roadside.png)。輪郭と陰影が揃い統一感がある。自車の後ろ姿はやや単純'],
        'アニメ・演出':[4,'フォグ・近景・ブレーキランプ・火花・シェイク・速度線・遷移の暗転フェード・ロゴの浮遊。タイヤアニメとカウントアップなし'],
        '手触り':[4,'M07〜M12 は仕様どおり、FPS 平均 60.05 / 最小 60。ボットで全クリア(S1 残り 26.6 秒)。スレスレ得点・シェイクあり'],
        '音':[5,'Must+Should の音がすべてボタンで発音(エラー 0)。エンジンは 3 発振器(saw/square/tri)+LPF を速度で開く。BGM は 128/138/150 BPM でリード波形も曲ごとに変更(8 小節)。スペクトログラム(compare/cmp-s08-spectrograms.png)で曲ごとの違いが見える。ピーク最大 0.20'],
        'UI':[4,'HUD・パネル・ゲームオーバーの文言が揃い色分けされている。タッチボタンあり(s09-touch-play.png)。debug=1 では FPS 表示が KM/H に重なる(EVAL §6-10 により減点しない)']},
 'high':{'画づくり':[4,'海のきらめき・山並み・S3 の街灯のグロー(review-c-roadside.png)。統一感は高い。S1 の草が緑で、仕様の配色(橙・桃・青緑)とはややずれる'],
        'アニメ・演出':[4,'フォグ・近景・ブレーキランプ・タイヤアニメ・火花と傾き・速度線・夜のグロー・ロゴの浮遊。遷移フェードとカウントアップなし(README も同様)'],
        '手触り':[4,'M07〜M12 は仕様どおり、P1 の FPS 平均 60.05 / 最小 60(タイトル P2 は最小 37 の落ち込みが 1 回)。ボットで全クリア。スレスレ・シェイクあり'],
        '音':[5,'Must+Should の音すべて(エラー 0)。エンジンは 2 発振器+LPF を速度で開く。BGM 128/138/152 BPM、16 小節、S3 はアルペジオ主体(コード)。ピーク最大 0.12'],
        'UI':[4,'HUD の要素・色分けが整い、NEW BEST は点滅。タイトルは操作説明の帯つき。タッチボタン(一時停止ボタン含む)あり']},
 'xhigh':{'画づくり':[5,'ディザの空と太陽、水平線のきらめき、BEACH 看板、S3 の窓明かり・HOTEL/NEON の発光・月(review-c-roadside.png)。自車のテールランプや車体の陰影まで作り込み、どの画面も完成品の見栄え'],
        'アニメ・演出':[5,'フォグ・近景・ブレーキ・タイヤ・火花・シェイク・速度線・シーン切替のフェード・ステージ名やバナーのフェードアウト・エンディングの粒子・夜のグロー。カウントアップはなし'],
        '手触り':[4,'M07〜M12 は仕様どおり。P1 の FPS 平均 59.5 / 最小 53、最長フレーム間隔 133 ms が 1 回。ボットで全クリア。スレスレ・シェイクあり'],
        '音':[5,'Must+Should の音すべて(エラー 0)。エンジンは 3 発振器+LPF(Q 2.2)を速度で開く。BGM は 126/138/152 BPM、16 小節のコード進行つき。ピーク最大 0.31'],
        'UI':[5,'HUD・パネル・エンディング(TOTAL SCORE 表記)まで整い、タイトルは帯で可読性を確保。タッチボタンあり、390 幅でも崩れなし']},
 'max':{'画づくり':[5,'砂浜と SURF 看板、細かいヤシ、ディザの空と太陽、S2 の山並みと松林、S3 の月と HOTEL/NEON(review-c-roadside.png)。自車はナンバープレートまで描き込み、全画面が完成品の見栄え'],
        'アニメ・演出':[5,'フォグ・近景・ブレーキ・タイヤ・火花・白フラッシュ・シェイク・速度線・リザルトのカウントアップ(review-d-clear.png)・フェード・ロゴの輝き・夜のグロー'],
        '手触り':[4,'M07〜M12 は仕様どおり、FPS 平均 60 / 最小 59。ボットで全クリア。スレスレ・シェイクあり'],
        '音':[5,'Must+Should の音すべて(エラー 0)。BGM 128/138/152 BPM、16 小節、ディレイ(付点 8 分)つき。エンジンは複数発振器+フィルタ。ピーク最大 0.41'],
        'UI':[5,'HUD・パネル(カウントアップ)・ゲームオーバーの配色が整い読みやすい。タッチボタンはアクセル緑・ブレーキ赤で区別。390 幅でも崩れなし']},
}
for e in E: V[e]['subjective']={k:{'score':v[0],'basis':v[1]} for k,v in S[e].items()}

# ---- 参考実装(opus-medium / fable-high)の目視判定。既存 5 実装と同じ項目・同じ条件で、各実装の画像を見て個別に記録する(common の文面は流用しない)
R = {
 'opus-medium': {
  'M04': (True, 'm04-title-blink-sheet.png, raw-m04-title-0.5s.png: ドット絵ロゴ(斜体・グラデーション)、PRESS ENTER が表示/非表示を繰り返す、BEST 000000、操作説明の帯'),
  'M05': (True, 'review-a-countdown.png(raw-m05-countdown-500/1500/2500): 3・2・1 と STAGE 1 / SEASIDE、信号ランプ'),
  'M06': (True, 'raw-m06-go-300.png に GO!(緑)、raw-m06-go-1200.png に GO! なし'),
  'M12': (True, 'raw-m12-offroad-1500.png: 自車が路肩の外側(砂の面)にかかり、タイヤ付近に砂煙'),
  'M13': (True, 'm13-s1-sheet.png: 右/左カーブで道路がそれぞれ右/左へ曲がる、頂上手前で奥が隠れる、平坦/上り/下りで消失位置が変わる'),
  'M15': (True, 'm15-flat-zoom4.png / m15-run150-zoom4.png: 路肩 2 色交互・路面と草の明暗、隙間や別色の横線なし'),
  'M16': (True, 'm16-b-s1-30s-sheet.png, m42-b-s1-60s-sheet.png: sedan/truck/sports が車線上に出現、遠いほど小さい'),
  'M18': (True, 'm18-crash-sheet.png: 自車が約 0.05 秒ごとに消える点滅、煙と火花'),
  'M19': (True, 'm19-crash-sheet.png: 点滅と煙・火花'),
  'M20': (True, 'review-c-roadside.png: S1 ヤシ・岩・低木(+SURF 看板)、S2 松・大岩・シダ(+標識)、S3 街灯・ネオン(MOTEL)・ビル(+車止め・HOTEL ビル)'),
  'M22': (True, 'review-e-cp.png: ゲートが道路をまたぐ(raw-m22-gate.png)、0.3/1.9 秒に CHECKPOINT! と +18 SEC、2.4 秒になし'),
  'M23': (True, 'raw-m23-timeup-500.png / raw-m23-gameover-500.png: TIME UP、GAME OVER / REACHED STAGE 1 / SCORE / BEST / ENTER: RETRY   ESC: TITLE'),
  'M24': (True, 'raw-m24-clear-1200.png に GOAL!(パネルなし)、raw-m24-clear-1800.png にパネル(値はカウントアップ中)、PRESS ENTER は 0.25 秒ごとの点滅で raw-w-s1-clear-1900/2000/2100.png に写る。raw-m24-gate.png にゴールゲート'),
  'M26': (True, 'raw-m26-s1/2/3-run2s.png: S1 橙〜桃、S2 紫〜藍、S3 黒〜濃紺+ネオン(数値条件も 3 つとも満たす)'),
  'M27': (True, 'raw-w-ending.png: ALL CLEAR!、TOTAL SCORE、ランク C、BEST、NEW BEST!、PRESS ENTER(点滅。raw-m27x-ending-800.png は消灯の瞬間)'),
  'M28': (True, 'raw-m28-paused-hud.png の SCORE 000570 = getState().score 570'),
  'M29': (True, 'raw-m29-paused-KeyP.png / -Escape.png: PAUSED と操作説明のオーバーレイ'),
  'M31': (True, 'raw-m31-sound-on.png / raw-m31-sound-off.png: [M] SOUND ON → OFF'),
  'M32': (True, 'm32x-gameover-sheet.png: NEW BEST! が点滅(raw-m32-gameover-newbest.png は消灯の瞬間)。raw-m32-title-best.png の BEST 000336'),
  'M33': (True, 'raw-m33-hud.png: TIME・SCORE 6 桁・STAGE 1/3・BEST・速度と KM/H・進捗バー(縦線 2 本・旗・マーカー)・PASSED・[M] SOUND ON。m33-timewarn-sheet.png: 残り 10 秒以下で赤く表示/非表示を繰り返す'),
  'M38': (True, 'm38-font-pixel.png: A〜Z・0〜9 判読可'),
  'M39': (True, 'm39-player-frames.png(左/直進/右)、m16 シート(3 車種)、review-c(空・遠景・路側物)、review-e(ゲート)、m18 シート(煙)、タイトル(ロゴ)、全画面(文字)'),
  'M42': (True, 'm42-b-s1-60s-sheet.png, m42-b-s3-60s-sheet.png: 同一レーンの重なりなし'),
  'S-01': (True, 'raw-m13-s1-flat.png ほか: 遠くの道路が地平線の色に溶ける(README のとおりスプライトにはフォグなし)'),
  'S-03': (True, 's03-brake-compare.png: ブレーキ中だけテールランプが光る(ディザのにじみ付き)'),
  'S-04': (True, 's04z-tire-zoom-sheet.png: タイヤの溝の位置が 2 フレームで切り替わる'),
  'S-05': (True, 'm18-crash-sheet.png に火花。S05X で衝突後 0.3 秒に 10 フレームの横ずれ(シェイク)'),
  'S-06': (True, 'raw-s06-280kmh.png(拡大して確認): 250 km/h 以上で路面に細い速度線(薄い)と速度表示の橙色。200 km/h ではなし'),
  'S-11': (True, 'sfx_timewarn ボタンあり。残り 10 秒以下で整数秒が変わるたびに sfx_timewarn を鳴らすコード(game.js)を確認。出力タップの RMS は BGM に埋もれて 1 秒周期を分離できず'),
  'S-12': (True, 'review-c-roadside.png の S3: ヘッドライトの照射、街灯・ネオンの発光、テールランプのにじみ'),
  'S-13': (True, 'raw-s13-overtake-100.png: 自車の上に +50'),
  'S-14': (True, 'o7-gallery-cars.png に各車種 3 色、m42 シートで混在'),
  'S-16': (True, 'F で document.fullscreenElement が非 null、右下(KM/H の上)に FPS 表示'),
  'S-18': (True, 'S18X: タイトルロゴが縦に最大 4 px 動く。ロゴの光の帯、リザルトのカウントアップ(review-d-clear.png)、遷移の暗転(raw-w-trans-cd-100.png)'),
 },
 'fable-high': {
  'M04': (True, 'm04-title-blink-sheet.png, raw-m04-title-0.5s.png: ドット絵ロゴ(背後に縞の太陽)、PRESS ENTER が表示/非表示を繰り返す、BEST 000000、操作説明'),
  'M05': (True, 'review-a-countdown.png(raw-m05-countdown-500/1500/2500): 3・2・1 と STAGE 1 / SEASIDE、信号ランプ'),
  'M06': (True, 'raw-m06-go-300.png に GO!(黄)、raw-m06-go-1200.png に GO! なし'),
  'M12': (True, 'raw-m12-offroad-1500.png: 自車の右半分が路肩の外(草の面)にかかり、タイヤ付近に砂煙'),
  'M13': (True, 'm13-s1-sheet.png: 右/左カーブで道路がそれぞれ右/左へ曲がる、頂上手前で奥が隠れる、平坦/上り/下りで消失位置が変わる'),
  'M15': (True, 'm15-flat-zoom4.png / m15-run150-zoom4.png: 路肩 2 色交互・路面と草の明暗、隙間や別色の横線なし'),
  'M16': (True, 'm16-b-s1-30s-sheet.png, m42-b-s1-60s-sheet.png: sedan/truck/sports が車線上に出現、遠いほど小さい'),
  'M18': (True, 'm18-crash-sheet.png: 自車が約 0.05 秒ごとに消える点滅、煙と火花'),
  'M19': (True, 'm19-crash-sheet.png: 点滅と煙・火花'),
  'M20': (True, 'review-c-roadside.png: S1 ヤシ・岩・低木(+SUNSET 看板)、S2 松・大岩・シダ(+標識)、S3 街灯・ネオン(NEON CLUB)・ビル'),
  'M22': (True, 'review-e-cp.png: ゲートが道路をまたぐ(raw-m22-gate.png)、0.3/1.9 秒に CHECKPOINT! と +18 SEC、2.4 秒になし'),
  'M23': (True, 'raw-m23-timeup-500.png / raw-m23-gameover-500.png: TIME UP、GAME OVER / REACHED STAGE 1 / SCORE / BEST / ENTER: RETRY   ESC: TITLE'),
  'M24': (True, 'raw-m24-clear-1200.png に GOAL!(パネルなし)、raw-m24-clear-1800.png にパネル 5 行(値はカウントアップ中、PRESS ENTER あり)。raw-m24-gate.png にゴールゲート'),
  'M26': (True, 'raw-m26-s1/2/3-run2s.png: S1 橙〜桃の空(地面は緑)、S2 紫〜藍、S3 黒〜濃紺+ネオン(数値条件も 3 つとも満たす)'),
  'M27': (True, 'raw-m27x-ending-800.png: ALL CLEAR!、SCORE、ランク C、BEST、NEW BEST!、PRESS ENTER(点滅。raw-w-ending.png は消灯の瞬間)'),
  'M28': (True, 'raw-m28-paused-hud.png の SCORE 000520 = getState().score 520'),
  'M29': (True, 'raw-m29-paused-KeyP.png / -Escape.png: PAUSED と操作説明のオーバーレイ'),
  'M31': (True, 'raw-m31-sound-on.png / raw-m31-sound-off.png: [M] SOUND ON → OFF'),
  'M32': (True, 'm32x-gameover-sheet.png: NEW BEST! が点滅(raw-m32-gameover-newbest.png は消灯の瞬間)。raw-m32-title-best.png の BEST 000286'),
  'M33': (True, 'raw-m33-hud.png: TIME・SCORE 6 桁・STAGE 1/3・BEST・速度と KM/H・進捗バー(縦線 2 本・F の旗・マーカー)・PASSED・[M] SOUND ON。m33-timewarn-sheet.png: 残り 10 秒以下で赤と暗い赤の交互で明滅'),
  'M38': (True, 'm38-font-pixel.png: A〜Z・0〜9 判読可(グリフ間に隙間がなく隣と接するのは既存実装と同じ)'),
  'M39': (True, 'm39-player-frames.png(左/直進/右)、m16 シート(3 車種)、review-c(空・遠景・路側物)、review-e(ゲート)、m18 シート(煙)、タイトル(ロゴ)、全画面(文字)'),
  'M42': (True, 'm42-b-s1-60s-sheet.png, m42-b-s3-60s-sheet.png: 同一レーンの重なりなし'),
  'S-01': (True, 'raw-m13-s1-flat.png ほか: 遠くの道路・スプライトが地平線の色に溶ける'),
  'S-03': (True, 's03-brake-compare.png: ブレーキ中だけテールランプが明るい色に変わる'),
  'S-04': (True, 's04z-tire-zoom-sheet.png: タイヤの明暗(トレッド)が 2 フレームで切り替わる'),
  'S-05': (True, 'm18-crash-sheet.png に火花。S05X で衝突後 0.3 秒に 2 フレームの横ずれ(シェイクは弱い)'),
  'S-06': (True, 'raw-s06-280kmh.png(拡大して確認): 250 km/h 以上で路面に細い速度線(薄い)。200 km/h ではなし'),
  'S-11': (True, 'sfx_timewarn ボタンあり。残り 10 秒以下で整数秒が変わるたびに sfx_timewarn を鳴らすコード(game.js)を確認。出力タップの RMS は BGM に埋もれて 1 秒周期を分離できず'),
  'S-12': (True, 'review-c-roadside.png の S3: ヘッドライトの照射、街灯・ネオンの発光'),
  'S-13': (True, 'raw-s13-overtake-100.png: 自車の右に +50'),
  'S-14': (True, 'o7-gallery-cars.png に各車種 3 色、m42 シートで混在'),
  'S-16': (False, 'F で document.fullscreenElement が非 null になるが、?debug=1 の FPS 表示は右上(BEST の下、render.js の y=42)で、仕様の「右下」ではない(raw-m33-hud.png ほか)'),
  'S-18': (True, 'S18X: タイトルロゴが縦に最大 4 px 動く。リザルトのカウントアップ(review-d-clear.png)。遷移のフェードはなし'),
 },
}
RS = {
 'opus-medium': {'画づくり': [5, 'ディザのグラデーション空と縞の太陽・雲、海のきらめきと島、S2 の雪をかぶった 2 層の山並みと三日月、S3 の満月・星空・窓明かりの街と MOTEL/HOTEL ネオン(review-c-roadside.png)。自車は運転手と同乗者まで描き、交通車 3 車種のシルエットも描き分けている(o7-gallery-cars.png)。どの画面も完成品の見栄え'],
        'アニメ・演出': [5, 'フォグ(道路のみ)・近景・ブレーキ灯のにじみ・タイヤアニメ・火花とシェイク(S05X 10 フレーム)・速度線(薄い)・シーン遷移の暗転・リザルトのカウントアップ・ロゴの浮遊と光の帯・夜の加算発光・GO! の拡大'],
        '手触り': [4, 'M07〜M12 は仕様どおり(3 秒 179.9 km/h、ブレーキ減少 149.0、惰性 110.4、コース外 74.7、遠心力 −1.059)、P1 の FPS 平均 60 / 最小 59。ボットで全クリアだが S1 残り 26.6 秒と余裕が大きく、既存 5 実装と同じ理由で 5 にしない。スレスレ・シェイクあり'],
        '音': [5, 'Must+Should の音がすべてボタンで発音(エラー 0)。エンジンは 3 発振器(saw/square/sub saw)+LPF(Q 3、速度で開く)。BGM は 128/138/150 BPM、8 小節、ベース+リード+コード/アルペジオ+ドラム。スペクトログラム(s08-spectrogram-s1..3.png)で S3 のアルペジオ主体など曲ごとの違いが見える。出力ピーク最大 0.30'],
        'UI': [5, 'HUD の要素と配色が整い、250 km/h 以上で速度表示が橙になる。パネルは左ラベル/右寄せの値でカウントアップ、タイトルは操作説明の帯つき。タッチボタンはアクセル緑・ブレーキ赤で区別(s09-touch-play.png)。390 幅でも崩れなし']},
 'fable-high': {'画づくり': [4, '縞の太陽と雲、灯台とヨットのある海、S3 の満月と NEON CLUB・窓明かりのビル(review-c-roadside.png)。輪郭と陰影がそろい統一感がある。ただし S2 の遠景は滑らかな丘の帯で山並みの作り込みが薄く(compare-ref/cmp-m20-s2-50.png)、交通車は 3 車種が同じくさび形のシルエットで描き分けが弱い(o7-gallery-cars.png)。S1 の地面が緑で、仕様の配色(橙・桃・青緑)とはややずれる(high と同じ)'],
        'アニメ・演出': [4, 'フォグ(スプライトも溶ける)・近景・ブレーキ灯・タイヤアニメ・火花・シェイク(S05X 2 フレームと弱い)・速度線(薄い)・リザルトのカウントアップ・ロゴの浮遊・夜の発光。シーン遷移のフェードはなく(raw-w-trans-cd-*.png、コードにもなし)、4 と 5 の間なので下に丸めた'],
        '手触り': [4, 'M07〜M12 は仕様どおり(3 秒 179.5 km/h、ブレーキ減少 149.7、惰性 110.3、コース外 74.8、遠心力 −1.067)、P1 の FPS 平均 60.05 / 最小 60。ボットで全クリア(S1 残り 25.5 秒)。スレスレ・シェイクあり'],
        '音': [5, 'Must+Should の音がすべてボタンで発音(エラー 0)。エンジンは 3 発振器(saw/square/tri)+LPF(Q 1.6、300〜2700 Hz を速度で開く)。BGM は 128/138/152 BPM、8 小節、ベース+リード+コード/パッド+ドラム、S3 は 16 分アルペジオ主体。スペクトログラムで曲ごとの違いが見える。出力ピーク最大 0.36'],
        'UI': [5, 'HUD の配色(SCORE 黄・BEST 水色)が整い、パネルはカウントアップと PRESS ENTER つき。タイトルはロゴ+太陽、エンディングは大きなランク文字(RANK の見出しは小さく左寄り)。タッチボタンは 4 つの丸ボタン(s09-touch-play.png)。390 幅でも崩れなし。debug=1 の FPS 表示が BEST の下に重なるが EVAL §6-10 により減点しない']},
}
for e, items in R.items():
  V[e] = {k: {'pass': p, 'note': n} for k, (p, n) in items.items()}
  V[e]['subjective'] = {k: {'score': v[0], 'basis': v[1]} for k, v in RS[e].items()}
json.dump(V, open('visual.json','w'), ensure_ascii=False, indent=1)
