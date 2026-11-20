import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import type { AppSettings, OutputFile, PdfLaunchRequest, UpdateInfo } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let pendingPdfLaunch: PdfLaunchRequest | undefined;

const defaultSettings: AppSettings = {
  format: "png",
  qualityPreset: "standard",
  customScale: 1.5,
  imageQuality: 0.9
};

const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

function addRegistryString(key: string, value: string | undefined, data: string) {
  return new Promise<void>((resolve, reject) => {
    const args = ["add", key, "/f", "/t", "REG_SZ"];
    if (value === undefined) args.push("/ve");
    else args.push("/v", value);
    args.push("/d", data);
    execFile("reg.exe", args, { windowsHide: true }, (error) => error ? reject(error) : resolve());
  });
}

function deleteRegistryKey(key: string) {
  return new Promise<void>((resolve) => {
    execFile("reg.exe", ["delete", key, "/f"], { windowsHide: true }, () => resolve());
  });
}

async function registerPdfContextMenu() {
  if (!app.isPackaged) return;

  const executable = process.execPath;
  const command = (argumentsText = "") => "\"" + executable + "\"" + argumentsText + " \"%1\"";
  const shellRoot = "HKCU\\Software\\Classes\\SystemFileAssociations\\.pdf\\shell";
  const verbNames = ["PDFImageConverter.Open", "PDFImageConverter.Png", "PDFImageConverter.Jpeg"];

  await Promise.all([
    deleteRegistryKey(shellRoot + "\\PDFImageConverter"),
    ...verbNames.map((name) => deleteRegistryKey(shellRoot + "\\" + name))
  ]);

  const verbs: [string, string, string][] = [
    ["PDFImageConverter.Open", "PDF Image Converter\u3067\u5909\u63db", command()],
    ["PDFImageConverter.Png", "PNG\u306b\u5909\u63db\uFF08\u6A19\u6E96\uFF09", command(" --convert=png")],
    ["PDFImageConverter.Jpeg", "JPEG\u306b\u5909\u63db\uFF08\u6A19\u6E96\uFF09", command(" --convert=jpeg")]
  ];

  await Promise.all(verbs.flatMap(([name, label, commandLine]) => {
    const key = shellRoot + "\\" + name;
    return [
      addRegistryString(key, "MUIVerb", label),
      addRegistryString(key + "\\command", undefined, commandLine)
    ];
  }));
}

async function getSettings(): Promise<AppSettings> {
  try {
    return { ...defaultSettings, ...JSON.parse(await fs.readFile(settingsPath(), "utf8")) };
  } catch {
    return defaultSettings;
  }
}

async function saveSettings(settings: AppSettings) {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function getPdfLaunchRequest(args: string[]): PdfLaunchRequest | undefined {
  const filePath = args.find((arg) => arg.toLowerCase().endsWith(".pdf") && !arg.startsWith("--"));
  if (!filePath) return undefined;

  const format = args.find((arg) => /^--convert=(png|jpeg)$/i.test(arg))?.split("=")[1]?.toLowerCase();
  return {
    filePath,
    quickConvertFormat: format === "png" || format === "jpeg" ? format : undefined
  };
}

function notifyPdfToRenderer(request?: PdfLaunchRequest) {
  if (!request) return;
  if (!mainWindow || !rendererReady) {
    pendingPdfLaunch = request;
    return;
  }
  mainWindow.webContents.send("open-pdf", request);
}

function createWindow() {
  rendererReady = false;
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, "../../dist-renderer/index.html"));
  pendingPdfLaunch = getPdfLaunchRequest(process.argv);
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", (_event, args) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    notifyPdfToRenderer(getPdfLaunchRequest(args));
  });

  app.whenReady().then(() => {
    registerPdfContextMenu().catch(() => undefined);
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

ipcMain.handle("pick-pdf", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle("read-pdf", async (_event, filePath: string) => {
  const bytes = await fs.readFile(filePath);
  return {
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    name: path.basename(filePath),
    directory: path.dirname(filePath)
  };
});

ipcMain.handle("select-save-path", async (_event, options: {
  defaultPath: string;
  filters: { name: string; extensions: string[] }[];
}) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: options.defaultPath,
    filters: options.filters
  });
  return result.canceled ? undefined : result.filePath;
});

ipcMain.handle("path-exists", async (_event, target: string) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("save-output", async (_event, target: string, file: OutputFile, overwrite: boolean) => {
  if (!overwrite) {
    try {
      await fs.access(target);
      return { status: "exists" as const };
    } catch {
      // The destination does not yet exist.
    }
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), "." + randomUUID() + ".tmp");
  try {
    await fs.writeFile(temporary, Buffer.from(file.bytes));
    if (overwrite) await fs.rm(target, { force: true });
    await fs.rename(temporary, target);
    return { status: "saved" as const };
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
});

ipcMain.handle("open-folder", async (_event, filePath: string) => shell.showItemInFolder(filePath));
ipcMain.handle("get-settings", getSettings);
ipcMain.handle("save-settings", async (_event, settings: AppSettings) => saveSettings(settings));
ipcMain.handle("check-updates", async (): Promise<UpdateInfo> => {
  const repository = String((require("../../package.json") as { repository?: string }).repository || "");
  if (!repository || repository.startsWith("YOUR_")) {
    return { available: false, configured: false };
  }

  try {
    const response = await fetch(
      "https://api.github.com/repos/" + repository + "/releases/latest",
      { headers: { "User-Agent": "PDF-Image-Converter" } }
    );
    if (!response.ok) throw new Error("GitHub returned " + response.status);

    const release = await response.json() as { tag_name: string; body?: string; html_url: string };
    const latest = release.tag_name.replace(/^v/, "");
    const current = app.getVersion();
    const newer = latest.localeCompare(current, undefined, { numeric: true, sensitivity: "base" }) > 0;
    return {
      available: newer,
      configured: true,
      version: latest,
      notes: release.body || "",
      url: release.html_url
    };
  } catch {
    return { available: false, configured: true };
  }
});

ipcMain.handle("open-external", async (_event, url: string) => shell.openExternal(url));
ipcMain.on("renderer-ready", () => {
  rendererReady = true;
  const request = pendingPdfLaunch;
  pendingPdfLaunch = undefined;
  notifyPdfToRenderer(request);
});
