import {
  CONTRACT_NAMES,
  GeneratedSiteSmellsJsonContractSchema,
  type GeneratedSiteSmellsJsonContract,
  type RepoInspectionJsonContract,
} from "../types/contracts";
import {
  DEFAULT_GENERATED_SITE_SMELL_LIMITS,
  GENERATED_SITE_SMELL_MOCK_SCENARIOS,
  GeneratedSiteSmellsError,
  type GeneratedSiteSmellMockScenario,
} from "./generatedSiteSmellTypes";
import type { RepoSmellScanLimits } from "./repoSmellScanner";

const FIXED_CHECKED_AT = "2026-07-06T12:00:00.000Z";

type Finding = GeneratedSiteSmellsJsonContract["findings"][number];

export function parseGeneratedSiteSmellMockScenario(value: string | undefined): GeneratedSiteSmellMockScenario | undefined {
  if (!value) return undefined;
  if ((GENERATED_SITE_SMELL_MOCK_SCENARIOS as readonly string[]).includes(value)) {
    return value as GeneratedSiteSmellMockScenario;
  }
  throw new GeneratedSiteSmellsError(
    "invalid_mode",
    `Unsupported generated-site smell mock scenario: ${value}.`,
  );
}

export function createMockGeneratedSiteSmells(input: {
  scenario: GeneratedSiteSmellMockScenario;
  repoPath: string;
  url?: string;
  framework?: RepoInspectionJsonContract["framework"];
  limits?: Partial<RepoSmellScanLimits>;
}): GeneratedSiteSmellsJsonContract {
  const findings = findingsFor(input.scenario);
  const limits = { ...DEFAULT_GENERATED_SITE_SMELL_LIMITS, ...input.limits };
  return createMockResult({
    repoPath: input.repoPath,
    url: input.url,
    framework: frameworkFor(input.scenario, input.framework),
    findings,
    scanned: {
      files: input.scenario === "clean" ? 18 : 24,
      bytes: input.scenario === "clean" ? 18_432 : 31_744,
      skippedFiles: 3,
      truncated: false,
      limits: {
        maxFiles: limits.maxFiles,
        maxBytes: limits.maxBytes,
        maxFileBytes: limits.maxFileBytes,
        maxFindings: limits.maxFindings,
        maxValuePreviewLength: limits.maxValuePreviewLength,
      },
    },
  });
}

function createMockResult(input: {
  repoPath: string;
  url?: string;
  framework: GeneratedSiteSmellsJsonContract["framework"];
  findings: Finding[];
  scanned: GeneratedSiteSmellsJsonContract["scanned"];
}): GeneratedSiteSmellsJsonContract {
  const severityCounts = countSeverities(input.findings);
  return GeneratedSiteSmellsJsonContractSchema.parse({
    contract: CONTRACT_NAMES.generatedSiteSmells,
    checkedAt: FIXED_CHECKED_AT,
    mode: "mock",
    repoPath: input.repoPath,
    ...(input.url ? { url: input.url } : {}),
    framework: input.framework,
    summary: {
      status: summaryStatus(input.findings),
      severityCounts,
      findingCount: input.findings.length,
    },
    findings: input.findings,
    scanned: input.scanned,
    limitations: [
      "Mock mode uses deterministic local fixtures and performs no network request.",
      "Findings are heuristic implementation signals, not proof of who or what produced a site.",
      "The smell detector is read-only and does not apply fixes.",
    ],
    nextActions: nextActionsFor(input.findings),
  });
}

