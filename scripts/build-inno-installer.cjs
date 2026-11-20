const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const project = resolve(__dirname, "..");
const version = JSON.parse(readFileSync(resolve(project, "package.json"), "utf8")).version;
const candidates = [
  process.env.INNO_SETUP_PATH,
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Programs\\Inno Setup 7\\ISCC.exe`,
  "C:\\Program Files (x86)\\Inno Setup 7\\ISCC.exe",
  "C:\\Program Files\\Inno Setup 7\\ISCC.exe",
  "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
  "C:\\Program Files\\Inno Setup 6\\ISCC.exe"
].filter(Boolean);
const compiler = candidates.find(existsSync);

if (!compiler) {
  console.error("Inno Setup 6 が見つかりません。https://jrsoftware.org/isdl.php から導入するか、INNO_SETUP_PATH に ISCC.exe のパスを設定してください。");
  process.exit(1);
}

const result = spawnSync(compiler, [`/DAppVersion=${version}`, resolve(project, "installer", "PDFImageConverter.iss")], { stdio: "inherit" });
process.exit(result.status ?? 1);
