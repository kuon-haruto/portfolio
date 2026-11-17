# 公開作品の企画書

## 掲載資料の添削対象

PDFポートフォリオ掲載の企画書10件・仕様書7件を対象に、本文と実装根拠を照合して正本を更新した。
2026-11-17校閲。未確定のルール・変更理由は推測で補わず、資料内に区別して残す。

### 現在の作業状況

- 企画書10件・46ページを添削し、編集可能なPowerPointとPDFを正本に生成。全ページを画像で確認し、変更したページは再確認した。
- 仕様書7件・28ページは根拠資料との照合を反映し、全ページを画像で確認。既存の変更記録を残し、校閲による訂正の経緯を各1件追加した。
- Webの企画書一覧に、10件すべてのPowerPointへのリンクを用意。無重力・リンク順に関する紹介文も現行の説明へ修正した。
- 三色の分岐係は `D:/三色分岐/Assets` 内に既存の仕様書を確認できていない。企画の根拠は実装スクリプトで照合し、仕様書の新規作成は本添削と区別する。
- 操作・性能の再検証ではなく資料の校閲。実行確認のない項目を動作保証として扱わない。

| 作品 | 企画書 | 仕様書 | 確認状況 |
| --- | --- | --- | --- |
| V-Link Battle | v-link-battle_proposal.pdf | v-link-battle_spec.pdf | 添削済み：構想・実装・Web版の制限を区別 |
| すべる宇宙駐車場 | sliding-space-parking_proposal.pdf | sliding-space-parking_spec.pdf | 添削済み：素材の担当範囲、操作・衝突の判定を明確化 |
| 双子 | futago_proposal.pdf | futago_spec.pdf | 添削済み：6人、素早さ順、2種のリンク、伝播の条件 |
| 線のこちら側／向こう側 | line-boundary_proposal.pdf | kochiratomukou_spec.pdf | 添削済み：2点選択・重力反転と旧案を区別 |
| てるてるウォーズ | teruteruwars_proposal.pdf | teruteru-wars_spec.pdf | 添削済み：配置時のモードと未確認の配置後反転を区別 |
| 反転暗殺 | hantenansatsu_proposal.pdf | hanntenn-ansatu_spec.pdf | 添削済み：ターン制・敵の全撃破・判定順の確認事項 |
| 三色の分岐係 | sanshoku-bunki_proposal.pdf | 公開リンクなし | 企画書添削済み：仕分けと不良品返却を整理 |
| バグハンター | mushi-shooting.pdf | bug-hunter_spec.pdf | 添削済み：AI実装・本人の企画、過去QAと今回の校閲を区別 |
| 5分ダンジョン | FiveMinuteDungeon.pdf | 企画のみ | 添削済み：時間表記、想定対象、未検証の操作感を整理 |
| せいぶつマスター | seibutsu-master.pdf | 企画のみ | 添削済み：教育効果を狙いとして記載、未確定処理を明示 |

確認観点：企画の狙いと実装済みルールの区別、プレイヤーの判断、用語統一、制作人数・担当、変更経緯の保持、未確認事項の明示。
制作期間を追加しない。企画だけの作品に実装済み仕様を捏造しない。
添削後は各PDFの全ページをレンダリングし、改ページ・文字欠落・画像・リンクを確認する。

企業の採用担当者に、遊びの核・プレイヤーの判断・作品の雰囲気を伝える資料です。
制作手順、判定条件、調整値、例外処理は既存の仕様書で扱い、企画書へ混在させません。

## 正本と更新

- 編集用PowerPointの正本：このフォルダーの `*_proposal.pptx`。
- 掲載用PDFの正本：`files/` 内。旧来のファイル名は維持し、対応は `manifest.json` に記録。
- 再生成元：`tools/build-game-proposals.mjs`。本文・配置・根拠資料を一緒に管理します。
- 企画書を改訂するときは再生成元も更新し、同じファイルを更新します。履歴はGitに残します。
- 制作期間は掲載しません。人数はV-Link 8人、双子6人、三色の分岐係5人、バグハンター1人、その他の制作済み作品は4人です。
- V-Linkの企画上の構想と、公開版の機能・表示制限を区別しています。
- 既存の10企画書を同じ公開パスで更新します。7件の本文は `reviewed-proposals.json`、代表作3件は生成スクリプトで管理します。

## 素材

ゲーム画面とアイコンは `files/images/`・`files/game-icons/` の既存素材を参照します。
`assets/` は次の元資料から採用した必要な素材だけを保持しています。

- `vlink-*.jpg`：現在ポートフォリオに掲載している `files/Vlinkvideo.mp4` の対戦（24秒）、コメント（30秒）、キャラクター選択（12秒）。旧ステージの実演映像は使用しません。
- `parking-ship.png`：`D:/すべる宇宙船/Assets/SlidingSpaceParking/Graphics/Textures/Sheet/ssp_ship.png`。
- `sanshoku-*.png`：`D:/三色分岐/Assets/Images/` の既存ロゴ、ロボット正常品・不良品、チュートリアル画像。

ゲーム素材の内容・縦横比は変更していません。想定プレイヤーと企画の狙いは提案として記載し、市場調査の結果とは扱いません。
10作品とも下部の作品名フッター・ページ番号は掲載せず、PDFのしおりでページを移動できます。
`dungeon-concept.png` と `seibutsu-card.png` は校閲前の同名PDFから抽出した既存のイメージ案です。ゲームの実装画面ではないことを明記しています。

## ビルド

既存のCodex共有ランタイムとWindows版PowerPointを使います。

```powershell
node tools/build-game-proposals.mjs
node tools/build-game-proposals.mjs --only=futago
python build.py
```

`CODEX_RUNTIME`・`PRESENTATIONS_SKILL` でランタイムと検証ツールの場所を指定できます。
PowerPointでPDFに変換し、全ページのプレビューを既存作業領域 `launcher/test-output/proposals/` へ出力します。
`manifest.json` は資料のページ数・公開パス・リンクの検査に使用します。
