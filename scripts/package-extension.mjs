// 브라우저 확장을 Chrome 웹 스토어 제출용 zip으로 묶는다.
// 결과: dist/browser-extension/hangulbond-extension-<version>.zip
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const extensionDir = fileURLToPath(new URL("browser-extension/extension/", root));
const { version } = JSON.parse(readFileSync(new URL("manifest.json", `file://${extensionDir}`), "utf8"));
const outDir = fileURLToPath(new URL("dist/browser-extension/", root));
const zipPath = `${outDir}hangulbond-extension-${version}.zip`;

mkdirSync(outDir, { recursive: true });
rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", "-X", "-q", zipPath, ".", "-x", "*.DS_Store"], { cwd: extensionDir });

console.log(zipPath);
console.log(execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" }));
