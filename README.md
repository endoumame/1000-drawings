# 1000-drawings

人体ドローイングの練習記録をつける PWA。30秒ドローイングと90秒ドローイングを、それぞれ1000体からカウントダウンする。

公開先：https://endoumame.github.io/1000-drawings/

スマホで開いて「ホーム画面に追加」すると、アプリとして使える。記録はその端末のブラウザの中に保存されるので、設定画面からときどき書き出しておく。

仕様とデザインの決まりごとは [`docs/HANDOFF.md`](docs/HANDOFF.md) にまとめている。

## 開発

```sh
npm install
npm run dev     # 開発用サーバー（http://localhost:5173/1000-drawings/）
npm test        # テスト
npm run build   # 型チェックと本番用のビルド
```

main に入ると GitHub Actions がテストとビルドをして、GitHub Pages に公開する。
