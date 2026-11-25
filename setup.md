# 開発・配布セットアップ

PDF Image Converter の開発、インストーラー作成、GitHub Releases による更新確認を設定するための手順です。

## 開発

依存パッケージを導入し、開発モードを起動します。

~~~powershell
npm.cmd install
npm.cmd run dev
~~~

## Windowsインストーラーの作成

最初に [Inno Setup 7](https://jrsoftware.org/isdl.php) を導入してください。標準のインストール先なら追加設定は不要です。

~~~powershell
npm.cmd run dist:win
~~~

インストーラーは次の場所に生成されます。

~~~text
release\PDF Image Converter Setup <version>.exe
~~~

Inno Setup を標準以外の場所に導入した場合は、ISCC.exe の絶対パスを INNO_SETUP_PATH 環境変数に設定してください。

~~~powershell
$env:INNO_SETUP_PATH = "C:\path\to\ISCC.exe"
npm.cmd run dist:win
~~~

アプリ・インストーラー・タスクバーには assets/app-icon.ico を使用します。元画像は assets/app-icon.png です。

## 右クリックメニュー

インストール後、PDFを右クリックすると、次の項目が表示されます。

- PDF Image Converterで変換
- PNGに変換（標準）
- JPEGに変換（標準）

右クリックメニューはインストーラーで登録されるため、開発モードでは表示されません。アプリをアンインストールすると、関連する登録も削除されます。

## GitHub Releasesによる更新確認

package.json の以下を、実際のGitHubオーナー名・リポジトリ名に変更してください。

- repository
- build.publish の owner
- build.publish の repo

アプリは「アップデートを確認」操作時に最新Releaseを確認し、新しい版があればReleaseページをブラウザで開けます。更新ファイルのダウンロード・インストールは自動化しません。

リリース時は、アプリのバージョンとGitHub Releaseのタグを合わせます。

~~~text
package.json: 1.0.1
GitHub Release: v1.0.1
~~~

## SVG出力について

SVGはPDFページをSVGコンテナに格納して出力します。PDFの複雑な描画内容を確実に保持するため、現在は画像として埋め込む互換出力です。

## 画像抽出について

「画像だけを抽出」は、選択ページに含まれる画像をPNGに変換し、ZIPに保存します。元の画像形式、ページ上の配置、文字やベクター図形は保持しません。描画用のマスクなど、独立した画像ではない要素は対象外です。同じページで繰り返し使われる画像は1回だけ出力される場合があります。
