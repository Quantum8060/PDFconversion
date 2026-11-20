/// <reference types="vite/client" />
import type { AppSettings, OutputFile, PdfLaunchRequest, UpdateInfo } from "../shared/types";
declare global {
  interface Window {
    desktop: {
      pickPdf(): Promise<string | undefined>;
      readPdf(path: string): Promise<{ bytes: ArrayBuffer; name: string; directory: string }>;
      selectSavePath(options: { defaultPath: string; filters: { name: string; extensions: string[] }[] }): Promise<string | undefined>;
      pathExists(path: string): Promise<boolean>;
      saveOutput(path: string, file: OutputFile, overwrite: boolean): Promise<{ status: "saved" | "exists" }>;
      openFolder(path: string): Promise<void>;
      getSettings(): Promise<AppSettings>;
      saveSettings(settings: AppSettings): Promise<void>;
      checkUpdates(): Promise<UpdateInfo>;
      openExternal(url: string): Promise<void>;
      rendererReady(): void;
      getPathForFile(file: File): string;
      onOpenPdf(callback: (request: PdfLaunchRequest) => void): () => void;
    };
  }
}
export {};
