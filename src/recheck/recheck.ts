import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { auditUrl, type AuditUrlOptions } from "../audit/auditUrl";
import { inspectRepo } from "../repo/inspectRepo";
import type { AuditResult, ResourceCheck } from "../types/audit";
import {
  CONTRACT_NAMES,
  RecheckJsonContractSchema,
  type RecheckJsonContract,
} from "../types/contracts";
import type { RepoInspectionResult } from "../types/repoInspection";
import { NetworkError } from "../utils/http";
import { normalizeAuditUrl } from "../utils/url";

export type RecheckInput = {
  url: string;
  repoPath?: string;
  timeoutMs?: number;
  userAgent?: string;
};

export type RecheckOperations = {
  audit: (url: string, options: AuditUrlOptions) => Promise<AuditResult>;
  inspect: typeof inspectRepo;
  now: () => string;
};

const DEFAULT_OPERATIONS: RecheckOperations = {
  audit: auditUrl,
  inspect: inspectRepo,
  now: () => new Date().toISOString(),
};

export async function recheck(
  input: RecheckInput,
  overrides: Partial<RecheckOperations> = {},
): Promise<RecheckJsonContract> {
  const operations = { ...DEFAULT_OPERATIONS, ...overrides };
  const url = normalizeAuditUrl(input.url);
  let inspection: RepoInspectionResult | undefined;
  let expectedFiles: Array<{ path: string; kind: "robots" | "sitemap"; exists: boolean }> | undefined;

  if (input.repoPath) {
    inspection = operations.inspect(input.repoPath);
    expectedFiles = expectedCrawlFiles(resolve(input.repoPath), inspection);
  }

  let audit: AuditResult | undefined;
  let auditUnavailable = false;
  try {
    audit = await operations.audit(url, {
      timeoutMs: input.timeoutMs,
      userAgent: input.userAgent,
      render: false,
    });
  } catch (error) {
    if (!(error instanceof NetworkError)) throw error;
    auditUnavailable = true;
  }

  return createRecheckResult({
    url,
    checkedAt: operations.now(),
    audit,
    auditUnavailable,
    inspection,
    expectedFiles,
  });
}

export type RecheckResultInput = {
  url: string;
  checkedAt: string;
  audit?: AuditResult;
  auditUnavailable?: boolean;
  inspection?: RepoInspectionResult;
  expectedFiles?: Array<{ path: string; kind: "robots" | "sitemap"; exists: boolean }>;
};

export function createRecheckResult(input: RecheckResultInput): RecheckJsonContract {
  const mode = input.inspection ? "repo_backed" : "url_only";
  const live = input.audit
    ? {
        robots: classifyResource("robots", input.audit.resources.robotsTxt),
        sitemap: classifyResource("sitemap", input.audit.resources.sitemapXml),
        auditContract: CONTRACT_NAMES.audit,
      }
    : {
        robots: unavailableResource("robots", input.auditUnavailable),
        sitemap: unavailableResource("sitemap", input.auditUnavailable),
      };
  const local = input.inspection
    ? {
        repoPath: input.inspection.path,
        framework: input.inspection.framework.name,
        expectedFiles: input.expectedFiles ?? [],
        inspectionContract: CONTRACT_NAMES.repoInspection,
      }
    : undefined;
  const outcome = classifyOutcome(live, local);

  return RecheckJsonContractSchema.parse({
    contract: CONTRACT_NAMES.recheck,
    url: input.url,
    checkedAt: input.checkedAt,
    mode,
    live,
    local,
    deployment: outcome.deployment,
    verdict: outcome.verdict,
    limitations: [
      "Recheck reads public evidence only; it does not deploy or call hosting provider APIs.",
      "Visible crawl files do not guarantee crawling, indexing, propagation, or third-party behavior.",
      ...(mode === "url_only"
        ? ["Local repository state is unknown, so deployment status is not checked."]
        : ["Local expected paths are inferred only from the current V1-safe framework conventions."]),
    ],
    nextActions: outcome.nextActions,
  });
}

function expectedCrawlFiles(
  repoRoot: string,
  inspection: RepoInspectionResult,
): Array<{ path: string; kind: "robots" | "sitemap"; exists: boolean }> {
  let paths: Array<{ path: string; kind: "robots" | "sitemap" }> = [];
  if (inspection.framework.id === "static_html") {
    paths = [{ path: "robots.txt", kind: "robots" }, { path: "sitemap.xml", kind: "sitemap" }];
  } else if (inspection.framework.id === "vite_react") {
    paths = [{ path: "public/robots.txt", kind: "robots" }, { path: "public/sitemap.xml", kind: "sitemap" }];
  } else if (inspection.framework.id === "next_app_router") {
    const evidencePaths = [
      ...inspection.framework.evidence.map((item) => item.path),
      ...inspection.importantFiles.map((item) => item.path),
      ...inspection.routes.map((item) => item.path),
      ...inspection.metadataLocations.map((item) => item.path),
    ].filter((path): path is string => Boolean(path));
    const appRoot = evidencePaths.some((path) => path === "src/app" || path.startsWith("src/app/"))
      ? "src/app"
      : "app";
    paths = [
      { path: `${appRoot}/robots.ts`, kind: "robots" },
      { path: `${appRoot}/sitemap.ts`, kind: "sitemap" },
    ];
  }

  return paths.map((file) => ({
    ...file,
    exists: existsSync(resolve(repoRoot, file.path)),
  }));
}

