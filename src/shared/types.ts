export type OutputFormat = "png" | "jpeg" | "webp" | "svg";
export type QualityPreset = "light" | "standard" | "high" | "custom";

export interface AppSettings {
  format: OutputFormat;
  qualityPreset: QualityPreset;
  customScale: number;
  imageQuality: number;
  lastOutputDirectory?: string;
}

export interface OutputFile {
  name: string;
  bytes: ArrayBuffer;
}

export interface UpdateInfo {
  available: boolean;
  configured: boolean;
  version?: string;
  notes?: string;
  url?: string;
}

export interface PdfLaunchRequest {
  filePath: string;
  quickConvertFormat?: "png" | "jpeg";
}
