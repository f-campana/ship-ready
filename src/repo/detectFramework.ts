import type {
  DetectedFramework,
  EvidenceItem,
  FrameworkConfidence,
  FrameworkId,
} from "../types/repoInspection";
import {
  findFiles,
  findSourceMatches,
  hasAnyDependency,
  hasDependency,
  hasDirectory,
  hasFile,
  readRepoFile,
  type RepoSnapshot,
} from "./repoSnapshot";

export type FrameworkDetection = {
  framework: DetectedFramework;
  warnings: string[];
};

type Candidate = {
  id: FrameworkId;
  name: string;
  evidence: EvidenceItem[];
};

const FRAMEWORK_NAMES: Record<FrameworkId, string> = {
  next_app_router: "Next.js App Router",
  next_pages_router: "Next.js Pages Router",
  vite_react: "Vite React",
  astro: "Astro",
  remix: "Remix",
  static_html: "Plain static HTML",
  unknown: "Unknown",
};

export function detectFramework(snapshot: RepoSnapshot): FrameworkDetection {
  const candidates = [
    nextAppRouterCandidate(snapshot),
    nextPagesRouterCandidate(snapshot),
    viteReactCandidate(snapshot),
    astroCandidate(snapshot),
    remixCandidate(snapshot),
    staticHtmlCandidate(snapshot),
  ];

  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreEvidence(candidate.evidence) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const warnings: string[] = [];

  if (ranked.length === 0 || ranked[0]?.score < 4) {
    return {
      framework: {
        id: "unknown",
        name: FRAMEWORK_NAMES.unknown,
        confidence: "low",
        evidence: unknownEvidence(snapshot),
      },
      warnings: ["No supported web framework could be detected with enough confidence."],
    };
  }

  const top = ranked[0];
  const runnerUp = ranked[1];
  let confidence = confidenceForScore(top.score, top.candidate.evidence);

  if (runnerUp && runnerUp.score >= 5 && top.score - runnerUp.score <= 2) {
    confidence = downgradeConfidence(confidence);
    warnings.push(
      `Framework signals are ambiguous: ${top.candidate.name} and ${runnerUp.candidate.name} both have strong evidence.`,
    );
  }

  return {
    framework: {
      id: top.candidate.id,
      name: top.candidate.name,
      confidence,
      evidence: top.candidate.evidence,
    },
    warnings,
  };
}

function nextAppRouterCandidate(snapshot: RepoSnapshot): Candidate {
  const evidence: EvidenceItem[] = [];
  addDependencyEvidence(snapshot, evidence, "next");
  addFirstExistingFile(snapshot, evidence, ["next.config.js", "next.config.mjs", "next.config.ts"], "Next.js config found", "medium");
  addFirstExistingDirectory(snapshot, evidence, ["app", "src/app"], "App Router directory found", "strong");
  addFirstExistingFile(
    snapshot,
    evidence,
    ["app/layout.tsx", "app/layout.jsx", "app/layout.ts", "app/layout.js", "src/app/layout.tsx", "src/app/layout.jsx", "src/app/layout.ts", "src/app/layout.js"],
    "App Router root layout found",
    "strong",
  );

  for (const path of appRouterPageFiles(snapshot).slice(0, 3)) {
    evidence.push({
      kind: "file",
      path,
      value: `${path} found`,
      weight: "medium",
    });
  }

  for (const path of metadataExportFiles(snapshot).slice(0, 3)) {
    evidence.push({
      kind: "source_pattern",
      path,
      value: `${path} exports metadata or generateMetadata`,
      weight: "medium",
    });
  }

  return { id: "next_app_router", name: FRAMEWORK_NAMES.next_app_router, evidence };
}