function classifyResource(kind: "robots" | "sitemap", resource: ResourceCheck) {
  const label = kind === "robots" ? "robots.txt" : "sitemap.xml";
  const base = {
    url: resource.finalUrl ?? resource.url,
    ...(resource.statusCode !== undefined ? { httpStatus: resource.statusCode } : {}),
  };
  if (resource.exists) {
    return { ...base, status: "present" as const, message: `Live ${label} appears present.` };
  }
  if (resource.error && resource.statusCode === undefined) {
    return {
      ...base,
      status: "unreachable" as const,
      message: `Live ${label} could not be read; this does not show that it is missing.`,
    };
  }
  if (resource.statusCode === 404 || resource.statusCode === 410) {
    return {
      ...base,
      status: "missing" as const,
      message: `Live ${label} was not observed at the conventional URL (HTTP ${resource.statusCode}).`,
    };
  }
  if (kind === "sitemap" && resource.statusCode !== undefined && resource.statusCode >= 200 && resource.statusCode < 300) {
    return {
      ...base,
      status: "invalid" as const,
      message: "The live sitemap URL responded, but the body did not appear to be an XML sitemap.",
    };
  }
  return {
    ...base,
    status: "unknown" as const,
    message: `Live ${label} presence could not be determined from the observed response.`,
  };
}

function unavailableResource(kind: "robots" | "sitemap", unavailable = false) {
  const label = kind === "robots" ? "robots.txt" : "sitemap.xml";
  return {
    status: unavailable ? "unreachable" as const : "unknown" as const,
    message: unavailable
      ? `The live page audit was unreachable, so ${label} presence could not be determined.`
      : `No live audit evidence was available for ${label}.`,
  };
}

function classifyOutcome(
  live: {
    robots: { status: string };
    sitemap: { status: string };
  },
  local: { expectedFiles: Array<{ exists: boolean }> } | undefined,
) {
  const statuses = [live.robots.status, live.sitemap.status];
  const present = statuses.filter((status) => status === "present").length;
  const absent = statuses.filter((status) => status === "missing" || status === "invalid").length;
  const uncertain = statuses.some((status) => status === "unreachable" || status === "unknown");

  if (!local) {
    if (uncertain) {
      return outcome(
        "not_checked",
        "Deployment status is not checked without local repository evidence.",
        "unknown",
        "Live crawl-file evidence is incomplete or unreachable.",
        ["Retry the read-only recheck when the public URL and crawl resources are reachable."],
      );
    }
    if (present === 2) {
      return outcome(
        "not_checked",
        "Both live crawl files appear present, but deployment status is not checked without local evidence.",
        "ready",
        "Live robots.txt and sitemap.xml appear present.",
        ["Review the reported limitations; crawling and indexing remain outside ShipReady's control."],
      );
    }
    return outcome(
      "not_checked",
      "Deployment status is not checked without local repository evidence.",
      "needs_attention",
      "One or more live crawl files were not observed.",
      ["Inspect the local repository, make any approved changes, deploy externally, then run a repo-backed recheck."],
    );
  }

  if (local.expectedFiles.length !== 2) {
    return outcome(
      "unknown",
      "The local framework does not expose two V1-safe expected crawl-file paths, so deployment comparison is unknown.",
      "unknown",
      "ShipReady could not make a supported local-to-live crawl-file comparison.",
      ["Review the framework's crawl-file conventions manually; ShipReady will not create or deploy unsupported files."],
    );
  }

  const localPresent = local.expectedFiles.filter((file) => file.exists).length;
  if (uncertain) {
    return outcome(
      "unknown",
      "Live evidence is incomplete, so ShipReady cannot infer whether local crawl files appear deployed.",
      "unknown",
      "The local-to-live comparison is inconclusive.",
      ["Retry after the public URL and both conventional crawl-file URLs are reachable."],
    );
  }
  if (localPresent === 2 && present === 2) {
    return outcome(
      "appears_deployed",
      "Local expected crawl files exist and both corresponding live resources appear present.",
      "ready",
      "The local crawl-file state appears visible on the live site.",
      ["No deployment action is indicated by this comparison; continue monitoring without assuming crawling or indexing."],
    );
  }
  if (localPresent === 2 && absent === 2) {
    return outcome(
      "appears_not_deployed",
      "Local expected crawl files exist, but both live resources still appear missing or invalid.",
      "needs_deploy",
      "The local crawl-file changes appear not deployed or not served at the conventional URLs.",
      ["Deploy through your normal external workflow or review hosting configuration, then run recheck again."],
    );
  }
  if (localPresent === 2 && present === 1 && absent === 1) {
    return outcome(
      "partially_deployed",
      "Local expected crawl files exist, but only one corresponding live resource appears present.",
      "needs_attention",
      "The local crawl-file changes appear only partially visible on the live site.",
      ["Review deployment and hosting configuration for the missing or invalid live resource, then run recheck again."],
    );
  }
  if (localPresent < 2 && absent > 0) {
    return outcome(
      "not_checked",
      "One or more local expected files are absent, so ShipReady cannot attribute missing live resources to deployment.",
      "needs_attention",
      "Local and live crawl-file evidence both need attention.",
      ["Review the missing local expected files before deploying externally and rechecking."],
    );
  }
  return outcome(
    "unknown",
    "Live crawl files appear present, but the local expected file set is incomplete, so deployment attribution is unknown.",
    "ready",
    "Live robots.txt and sitemap.xml appear present; their source cannot be attributed to the local expected paths.",
    ["Review local framework conventions if local-to-live attribution is required."],
  );
}

function outcome(
  deploymentStatus: RecheckJsonContract["deployment"]["status"],
  deploymentMessage: string,
  verdictStatus: RecheckJsonContract["verdict"]["status"],
  verdictSummary: string,
  nextActions: string[],
) {
  return {
    deployment: { status: deploymentStatus, message: deploymentMessage },
    verdict: { status: verdictStatus, summary: verdictSummary },
    nextActions,
  };
}
