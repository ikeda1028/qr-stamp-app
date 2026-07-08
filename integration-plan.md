# DB / AI 連携設計メモ

## 最小構成

- フロント: スマホ向けWebアプリ、またはPWA
- 認証: Firebase Auth、Supabase Auth、LINEログインなど
- DB: Firestore / Supabase / PostgreSQL
- AI: OpenAI API
- 管理画面: 拠点、QRトークン、カード、解放条件を登録

## チェックインAPI

```http
POST /api/checkins
Authorization: Bearer <user token>
Content-Type: application/json

{
  "qrToken": "BASE-A-or-secure-token",
  "lat": 35.0000,
  "lng": 139.0000
}
```

サーバー側で検証すること:

- QRトークンが有効か
- 同じユーザーが同じ拠点で重複取得していないか
- 位置情報や時間制限が必要なら条件内か
- ポイント加算後に解放されるカードがあるか

## AI生成API

```http
POST /api/ai/recommendation
Authorization: Bearer <user token>
Content-Type: application/json

{
  "userId": "user_123",
  "latestBaseId": "base_a",
  "stampCount": 3
}
```

生成できるもの:

- 次に行くおすすめ拠点
- 解放カードの説明文
- カード画像生成用プロンプト
- ユーザー別の短い称号や達成メッセージ

## OpenAIプロンプト例

```txt
あなたは地域周遊スタンプアプリの案内AIです。
ユーザーの訪問履歴、未訪問拠点、現在のスタンプ数をもとに、
次のおすすめ拠点を1つ、30文字以内の達成メッセージを1つ、
カード画像生成用の短いプロンプトを1つ返してください。
JSONだけを返してください。
```

## 不正対策

- QR文字列は `BASE-A` のような推測可能な値ではなく、ランダムな長いトークンにする
- QRトークンを定期的にローテーションできるようにする
- チェックイン判定はフロントではなく必ずサーバー側で行う
- 重要な特典はユーザーID、拠点ID、日時を監査ログとして残す
