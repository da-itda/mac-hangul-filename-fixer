import { readdir, rename, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import {
  buildCollisionSafeName,
  createRenamePlan,
  isTemporaryOrIgnoredName
} from "../../unicode-normalizer/src/index.js";

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules"
]);

export async function scanDirectory(rootPath, options = {}) {
  const resolvedRootPath = resolve(rootPath);
  const recursive = options.recursive ?? true;
  const targets = [];

  await walkDirectory(resolvedRootPath, {
    recursive,
    targets
  });

  return {
    rootPath: resolvedRootPath,
    recursive,
    targets
  };
}

export async function normalizeDirectory(rootPath, options = {}) {
  const dryRun = options.dryRun ?? false;
  const scan = await scanDirectory(rootPath, options);
  const results = [];

  for (const target of scan.targets) {
    if (dryRun) {
      results.push({
        status: "dry-run",
        ...target
      });
      continue;
    }

    results.push(await applyRenameTarget(target));
  }

  return {
    ...scan,
    dryRun,
    results
  };
}

async function walkDirectory(directoryPath, context) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const reservedNames = new Set(entries.map((entry) => entry.name));

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory() && context.recursive && !isExcludedDirectoryName(entry.name)) {
      await walkDirectory(entryPath, context);
    }

    if (!entry.isFile() && !entry.isDirectory()) {
      continue;
    }

    const plan = createRenamePlan(entry.name, reservedNames);

    if (!plan.shouldRename) {
      continue;
    }

    reservedNames.add(plan.finalName);
    context.targets.push({
      kind: entry.isDirectory() ? "directory" : "file",
      path: entryPath,
      parentPath: directoryPath,
      depth: getPathDepth(entryPath),
      originalName: plan.originalName,
      normalizedName: plan.normalizedName,
      finalName: plan.finalName,
      collision: plan.collision
    });
  }
}

async function applyRenameTarget(target) {
  try {
    const safeTarget = await refreshCollisionTarget(target);
    const finalPath = join(safeTarget.parentPath, safeTarget.finalName);

    await rename(safeTarget.path, finalPath);

    return {
      status: safeTarget.collision ? "collision" : "success",
      ...safeTarget,
      finalPath
    };
  } catch (error) {
    return {
      status: "failed",
      ...target,
      reason: error.code ?? error.message
    };
  }
}

async function refreshCollisionTarget(target) {
  const currentNames = await readdir(target.parentPath);
  const currentNameSet = new Set(currentNames);
  let finalName = target.finalName;

  if (await pathExists(join(target.parentPath, finalName))) {
    finalName = buildCollisionSafeName(target.normalizedName, currentNameSet);
  }

  return {
    ...target,
    finalName,
    collision: target.collision || finalName !== target.normalizedName
  };
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isExcludedDirectoryName(name) {
  return (
    EXCLUDED_DIRECTORY_NAMES.has(name) ||
    name.endsWith(".app") ||
    isTemporaryOrIgnoredName(name)
  );
}

function getPathDepth(path) {
  return path.split(sep).filter(Boolean).length;
}

