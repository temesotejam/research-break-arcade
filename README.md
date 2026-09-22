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
- `game.js` — ゲームロジック / Canvas描画