function nextPagesRouterCandidate(snapshot: RepoSnapshot): Candidate {
  const evidence: EvidenceItem[] = [];
  addDependencyEvidence(snapshot, evidence, "next");
  addFirstExistingFile(snapshot, evidence, ["next.config.js", "next.config.mjs", "next.config.ts"], "Next.js config found", "medium");
  addFirstExistingDirectory(snapshot, evidence, ["pages", "src/pages"], "Pages Router directory found", "strong");
  addExistingFiles(
    snapshot,
    evidence,
    [
      "pages/_app.tsx",
      "pages/_app.jsx",
      "pages/_app.ts",
      "pages/_app.js",
      "pages/_document.tsx",
      "pages/_document.jsx",
      "pages/_document.ts",
      "pages/_document.js",
      "src/pages/_app.tsx",
      "src/pages/_app.jsx",
      "src/pages/_app.ts",
      "src/pages/_app.js",
      "src/pages/_document.tsx",
      "src/pages/_document.jsx",
      "src/pages/_document.ts",
      "src/pages/_document.js",
    ],
    "Pages Router app/document file found",
    "medium",
  );

  for (const path of pagesRouterRouteFiles(snapshot).slice(0, 3)) {
    evidence.push({
      kind: "file",
      path,
      value: `${path} found`,
      weight: "weak",
    });
  }

  for (const path of nextHeadFiles(snapshot).slice(0, 3)) {
    evidence.push({
      kind: "source_pattern",
      path,
      value: `${path} imports next/head`,
      weight: "medium",
    });
  }

  return { id: "next_pages_router", name: FRAMEWORK_NAMES.next_pages_router, evidence };
}

