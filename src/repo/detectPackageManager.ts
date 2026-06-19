import type { EvidenceItem, PackageManager } from "../types/repoInspection";
import { hasFile, type RepoSnapshot } from "./repoSnapshot";

export type PackageManagerDetection = {
  packageManager: PackageManager;
  evidence: EvidenceItem[];
};

export function detectPackageManager(snapshot: RepoSnapshot): PackageManagerDetection {
  const lockfiles: Array<{ path: string; packageManager: PackageManager; value: string }> = [
    { path: "pnpm-lock.yaml", packageManager: "pnpm", value: "pnpm-lock.yaml found" },
    { path: "package-lock.json", packageManager: "npm", value: "package-lock.json found" },
    { path: "npm-shrinkwrap.json", packageManager: "npm", value: "npm-shrinkwrap.json found" },
    { path: "yarn.lock", packageManager: "yarn", value: "yarn.lock found" },
    { path: "bun.lock", packageManager: "bun", value: "bun.lock found" },
    { path: "bun.lockb", packageManager: "bun", value: "bun.lockb found" },
  ];

  for (const lockfile of lockfiles) {
    if (hasFile(snapshot, lockfile.path)) {
      return {
        packageManager: lockfile.packageManager,
        evidence: [
          {
            kind: "lockfile",
            path: lockfile.path,
            value: lockfile.value,
            weight: "strong",
          },
        ],
      };
    }
  }

  const packageManager = snapshot.packageJson?.packageManager;
  if (packageManager) {
    if (packageManager.startsWith("pnpm@")) {
      return fromPackageJson("pnpm", packageManager);
    }
    if (packageManager.startsWith("npm@")) {
      return fromPackageJson("npm", packageManager);
    }
    if (packageManager.startsWith("yarn@")) {
      return fromPackageJson("yarn", packageManager);
    }
    if (packageManager.startsWith("bun@")) {
      return fromPackageJson("bun", packageManager);
    }
  }

  return { packageManager: "unknown", evidence: [] };
}

function fromPackageJson(packageManager: PackageManager, value: string): PackageManagerDetection {
  return {
    packageManager,
    evidence: [
      {
        kind: "file",
        path: "package.json",
        value: `package.json declares packageManager "${value}"`,
        weight: "medium",
      },
    ],
  };
}
