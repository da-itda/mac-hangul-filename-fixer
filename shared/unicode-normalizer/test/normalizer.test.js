import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeName,
  buildCollisionSafeName,
  createRenamePlan,
  isNameNfc,
  isTemporaryOrIgnoredName,
  normalizeNameToNfc
} from "../src/index.js";

test("normalizes NFD Korean file names to NFC", () => {
  const cases = [
    ["한글.txt", "한글.txt"],
    ["가.txt", "가.txt"],
    ["test_한글.docx", "test_한글.docx"],
    ["2026_보고서.xlsx", "2026_보고서.xlsx"],
    ["공백 한글 파일.txt", "공백 한글 파일.txt"]
  ];

  for (const [input, expected] of cases) {
    assert.equal(normalizeNameToNfc(input), expected);
  }
});

test("detects names already in NFC", () => {
  const names = ["한글.txt", "보고서.pdf", "가나다.xlsx"];

  for (const name of names) {
    assert.equal(isNameNfc(name), true);
    assert.deepEqual(analyzeName(name), {
      originalName: name,
      normalizedName: name,
      shouldRename: false,
      reason: "already-nfc"
    });
  }
});

test("detects names that need normalization", () => {
  const plan = createRenamePlan("한글.pdf", []);

  assert.equal(plan.action, "rename");
  assert.equal(plan.originalName, "한글.pdf");
  assert.equal(plan.normalizedName, "한글.pdf");
  assert.equal(plan.finalName, "한글.pdf");
  assert.equal(plan.collision, false);
});

test("adds numeric suffix when normalized name already exists", () => {
  const plan = createRenamePlan("가.txt", ["가.txt", "가.txt"]);

  assert.equal(plan.action, "rename");
  assert.equal(plan.normalizedName, "가.txt");
  assert.equal(plan.finalName, "가_1.txt");
  assert.equal(plan.collision, true);
});

test("keeps incrementing suffix until a safe name is found", () => {
  const finalName = buildCollisionSafeName(
    "가.txt",
    ["가.txt", "가_1.txt", "가_2.txt"]
  );

  assert.equal(finalName, "가_3.txt");
});

test("ignores temporary, hidden, and known system files", () => {
  const names = [
    "보고서.tmp",
    "보고서.temp",
    "보고서.crdownload",
    "보고서.part",
    "보고서.download",
    "보고서.swp",
    "보고서.lock",
    "~$보고서.docx",
    ".숨김파일",
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini"
  ];

  for (const name of names) {
    assert.equal(isTemporaryOrIgnoredName(name), true);
    assert.equal(createRenamePlan(name).action, "skip");
  }
});

test("normalizes folder names with the same engine", () => {
  const plan = createRenamePlan("한글폴더");

  assert.equal(plan.action, "rename");
  assert.equal(plan.finalName, "한글폴더");
});
