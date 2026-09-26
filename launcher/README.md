# Zenta Game Library

Windows向けのゲームライブラリ。作品説明、操作方法、目的、開発エンジン、制作人数・期間を表示し、ゲームのインストール・起動・更新を行います。ポートフォリオ本体とは独立した `launcher` フォルダーです。

## 利用者向け

公開後の GitHub Releases から `ZentaGameLibrary-Setup-<バージョン>.exe` を入手してインストールします。UnityやNode.jsは不要です。ゲーム一式をインストーラーに同梱するため、初回もネット接続なしで「インストールしてプレイ」を実行できます。

「更新を確認」からゲーム情報とランチャー本体を確認できます。ゲームの新版は作品画面の「ゲームを更新」、本体は「更新を取得」「再起動して更新」で反映します。プレイ中のゲームは終了してから更新してください。

初回リリースが公開されるまではオンライン更新先にファイルがありません。現在のビルドは未署名です。公開前に署名と実機配布テストを行うことを推奨します。Windowsの警告が出る場合は発行元・入手元を確認してください。

## クローンからビルド

Windows 10/11 x64、Node.js 24、pnpm 11.25.0、Gitが必要です。

```powershell
git clone https://github.com/kuon-haruto/portfolio.git
cd portfolio/launcher
pnpm install --frozen-lockfile
pnpm test
pnpm fetch:games
pnpm dist
```

生成先は `launcher/dist/ZentaGameLibrary-Setup-0.1.0.exe`。`pnpm fetch:games` はカタログに記録された公開済みZIPを取得し、サイズとSHA-256を検証します。**初回公開前は取得元がないため、次の手順で手元のWindowsビルドを登録してください。**

開発起動は `pnpm start`、画面検証は `pnpm test:ui`。`pnpm test:install` は双子をテスト領域へ展開し、実際にゲームを起動して終了します。出力・スクリーンショットは `test-output/` に保存します。

## ゲームのWindows版を作成

`data/game-sources.json` に4作品のリポジトリ、固定コミット、Unityバージョンを記録しています。該当UnityとWindows Build Support、および有効なUnityライセンスを用意してください。

```powershell
./tools/build-games.ps1
# 1作品のみの場合
./tools/build-games.ps1 -Ids futago
# Unityの生成コマンドが日本語パスで失敗する環境
./tools/build-games.ps1 -Ids teruteru-wars -SourceRoot "$env:TEMP/zenta-unity-sources"
```

ビルドは `game-sources/` 内のクローンで行い、元の作業用プロジェクトを変更しません。既存クローンのコミット不一致やローカル編集はエラーにし、自動上書きしません。WindowsのGitで証明書資格情報のエラーになる環境では `-OpenSsl` を指定できます。TLS証明書の検証は無効化しません。

Windowsビルドの登録例:

```powershell
pnpm pack:game --id futago --source game-builds/futago --exe Futago.exe --version 1.0.0
pnpm pack:game --id line-boundary --source game-builds/line-boundary --exe LineBoundary.exe --version 1.0.0
pnpm pack:game --id hanten-assassination --source game-builds/hanten-assassination --exe HantenAssassination.exe --version 1.0.0
pnpm pack:game --id teruteru-wars --source game-builds/teruteru-wars --exe TeruteruWars.exe --version 1.0.0
pnpm pack:game --id v-link-battle --source 'D:/VBattle_0214/VBattle_0214' --exe V-LinkBattle.exe --version 1.0.0
```

V-Link Battleは提供済みWindowsビルドを使用しています。別のPCでは `--source` を手元のビルドフォルダーへ変更してください。exeだけでなく `_Data`、`UnityPlayer.dll`、必要なランタイム等をすべて含めます。デバッグ出力・PDBは除外します。登録済みのZIPは上書きしないので、ゲームを変更したらバージョン番号を上げてください。

## 更新版を公開

Gitのコミットだけではインストール済みアプリは更新されません。配布用ビルドと公開リリースが必要です。

1. 対象ゲームのソースを変更・コミットし、`data/game-sources.json` のコミットを更新します。
2. クリーンなクローンでWindows版をビルドします。
3. `pnpm pack:game` で新しいゲームバージョンを登録します。
4. `data/catalog.json` の説明・操作・人数・期間を確認します。
5. `package.json` のランチャーバージョンも上げます。ゲーム更新のみでもリリース単位で上げます。
6. `pnpm test`、`pnpm prepare:release`、`pnpm dist`、実機テストを行います。
7. `launcher-v<本体バージョン>` のGitHub Releaseに、`artifacts/launcher-v*/` の全ファイルと、`dist/` のインストーラー・`.blockmap`・`latest.yml` を添付します。
8. 内容を確認し、DraftでもPre-releaseでもない通常リリースとして公開し、Latestに設定します。

公開先は `kuon-haruto/portfolio`。すべてのゲームZIP・`games.json`・本体更新情報を**同じリリース**に置きます。ゲームZIPのURLは固定タグを参照するため、公開済みZIPを差し替えず新バージョンにしてください。旧版に戻したいときもバージョンを上げて再リリースします。

GitHub Actionsの `Build Windows Game Library` は手動実行です。初回リリース後は公開済みゲームを検証・取得してインストーラーを作成できます。オプションを有効にするとDraft Releaseまで作成しますが、自動で一般公開はしません。ソースや巨大なUnityビルドをGitへ含める必要はありません。`data/catalog.json`・ソース・ロックファイルはコミットしてください。

ローカルからの公開にも対応しています。ソースをコミット・pushし、上記の配布用ビルドとテストを完了してから実行します。Git Credential Managerの保存済み認証、または環境変数 `GH_TOKEN` を使います。トークンをファイルへ保存・表示しません。

```powershell
node tools/publish-release.cjs --draft
# 添付ファイルを確認して一般公開する場合
node tools/publish-release.cjs --publish
```

アップロード済みファイルのSHA-256も確認し、すべて揃ってから公開します。公開済みリリースの上書きは拒否します。

## データと安全性

- 通常の保存先は `%APPDATA%/zenta-game-library`。ゲームはその `games/` 以下です。
- 更新は取得、SHA-256とサイズ検証、隔離フォルダーへの展開、実行ファイル確認の順で処理します。完了するまで既存ゲームを置き換えません。
- 展開時はパストラバーサル、絶対パス、Windows予約名、シンボリックリンク、重複名、容量超過を拒否します。
- 配布元は設定済みHTTPSホストのみ許可します。画面から任意コマンドや任意ファイルを実行するAPIはありません。
- 直前のゲーム版は `.previous` に残ります。置き換え中の失敗時は旧版へ戻します。
- UnityのPlayerPrefs等は各ゲーム固有の保存場所にあります。独自にゲームフォルダーへセーブする作品は、更新前に永続保存先へ移してください。
- テスト時は `ZENTA_USER_DATA` 環境変数で保存先を隔離できます。

各ゲームや素材の権利はそれぞれの制作者に帰属します。配布範囲・素材の利用条件は公開前にチームで確認してください。
