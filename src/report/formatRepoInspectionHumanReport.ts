import type {
  EvidenceItem,
  ImportantFile,
  MetadataLocation,
  RepoInspectionResult,
  RouteCandidate,
  SupportedFix,
} from "../types/repoInspection";

export function formatRepoInspectionHumanReport(result: RepoInspectionResult): string {
  const lines: string[] = [
    `ShipReady repo inspection: ${result.path}`,
    "",
    "Framework",
    `- Detected: ${result.framework.name}`,
    `- Confidence: ${result.framework.confidence}`,
    "",
    "Evidence",
    ...formatEvidence(result.framework.evidence),
    "",
    "Package manager",
    `- ${result.packageManager}`,
    "",
    "Important files",
    ...formatImportantFiles(result.importantFiles),
    "",
    "Likely route/page structure",
    ...formatRoutes(result.routes),
    "",
    "Likely metadata locations",
    ...formatMetadataLocations(result.metadataLocations),
    "",
    "Supported future fixes",
    ...formatSupportedFixes(result.supportedFixes),
    "",
    "Limitations",
    ...formatList(result.limitations),
    "",
    "Warnings",
    ...formatList(result.warnings),
    "",
    "Recommended next action",
    formatRecommendedNextAction(result),
  ];

  return `${lines.join("\n")}\n`;
}

function formatEvidence(evidence: EvidenceItem[]): string[] {
  if (evidence.length === 0) {
    return ["- None"];
  }

  return evidence.map((item) => {
    const path = item.path ? `${item.path}: ` : "";
    return `- ${path}${item.value}`;
  });
}

function formatImportantFiles(files: ImportantFile[]): string[] {
  if (files.length === 0) {
    return ["- None found"];
  }

  return files.map((file) => `- ${file.path} (${file.reason})`);
}

function formatRoutes(routes: RouteCandidate[]): string[] {
  if (routes.length === 0) {
    return ["- None found"];
  }

  return routes.map((route) => {
    const routeText = route.route ? `${route.route} -> ` : "";
    return `- ${routeText}${route.path} (${route.reason})`;
  });
}

function formatMetadataLocations(locations: MetadataLocation[]): string[] {
  if (locations.length === 0) {
    return ["- None found"];
  }

  return locations.map((location) => {
    const status = location.exists ? "found" : "not found yet";
    return `- ${location.path} (${status}; ${location.reason})`;
  });
}

function formatSupportedFixes(fixes: SupportedFix[]): string[] {
  if (fixes.length === 0) {
    return ["- None yet"];
  }

  return fixes.map((fix) => `- ${fix.title}`);
}

function formatList(values: string[]): string[] {
  if (values.length === 0) {
    return ["- None"];
  }

  return values.map((value) => `- ${value}`);
}

function formatRecommendedNextAction(result: RepoInspectionResult): string {
  if (result.framework.id === "unknown") {
    return "Inspect the project manually before attempting automated fixes.";
  }

  return "Use this inspection result with a URL audit to produce a read-only fix plan.";
}