function findingsFor(scenario: GeneratedSiteSmellMockScenario): Finding[] {
  if (scenario === "clean") return [];
  if (scenario === "vite-client-only-metadata") {
    return [
      finding({
        id: "metadata.client_only_metadata",
        title: "Metadata appears to rely on client-side code",
        category: "metadata",
        severity: "high",
        confidence: "medium",
        status: "needs_attention",
        evidence: [
          ev("repo", "index.html", 4, "Raw HTML fallback has a generic title and no description."),
          ev("scanner", "src/App.tsx", 12, "document.title = \"Launch-ready product\""),
        ],
        whyItMatters: "Preview bots and crawlers often read raw HTML first; client-only metadata can be missed.",
        nextAction: "Move essential title, description, canonical, and social image metadata into the raw HTML or framework metadata surface.",
      }),
      finding({
        id: "routing.spa_weak_raw_html",
        title: "SPA fallback looks weak for crawler and preview inputs",
        category: "routing",
        severity: "medium",
        confidence: "medium",
        status: "needs_attention",
        evidence: [ev("repo", "index.html", 5, "<div id=\"root\"></div>")],
        whyItMatters: "A generated-looking SPA shell with weak raw metadata can make shares and crawler previews fragile.",
        nextAction: "Review whether the app needs prerendering, static metadata, or framework-specific server-rendered metadata.",
      }),
    ];
  }
  if (scenario === "placeholder-content") {
    return [
      finding({
        id: "content.placeholder_copy",
        title: "Placeholder copy remains in user-facing files",
        category: "content_placeholders",
        severity: "medium",
        confidence: "high",
        status: "manual_review",
        evidence: [
          ev("repo", "src/App.tsx", 21, "Lorem ipsum dolor sit amet"),
          ev("repo", "src/App.tsx", 27, "TODO: change me before launch"),
        ],
        whyItMatters: "Placeholder wording commonly appears in generated sites and may make launch metadata, previews, and visible content incomplete.",
        nextAction: "Review the referenced copy and replace placeholders with accurate product language.",
      }),
      finding({
        id: "generated_boilerplate.default_starter",
        title: "Default starter boilerplate is still present",
        category: "generated_boilerplate",
        severity: "low",
        confidence: "high",
        status: "manual_review",
        evidence: [ev("repo", "src/App.tsx", 9, "Vite + React")],
        whyItMatters: "Starter defaults can indicate that launch-critical metadata and assets were not reviewed after generation.",
        nextAction: "Remove starter text, default logos, and starter assets that are not part of the intended brand.",
      }),
    ];
  }
  if (scenario === "missing-social-assets") {
    return [
      finding({
        id: "assets.missing_social_image",
        title: "Referenced social image is missing locally",
        category: "assets",
        severity: "high",
        confidence: "high",
        status: "needs_attention",
        evidence: [ev("repo", "index.html", 8, "<meta property=\"og:image\" content=\"/og-image.png\">")],
        whyItMatters: "A missing social image can make shared links fall back to a plain or inconsistent preview.",
        nextAction: "Add the referenced public image or update metadata to an existing launch-ready asset.",
      }),
      finding({
        id: "assets.missing_favicon",
        title: "Referenced favicon is missing locally",
        category: "assets",
        severity: "low",
        confidence: "high",
        status: "needs_attention",
        evidence: [ev("repo", "index.html", 6, "<link rel=\"icon\" href=\"/favicon.svg\">")],
        whyItMatters: "Missing favicon assets are small launch-readiness issues that can make browser and share surfaces look unfinished.",
        nextAction: "Add the referenced icon under the public asset root or update the favicon link.",
      }),
    ];
  }
  if (scenario === "hardcoded-localhost") {
    return [
      finding({
        id: "configuration.placeholder_or_local_url",
        title: "Metadata or configuration contains a placeholder/local URL",
        category: "configuration",
        severity: "medium",
        confidence: "high",
        status: "needs_attention",
        evidence: [ev("repo", "src/siteConfig.ts", 3, "siteUrl: \"http://localhost:5173\"")],
        whyItMatters: "Local or placeholder URLs in launch metadata can leak into canonical URLs, sitemaps, and share previews.",
        nextAction: "Replace local and example domains with the intended public origin before deployment.",
      }),
    ];
  }
  if (scenario === "unsupported-framework") {
    return [
      finding({
        id: "framework.unsupported_shape",
        title: "Project shape needs manual framework review",
        category: "framework",
        severity: "low",
        confidence: "high",
        status: "manual_review",
        evidence: [ev("mock", undefined, undefined, "No supported framework convention was detected with confidence.")],
        whyItMatters: "Unsupported or unclear project shapes make metadata, routing, and public asset conventions harder to evaluate automatically.",
        nextAction: "Manually identify the framework and confirm where raw metadata, crawl files, and public assets are produced.",
      }),
    ];
  }
  if (scenario === "repo-plus-url-rendered-only") {
    return [
      finding({
        id: "metadata.rendered_only_metadata",
        title: "Live metadata appears only after rendering",
        category: "metadata",
        severity: "high",
        confidence: "high",
        status: "needs_attention",
        evidence: [
          ev("audit", undefined, undefined, "title changed from raw generic fallback to rendered page title."),
          ev("social_preview", undefined, undefined, "Open Graph title appears only after rendering."),
        ],
        whyItMatters: "Raw HTML is usually safer for crawler and preview-bot visibility than metadata injected after JavaScript runs.",
        nextAction: "Move essential metadata into the framework's raw HTML or server-rendered metadata path.",
      }),
    ];
  }
  return [
    ...findingsFor("vite-client-only-metadata"),
    ...findingsFor("placeholder-content"),
    ...findingsFor("missing-social-assets"),
    ...findingsFor("hardcoded-localhost"),
  ].slice(0, 6);
}

