#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));

if (packageJson.name !== "@ship-ready/cli") {
  throw new Error(`Publish preflight expected package name @ship-ready/cli; found ${String(packageJson.name)}.`);
}
if (packageJson.private !== true) {
  throw new Error("Publish preflight requires private: true until an approved publish execution commit.");
}
if (packageJson.bin?.shipready !== "./dist/index.js") {
  throw new Error("Publish preflight requires bin.shipready to remain ./dist/index.js.");
}
if (!packageJson.files?.includes("CHANGELOG.md")) {
  throw new Error("Publish preflight requires CHANGELOG.md in the package files whitelist.");
}

const prohibitedWorkflowPatterns = [
  /\bnpm\s+(?:publish|login)\b/i,
  /\bgh\s+release\b/i,
  /\bgit\s+tag\b/i,
  /upload-artifact/i,
  /id-token\s*:\s*write/i,
  /(?:NPM_TOKEN|NODE_AUTH_TOKEN)/,
];
const validationOnlyFiles = [
  ".github/workflows/publish.yml",
  ".github/workflows/publish-preflight.yml",
  ".github/workflows/package-smoke.yml",
  "scripts/package-smoke.mjs",
  "package.json",
];
for (const file of validationOnlyFiles) {
  const path = join(repoRoot, file);
  const contents = await readFile(path, "utf8");
  if (prohibitedWorkflowPatterns.some((pattern) => pattern.test(contents))) {
    throw new Error(`Release-capable behavior is prohibited in ${relative(repoRoot, path)}.`);
  }
}

const tarballs = await findTarballs(repoRoot, 3);
if (tarballs.length > 0) {
  throw new Error(`Unexpected package tarball(s) in repository: ${tarballs.join(", ")}`);
}

process.stdout.write("ShipReady publish preflight stop gates passed; publication remains disabled.\n");

async function findTarballs(directory, maxDepth, depth = 0) {
  if (depth > maxDepth) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(".tgz")) {
      found.push(relative(repoRoot, path));
    } else if (entry.isDirectory()) {
      found.push(...await findTarballs(path, maxDepth, depth + 1));
    }
  }

  return found;
}
