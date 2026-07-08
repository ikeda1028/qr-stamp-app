# MANABI探究ポイント iOS

追加依存なしでWeb版を同梱するiPhone向けWKWebViewアプリです。

## 更新

Web側を変更したあと、下記で `native/ios/Web` を更新します。

```bash
node tools/build-native.mjs
```

## Xcodeで開く

```bash
open native/ios/MANABITankyuPoint.xcodeproj
```

Xcodeで開いたら、Signing & Capabilities でTeamを選び、iPhone実機またはSimulatorで実行します。QRカメラ読み取りは実機で確認してください。
