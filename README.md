# PDF Image Converter

Windows用のローカルPDF→画像変換アプリです。PDFや変換後の画像はPC内だけで処理します。

## 開発

```powershell
npm.cmd install
npm.cmd run dev
```

## Windowsインストーラーの作成

最初に無料の [Inno Setup 7](https://jrsoftware.org/isdl.php) を導入してください。標準のインストール先なら追加設定は不要です。Inno Setup 6も互換性があります。

```powershell
npm.cmd run dist:win
```

生成先は `dist/PDF Image Converter Setup <version>.exe` です。Inno Setupを標準以外の場所に導入した場合は、`ISCC.exe` の絶対パスを `INNO_SETUP_PATH` 環境変数に設定してください。

アプリ・インストーラー・タスクバーには `assets/app-icon.ico` を使用します。元画像は `assets/app-icon.png` です。

インストール後、PDFを右クリックすると **「PDF Image Converterで変換」** のサブメニューが表示されます。

- アプリで開く
- PNGに変換（標準）
- JPEGに変換（標準）

PNG／JPEG変換を選ぶと、標準設定（150 DPI相当、JPEG品質90）で「名前を付けて保存」を開き、保存後に変換を開始します。右クリックメニューはInno Setupのインストーラーで登録されるため、開発モードでは表示されません。

## GitHub Releasesによる更新確認

`package.json` の以下を実際のGitHubオーナー名・リポジトリ名に変更してください。

- `repository`
- `build.publish` の `owner` と `repo`

アプリは起動時と「アップデートを確認」操作時に最新Releaseを確認し、新しい版があればReleaseページをブラウザで開けます。更新のダウンロードやインストールは自動化しません。

## SVG出力について

SVGはPDFページをSVGコンテナに格納して出力します。PDFの複雑な描画内容を確実に保持するため、現在は画像として埋め込む互換出力です。
