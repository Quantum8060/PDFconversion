import { ImageKind, OPS, type PDFPageProxy } from "pdfjs-dist";

type PdfImage = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray; bitmap?: ImageBitmap };
type ImageRegion = { x: number; y: number; w: number; h: number };

function imageCanvas(image: PdfImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !image.width || !image.height) throw new Error("画像を読み込めませんでした");
  if (image.bitmap) { ctx.drawImage(image.bitmap, 0, 0); return canvas; }
  if (!image.data) throw new Error("PDF内の画像データを読み込めませんでした");
  const pixels = ctx.createImageData(image.width, image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = y * image.width + x, dest = i * 4;
      if (image.kind === ImageKind.GRAYSCALE_1BPP) {
        const value = image.data[y * Math.ceil(image.width / 8) + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0;
        pixels.data[dest] = pixels.data[dest + 1] = pixels.data[dest + 2] = value;
        pixels.data[dest + 3] = 255;
      } else if (image.kind === ImageKind.RGB_24BPP || image.kind === ImageKind.RGBA_32BPP) {
        const channels = image.kind === ImageKind.RGB_24BPP ? 3 : 4;
        pixels.data[dest] = image.data[i * channels]; pixels.data[dest + 1] = image.data[i * channels + 1]; pixels.data[dest + 2] = image.data[i * channels + 2];
        pixels.data[dest + 3] = channels === 4 ? image.data[i * channels + 3] : 255;
      } else throw new Error("対応していない画像形式がPDFに含まれています");
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

async function png(image: PdfImage, region?: ImageRegion): Promise<Blob> {
  let canvas = imageCanvas(image);
  if (region) {
    const cropped = document.createElement("canvas"); cropped.width = region.w; cropped.height = region.h;
    const ctx = cropped.getContext("2d");
    if (!ctx) throw new Error("画像を読み込めませんでした");
    ctx.drawImage(canvas, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    canvas = cropped;
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("画像の作成に失敗しました")), "image/png"));
}

export async function extractPageImages(page: PDFPageProxy): Promise<Blob[]> {
  const list = await page.getOperatorList();
  const images: Blob[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < list.fnArray.length; i++) {
    const op = list.fnArray[i], args = list.argsArray[i];
    if (op === OPS.paintImageXObject || op === OPS.paintImageXObjectRepeat) {
      const id = args[0] as string;
      if (seen.has(id)) continue;
      seen.add(id);
      const objects = id.startsWith("g_") ? page.commonObjs : page.objs;
      const image = await new Promise<PdfImage | null>(resolve => objects.get(id, resolve));
      if (!image) throw new Error("PDF内の画像を読み込めませんでした");
      images.push(await png(image));
    } else if (op === OPS.paintInlineImageXObject) {
      images.push(await png(args[0] as PdfImage));
    } else if (op === OPS.paintInlineImageXObjectGroup) {
      for (const region of args[1] as ImageRegion[]) images.push(await png(args[0] as PdfImage, region));
    }
  }
  return images;
}
