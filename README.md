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

## Autonomous Mode — Tiny Bot / Vast Retro RPG World

昔のコンソールRPGのような真上視点のタイルフィールドを、1体の自律ロボットが旅する永続型シミュレーションです。既存ゲームの画像やマップは使わず、標準の HTML Canvas 2D だけで独自に描画します。

- 論理ワールドは **512 × 512 タイル**
- 全マップを保持・描画せず、現在地周辺の30〜50タイルだけを描画
- 座標から地形をオンデマンド生成するため、広大でも軽量
- 草原 / 森 / 山 / 水 / 砂地 / 雪原などをレトロRPG風の簡素なタイルで表現
- WORLD / CLOSE / SENSOR の3表示
- 小さい人型キャラクターを画面中央付近に表示
- 最大目標は **SELF EVOLUTION** と **REACH NEXT REGION** の2つだけ
- 移動・探索・回収・遺跡調査は、2つの最大目標を進めるための下位行動
- 古代の門は開始地点からおよそ125〜190タイル離れた場所に生成
- 門を開くキー遺物はおよそ55〜110タイル圏に生成
- 部品箱はおよそ18〜120タイル、遺跡はおよそ25〜145タイル圏に散在
- ロボットは未発見地点の座標を意思決定に使用せず、視界に入ったものだけを記憶
- 山は視線を遮り、森が多く挟まると認識信頼度が下がる
- SENSOR表示では現在認識している地点と信頼度を表示
- 画面右上に **MEMORY MAP** を常時表示
- MEMORY MAPはロボットが実際に見た地形セルだけ色が付き、未認識領域は黒
- 視野方向に沿って地図が徐々に埋まり、LONG-RANGE OPTICS取得後は一度に記録できる範囲も広がる
- 発見済みの部品箱・遺跡・キー遺物・古代の門だけをMEMORY MAP上に表示
- 地域移動後は GREEN KINGDOM / SUNLAND / SNOW MARCH / DARKWOOD 系の別フィールドへ進行

### Self upgrades

攻撃力・防御力アップはありません。探索・移動能力だけが成長します。

- **MOVEMENT MODULE** — 移動速度 ×1.48
- **TOOL MODULE** — 回収速度 ×1.85
- **LONG-RANGE OPTICS** — 視認距離を約13.5 → 22タイルへ拡大
- **DETECTION ARRAY** — 認識信頼度 +14%
- **FAST ANALYZER** — 調査速度 ×1.75
- **POWER EFFICIENCY** — エネルギー消費 ×0.63

MISSION、性格、部品、アップグレード、地域、現在座標は Local Storage に保存されます。NEW LIFE でのみ完全初期化します。

公開ページ: `rover.html`

旧 `pond.html` は Tiny Bot へリダイレクトします。

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
- `rover.html` — Tiny Bot UI
- `rover.css` — Tiny Bot / レトロRPG表示デザイン
- `rover.js` — Pure Canvas 2D / 512×512 procedural world + recognition memory map / MISSION / 自己アップグレード / 地域進行 / 視覚認識
- `pond.html` — Tiny Bot への互換リダイレクト
