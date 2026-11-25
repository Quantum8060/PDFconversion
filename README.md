<div align="center">
  <img src="assets/app-icon.png" width="112" alt="PDF Image Converter icon">

  # PDF Image Converter

  **PDFを、必要な画像形式へ。**

  Windows上で完結する、シンプルなPDF画像変換アプリです。

  <p>
    <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows 10 and 11">
    <img src="https://img.shields.io/badge/Electron-33-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron">
    <a href="https://github.com/Quantum8060/PDFconversion/releases">
      <img src="https://img.shields.io/github/v/release/Quantum8060/PDFconversion?style=for-the-badge&logo=github&label=release" alt="Latest release">
    </a>
    <a href="https://github.com/Quantum8060/PDFconversion/commits/main">
      <img src="https://img.shields.io/github/last-commit/Quantum8060/PDFconversion?style=for-the-badge&logo=github&label=updated" alt="Last commit">
    </a>
    <img src="https://img.shields.io/badge/local%20processing-100%25-2E7D32?style=for-the-badge" alt="Local processing">
  </p>
</div>

---

## ✨ 概要

PDF Image Converter は、PDFの各ページを PNG / JPEG / WebP / SVG に変換する Windows 向けデスクトップアプリです。
PDFファイルと変換結果はPC内だけで処理され、外部サーバーへアップロードされません。

## 🚀 インストール

1. [Releases](https://github.com/Quantum8060/PDFconversion/releases) から PDF Image Converter Setup x.y.z.exe をダウンロードします。
2. セットアップを実行し、案内に従ってインストールします。
3. スタートメニュー、またはデスクトップのショートカットから起動します。

> [!NOTE]
> 現在のインストーラーはコード署名されていません。Windows の警告が出た場合は、内容を確認したうえで「詳細情報」から実行してください。

## 🖼️ 主な機能

| 機能 | 内容 |
| --- | --- |
| 入力 | PDFのドラッグ＆ドロップ、またはファイル選択 |
| 出力形式 | PNG / JPEG / WebP / SVG |
| 画像抽出 | 選択ページに埋め込まれた画像をPNGとしてZIPに保存 |
| ページ指定 | 全ページ、範囲、個別ページを指定可能 |
| 複数ページ | 変換結果をZIPファイルへまとめて出力 |
| 画質設定 | 用途に合わせた画質・解像度のプリセットと倍率指定 |
| プレビュー | PDF全体のサムネイルを表示 |
| パスワード付きPDF | パスワード入力を求めて読み込み |
| 保存 | ファイル名と保存先を指定して出力 |
| 設定保持 | 前回の形式・画質・倍率を次回起動時に復元 |

## 🖱️ エクスプローラーから使う

PDFを右クリックすると、次の項目からすぐに起動・変換できます。

- PDF Image Converterで変換
- PNGに変換（標準）
- JPEGに変換（標準）

PNG / JPEG の標準変換では、保存先とファイル名を選んでから変換を開始します。

## 🔒 プライバシー

- PDFの解析・変換はすべてローカルPC上で行います。
- PDFの内容や変換結果を外部サーバーへ送信しません。
- 更新確認時のみ、GitHub Releasesの公開情報を取得します。

## 🔄 アップデート

アプリの「アップデートを確認」から、新しいバージョンの有無を確認できます。
新しい版が見つかった場合は、ブラウザでReleaseページを開いてインストーラーをダウンロードします。

## 🛠️ 開発・ビルド

開発環境の準備、Windowsインストーラーの作成、GitHub Releasesの設定は [setup.md](setup.md) を参照してください。
