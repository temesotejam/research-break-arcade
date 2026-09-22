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

## Autonomous Mode — Tiny Bot / Minecraft World

Minecraft風のブロック世界で、1体の人型自律ロボットを観察する永続型シミュレーションです。WebGL / Three.js は使わず、標準の HTML Canvas 2D だけで描画します。通常のMinecraftらしい探索・採掘・ポータル進行に、ロボット自身の非戦闘アップグレード要素だけを追加しています。

- ロボット本体は頭・胴体・両腕・両脚を持つMinecraft風のブロック人型
- 移動中は腕と脚を振って歩き、頭そのものがパン / チルトするカメラ
- 最大目標は **SELF EVOLUTION** と **REACH NEXT DIMENSION** の2つだけ
- 測量そのものはMISSIONにせず、移動・観察・採掘は2つの最大目標を進めるための下位行動
- OVERWORLD PLAINS → NETHER WASTES → THE END → 以降もMinecraft風チャンクを継続生成
- 約64 m角のブロック世界を HTML Canvas 2D だけで軽量描画
- IRON / REDSTONE / QUARTZ / GOLD などを認識・採掘して材料として回収
- カメラに映った物だけを新規認識し、未発見物の座標を意思決定には使用しない
- 頭部方向・視野角・距離・見かけサイズ・2D遮蔽判定から認識信頼度を算出
- BOT CAMでは検出枠、分類名、認識信頼度、距離を表示。十分に分からない物体は `?`
- 調査後は STONE / IRON ORE / REDSTONE ORE / FLINT & STEEL / NETHER PORTAL などMinecraft側の分類名へ更新
- ポータルフレームと起動アイテムを探し、発見 → 回収 → 起動 → 通過まで自律実行

### Self upgrades

戦闘用の攻撃力 / 防御力アップはありません。代わりにロボット自身の探索能力が変化します。

- **MOVEMENT MODULE** — 移動速度 ×1.48
- **MINING MODULE** — 採掘・回収速度 ×1.85
- **LONG-RANGE OPTICS** — 視認距離 ×1.65
- **DETECTION ARRAY** — 認識信頼度 +14%、小さい物体も検出しやすくなる
- **FAST ANALYZER** — 未知物体の解析速度 ×1.75
- **POWER EFFICIENCY** — エネルギー消費 ×0.63

アップグレードはロボット自身が現在不足している能力を評価して選び、外見にも反映されます。

- MOVEMENT MODULE → 脚部モジュール
- MINING MODULE → 右手の採掘ツール
- LONG-RANGE OPTICS → 顔面バイザー
- DETECTION ARRAY → 頭部アンテナ
- FAST ANALYZER → 頭部解析モジュール
- POWER EFFICIENCY → 胸部発光コア

MISSION、性格、材料、アップグレード、ディメンション、現在位置は Local Storage に保存されます。NEW LIFE でのみ完全初期化します。

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
- `rover.html` — Tiny Rover UI
- `rover.css` — Tiny Rover デザイン
- `rover.js` — Pure Canvas 2D / MISSION / 人型アニメーション / 非戦闘アップグレード / ポータル進行 / 視覚認識
- `pond.html` — Tiny Rover への互換リダイレクト
