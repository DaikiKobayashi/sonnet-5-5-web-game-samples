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
json.dump(V, open('visual.json','w'), ensure_ascii=False, indent=1)