function frameworkFor(
  scenario: GeneratedSiteSmellMockScenario,
  framework: RepoInspectionJsonContract["framework"] | undefined,
): GeneratedSiteSmellsJsonContract["framework"] {
  if (scenario === "unsupported-framework") {
    return {
      kind: "unknown",
      name: "Unknown",
      confidence: "low",
      evidence: [{ kind: "file", value: "Mock unsupported framework shape", weight: "weak" }],
    };
  }
  if (framework) {
    return {
      kind: framework.id,
      name: framework.name,
      confidence: framework.confidence,
      evidence: framework.evidence,
    };
  }
  return {
    kind: "vite_react",
    name: "Vite React",
    confidence: "high",
    evidence: [{ kind: "config_file", path: "vite.config.ts", value: "Vite config found", weight: "medium" }],
  };
}

function finding(input: Omit<Finding, "relatedCommands" | "relatedContracts"> & {
  relatedCommands?: string[];
  relatedContracts?: string[];
}): Finding {
  return {
    ...input,
    relatedCommands: input.relatedCommands ?? ["pnpm shipready smells <path> --json"],
    relatedContracts: input.relatedContracts ?? [CONTRACT_NAMES.generatedSiteSmells],
  };
}

function ev(
  source: Finding["evidence"][number]["source"],
  path: string | undefined,
  line: number | undefined,
  valuePreview: string,
): Finding["evidence"][number] {
  return {
    source,
    ...(path ? { path } : {}),
    ...(line ? { line } : {}),
    valuePreview,
    message: path ? `${path}${line ? `:${line}` : ""}` : "Deterministic mock evidence.",
  };
}

function countSeverities(findings: Finding[]): GeneratedSiteSmellsJsonContract["summary"]["severityCounts"] {
  return findings.reduce((counts, item) => {
    counts[item.severity] += 1;
    return counts;
  }, { high: 0, medium: 0, low: 0, info: 0 });
}

function summaryStatus(findings: Finding[]): GeneratedSiteSmellsJsonContract["summary"]["status"] {
  if (findings.length === 0) return "clean";
  if (findings.some((finding) => finding.severity === "high" || finding.severity === "medium")) return "needs_attention";
  if (findings.some((finding) => finding.status === "manual_review")) return "manual_review";
  return "unknown";
}

function nextActionsFor(findings: Finding[]): string[] {
  if (findings.length === 0) {
    return ["No generated-site implementation smells were found in this deterministic mock scenario."];
  }
  return Array.from(new Set(findings.map((finding) => finding.nextAction))).slice(0, 5);
}
