const TEMPORARY_EXTENSIONS = new Set([
  ".tmp",
  ".temp",
  ".crdownload",
  ".part",
  ".download",
  ".swp",
  ".lock"
]);

const IGNORED_EXACT_NAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini"
]);

export function normalizeNameToNfc(name) {
  assertName(name);
  return name.normalize("NFC");
}

export function isNameNfc(name) {
  assertName(name);
  return name === normalizeNameToNfc(name);
}

export function isTemporaryOrIgnoredName(name) {
  assertName(name);

  if (IGNORED_EXACT_NAMES.has(name)) {
    return true;
  }

  if (name.startsWith("~$")) {
    return true;
  }

  if (name.startsWith(".")) {
    return true;
  }

  const lowerName = name.toLowerCase();
  for (const extension of TEMPORARY_EXTENSIONS) {
    if (lowerName.endsWith(extension)) {
      return true;
    }
  }

  return false;
}

export function analyzeName(name) {
  assertName(name);

  if (isTemporaryOrIgnoredName(name)) {
    return {
      originalName: name,
      normalizedName: name,
      shouldRename: false,
      reason: "ignored"
    };
  }

  const normalizedName = normalizeNameToNfc(name);

  if (normalizedName === name) {
    return {
      originalName: name,
      normalizedName,
      shouldRename: false,
      reason: "already-nfc"
    };
  }

  return {
    originalName: name,
    normalizedName,
    shouldRename: true,
    reason: "needs-normalization"
  };
}

export function createRenamePlan(name, existingNames = []) {
  assertName(name);
  assertExistingNames(existingNames);

  const analysis = analyzeName(name);

  if (!analysis.shouldRename) {
    return {
      ...analysis,
      action: "skip",
      finalName: name,
      collision: false
    };
  }

  const finalName = buildCollisionSafeName(
    analysis.normalizedName,
    new Set(existingNames)
  );

  return {
    ...analysis,
    action: "rename",
    finalName,
    collision: finalName !== analysis.normalizedName
  };
}

export function buildCollisionSafeName(targetName, existingNames) {
  assertName(targetName);

  const existingSet = existingNames instanceof Set
    ? existingNames
    : new Set(existingNames);

  if (!existingSet.has(targetName)) {
    return targetName;
  }

  const { baseName, extension } = splitNameAndExtension(targetName);
  let index = 1;
  let candidate = `${baseName}_${index}${extension}`;

  while (existingSet.has(candidate)) {
    index += 1;
    candidate = `${baseName}_${index}${extension}`;
  }

  return candidate;
}

function splitNameAndExtension(name) {
  const lastDotIndex = name.lastIndexOf(".");

  if (lastDotIndex <= 0) {
    return {
      baseName: name,
      extension: ""
    };
  }

  return {
    baseName: name.slice(0, lastDotIndex),
    extension: name.slice(lastDotIndex)
  };
}

function assertName(name) {
  if (typeof name !== "string") {
    throw new TypeError("name must be a string");
  }
}

function assertExistingNames(existingNames) {
  if (!Array.isArray(existingNames) && !(existingNames instanceof Set)) {
    throw new TypeError("existingNames must be an array or a set");
  }
}

