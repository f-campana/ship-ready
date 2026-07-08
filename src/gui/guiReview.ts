import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { crawlSite } from "../crawl/crawl";
import { getDnsStatus } from "../dns/dnsStatus";
import { createUiReport, type CreateUiReportInput } from "../report/createUiReport";
import { recheck } from "../recheck/recheck";
import { getSearchConsoleStatus } from "../searchConsole/searchConsoleStatus";
import { getGeneratedSiteSmells } from "../smells/generatedSiteSmells";
import { getSocialPreview } from "../socialPreview/socialPreview";
import type {
  CrawlJsonContract,
  DnsStatusJsonContract,
  GeneratedSiteSmellsJsonContract,
  RecheckJsonContract,
  SearchConsoleStatusJsonContract,
  SocialPreviewJsonContract,
} from "../types/contracts";
import type { UiReport } from "../types/uiReport";
import { normalizeAuditUrl } from "../utils/url";

export type GuiReviewInclude = {
  uiReport?: boolean;
  audit?: boolean;
  repo?: boolean;
  fixPlan?: boolean;
  dryRun?: boolean;
  socialPreview?: boolean;
  crawl?: boolean;
  smells?: boolean;
  dns?: boolean;
  searchConsole?: boolean;
  recheck?: boolean;
};

export type GuiReviewRequestOptions = {
  crawlMaxPages?: number;
  crawlMaxDepth?: number;
  socialPreviewSource?: "raw" | "rendered" | "both";
  rendered?: boolean;
};

export type GuiReviewInput = {
  url: string;
  repoPath?: string;
  include?: GuiReviewInclude;
  options?: GuiReviewRequestOptions;
  timeoutMs?: number;
  userAgent?: string;
  generatedAt?: string;
};

export type GuiReviewOperations = {
  createReport: (input: CreateUiReportInput) => Promise<UiReport>;
  socialPreview: typeof getSocialPreview;
  crawl: typeof crawlSite;
  smells: typeof getGeneratedSiteSmells;
  dnsStatus: typeof getDnsStatus;
  searchConsoleStatus: typeof getSearchConsoleStatus;
  recheck: typeof recheck;
};

export type GuiReviewCheckName =
  | "socialPreview"
  | "crawl"
  | "smells"
  | "dns"
  | "searchConsole"
  | "recheck";

type GuiReviewCheckPayload = {
  socialPreview: SocialPreviewJsonContract;
  crawl: CrawlJsonContract;
  smells: GeneratedSiteSmellsJsonContract;
  dns: DnsStatusJsonContract;
  searchConsole: SearchConsoleStatusJsonContract;
  recheck: RecheckJsonContract;
};

export type GuiReviewCheckResult =
  | {
      status: "ready";
      label: string;
      result: GuiReviewCheckPayload[GuiReviewCheckName];
      summary: Record<string, string | number | boolean | undefined>;
    }
  | {
      status: "skipped";
      label: string;
      message: string;
    }
  | {
      status: "error";
      label: string;
      error: {
        message: string;
        stage: GuiReviewCheckName;
      };
    };

