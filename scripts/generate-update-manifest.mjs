import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"));
const version = config.version;
const productName = "HangulBond";
const baseUrl = `https://github.com/da-itda/mac-nfd-nfc-hangulbond/releases/download/v${version}`;
const bundleRoot = new URL("src-tauri/target/release/bundle/", root);
const macosBundle = new URL("macos/", bundleRoot);
const dmgBundle = new URL("dmg/", bundleRoot);
const outRoot = new URL(`dist/hangulbond-release/${version}/`, root);
const latestJsonUrl = new URL("latest.json", outRoot);

const tarball = await findFile(macosBundle, ".app.tar.gz");
const signaturePath = `${tarball}.sig`;
const signature = (await readFile(signaturePath, "utf8")).trim();
const dmg = await findFile(dmgBundle, "_aarch64.dmg");

const macDir = new URL("darwin-aarch64/", outRoot);
await rm(outRoot, { recursive: true, force: true });
await mkdir(macDir, { recursive: true });

const updateFileName = `${productName}_${version}_darwin_aarch64.app.tar.gz`;
const signatureFileName = `${updateFileName}.sig`;
const dmgFileName = `${productName}_${version}_aarch64.dmg`;

await cp(tarball, new URL(updateFileName, macDir));
await cp(signaturePath, new URL(signatureFileName, macDir));
await cp(dmg, new URL(dmgFileName, macDir));

const latest = {
  version,
  notes: `한글본드 ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-aarch64-app": {
      signature,
      url: `${baseUrl}/${updateFileName}`
    },
    "darwin-aarch64": {
      signature,
      url: `${baseUrl}/${updateFileName}`
    }
  }
};

await writeFile(latestJsonUrl, `${JSON.stringify(latest, null, 2)}\n`);

console.log(`Prepared release files in ${outRoot.pathname}`);
console.log(`Attach latest.json and the darwin-aarch64 files to GitHub Release v${version}.`);

async function findFile(directoryUrl, suffix) {
  const entries = await readdir(directoryUrl);
  const match = entries.find((entry) => entry.endsWith(suffix));
  if (!match) {
    throw new Error(`Could not find *${suffix} in ${directoryUrl.pathname}`);
  }

  return join(directoryUrl.pathname, basename(match));
}
