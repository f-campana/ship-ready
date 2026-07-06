import { closeSync, fstatSync, openSync, readSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  createRepoSnapshot,
  toPosix,
  type RepoSnapshot,
} from "../repo/repoSnapshot";
import { DEFAULT_GENERATED_SITE_SMELL_LIMITS } from "./generatedSiteSmellTypes";

const EXTRA_IGNORED_SEGMENTS = new Set([
  "out",
  "vendor",
  ".parcel-cache",
  ".sass-cache",
  ".vite",
  "storybook-static",
]);

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
]);

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);

export type RepoSmellScanLimits = {
  maxFiles: number;
  maxBytes: number;
  maxFileBytes: number;
  maxFindings: number;
  maxEvidencePerFinding: number;
  maxValuePreviewLength: number;
};

export type ScannedRepoFile = {
  path: string;
  extension: string;
  sizeBytes: number;
  bytesRead: number;
  truncated: boolean;
  content: string;
};

export type RepoSmellScan = {
  root: string;
  displayPath: string;
  snapshot: RepoSnapshot;
  files: ScannedRepoFile[];
  scannedFiles: number;
  scannedBytes: number;
  skippedFiles: number;
  truncated: boolean;
  limits: RepoSmellScanLimits;
  limitations: string[];
};

export type LineEvidence = {
  path: string;
  line: number;
  valuePreview: string;
};

export function normalizeSmellScanLimits(input: {
  maxFiles?: number;
  maxBytes?: number;
} = {}): RepoSmellScanLimits {
  return {
    ...DEFAULT_GENERATED_SITE_SMELL_LIMITS,
    maxFiles: input.maxFiles ?? DEFAULT_GENERATED_SITE_SMELL_LIMITS.maxFiles,
    maxBytes: input.maxBytes ?? DEFAULT_GENERATED_SITE_SMELL_LIMITS.maxBytes,
  };
}

export function scanRepoForSmellInputs(
  repoPath: string,
  options: {
    cwd?: string;
    limits?: Partial<RepoSmellScanLimits>;
  } = {},
): RepoSmellScan {
  const limits = { ...DEFAULT_GENERATED_SITE_SMELL_LIMITS, ...options.limits };
  const snapshot = createRepoSnapshot(repoPath, {
    cwd: options.cwd,
    maxFiles: Math.max(limits.maxFiles * 4, limits.maxFiles),
  });
  const files: ScannedRepoFile[] = [];
  const limitations = [...snapshot.warnings];
  let scannedBytes = 0;
  let skippedFiles = 0;
  let truncated = snapshot.truncated;

  for (const path of snapshot.fileList) {
    if (files.length >= limits.maxFiles) {
      truncated = true;
      limitations.push(`Implementation smell scan stopped after ${limits.maxFiles} text/config files.`);
      break;
    }
    if (scannedBytes >= limits.maxBytes) {
      truncated = true;
      limitations.push(`Implementation smell scan stopped after ${limits.maxBytes} bytes.`);
      break;
    }
    if (!isScannableTextPath(path)) {
      skippedFiles += 1;
      continue;
    }

    const absolute = resolve(snapshot.root, path);
    let sizeBytes = 0;
    try {
      sizeBytes = statSync(absolute).size;
    } catch {
      skippedFiles += 1;
      continue;
    }

    const remaining = limits.maxBytes - scannedBytes;
    const readLimit = Math.max(0, Math.min(limits.maxFileBytes, remaining));
    if (readLimit <= 0) {
      truncated = true;
      limitations.push(`Implementation smell scan stopped after ${limits.maxBytes} bytes.`);
      break;
    }

    const content = readFilePrefix(absolute, readLimit);
    if (content === undefined) {
      skippedFiles += 1;
      continue;
    }

    const bytesRead = Buffer.byteLength(content, "utf8");
    scannedBytes += bytesRead;
    const truncatedFile = sizeBytes > readLimit;
    if (truncatedFile) {
      truncated = true;
    }

    files.push({
      path,
      extension: extensionFor(path),
      sizeBytes,
      bytesRead,
      truncated: truncatedFile,
      content,
    });
  }

  if (files.some((file) => file.truncated)) {
    limitations.push(`One or more files exceeded the per-file read cap of ${limits.maxFileBytes} bytes.`);
  }

  return {
    root: snapshot.root,
    displayPath: snapshot.displayPath,
    snapshot,
    files,
    scannedFiles: files.length,
    scannedBytes,
    skippedFiles,
    truncated,
    limits,
    limitations: Array.from(new Set(limitations)),
  };
}

