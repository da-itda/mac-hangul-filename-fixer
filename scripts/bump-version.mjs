import { readFile, writeFile } from "node:fs/promises";

const bumpKind = process.argv[2] ?? "patch";
const root = new URL("../", import.meta.url);

const packageUrl = new URL("package.json", root);
const packageLockUrl = new URL("package-lock.json", root);
const cargoUrl = new URL("src-tauri/Cargo.toml", root);
const tauriConfigUrl = new URL("src-tauri/tauri.conf.json", root);

const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
const nextVersion = nextSemver(packageJson.version, bumpKind);

packageJson.version = nextVersion;
await writeJson(packageUrl, packageJson);

const packageLock = JSON.parse(await readFile(packageLockUrl, "utf8"));
packageLock.version = nextVersion;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].version = nextVersion;
}
await writeJson(packageLockUrl, packageLock);

const cargoToml = await readFile(cargoUrl, "utf8");
await writeFile(
  cargoUrl,
  cargoToml.replace(/^version = "[^"]+"/m, `version = "${nextVersion}"`)
);

const tauriConfig = JSON.parse(await readFile(tauriConfigUrl, "utf8"));
tauriConfig.version = nextVersion;
await writeJson(tauriConfigUrl, tauriConfig);

console.log(nextVersion);

function nextSemver(current, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) {
    return kind;
  }

  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) {
    throw new Error(`Invalid current version: ${current}`);
  }

  let [, major, minor, patch] = match.map(Number);
  switch (kind) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      throw new Error(`Unknown bump kind: ${kind}`);
  }

  return `${major}.${minor}.${patch}`;
}

async function writeJson(url, value) {
  await writeFile(url, `${JSON.stringify(value, null, 2)}\n`);
}
