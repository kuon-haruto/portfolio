# V-Link Battle 紹介のローカル試作

- ブランチ: `experiment/portfolio-title-home`
- 確認先: http://127.0.0.1:4188/launcher/test-output/title-home-review/#home
- 初回は背景での行動から紹介へ進む。「作品紹介を見る」で待たずに再生し、紹介後は「もう一度見る」で再生する。
- 「見送る」と二人がアイコンを引き取り退場する。詳細を開いて戻った場合、直後は背景の行動のみ。
- 「動きを減らす」設定では静止した紹介ポーズと同じ作品リンクが出る。

## 実装

`puppet.js` は親レイアウト内でキャラの画・操作を管理する。
`motion.js` は奥行き・移動・接地の計算、`portrait.js` はまばたきと顔周辺の変形を担当する。
旧 `art.js` はこの画面の描画には使用しない。

`hosts.png` と歩行、待機、方向転換、運搬、接近、片手で支える、視線を上げる、正面の差し出しはWeb専用絵。
本編のモデルとは別の素材で、ゲームアイコンは既存の正式画像を使用する。
専用絵の緑色の仮カード領域を抜き、アイコンと握る指を別順序で描く。
全身歩行は描き分けたコマと靴底位置を使う。手前へ移る途中は全身絵と上半身絵を切り替える。

## 確認

`node launcher/test-output/title-home-review/puppet/interaction-qa.cjs` で、
EdgeのPC幅・スマホ幅でカテゴリ、挨拶、見送り、再視聴、作品詳細、ホーム復帰、モーション設定を検証する。

`node launcher/test-output/title-home-review/puppet/record-scene.cjs --first --full` で、
初回のホームから紹介、退場、背景への復帰までを通常速度で収録する。
FFmpegを使用し、既存の `desktop-vlink-full.mp4` と `mobile-vlink-full.mp4` を更新する。

`launcher/test-output` はローカル試作用。公開サイト、PDF、mainへの反映は行わない。