export function findLineEvidence(
  scan: RepoSmellScan,
  pattern: RegExp,
  options: {
    max?: number;
    filePredicate?: (file: ScannedRepoFile) => boolean;
    linePredicate?: (line: string, file: ScannedRepoFile) => boolean;
  } = {},
): LineEvidence[] {
  const max = options.max ?? scan.limits.maxEvidencePerFinding;
  const evidence: LineEvidence[] = [];
  for (const file of scan.files) {
    if (options.filePredicate && !options.filePredicate(file)) {
      continue;
    }
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (evidence.length >= max) return evidence;
      const line = lines[index] ?? "";
      pattern.lastIndex = 0;
      if (!pattern.test(line)) {
        continue;
      }
      if (options.linePredicate && !options.linePredicate(line, file)) {
        continue;
      }
      evidence.push({
        path: file.path,
        line: index + 1,
        valuePreview: sanitizeValuePreview(line, scan.limits.maxValuePreviewLength) ?? "[redacted]",
      });
    }
  }
  return evidence;
}

export function sanitizeValuePreview(value: string | undefined, maxLength: number = DEFAULT_GENERATED_SITE_SMELL_LIMITS.maxValuePreviewLength): string | undefined {
  const compact = value
    ?.replace(/\s+/g, " ")
    .replace(/(password|passwd|secret|token|api[_-]?key|authorization)\s*[:=]\s*["']?[^"',\s)]+/gi, "$1=[redacted]")
    .replace(/https?:\/\/[^\s"'<>)]*/gi, (url) => redactUrl(url))
    .trim();
  if (!compact) return undefined;
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function redactUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.replace(/[?#].*$/, "");
  }
}

export function isSourceLikeFile(file: ScannedRepoFile): boolean {
  return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(file.extension);
}

export function isHtmlFile(file: ScannedRepoFile): boolean {
  return file.extension === ".html";
}

export function isMetadataOrConfigPath(path: string): boolean {
  return (
    /(^|\/)(index\.html|package\.json|next\.config\.(js|mjs|ts)|vite\.config\.(js|mjs|ts|mts)|astro\.config\.(js|mjs|ts)|remix\.config\.(js|mjs)|app\/.*(layout|page)\.(tsx|jsx|ts|js)|src\/app\/.*(layout|page)\.(tsx|jsx|ts|js))$/.test(path) ||
    /(^|\/)(metadata|seo|head|helmet|config|site|siteConfig|site-config)\.(ts|tsx|js|jsx|json)$/.test(path)
  );
}

export function hasRepoFile(scan: RepoSmellScan, path: string): boolean {
  return scan.snapshot.files.has(toPosix(path));
}

export function hasRepoDirectory(scan: RepoSmellScan, path: string): boolean {
  return scan.snapshot.directories.has(toPosix(path));
}

export function assetExistsForPublicPath(scan: RepoSmellScan, publicPath: string, staticRoot = false): boolean {
  const normalized = publicPath.split(/[?#]/, 1)[0]?.replace(/^\/+/, "") ?? "";
  if (!normalized || normalized.startsWith("http:") || normalized.startsWith("https:") || normalized.startsWith("//")) {
    return true;
  }
  if (staticRoot && hasRepoFile(scan, normalized)) {
    return true;
  }
  return hasRepoFile(scan, `public/${normalized}`);
}

function isScannableTextPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((part) => EXTRA_IGNORED_SEGMENTS.has(part))) {
    return false;
  }
  const name = basename(path);
  if (LOCKFILE_NAMES.has(name)) {
    return false;
  }
  if (name.startsWith(".env")) {
    return false;
  }
  return TEXT_EXTENSIONS.has(extensionFor(path));
}

function readFilePrefix(path: string, maxBytes: number): string | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const stats = fstatSync(fd);
    if (!stats.isFile()) return undefined;
    const buffer = Buffer.alloc(Math.min(maxBytes, stats.size));
    const bytes = readSync(fd, buffer, 0, buffer.length, 0);
    if (buffer.subarray(0, bytes).includes(0)) return undefined;
    return buffer.subarray(0, bytes).toString("utf8");
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function extensionFor(path: string): string {
  const match = /(\.[^.\/]+)$/.exec(path);
  return match?.[1]?.toLowerCase() ?? "";
}
