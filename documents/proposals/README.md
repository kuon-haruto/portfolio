# 公開作品の企画書

企業の採用担当者に、遊びの核・プレイヤーの判断・作品の雰囲気を伝える資料です。
制作手順、判定条件、調整値、例外処理は既存の仕様書で扱い、企画書へ混在させません。

## 正本と更新

- 編集用PowerPointの正本：このフォルダーの `*_proposal.pptx`。
- 掲載用PDFの正本：`files/` の同名 `*_proposal.pdf`。
- 再生成元：`tools/build-game-proposals.mjs`。本文・配置・根拠資料を一緒に管理します。
- 企画書を改訂するときは再生成元も更新し、同じファイルを更新します。履歴はGitに残します。
- 制作期間は掲載しません。制作人数はV-Link 8人、すべる宇宙駐車場4人、三色の分岐係5人です。
- V-Linkの企画上の構想と、公開版の機能・表示制限を区別しています。
- 既存5作品と企画書のみの2作品のPDFは維持し、不足していた3作品を追加しています。

## 素材

ゲーム画面とアイコンは `files/images/`・`files/game-icons/` の既存素材を参照します。
`assets/` は次の元資料から採用した必要な素材だけを保持しています。

- `vlink-*.jpg`：現在ポートフォリオに掲載している `files/Vlinkvideo.mp4` の対戦（24秒）、コメント（30秒）、キャラクター選択（12秒）。旧ステージの実演映像は使用しません。
- `parking-ship.png`：`D:/すべる宇宙船/Assets/SlidingSpaceParking/Graphics/Textures/Sheet/ssp_ship.png`。
- `sanshoku-*.png`：`D:/三色分岐/Assets/Images/` の既存ロゴ、ロボット正常品・不良品、チュートリアル画像。

ゲーム素材の内容・縦横比は変更していません。想定プレイヤーと企画の狙いは提案として記載し、市場調査の結果とは扱いません。
3作品とも下部の作品名・企画書表記・ページ番号は掲載せず、PDFのしおりでページを移動できます。

## ビルド

既存のCodex共有ランタイムとWindows版PowerPointを使います。

```powershell
node tools/build-game-proposals.mjs
python build.py
```

`CODEX_RUNTIME`・`PRESENTATIONS_SKILL` でランタイムと検証ツールの場所を指定できます。
PowerPointでPDFに変換し、全ページのプレビューを既存作業領域 `launcher/test-output/proposals/` へ出力します。
`manifest.json` は資料のページ数・公開パス・リンクの検査に使用します。
