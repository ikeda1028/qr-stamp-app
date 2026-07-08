# 拠点スタンプ QR アプリ

スマホで拠点QRを読み取り、ポイントとスタンプを貯め、条件達成でカードを解放する静的Webアプリです。

## 使い方

`index.html` をブラウザで開きます。デモコードは `BASE-A`、`BASE-B`、`BASE-C`、`BASE-D` です。

カメラQR読み取りは、対応ブラウザでは `BarcodeDetector` を使い、非対応ブラウザでは `jsQR` にフォールバックします。カメラが使えない環境でもコード入力と「試す」ボタンで同じチェックイン処理を確認できます。

ポイントと鍵スタンプは、最後のポイント獲得から60分経過した場合のみ付与されます。獲得ポイントに応じて1pt/10pt/100pt/1000ptの鍵スタンプを表示し、40ポイントで `むきあうかぎ`、80ポイントで `かんがえるかぎ` がクリア報酬として解放されます。

## GitHub Pages 公開

このリポジトリは GitHub Pages 用のワークフローを含んでいます。

1. GitHubでリポジトリを作成
2. このフォルダのファイルを `main` ブランチへpush
3. Settings → Pages → Build and deployment → Source を `GitHub Actions` に設定
4. Actions の `Deploy to GitHub Pages` が完了すると公開URLが発行されます

## ネイティブアプリ化

すぐにiPhoneアプリとして確認できるXcodeプロジェクトを `native/ios/MANABITankyuPoint.xcodeproj` に追加しています。Web版をWKWebViewに同梱し、カメラ権限文言も設定済みです。

```bash
open native/ios/MANABITankyuPoint.xcodeproj
```

XcodeでSigning Teamを選ぶと、iPhone実機へインストールして確認できます。QRカメラ読み取りは実機で確認してください。

Web側を変更したあと、iOS同梱ファイルを更新する場合:

```bash
node tools/build-native.mjs
```

署名なしのシミュレータ向けビルド確認:

```bash
xcodebuild -project native/ios/MANABITankyuPoint.xcodeproj -scheme MANABITankyuPoint -configuration Debug -sdk iphonesimulator -derivedDataPath .build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

CapacitorでiOS/Androidアプリとして生成する構成も追加しています。

```bash
npm install
npm run build
npx cap add ios
npx cap add android
npm run native:sync
```

iPhoneアプリとして確認する場合:

```bash
npm run native:ios
```

Androidアプリとして確認する場合:

```bash
npm run native:android
```

Capacitorで生成したネイティブプロジェクトには、カメラ権限が必要です。`npx cap add ios` / `npx cap add android` 実行後に、下記を設定してください。

- iOS: `ios/App/App/Info.plist` に `NSCameraUsageDescription` を追加
- Android: `android/app/src/main/AndroidManifest.xml` に `android.permission.CAMERA` を追加

権限文言例: `拠点QRを読み取るためにカメラを使用します。`

## 本番化の差し替えポイント

- `localStorage`: Firebase Firestore、Supabase、PostgreSQL などに変更
- `bases`: 管理画面で拠点、QRコード値、付与ポイントを管理
- `rewards`: カード条件、特典、画像URLをDB管理
- `renderAiMessage`: OpenAI APIでカード文言、カード画像プロンプト、次のおすすめ拠点を生成
- 不正対策: QR値を推測しにくいトークンにし、サーバー側で使用済み判定、位置情報、時間制限を検証

## 推奨データ構造

```txt
users/{userId}
  points
  createdAt

bases/{baseId}
  name
  qrToken
  points
  active

checkins/{checkinId}
  userId
  baseId
  points
  checkedInAt

rewards/{rewardId}
  title
  threshold
  body
  cardImageUrl

userRewards/{userRewardId}
  userId
  rewardId
  unlockedAt
```
