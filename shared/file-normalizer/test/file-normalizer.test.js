import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  normalizeDirectory,
  scanDirectory
} from "../src/index.js";

test("scans a folder and finds NFD file names", async () => {
  await withTempDirectory(async (directoryPath) => {
    await writeFile(join(directoryPath, "한글.txt"), "content");

    const result = await scanDirectory(directoryPath);

    assert.equal(result.targets.length, 1);
    assert.equal(result.targets[0].originalName, "한글.txt");
    assert.equal(result.targets[0].finalName, "한글.txt");
  });
});

test("renames an NFD file and preserves file content", async () => {
  await withTempDirectory(async (directoryPath) => {
    const originalPath = join(directoryPath, "한글.txt");
    const finalPath = join(directoryPath, "한글.txt");
    const content = "파일 내용은 바꾸지 않습니다.";

    await writeFile(originalPath, content);

    const result = await normalizeDirectory(directoryPath);

    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, "success");
    assert.equal(await readFile(finalPath, "utf8"), content);

    const names = await readdir(directoryPath);
    assert.deepEqual(names, ["한글.txt"]);
  });
});

test("does not overwrite an existing NFC file on collision", async (t) => {
  await withTempDirectory(async (directoryPath) => {
    if (!await supportsDistinctNormalizationNames(directoryPath)) {
      t.skip("current filesystem treats NFC and NFD spellings as the same path");
      return;
    }

    await writeFile(join(directoryPath, "가.txt"), "original");
    await writeFile(join(directoryPath, "가.txt"), "nfd");

    const result = await normalizeDirectory(directoryPath);

    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, "collision");
    assert.equal(result.results[0].finalName, "가_1.txt");
    assert.equal(await readFile(join(directoryPath, "가.txt"), "utf8"), "original");
    assert.equal(await readFile(join(directoryPath, "가_1.txt"), "utf8"), "nfd");
  });
});

test("renames child entries before parent directories", async () => {
  await withTempDirectory(async (directoryPath) => {
    const nfdDirectoryPath = join(directoryPath, "한글폴더");
    await mkdir(nfdDirectoryPath);
    await writeFile(join(nfdDirectoryPath, "가.txt"), "nested");

    const result = await normalizeDirectory(directoryPath);
    const finalDirectoryPath = join(directoryPath, "한글폴더");

    assert.deepEqual(
      result.results.map((entry) => entry.kind),
      ["file", "directory"]
    );
    assert.equal(await readFile(join(finalDirectoryPath, "가.txt"), "utf8"), "nested");
  });
});

test("keeps ignored temporary files unchanged", async () => {
  await withTempDirectory(async (directoryPath) => {
    const ignoredPath = join(directoryPath, "보고서.tmp");
    await writeFile(ignoredPath, "temporary");

    const result = await normalizeDirectory(directoryPath);

    assert.equal(result.results.length, 0);
    assert.equal(await readFile(ignoredPath, "utf8"), "temporary");
  });
});

async function withTempDirectory(callback) {
  const directoryPath = await mkdtemp(join(tmpdir(), "hangul-nfc-normalizer-"));

  try {
    await callback(directoryPath);
  } finally {
    await rm(directoryPath, { recursive: true, force: true });
  }
}

async function supportsDistinctNormalizationNames(directoryPath) {
  const probeDirectoryPath = join(directoryPath, "collision-probe");
  await mkdir(probeDirectoryPath);
  await writeFile(join(probeDirectoryPath, "가.txt"), "nfc");
  await writeFile(join(probeDirectoryPath, "가.txt"), "nfd");

  const names = await readdir(probeDirectoryPath);
  return names.length === 2;
}
