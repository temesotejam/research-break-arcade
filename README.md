# Research Break Arcade

研究の合間に、1〜2分だけ遊んで区切りを付けるための軽量ブラウザゲーム集です。

## Game 01 — Tiny Lander

小型着陸船を PAD に静かに降ろすミニゲームです。

- PC: `←` / `→` で横噴射、`Space` または `↑` でメイン噴射
- Mobile: 画面下の LEFT / THRUST / RIGHT
- 1セッション 90 秒
- 毎ラウンド、重力・横風・着陸地点が変化
- ベストスコアはブラウザの Local Storage に保存
- 外部ライブラリ、ビルド処理、サーバーは不要

## Game 02 — Night Fishing

夜の水辺で遊ぶ、1ボタンのタイミング＋リール操作ゲームです。

- PC: `Space` だけ
- Mobile: 画面下の大きなアクションボタン
- CAST → HIT → REEL の3段階
- リール中は押して巻き、離して糸の張りを逃がす
- 全6種類の魚。珍しい魚ほど高得点
- 1セッション 90 秒
- ベストスコアはブラウザの Local Storage に保存

公開ページ: `fishing.html`

## Game 03 — Stack Tower

左右に動くブロックをタイミングよく積み上げる1ボタンゲームです。

- PC: `Space`
- Mobile: 画面下の DROP またはゲーム画面タップ
- ズレた部分は切り落とされ、塔が徐々に細くなる
- ±4 px以内は PERFECT。コンボが続くほど少し幅を回復
- 高くなるほどブロック速度が上昇
- 最大90秒
- ベスト高さはブラウザの Local Storage に保存

公開ページ: `tower.html`

## Game 04 — One Button Drift

自動で走る車を1ボタンだけで周回させるドリフトゲームです。

- PC: `Space` を押している間だけ左旋回
- Mobile: 画面下の DRIFT を長押し
- 離すと直進、押しすぎると内側、離しすぎると外側へ
- 路面中央を維持すると FLOW 倍率が上昇
- 4チェックポイントを順番に通過すると1周
- 大きくコースアウトすると最後のチェックポイントへ自動復帰
- 1セッション 90 秒
- ベストスコアはブラウザの Local Storage に保存

公開ページ: `drift.html`

## Game 05 — Orbit Sling

惑星の重力を使って次々にスリングショットする1ボタン軌道ゲームです。

- PC: `Space` で進行方向へ短い BOOST
- Mobile: BOOST またはゲーム画面をタップ
- 白い予測線で「無操作時の軌道」を表示
- 緑のスリング帯を通過すると成功
- 近づきすぎる時は BOOST で速度を上げ、重力による曲がりを弱める
- BOOST燃料は成功ごとに回復し、惑星間で持ち越し
- 失敗時は同じ惑星の手前から再挑戦
- 1セッション 90 秒
- ベストスコアはブラウザの Local Storage に保存

公開ページ: `orbit.html`

## Autonomous Mode — Tiny Rover

1台の小型探査ローバーを「操作する」のではなく、ロボット自身の判断と成長を観察する永続型シミュレーションです。

- 動く主体はローバー1台だけ
- Three.js 0.186.0 を固定利用した3D WebGL描画
- CURIOSITY / CAUTION / SELF-IMPROVE の性格値を個体ごとに生成
- 探索、充電、自己改造、ゲート起動、次マップ移動を毎回スコアリングして自律選択
- 失敗回数・充電回数・走行距離・調査経験から「今の自分に何が足りないか」を評価
- TRACTION WHEELS / AUX BATTERY / LIDAR / ACTIVE SUSPENSION / ARM TOOL / SOLAR BOOST を自分で選んで装着
- 改造は3Dモデルの外見にも反映
- 岩や廃部品、マップ固有のキーアイテムを探索・回収
- キーアイテムと以前見つけたゲートの関係を自分で試し、ゲートを起動
- ゲート起動後も、残りの探索を続けるか次マップへ進むかを性格と探索率から自分で判断
- MAP 01 RED BASIN → MAP 02 GLASS HOLLOW → MAP 03 ANCIENT RELAY → 以降は FRONTIER を自動生成
- 進行、性格、記憶、アップグレード、現在位置を Local Storage に保存
- 岩を先読みして回避し、進めない時は自動でバックして経路復帰
- 地形の傾斜に合わせて車体がピッチ・ロール
- 6輪の左右回転速度は旋回角速度に応じて個別計算
- VIEWで OVERVIEW / FOLLOW / ROVER CAM / ARM CAM を切り替え
- NEW LIFE を押した場合のみ、性格・記憶・改造をすべて初期化
- 時間制限なし、スコアなし

公開ページ: `rover.html`

旧 `pond.html` は Tiny Rover へリダイレクトします。

## Run locally

`index.html` をブラウザで開くだけでも動作します。ローカルHTTPサーバーを使う場合は任意の静的サーバーでこのディレクトリを配信してください。

## GitHub Pages

`.github/workflows/pages.yml` で静的ファイルを GitHub Pages にデプロイします。

新規リポジトリでは初回のみ、GitHub の **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定する必要があります。設定後は `main` への push ごとに自動デプロイされます。

公開先:

`https://temesotejam.github.io/research-break-arcade/`

## Structure

- `index.html` — UI
- `styles.css` — レイアウト / デザイン
- `game.js` — Tiny Lander ゲームロジック / Canvas描画
- `fishing.html` — Night Fishing UI
- `fishing.css` — Night Fishing デザイン
- `fishing.js` — Night Fishing ゲームロジック / Canvas描画
- `tower.html` — Stack Tower UI
- `tower.css` — Stack Tower デザイン
- `tower.js` — Stack Tower ゲームロジック / Canvas描画
- `drift.html` — One Button Drift UI
- `drift.css` — One Button Drift デザイン
- `drift.js` — One Button Drift ゲームロジック / Canvas描画
- `orbit.html` — Orbit Sling UI
- `orbit.css` — Orbit Sling デザイン
- `orbit.js` — Orbit Sling ゲームロジック / Canvas描画
- `rover.html` — Tiny Rover UI
- `rover.css` — Tiny Rover デザイン
- `rover.js` — Tiny Rover 自律意思決定 / 自己改造 / マップ進行 / 永続化 / 3Dフィールド
- `pond.html` — Tiny Rover への互換リダイレクト
