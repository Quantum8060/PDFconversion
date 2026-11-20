import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { AppSettings, OutputFile, PdfLaunchRequest, UpdateInfo } from "../shared/types";

const api = {
  pickPdf: () => ipcRenderer.invoke("pick-pdf") as Promise<string | undefined>,
  readPdf: (filePath: string) => ipcRenderer.invoke("read-pdf", filePath) as Promise<{ bytes: ArrayBuffer; name: string; directory: string }>,
  selectSavePath: (options: { defaultPath: string; filters: { name: string; extensions: string[] }[] }) => ipcRenderer.invoke("select-save-path", options) as Promise<string | undefined>,
  pathExists: (filePath: string) => ipcRenderer.invoke("path-exists", filePath) as Promise<boolean>,
  saveOutput: (target: string, file: OutputFile, overwrite: boolean) => ipcRenderer.invoke("save-output", target, file, overwrite) as Promise<{ status: "saved" | "exists" }>,
  openFolder: (filePath: string) => ipcRenderer.invoke("open-folder", filePath),
  getSettings: () => ipcRenderer.invoke("get-settings") as Promise<AppSettings>,
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke("save-settings", settings),
  checkUpdates: () => ipcRenderer.invoke("check-updates") as Promise<UpdateInfo>,
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  rendererReady: () => ipcRenderer.send("renderer-ready"),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onOpenPdf: (callback: (request: PdfLaunchRequest) => void) => { const listener = (_: Electron.IpcRendererEvent, request: PdfLaunchRequest) => callback(request); ipcRenderer.on("open-pdf", listener); return () => ipcRenderer.removeListener("open-pdf", listener); }
};
contextBridge.exposeInMainWorld("desktop", api);
