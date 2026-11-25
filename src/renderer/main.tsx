import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { BlobReader, BlobWriter, ZipWriter } from "@zip.js/zip.js";
import type { AppSettings, OutputFormat, QualityPreset, OutputFile, UpdateInfo } from "../shared/types";
import "./styles.css";
import { extractPageImages } from "./extract-images";

GlobalWorkerOptions.workerSrc = workerUrl;
const presets: Record<QualityPreset, { label: string; scale: number; quality: number; help: string }> = {
  light: { label: "軽量", scale: 1, quality: .8, help: "96 DPI相当・共有向け" },
  standard: { label: "標準", scale: 1.5, quality: .9, help: "150 DPI相当・通常利用向け" },
  high: { label: "高画質", scale: 3, quality: .95, help: "300 DPI相当・印刷向け" },
  custom: { label: "カスタム", scale: 1.5, quality: .9, help: "倍率と画質を指定" }
};
const formatLabels: Record<OutputFormat, string> = { png: "PNG", jpeg: "JPEG", webp: "WebP", svg: "SVG" };
const extension = (format: OutputFormat) => format === "jpeg" ? "jpg" : format;

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("画像の作成に失敗しました")), type, quality));
}
async function pageToCanvas(page: PDFPageProxy, scale: number) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvasを初期化できませんでした");
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}
async function svgFromCanvas(canvas: HTMLCanvasElement) {
  const png = await canvasBlob(canvas, "image/png");
  const data = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(png); });
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="${canvas.width}" height="${canvas.height}" href="${data}"/></svg>`], { type: "image/svg+xml" });
}
function parsePages(value: string, total: number): number[] | undefined {
  const set = new Set<number>();
  if (!value.trim()) return undefined;
  for (const unit of value.split(",")) {
    const [from, to] = unit.trim().split("-").map((n) => Number(n.trim()));
    if (!Number.isInteger(from) || (to !== undefined && !Number.isInteger(to))) return undefined;
    const end = to ?? from; if (from < 1 || end < from || end > total) return undefined;
    for (let n = from; n <= end; n++) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}
function compactPages(pages: number[]) { return pages.join(", "); }
function fileStem(name: string) { return name.replace(/\.pdf$/i, "") || "converted"; }

type PasswordPrompt = { submit: (value: string) => void; invalid: boolean };
type ConversionJob = { document: PDFDocumentProxy; info: { path: string; name: string; directory: string }; pages: number[]; format: OutputFormat; scale: number; quality: number };
function App() {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pdfInfo, setPdfInfo] = useState<{ path: string; name: string; directory: string }>();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pageText, setPageText] = useState("");
  const [settings, setSettings] = useState<AppSettings>({ format: "png", qualityPreset: "standard", customScale: 1.5, imageQuality: .9 });
  const [progress, setProgress] = useState<{ percent: number; label: string }>();
  const [toast, setToast] = useState<string>();
  const [error, setError] = useState<string>();
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPrompt>();
  const [overwritePath, setOverwritePath] = useState<string>();
  const [extractedOutput, setExtractedOutput] = useState<{ target: string; file: OutputFile }>();
  const [lastOutput, setLastOutput] = useState<string>();
  const [update, setUpdate] = useState<UpdateInfo>();
  const [dragging, setDragging] = useState(false);
  const cancelRef = useRef(false);
  const thumbRefs = useRef(new Map<number, HTMLCanvasElement>());

  useEffect(() => {
    window.desktop.getSettings().then(setSettings);
    window.desktop.checkUpdates().then((result) => { if (result.available) setUpdate(result); });
    const unsubscribe = window.desktop.onOpenPdf((request) => openPath(request.filePath, request.quickConvertFormat));
    window.desktop.rendererReady();
    return unsubscribe;
  }, []);
  useEffect(() => { window.desktop.saveSettings(settings); }, [settings]);
  useEffect(() => {
    if (!pdf) return;
    let stale = false;
    const draw = async () => {
      for (let n = 1; n <= pdf.numPages; n++) {
        const canvas = thumbRefs.current.get(n); if (!canvas || stale) continue;
        const page = await pdf.getPage(n); const view = page.getViewport({ scale: .22 });
        canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
        const ctx = canvas.getContext("2d"); if (ctx) await page.render({ canvasContext: ctx, viewport: view }).promise;
      }
    };
    draw().catch(() => undefined); return () => { stale = true; };
  }, [pdf]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(undefined), 5000); return () => window.clearTimeout(timer); }, [toast]);

  async function openPath(path: string, quickConvertFormat?: "png" | "jpeg") {
    setError(undefined); setLastOutput(undefined); setProgress(undefined); cancelRef.current = false;
    try {
      const source = await window.desktop.readPdf(path);
      const task = getDocument({ data: new Uint8Array(source.bytes) });
      task.onPassword = (submit: (password: string) => void, reason: number) => setPasswordPrompt({ submit, invalid: reason === 2 });
      const loaded = await task.promise;
      const info = { path, name: source.name, directory: source.directory };
      setPdf(loaded); setPdfInfo(info);
      const initial = new Set(Array.from({ length: loaded.numPages }, (_, i) => i + 1)); setSelected(initial); setPageText(`1-${loaded.numPages}`);
      if (quickConvertFormat) {
        setSettings((current) => ({ ...current, format: quickConvertFormat, qualityPreset: "standard" }));
        await quickConvert(loaded, info, [...initial], quickConvertFormat);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDFを開けませんでした"); }
  }
  async function choosePdf() { const path = await window.desktop.pickPdf(); if (path) await openPath(path); }
  function updatePageText(value: string) {
    setPageText(value); if (!pdf) return; const pages = parsePages(value, pdf.numPages); if (pages) setSelected(new Set(pages));
  }
  function togglePage(page: number) {
    const next = new Set(selected); next.has(page) ? next.delete(page) : next.add(page); setSelected(next); setPageText(compactPages([...next].sort((a, b) => a - b)));
  }
  const scale = settings.qualityPreset === "custom" ? settings.customScale : presets[settings.qualityPreset].scale;
  const quality = settings.qualityPreset === "custom" ? settings.imageQuality : presets[settings.qualityPreset].quality;
  function defaultOutputPath() {
    if (!pdfInfo) return ""; const multiple = selected.size > 1; return `${pdfInfo.directory}\\${fileStem(pdfInfo.name)}.${multiple ? "zip" : extension(settings.format)}`;
  }
  function outputPathFor(info: { name: string; directory: string }, pages: number[], format: OutputFormat) {
    return `${info.directory}\\${fileStem(info.name)}.${pages.length > 1 ? "zip" : extension(format)}`;
  }
  async function quickConvert(document: PDFDocumentProxy, info: { path: string; name: string; directory: string }, pages: number[], format: "png" | "jpeg") {
    const target = await window.desktop.selectSavePath({ defaultPath: outputPathFor(info, pages, format), filters: pages.length > 1 ? [{ name: "ZIP", extensions: ["zip"] }] : [{ name: formatLabels[format], extensions: [extension(format)] }] });
    if (!target) return;
    await performConversion(target, false, { document, info, pages, format, scale: presets.standard.scale, quality: presets.standard.quality });
  }
  async function convert(overwrite = false) {
    if (!pdf || !pdfInfo || !selected.size) return;
    setError(undefined); setLastOutput(undefined); cancelRef.current = false;
    const target = await window.desktop.selectSavePath({ defaultPath: defaultOutputPath(), filters: selected.size > 1 ? [{ name: "ZIP", extensions: ["zip"] }] : [{ name: formatLabels[settings.format], extensions: [extension(settings.format)] }] });
    if (!target) return;
    await performConversion(target, overwrite);
  }
  async function performConversion(target: string, overwrite = false, explicitJob?: ConversionJob) {
    if (!explicitJob && (!pdf || !pdfInfo)) return;
    const job: ConversionJob = explicitJob ?? { document: pdf!, info: pdfInfo!, pages: [...selected].sort((a, b) => a - b), format: settings.format, scale, quality };
    const pages = job.pages; setProgress({ percent: 0, label: "変換を準備中…" }); cancelRef.current = false;
    try {
      const converted: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < pages.length; i++) {
        if (cancelRef.current) throw new Error("__CANCELLED__");
        const page = await job.document.getPage(pages[i]); const canvas = await pageToCanvas(page, job.scale);
        const mime = job.format === "jpeg" ? "image/jpeg" : job.format === "webp" ? "image/webp" : "image/png";
        const blob = job.format === "svg" ? await svgFromCanvas(canvas) : await canvasBlob(canvas, mime, job.quality);
        converted.push({ name: `${fileStem(job.info.name)}-${String(pages[i]).padStart(2, "0")}.${extension(job.format)}`, blob });
        setProgress({ percent: Math.round(((i + 1) / pages.length) * 90), label: `変換中：${i + 1} / ${pages.length}ページ` });
      }
      if (cancelRef.current) throw new Error("__CANCELLED__");
      let output: OutputFile;
      if (converted.length === 1) output = { name: converted[0].name, bytes: await converted[0].blob.arrayBuffer() };
      else {
        setProgress({ percent: 92, label: "ZIPファイルを作成中…" });
        const writer = new ZipWriter(new BlobWriter("application/zip"));
        for (const item of converted) { if (cancelRef.current) throw new Error("__CANCELLED__"); await writer.add(item.name, new BlobReader(item.blob)); }
        const zip = await writer.close(); output = { name: `${fileStem(job.info.name)}.zip`, bytes: await zip.arrayBuffer() };
      }
      if (cancelRef.current) throw new Error("__CANCELLED__");
      const saved = await window.desktop.saveOutput(target, output, overwrite);
      if (saved.status === "exists") { setProgress(undefined); setOverwritePath(target); return; }
      setProgress({ percent: 100, label: "変換が完了しました" }); setLastOutput(target); setToast("変換が完了しました");
      window.setTimeout(() => setProgress(undefined), 900);
    } catch (cause) {
      setProgress(undefined);
      if ((cause as Error).message === "__CANCELLED__") setToast("変換を中止しました。ファイルは保存されていません。");
      else setError(cause instanceof Error ? cause.message : "変換に失敗しました");
    }
  }
  async function retrySave() { if (!overwritePath) return; const old = overwritePath; setOverwritePath(undefined); const picked = await window.desktop.selectSavePath({ defaultPath: old, filters: [{ name: "出力ファイル", extensions: ["*"] }] }); if (picked) await performConversion(picked); }

  async function saveExtracted(target: string, file: OutputFile, overwrite = false) {
    const result = await window.desktop.saveOutput(target, file, overwrite);
    if (result.status === "exists") { setExtractedOutput({ target, file }); return; }
    setExtractedOutput(undefined); setLastOutput(target); setToast("画像の抽出が完了しました");
  }
  async function extractImages() {
    if (!pdf || !pdfInfo || !selected.size) return;
    const pages = [...selected].sort((a, b) => a - b);
    const name = `${fileStem(pdfInfo.name)}-images.zip`;
    const target = await window.desktop.selectSavePath({ defaultPath: `${pdfInfo.directory}\\${name}`, filters: [{ name: "ZIP", extensions: ["zip"] }] });
    if (!target) return;
    setError(undefined); setLastOutput(undefined); cancelRef.current = false;
    setProgress({ percent: 0, label: "画像を抽出中…" });
    try {
      const images: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < pages.length; i++) {
        if (cancelRef.current) throw new Error("__CANCELLED__");
        const found = await extractPageImages(await pdf.getPage(pages[i]));
        found.forEach((blob, index) => images.push({ name: `page-${String(pages[i]).padStart(2, "0")}-image-${String(index + 1).padStart(2, "0")}.png`, blob }));
        setProgress({ percent: Math.round((i + 1) / pages.length * 90), label: `画像を抽出中：${i + 1} / ${pages.length}ページ` });
      }
      if (cancelRef.current) throw new Error("__CANCELLED__");
      if (!images.length) { setToast("選択したページに抽出できる画像がありませんでした"); return; }
      setProgress({ percent: 92, label: "ZIPファイルを作成中…" });
      const writer = new ZipWriter(new BlobWriter("application/zip"));
      for (const image of images) { if (cancelRef.current) throw new Error("__CANCELLED__"); await writer.add(image.name, new BlobReader(image.blob)); }
      const zip = await writer.close();
      if (cancelRef.current) throw new Error("__CANCELLED__");
      await saveExtracted(target, { name, bytes: await zip.arrayBuffer() });
    } catch (cause) {
      if ((cause as Error).message === "__CANCELLED__") setToast("画像の抽出を中止しました。ファイルは保存されていません。");
      else setError(cause instanceof Error ? cause.message : "画像の抽出に失敗しました");
    } finally { setProgress(undefined); }
  }

  return <main onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; const droppedPath = file ? window.desktop.getPathForFile(file) : ""; if (droppedPath.toLowerCase().endsWith(".pdf")) openPath(droppedPath); else setError("PDFファイルをドロップしてください。"); }}>
    {progress && <div className="progress"><div className="progress-fill" style={{ width: `${progress.percent}%` }} /><span>{progress.label}（{progress.percent}%）</span><button onClick={() => { cancelRef.current = true; }}>中止</button></div>}
    <header><div className="brand">PDF Image Converter</div><div className="header-actions"><button className="quiet" onClick={() => window.desktop.checkUpdates().then((r) => r.available ? setUpdate(r) : setToast("現在のバージョンは最新です"))}>アップデートを確認</button><button onClick={choosePdf}>PDFを開く</button></div></header>
    {update && <div className="update"><div><strong>バージョン {update.version} を利用できます</strong><small>{update.notes || "GitHub Releasesから新しいインストーラーをダウンロードできます。"}</small></div><button onClick={() => update.url && window.desktop.openExternal(update.url)}>ダウンロードページを開く</button><button className="quiet" onClick={() => setUpdate(undefined)}>閉じる</button></div>}
    {!pdf && <section className={`drop-zone ${dragging ? "dragging" : ""}`}><h1>PDFを画像に変換</h1><p>PDFをここへドラッグ＆ドロップするか、ファイルを選択してください。</p><button onClick={choosePdf}>PDFを選択</button></section>}
    {pdf && pdfInfo && <section className="workspace"><aside><div className="doc-title" title={pdfInfo.name}>{pdfInfo.name}</div><div className="page-count">{selected.size ? `${Math.min(...selected)} / ${pdf.numPages} ページ` : `0 / ${pdf.numPages} ページ`}</div><div className="thumbnails">{Array.from({ length: pdf.numPages }, (_, index) => { const page = index + 1; return <button key={page} className={`thumbnail ${selected.has(page) ? "selected" : ""}`} onClick={() => togglePage(page)}><canvas ref={(node) => { if (node) thumbRefs.current.set(page, node); else thumbRefs.current.delete(page); }} /><span>{page}</span></button>; })}</div></aside>
      <section className="controls"><h1>{pdfInfo.name}</h1><p className="muted">全 {pdf.numPages} ページ</p><label>ページ範囲<input value={pageText} onChange={(e) => updatePageText(e.target.value)} placeholder="例: 1-3, 5" /></label><small>サムネイルのクリックでも選択できます。{selected.size}ページを選択中</small>
        <fieldset><legend>出力形式</legend>{(Object.keys(formatLabels) as OutputFormat[]).map((format) => <label className="choice" key={format}><input type="radio" checked={settings.format === format} onChange={() => setSettings({ ...settings, format })}/>{formatLabels[format]}</label>)}</fieldset>
        <fieldset><legend>画質・解像度</legend>{(Object.keys(presets) as QualityPreset[]).map((preset) => <label className="choice" key={preset}><input type="radio" checked={settings.qualityPreset === preset} onChange={() => setSettings({ ...settings, qualityPreset: preset })}/>{presets[preset].label}<small>{presets[preset].help}</small></label>)}{settings.qualityPreset === "custom" && <div className="custom"><label>倍率<input type="number" min="0.5" max="6" step="0.1" value={settings.customScale} onChange={(e) => setSettings({ ...settings, customScale: Number(e.target.value) })}/></label>{settings.format !== "png" && settings.format !== "svg" && <label>画質<input type="number" min="1" max="100" value={Math.round(settings.imageQuality * 100)} onChange={(e) => setSettings({ ...settings, imageQuality: Number(e.target.value) / 100 })}/></label>}</div>}</fieldset>
        <div className="save-note">変換開始時に、元PDFと同じフォルダーを初期表示した「名前を付けて保存」画面が開きます。</div>
        <div className="actions"><button className="primary" disabled={!selected.size || !!progress} onClick={() => convert()}>変換を開始</button><button className="secondary" disabled={!selected.size || !!progress} onClick={extractImages}>画像だけを抽出</button></div>
        <small>抽出では選択ページ内の画像をPNGとしてZIPに保存します。文字・図形や画像の配置は含まれません。</small>
        {lastOutput && <div className="result">変換完了 <button onClick={() => window.desktop.openFolder(lastOutput)}>出力フォルダーを開く</button></div>}
      </section></section>}
    {error && <div className="modal"><div className="dialog"><h2>エラー</h2><p>{error}</p><button onClick={() => setError(undefined)}>閉じる</button></div></div>}
    {passwordPrompt && <PasswordDialog invalid={passwordPrompt.invalid} onSubmit={(value) => { passwordPrompt.submit(value); setPasswordPrompt(undefined); }} />}
    {overwritePath && <div className="modal"><div className="dialog"><h2>同名のファイルがあります</h2><p>{overwritePath}</p><div className="dialog-actions"><button onClick={() => { const target = overwritePath; setOverwritePath(undefined); performConversion(target, true); }}>上書き</button><button onClick={retrySave}>再試行</button><button className="quiet" onClick={() => { setOverwritePath(undefined); setToast("出力をスキップしました"); }}>スキップ</button></div></div></div>}
    {extractedOutput && <div className="modal"><div className="dialog"><h2>同名のファイルがあります</h2><p>{extractedOutput.target}</p><div className="dialog-actions"><button onClick={() => { saveExtracted(extractedOutput.target, extractedOutput.file, true).catch((cause) => setError(String(cause))); }}>上書き</button><button onClick={async () => { const picked = await window.desktop.selectSavePath({ defaultPath: extractedOutput.target, filters: [{ name: "ZIP", extensions: ["zip"] }] }); if (picked) await saveExtracted(picked, extractedOutput.file).catch((cause) => setError(String(cause))); }}>別の名前で保存</button><button className="quiet" onClick={() => setExtractedOutput(undefined)}>キャンセル</button></div></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
function PasswordDialog({ invalid, onSubmit }: { invalid: boolean; onSubmit: (value: string) => void }) { const [value, setValue] = useState(""); return <div className="modal"><form className="dialog" onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}><h2>パスワード付きPDF</h2><p>{invalid ? "パスワードが正しくありません。もう一度入力してください。" : "このPDFを開くにはパスワードが必要です。"}</p><input autoFocus type="password" value={value} onChange={(e) => setValue(e.target.value)} /><div className="dialog-actions"><button type="submit">開く</button></div></form></div>; }
createRoot(document.getElementById("root")!).render(<App />);
