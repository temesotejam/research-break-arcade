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