function viteReactCandidate(snapshot: RepoSnapshot): Candidate {
  const evidence: EvidenceItem[] = [];
  addDependencyEvidence(snapshot, evidence, "vite");
  addDependencyEvidence(snapshot, evidence, "react", "weak");
  addDependencyEvidence(snapshot, evidence, "@vitejs/plugin-react", "medium");
  addDependencyEvidence(snapshot, evidence, "react-router-dom", "weak");
  addFirstExistingFile(snapshot, evidence, ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"], "Vite config found", "medium");
  addFirstExistingFile(snapshot, evidence, ["index.html"], "Vite root index.html found", "medium");
  addFirstExistingFile(snapshot, evidence, ["src/main.tsx", "src/main.jsx"], "React entry file found", "medium");
  addFirstExistingFile(snapshot, evidence, ["src/App.tsx", "src/App.jsx"], "React app component found", "weak");

  return { id: "vite_react", name: FRAMEWORK_NAMES.vite_react, evidence };
}

function astroCandidate(snapshot: RepoSnapshot): Candidate {
  const evidence: EvidenceItem[] = [];
  addDependencyEvidence(snapshot, evidence, "astro");
  addFirstExistingFile(snapshot, evidence, ["astro.config.js", "astro.config.mjs", "astro.config.ts"], "Astro config found", "strong");
  addFirstExistingDirectory(snapshot, evidence, ["src/pages"], "Astro pages directory found", "medium");

  for (const path of findFiles(snapshot, (file) => /^src\/(pages|layouts)\/.+\.astro$/.test(file)).slice(0, 3)) {
    evidence.push({
      kind: "file",
      path,
      value: `${path} found`,
      weight: "strong",
    });
  }

  return { id: "astro", name: FRAMEWORK_NAMES.astro, evidence };
}

function remixCandidate(snapshot: RepoSnapshot): Candidate {
  const evidence: EvidenceItem[] = [];
  for (const dependency of snapshot.packageJson?.dependencies ?? []) {
    if (dependency.startsWith("@remix-run/")) {
      evidence.push({
        kind: "package_dependency",
        path: "package.json",
        value: `package.json includes dependency "${dependency}"`,
        weight: "strong",
      });
    }
  }

  addFirstExistingFile(snapshot, evidence, ["remix.config.js", "remix.config.mjs"], "Remix config found", "strong");
  addFirstExistingFile(snapshot, evidence, ["app/root.tsx", "app/root.jsx", "app/root.ts", "app/root.js"], "Remix root module found", "medium");
  addFirstExistingDirectory(snapshot, evidence, ["app/routes"], "Remix routes directory found", "medium");

  for (const path of remixRouteFiles(snapshot).slice(0, 3)) {
    evidence.push({
      kind: "file",
      path,
      value: `${path} found`,
      weight: "medium",
    });
  }

  for (const path of remixMetaExportFiles(snapshot).slice(0, 3)) {
    evidence.push({
      kind: "source_pattern",
      path,
      value: `${path} exports meta or links`,
      weight: "medium",
    });
  }

  for (const configPath of ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"]) {
    const content = readRepoFile(snapshot, configPath);
    if (content && /@remix-run\/dev|vite-plugin-remix/.test(content)) {
      evidence.push({
        kind: "source_pattern",
        path: configPath,
        value: `${configPath} references a Remix Vite plugin`,
        weight: "medium",
      });
      break;
    }
  }

  return { id: "remix", name: FRAMEWORK_NAMES.remix, evidence };
}

function staticHtmlCandidate(snapshot: RepoSnapshot): Candidate {
  const evidence: EvidenceItem[] = [];
  const htmlFiles = findFiles(snapshot, (file) => file.endsWith(".html"));
  const knownFrameworkDependency = hasAnyDependency(snapshot, [
    "next",
    "vite",
    "react",
    "@vitejs/plugin-react",
    "astro",
    "@remix-run/react",
    "@remix-run/node",
    "@remix-run/dev",
  ]);

  if (hasFile(snapshot, "index.html")) {
    evidence.push({
      kind: "file",
      path: "index.html",
      value: "index.html found",
      weight: "strong",
    });
  }

  if (htmlFiles.length > 1) {
    evidence.push({
      kind: "file",
      value: `${htmlFiles.length} HTML files found`,
      weight: "medium",
    });
  }

  if (!snapshot.packageJson) {
    evidence.push({
      kind: "file",
      value: "No package.json found",
      weight: "weak",
    });
  } else if (!knownFrameworkDependency) {
    evidence.push({
      kind: "file",
      path: "package.json",
      value: "package.json found, but no known web framework dependency detected",
      weight: "weak",
    });
  }

  return { id: "static_html", name: FRAMEWORK_NAMES.static_html, evidence };
}

export function appRouterPageFiles(snapshot: RepoSnapshot): string[] {
  return findFiles(snapshot, (file) => /^((src\/)?app)\/.+\/page\.(tsx|jsx|ts|js)$/.test(file) || /^((src\/)?app)\/page\.(tsx|jsx|ts|js)$/.test(file));
}

export function appRouterLayoutFiles(snapshot: RepoSnapshot): string[] {
  return findFiles(snapshot, (file) => /^((src\/)?app)\/.*layout\.(tsx|jsx|ts|js)$/.test(file));
}

export function pagesRouterRouteFiles(snapshot: RepoSnapshot): string[] {
  return findFiles(snapshot, (file) => {
    if (!/^((src\/)?pages)\//.test(file) || !/\.(tsx|jsx|ts|js)$/.test(file)) {
      return false;
    }

    const basename = file.split("/").pop() ?? "";
    return !basename.startsWith("_") && !file.includes("/api/");
  });
}

export function remixRouteFiles(snapshot: RepoSnapshot): string[] {
  return findFiles(snapshot, (file) => /^app\/routes\/.+\.(tsx|jsx|ts|js)$/.test(file));
}

export function astroPageFiles(snapshot: RepoSnapshot): string[] {
  return findFiles(snapshot, (file) => /^src\/pages\/.+\.(astro|md|mdx|tsx|jsx|ts|js)$/.test(file));
}

export function htmlPageFiles(snapshot: RepoSnapshot): string[] {
  return findFiles(snapshot, (file) => file.endsWith(".html"));
}

export function nextHeadFiles(snapshot: RepoSnapshot): string[] {
  return findSourceMatches(
    snapshot,
    (file) => isSourceFile(file),
    /from\s+["']next\/head["']|require\(["']next\/head["']\)/,
  );
}

export function metadataExportFiles(snapshot: RepoSnapshot): string[] {
  return findSourceMatches(
    snapshot,
    (file) => /^((src\/)?app)\//.test(file) && isSourceFile(file),
    /export\s+(const\s+metadata|(?:async\s+)?function\s+generateMetadata)\b/,
  );
}

export function remixMetaExportFiles(snapshot: RepoSnapshot): string[] {
  return findSourceMatches(
    snapshot,
    (file) => /^app\/(root|routes\/)/.test(file) && isSourceFile(file),
    /export\s+(?:const\s+(?:meta|links)|(?:async\s+)?function\s+(?:meta|links))\b/,
  );
}

export function reactHelmetFiles(snapshot: RepoSnapshot): string[] {
  return findSourceMatches(
    snapshot,
    (file) => isSourceFile(file),
    /react-helmet|react-helmet-async/,
  );
}

function addDependencyEvidence(
  snapshot: RepoSnapshot,
  evidence: EvidenceItem[],
  dependency: string,
  weight: EvidenceItem["weight"] = "strong",
): void {
  if (hasDependency(snapshot, dependency)) {
    evidence.push({
      kind: "package_dependency",
      path: "package.json",
      value: `package.json includes dependency "${dependency}"`,
      weight,
    });
  }
}

function addFirstExistingFile(
  snapshot: RepoSnapshot,
  evidence: EvidenceItem[],
  paths: string[],
  value: string,
  weight: EvidenceItem["weight"],
): void {
  const path = paths.find((candidate) => hasFile(snapshot, candidate));
  if (path) {
    evidence.push({
      kind: "file",
      path,
      value,
      weight,
    });
  }
}

function addExistingFiles(
  snapshot: RepoSnapshot,
  evidence: EvidenceItem[],
  paths: string[],
  value: string,
  weight: EvidenceItem["weight"],
): void {
  for (const path of paths) {
    if (hasFile(snapshot, path)) {
      evidence.push({
        kind: "file",
        path,
        value: `${value}: ${path}`,
        weight,
      });
    }
  }
}

function addFirstExistingDirectory(
  snapshot: RepoSnapshot,
  evidence: EvidenceItem[],
  paths: string[],
  value: string,
  weight: EvidenceItem["weight"],
): void {
  const path = paths.find((candidate) => hasDirectory(snapshot, candidate));
  if (path) {
    evidence.push({
      kind: "directory",
      path,
      value,
      weight,
    });
  }
}

function unknownEvidence(snapshot: RepoSnapshot): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  if (snapshot.packageJson) {
    evidence.push({
      kind: "file",
      path: "package.json",
      value: "package.json found, but no supported web framework was detected",
      weight: "weak",
    });
  } else {
    evidence.push({
      kind: "file",
      value: "No package.json found",
      weight: "weak",
    });
  }

  if (!hasFile(snapshot, "index.html")) {
    evidence.push({
      kind: "file",
      value: "No root index.html found",
      weight: "weak",
    });
  }

  if (!hasDirectory(snapshot, "app") && !hasDirectory(snapshot, "src/app") && !hasDirectory(snapshot, "pages") && !hasDirectory(snapshot, "src/pages")) {
    evidence.push({
      kind: "directory",
      value: "No app/pages route structure detected",
      weight: "weak",
    });
  }

  return evidence;
}

function scoreEvidence(evidence: EvidenceItem[]): number {
  return evidence.reduce((score, item) => {
    if (item.weight === "strong") return score + 3;
    if (item.weight === "medium") return score + 2;
    return score + 1;
  }, 0);
}

function confidenceForScore(score: number, evidence: EvidenceItem[]): FrameworkConfidence {
  const strongCount = evidence.filter((item) => item.weight === "strong").length;
  const mediumCount = evidence.filter((item) => item.weight === "medium").length;
  if (score >= 8 && (strongCount >= 2 || (strongCount >= 1 && mediumCount >= 2))) {
    return "high";
  }

  if (score >= 4) {
    return "medium";
  }

  return "low";
}

function downgradeConfidence(confidence: FrameworkConfidence): FrameworkConfidence {
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  return "low";
}

function isSourceFile(path: string): boolean {
  return /\.(tsx|jsx|ts|js|mjs|cjs)$/.test(path);
}
