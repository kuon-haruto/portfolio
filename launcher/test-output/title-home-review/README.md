# タイトル・ホーム 比較ボード

## 成果物

- `comparison-a.png` : A案。余白・タイトル・氷ノあめの存在感を優先。
- `comparison-b.png` : B案。ゲームの発見・比較・担当確認を優先。
- いずれも 1600 x 2943 px、日本語、3場面を縦に配置。同じ代表作で比較。
- `design.html` : 両ボードを表示する編集可能なデザインソース。直接開けます。
- `design.css` / `design.js` : 配置・書体・構成・日本語テキスト。
- `model-stage.html` / `model-stage.js` : 実モデルのポーズと実アイコンの3D描画ソース。
- `ame-idle.png` / `ame-peek.png` / `ame-offer.png` : ソースHTMLで使用する透過レンダー。
- `render.cjs` : PNGの再生成と自動チェック。`verification.json` が検証結果。

## 再生成

リポジトリのルートで実行：

```powershell
node launcher/test-output/title-home-review/render.cjs
```

既存の `launcher/node_modules/playwright` とローカルEdgeを使用。ローカルHTTPサーバーは処理中だけ起動し、終了時に停止します。`--qa` を付けると場面別検証PNGも生成します。新しい依存環境は作成しません。

## 素材と確認範囲

- 色と書体：既存 `styles/main.css` のネイビー `#0c1226`、白 `#f2f5fc`、青、ミント、Segoe UI / Hiragino Sans / Yu Gothic UI。
- 背景：既存の48pxグリッドを継承。
- 共通の代表作：`files/images/sliding-space-parking-store-gameplay.jpg`。
- 差し出す実アイコン：`files/game-icons/sliding-space-parking.png`。
- 追加の実画像：V-Link Battle、三色の分岐係の既存アイコン・ゲーム画面。
- 作品名・担当内容：既存 `index.html` に記載された範囲。
- 氷ノあめ：既存 `../vlink-companion/assets/ame.json` の実メッシュ・骨格・テクスチャを参照。46,915頂点、226ボーン。モデルや共有ライブラリは複製・変更していません。
- 差し出し姿勢：この検討用に両腕のボーンをCCDで調整。実アイコンを同じ3D空間に配置し、手を手前に重ねて描画。
- 画像読込、JavaScriptエラー、文字の横はみ出し、カード内の文字切れ、WebGLの非透明ピクセル数を自動確認。PNGの全6場面を目視確認。

これは静止画による方向選択用の見本です。リンク・カテゴリ切替・歩行・差し出しの連続アニメーションは未実装。Web専用モデルの改修、てらみすいの追加、公開、Git操作は行っていません。目的書のブランチ作成・全体実装より、今回指定された「このフォルダ内の画像比較のみ」を優先しています。
