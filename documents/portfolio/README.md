# PDFポートフォリオの正本

ゲームプランナー応募向け。提出条件の指定なし、横長16:9・21ページ。
制作期間は掲載せず、制作人数と担当範囲を残す。

## 更新先

- 閲覧用：`島本善太_ポートフォリオ.pdf`
- 編集用：`島本善太_ポートフォリオ.pptx`
- 再生成元：`../../tools/build-portfolio-booklet.mjs`
- 検証・書き出し作業：`../../launcher/test-output/portfolio-booklet/`（Git管理外、再利用）

Web版・ゲーム素材・元企画書は保持する。別版フォルダーは増やさず、履歴はGitで管理する。
自動再生成時はPPTXの手編集が反映されないため、変更内容を生成元にも反映する。

## 構成と根拠

| ページ | 役割 | 根拠と区別 |
| --- | --- | --- |
| 1–3 | 代表作への入口・強み | 本人の担当確認、Web版の所属情報。個人制作と一人でのプランナー担当を混同しない |
| 4–6 | すべる宇宙駐車場 | App Store掲載画像、元プロジェクトのDocs/Spec.md・DevelopmentGuide.md、TouchControlsTests.cs。操作追加はチームの開発経緯、テスト実行結果は未確認 |
| 7–10 | V-Link Battle | 既存プレイ映像・企画書・Web版の機能差。27・29・31秒の連続画像は企画ルールの全実装や改善前後の比較の証明ではない |
| 11–12 | 双子・仕様変更の記録 | futago_spec.pdf p.3、specifications.json、LinkType.cs。変更理由と実装確認を分け、改善効果を推測しない |
| 13–15 | 他のチーム制作作品 | Web版、本人が確認した人数・担当、公開画面 |
| 16 | バグハンター | 本人は企画・改善方針。コードはAI実装。QA.mdは過去の検証記録で、本人が行ったテストとは断定しない。ASSETS.mdにAI生成・CC0素材の範囲 |
| 17–18 | 未実装の企画 | 企画書のみ・構想を明示。AI生成画像を実ゲーム画面として扱わない |
| 19–21 | スキル・資料導線・連絡先 | 既存Web版の確認済み情報、クリック可能な資料・動画・公開ページ |

V-Linkなどの素材担当には制作・収集が混在するため、ゲーム画面全体を本人の自作素材とは主張しない。
試遊人数、使いやすさの改善率、FPS向上など、根拠のない成果数値は追加しない。
本人の具体的な試遊エピソードが得られたら、該当ページに事実として追記する。

## 再生成・検証

既存の共有Node/Pythonランタイム、PowerPoint、FFmpeg、Popplerを使用する。
環境が変わった場合は `CODEX_RUNTIME`・`PRESENTATIONS_SKILL`・`FFMPEG` で保存先を指定する。

```powershell
node tools/build-portfolio-booklet.mjs --preview-pages=6,8,16
node tools/build-portfolio-booklet.mjs
python -m unittest discover -s tests -p 'test_*.py'
```

生成後はPDF全ページをレンダリングして確認する。自動テストだけでは見た目・事実の正確さは保証しない。
提出用PDFは画面閲覧を前提とし、QRコードは重複するため追加せず、本文リンク・目次・しおりを使用する。
