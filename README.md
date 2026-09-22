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

## Quiet Mode — Quiet Koi

1匹の鯉だけを観察する、目的・スコア・ゲームオーバーのない静かなモードです。

- 動く生き物は鯉1匹だけ
- 慣性を持った旋回と加減速
- 速度に応じた尾びれ・胴体の動き
- 水面付近 / 深場を自律的に行き来する
- 壁際では自然に向きを変える
- 水面光、影、底石、コースティクスで池を表現
- VIEWで POND / FOLLOW / KOI POV を切り替え
- KOI POV は鯉の進行方向から見た疑似一人称水中視点
- COME HERE で水面に1回だけ刺激を与え、鯉の注意を向けられる
- LIGHT で午後 / 夕方 / 曇天の光を切り替え
- 時間制限なし、スコアなし

公開ページ: `pond.html`

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
- `pond.html` — Quiet Koi UI
- `pond.css` — Quiet Koi デザイン
- `pond.js` — 1匹の鯉の行動シミュレーション / FOLLOW・KOI POVカメラ