export type GuiReview = {
  schemaVersion: "ui-review-v1";
  generatedAt: string;
  input: {
    url: string;
    repoPath?: string;
    mode: "url_only" | "url_and_repo";
  };
  endpoints: Array<{
    path: string;
    method: "POST";
    readOnly: true;
    description: string;
  }>;
  uiReport?: UiReport;
  checks: Partial<Record<GuiReviewCheckName, GuiReviewCheckResult>>;
  commands: {
    uiReport: string;
    socialPreview: string;
    crawl: string;
    dnsStatus: string;
    searchConsoleStatus: string;
    recheck: string;
    smells?: string;
    githubPrDraft?: string;
  };
  safety: string[];
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CRAWL_MAX_PAGES = 8;
const DEFAULT_CRAWL_MAX_DEPTH = 1;

const DEFAULT_OPERATIONS: GuiReviewOperations = {
  createReport: createUiReport,
  socialPreview: getSocialPreview,
  crawl: crawlSite,
  smells: getGeneratedSiteSmells,
  dnsStatus: getDnsStatus,
  searchConsoleStatus: getSearchConsoleStatus,
  recheck,
};

export async function createGuiReview(
  input: GuiReviewInput,
  operations: Partial<GuiReviewOperations> = {},
): Promise<GuiReview> {
  const ops = { ...DEFAULT_OPERATIONS, ...operations };
  const include = normalizeInclude(input.include);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const url = normalizeAuditUrl(input.url);
  const displayUrl = stripUrlQueryAndHash(url);
  const repoPath = input.repoPath;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rendered = input.options?.rendered ?? true;
  const checks: GuiReview["checks"] = {};

  let uiReport: UiReport | undefined;
  if (include.uiReport) {
    uiReport = await ops.createReport({
      url,
      repoPath,
      timeoutMs,
      userAgent: input.userAgent,
      render: rendered,
    });
  }

  await Promise.all([
    include.socialPreview
      ? runCheck("socialPreview", "Social preview simulator", async () => {
          const result = await ops.socialPreview({
            url,
            source: input.options?.socialPreviewSource ?? "both",
            timeoutMs,
            userAgent: input.userAgent,
          });
          checks.socialPreview = readyCheck("Social preview simulator", result, {
            status: result.verdict.status,
            warnings: result.warnings.length,
            surfaces: Object.keys(result.previews).length,
            approximate: true,
          });
        }, checks)
      : undefined,
    include.crawl
      ? runCheck("crawl", "Bounded crawl", async () => {
          const result = await ops.crawl({
            url,
            maxPages: input.options?.crawlMaxPages ?? DEFAULT_CRAWL_MAX_PAGES,
            maxDepth: input.options?.crawlMaxDepth ?? DEFAULT_CRAWL_MAX_DEPTH,
            rendered,
            timeoutMs,
            userAgent: input.userAgent,
          });
          checks.crawl = readyCheck("Bounded crawl", result, {
            status: result.summary.status,
            pagesChecked: result.summary.pagesChecked,
            pagesDiscovered: result.summary.pagesDiscovered,
            pagesSkipped: result.summary.pagesSkipped,
            repeatedIssues: result.summary.repeatedIssues,
            limited: result.skipped.some((item) => item.reason === "limit_reached"),
          });
        }, checks)
      : undefined,
    include.smells
      ? runCheck("smells", "Project smells", async () => {
          if (!repoPath) {
            checks.smells = {
              status: "skipped",
              label: "Project smells",
              message: "Project smell review needs a local repository path.",
            };
            return;
          }

          const result = await ops.smells({
            repoPath,
            url,
            timeoutMs,
            userAgent: input.userAgent,
            render: rendered,
          });
          checks.smells = readyCheck("Project smells", result, {
            status: result.summary.status,
            findings: result.summary.findingCount,
            scannedFiles: result.scanned.files,
            heuristic: true,
          });
        }, checks)
      : undefined,
    include.dns
      ? runCheck("dns", "DNS status", async () => {
          const result = await ops.dnsStatus({ url, timeoutMs });
          checks.dns = readyCheck("DNS status", result, {
            status: result.verdict.status,
            mode: result.mode,
            hosts: result.hosts.length,
            readOnly: true,
          });
        }, checks)
      : undefined,
    include.searchConsole
      ? runCheck("searchConsole", "Search Console mock status", async () => {
          const result = await ops.searchConsoleStatus({ url });
          checks.searchConsole = readyCheck("Search Console mock status", result, {
            mode: result.mode,
            authorization: result.authorization.status,
            property: result.propertyMatch.status,
            mockBacked: result.mode === "mock",
          });
        }, checks)
      : undefined,
    include.recheck
      ? runCheck("recheck", "Post-deploy recheck", async () => {
          const result = await ops.recheck({ url, repoPath, timeoutMs, userAgent: input.userAgent });
          checks.recheck = readyCheck("Post-deploy recheck", result, {
            verdict: result.verdict.status,
            deployment: result.deployment.status,
            mode: result.mode,
            readOnly: true,
          });
        }, checks)
      : undefined,
  ].filter(Boolean));

  return redactQueryStringsDeep({
    schemaVersion: "ui-review-v1",
    generatedAt,
    input: {
      url: displayUrl,
      ...(repoPath ? { repoPath: resolve(repoPath) } : {}),
      mode: repoPath ? "url_and_repo" : "url_only",
    },
    endpoints: [
      {
        path: "/api/review",
        method: "POST",
        readOnly: true,
        description: "Aggregate local GUI review surface with on-demand read-only checks.",
      },
      {
        path: "/api/ui-report",
        method: "POST",
        readOnly: true,
        description: "Compatibility endpoint for the existing ui-report-v1 model.",
      },
    ],
    ...(uiReport ? { uiReport } : {}),
    checks,
    commands: buildCommands(displayUrl, repoPath),
    safety: [
      "GUI endpoints are local and read-only.",
      "The GUI does not run fix --write or shipready.write_safe_crawl_files.",
      "Safe crawl-file candidates are previewed as copyable CLI commands only.",
      "GitHub PR draft handoff is copy-only; no PR, branch, commit, push, deployment, GitHub API call, or Git command is executed by the GUI.",
      "No metadata, content, JSON-LD, package, configuration, DNS, Search Console, Git, GitHub, provider, or deployment action is executed by the GUI.",
      "Search Console status is mock-backed; DNS, social preview, crawl, smell review, and recheck surfaces are read-only.",
    ],
  });
}

export function validateGuiRepoPath(repoPath: string): string | undefined {
  const trimmed = repoPath.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 4096 || trimmed.includes("\0")) {
    throw new Error("Local repo path must be a bounded filesystem path.");
  }

  const absolutePath = resolve(trimmed);
  if (!existsSync(absolutePath)) {
    throw new Error("Local repo path must be an existing directory.");
  }

  const stat = statSync(absolutePath);
  if (!stat.isDirectory()) {
    throw new Error("Local repo path must be an existing directory.");
  }

  return absolutePath;
}

