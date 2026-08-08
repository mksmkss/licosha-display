# licosha-display

Licosha写真展運営用ツールのWeb版。Google フォームの回答（Excelエクスポート）を読み込み、展示用のキャプションカード・名札・SNS用QRコードシート・作品説明カードをPDFとして一括生成する。

[Pythonデスクトップアプリ版](https://github.com/mksmkss/Display)（Tkinter/customtkinter）をTypeScriptで書き直したもの。サーバー不要、入力内容はブラウザ内で完結し、どこにも送信されない。

## 使い方

1. `index.html`（デプロイ後のURL）を開く
2. Excelファイル・年度・展示名を入力し、「生成する」を押す
3. 完了すると生成物一式（キャプション/名札/QRコード/説明の各PDFフォルダ、統合済みキャプションPDF、uuid列を追記したExcel）が1つのZIPとしてダウンロードされる

## 開発

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # 本番ビルド (dist/)
npm run preview  # ビルド結果をローカルで確認
```

## 構成

- `src/main.ts` — フォームUIの配線。生成処理本体（`src/lib/pipeline.ts`）は送信時に動的importされる（初期表示を軽くするため）
- `src/lib/excel.ts` — Excel読み書き（SheetJS）。列名マッピングやUUID採番など、旧Python版の`*/functions.py`群を1:1で移植
- `src/lib/qr.ts` — ロゴ入り角丸QRコード生成（Canvas 2D）。旧版の`qrcode_generate.py`を移植
- `src/lib/datamatrix.ts` — DataMatrix生成（[bwip-js](https://github.com/metafloor/bwip-js)）
- `src/lib/budoux.ts` — 日本語の自然な折り返し（[budoux](https://github.com/google/budoux)）
- `src/lib/pdf/*.ts` — 各PDF生成（[pdf-lib](https://github.com/Hopding/pdf-lib)）。旧版の`*/main.py`に対応
- `src/lib/zip.ts` — 生成物一式をZIPにまとめる（[JSZip](https://github.com/Stuk/jszip)）
- `assets/` — フォント・アイコンのライセンス同梱元。詳細は`assets/LICENSES.md`

旧Python版との差分（フォント差し替え、出力がZIPダウンロードになる点など）も`assets/LICENSES.md`と各ソースのコメントに記載している。

## 公開

GitHub Pages（`main`ブランチへのpushで`.github/workflows/deploy.yml`が自動ビルド・公開）。`vite.config.ts`の`base`はリポジトリ名に合わせて設定してあるため、リポジトリ名を変える場合は要更新。

## プライバシー

アップロードしたExcelファイルや生成されるPDF/画像は一切サーバーへ送信されない。すべてブラウザ内（クライアントサイド）で処理される。
