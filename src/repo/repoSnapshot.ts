import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".vercel",
  "coverage",
  ".turbo",
  ".cache",
]);

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_FILES = 1500;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;

export type PackageJsonSummary = {
  path: string;
  dependencies: Set<string>;
  packageManager?: string;
};

export type RepoSnapshot = {
  root: string;
  displayPath: string;
  files: Set<string>;
  directories: Set<string>;
  fileList: string[];
  directoryList: string[];
  packageJson?: PackageJsonSummary;
  warnings: string[];
  truncated: boolean;
};

export function createRepoSnapshot(
  inputPath: string,
  options: { cwd?: string; maxDepth?: number; maxFiles?: number } = {},
): RepoSnapshot {
  const cwd = options.cwd ?? process.cwd();
  const root = resolve(cwd, inputPath);
  const displayPath = formatDisplayPath(root, cwd);
  const warnings: string[] = [];

  let stats;
  try {
    stats = statSync(root);
  } catch {
    throw new Error(`Repository path does not exist: ${inputPath}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${inputPath}`);
  }

  const files = new Set<string>();
  const directories = new Set<string>();
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  let truncated = false;

  function walk(relativeDir: string, depth: number): void {
    if (truncated || depth > maxDepth) {
      return;
    }

    const absoluteDir = resolve(root, relativeDir);
    let entries;
    try {
      entries = readdirSync(absoluteDir, { withFileTypes: true });
    } catch (error) {
      warnings.push(`Could not read ${relativeDir || "."}: ${formatError(error)}`);
      return;
    }

    for (const entry of entries) {
      if (truncated) {
        return;
      }

      if (entry.isSymbolicLink()) {
        continue;
      }

      const relativePath = toPosix(relativeDir ? `${relativeDir}/${entry.name}` : entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        directories.add(relativePath);
        walk(relativePath, depth + 1);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      files.add(relativePath);
      if (files.size >= maxFiles) {
        truncated = true;
        warnings.push(`Repository scan stopped after ${maxFiles} files. Results may be incomplete.`);
      }
    }
  }

  walk("", 0);

  const packageJson = readPackageJsonSummary(root);

  return {
    root,
    displayPath,
    files,
    directories,
    fileList: Array.from(files).sort(),
    directoryList: Array.from(directories).sort(),
    packageJson,
    warnings,
    truncated,
  };
}

export function hasFile(snapshot: RepoSnapshot, path: string): boolean {
  return snapshot.files.has(toPosix(path));
}

export function hasDirectory(snapshot: RepoSnapshot, path: string): boolean {
  return snapshot.directories.has(toPosix(path));
}

export function hasDependency(snapshot: RepoSnapshot, dependency: string): boolean {
  return snapshot.packageJson?.dependencies.has(dependency) ?? false;
}

export function hasAnyDependency(snapshot: RepoSnapshot, dependencies: string[]): boolean {
  return dependencies.some((dependency) => hasDependency(snapshot, dependency));
}

export function findFiles(snapshot: RepoSnapshot, predicate: (path: string) => boolean): string[] {
  return snapshot.fileList.filter(predicate);
}

export function readRepoFile(
  snapshot: RepoSnapshot,
  path: string,
  options: { maxBytes?: number } = {},
): string | undefined {
  const relativePath = toPosix(path);
  if (!snapshot.files.has(relativePath)) {
    return undefined;
  }

  const absolutePath = resolve(snapshot.root, relativePath);
  try {
    const stats = statSync(absolutePath);
    if (stats.size > (options.maxBytes ?? DEFAULT_MAX_FILE_BYTES)) {
      return undefined;
    }
    return readFileSync(absolutePath, "utf8");
  } catch {
    return undefined;
  }
}

export function findSourceMatches(
  snapshot: RepoSnapshot,
  predicate: (path: string) => boolean,
  pattern: RegExp,
): string[] {
  const matches: string[] = [];
  for (const path of snapshot.fileList) {
    if (!predicate(path)) {
      continue;
    }

    const content = readRepoFile(snapshot, path);
    if (content && pattern.test(content)) {
      matches.push(path);
    }
  }

  return matches;
}

export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function readPackageJsonSummary(root: string): PackageJsonSummary | undefined {
  const packageJsonPath = resolve(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      packageManager?: string;
    };

    return {
      path: "package.json",
      dependencies: new Set([
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.devDependencies ?? {}),
        ...Object.keys(parsed.peerDependencies ?? {}),
        ...Object.keys(parsed.optionalDependencies ?? {}),
      ]),
      packageManager: typeof parsed.packageManager === "string" ? parsed.packageManager : undefined,
    };
  } catch {
    return {
      path: "package.json",
      dependencies: new Set(),
    };
  }
}

function formatDisplayPath(root: string, cwd: string): string {
  const relativePath = toPosix(relative(cwd, root));
  if (!relativePath || relativePath === "") {
    return ".";
  }

  if (!relativePath.startsWith("..") && relativePath !== ".") {
    return relativePath;
  }

  return root;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "permission or filesystem error";
}
