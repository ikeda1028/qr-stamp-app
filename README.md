# 拠点スタンプ QR アプリ

スマホで拠点QRを読み取り、ポイントとスタンプを貯め、条件達成でカードを解放する静的Webアプリです。

## 使い方

`index.html` をブラウザで開きます。デモコードは `BASE-A`、`BASE-B`、`BASE-C`、`BASE-D` です。

カメラQR読み取りは、対応ブラウザでは `BarcodeDetector` を使い、非対応ブラウザでは `jsQR` にフォールバックします。カメラが使えない環境でもコード入力と「試す」ボタンで同じチェックイン処理を確認できます。

ポイントとスタンプは、最後のポイント獲得から60分経過した場合のみ付与されます。

## GitHub Pages 公開

このリポジトリは GitHub Pages 用のワークフローを含んでいます。

1. GitHubでリポジトリを作成
2. このフォルダのファイルを `main` ブランチへpush
3. Settings → Pages → Build and deployment → Source を `GitHub Actions` に設定
4. Actions の `Deploy to GitHub Pages` が完了すると公開URLが発行されます

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