function normalizeInclude(include: GuiReviewInclude | undefined): Required<GuiReviewInclude> {
  return {
    uiReport: include?.uiReport ?? include?.audit ?? include?.repo ?? include?.fixPlan ?? include?.dryRun ?? true,
    audit: include?.audit ?? false,
    repo: include?.repo ?? false,
    fixPlan: include?.fixPlan ?? false,
    dryRun: include?.dryRun ?? false,
    socialPreview: include?.socialPreview ?? false,
    crawl: include?.crawl ?? false,
    smells: include?.smells ?? false,
    dns: include?.dns ?? false,
    searchConsole: include?.searchConsole ?? false,
    recheck: include?.recheck ?? false,
  };
}

async function runCheck<Name extends GuiReviewCheckName>(
  name: Name,
  label: string,
  callback: () => Promise<void>,
  checks: GuiReview["checks"],
): Promise<void> {
  try {
    await callback();
  } catch (error) {
    checks[name] = {
      status: "error",
      label,
      error: {
        stage: name,
        message: error instanceof Error ? error.message : "Read-only check failed.",
      },
    };
  }
}

function readyCheck(
  label: string,
  result: GuiReviewCheckPayload[GuiReviewCheckName],
  summary: Record<string, string | number | boolean | undefined>,
): GuiReviewCheckResult {
  return {
    status: "ready",
    label,
    result,
    summary,
  };
}

function buildCommands(url: string, repoPath: string | undefined): GuiReview["commands"] {
  return {
    uiReport: repoPath
      ? `pnpm shipready ui-report ${formatCommandArg(repoPath)} --url ${formatCommandArg(url)} --json`
      : `pnpm shipready ui-report --url ${formatCommandArg(url)} --json`,
    socialPreview: `pnpm shipready social-preview --url ${formatCommandArg(url)} --json`,
    crawl: `pnpm shipready crawl --url ${formatCommandArg(url)} --json`,
    dnsStatus: `pnpm shipready dns status --url ${formatCommandArg(url)} --json`,
    searchConsoleStatus: `pnpm shipready search-console status --url ${formatCommandArg(url)} --json`,
    recheck: repoPath
      ? `pnpm shipready recheck ${formatCommandArg(repoPath)} --url ${formatCommandArg(url)} --json`
      : `pnpm shipready recheck --url ${formatCommandArg(url)} --json`,
    ...(repoPath
      ? {
          smells: `pnpm shipready smells ${formatCommandArg(repoPath)} --url ${formatCommandArg(url)} --json`,
          githubPrDraft: `pnpm shipready github-pr-draft ${formatCommandArg(repoPath)} --url ${formatCommandArg(url)} --output /tmp/shipready-pr.md --include-gh-command`,
        }
      : {}),
  };
}

function formatCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
  return `'${value.split("'").join("'\\''")}'`;
}

function stripUrlQueryAndHash(value: string): string {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function redactQueryStringsDeep<T>(value: T): T {
  if (typeof value === "string") {
    return redactUrlsInText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactQueryStringsDeep(item)) as T;
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = redactQueryStringsDeep(child);
    }
    return result as T;
  }

  return value;
}

function redactUrlsInText(value: string): string {
  return value.replace(/https?:\/\/[^\s"'<>]+/g, (match) => {
    try {
      return stripUrlQueryAndHash(match);
    } catch {
      return match;
    }
  });
}
