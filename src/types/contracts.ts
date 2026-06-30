import { z } from "zod";
import { AuditResultSchema } from "./audit";
import { DryRunFixResultSchema } from "./dryRunFix";
import { FixPlanResultSchema } from "./fixPlan";
import { RepoInspectionResultSchema } from "./repoInspection";
import { UiReportSchema } from "./uiReport";
import { WRITE_POLICY_V1, WriteFixResultSchema } from "./writeFix";

export const CONTRACT_NAMES = {
  audit: "shipready.audit.v1",
  repoInspection: "shipready.repoInspection.v1",
  fixPlan: "shipready.fixPlan.v1",
  dryRunFix: "shipready.dryRunFix.v1",
  writeFix: "shipready.writeFix.v1",
  uiReport: "shipready.uiReport.v1",
  searchConsoleStatus: "shipready.searchConsoleStatus.v1",
  dnsStatus: "shipready.dnsStatus.v1",
  status: "shipready.status.v1",
  doctor: "shipready.doctor.v1",
  error: "shipready.error.v1",
} as const;

export const CLI_JSON_CONTRACT_BY_COMMAND = {
  "audit --json": CONTRACT_NAMES.audit,
  "inspect-repo --json": CONTRACT_NAMES.repoInspection,
  "plan-fixes --json": CONTRACT_NAMES.fixPlan,
  "fix --dry-run --json": CONTRACT_NAMES.dryRunFix,
  "fix --write --allow-create --json": CONTRACT_NAMES.writeFix,
  "ui-report --json": CONTRACT_NAMES.uiReport,
  "search-console status --json": CONTRACT_NAMES.searchConsoleStatus,
  "dns status --json": CONTRACT_NAMES.dnsStatus,
  "status --json": CONTRACT_NAMES.status,
  "doctor --json": CONTRACT_NAMES.doctor,
} as const;

export const AuditJsonContractSchema = AuditResultSchema.extend({
  contract: z.literal(CONTRACT_NAMES.audit),
});

export const RepoInspectionJsonContractSchema = RepoInspectionResultSchema.extend({
  contract: z.literal(CONTRACT_NAMES.repoInspection),
});

export const FixPlanJsonContractSchema = FixPlanResultSchema.extend({
  contract: z.literal(CONTRACT_NAMES.fixPlan),
});

export const DryRunFixJsonContractSchema = DryRunFixResultSchema.extend({
  contract: z.literal(CONTRACT_NAMES.dryRunFix),
});

export const WriteFixJsonContractSchema = WriteFixResultSchema.extend({
  contract: z.literal(CONTRACT_NAMES.writeFix),
});

export const UiReportJsonContractSchema = UiReportSchema.extend({
  contract: z.literal(CONTRACT_NAMES.uiReport),
});

const SearchConsolePermissionLevelSchema = z.enum([
  "siteOwner",
  "siteFullUser",
  "siteRestrictedUser",
  "siteUnverifiedUser",
  "UNKNOWN",
]);

const SearchConsolePropertySchema = z.object({
  siteUrl: z.string().min(1),
  type: z.enum(["domain", "url_prefix"]),
  permissionLevel: SearchConsolePermissionLevelSchema,
}).strict();

const SearchConsoleSitemapEntrySchema = z.object({
  path: z.string().min(1),
  lastSubmitted: z.string().min(1).optional(),
  lastDownloaded: z.string().min(1).optional(),
  isPending: z.boolean().optional(),
  isSitemapsIndex: z.boolean().optional(),
  type: z.enum([
    "atomFeed",
    "notSitemap",
    "patternSitemap",
    "rssFeed",
    "sitemap",
    "urlList",
    "UNKNOWN",
  ]).optional(),
  warnings: z.number().int().nonnegative().optional(),
  errors: z.number().int().nonnegative().optional(),
  contents: z.array(z.object({
    type: z.enum([
      "androidApp",
      "image",
      "iosApp",
      "mobile",
      "news",
      "pattern",
      "video",
      "web",
      "UNKNOWN",
    ]),
    submitted: z.number().int().nonnegative().optional(),
  }).strict()).optional(),
}).strict();

const SearchConsoleInspectionResultSchema = z.object({
  verdict: z.enum(["VERDICT_UNSPECIFIED", "PASS", "PARTIAL", "FAIL", "NEUTRAL", "UNKNOWN"]).optional(),
  coverageState: z.string().min(1).optional(),
  robotsTxtState: z.enum([
    "ROBOTS_TXT_STATE_UNSPECIFIED",
    "ALLOWED",
    "DISALLOWED",
    "UNKNOWN",
  ]).optional(),
  indexingState: z.enum([
    "INDEXING_STATE_UNSPECIFIED",
    "INDEXING_ALLOWED",
    "BLOCKED_BY_META_TAG",
    "BLOCKED_BY_HTTP_HEADER",
    "BLOCKED_BY_ROBOTS_TXT",
    "UNKNOWN",
  ]).optional(),
  lastCrawlTime: z.string().min(1).optional(),
  pageFetchState: z.enum([
    "PAGE_FETCH_STATE_UNSPECIFIED",
    "SUCCESSFUL",
    "SOFT_404",
    "BLOCKED_ROBOTS_TXT",
    "NOT_FOUND",
    "ACCESS_DENIED",
    "SERVER_ERROR",
    "REDIRECT_ERROR",
    "ACCESS_FORBIDDEN",
    "BLOCKED_4XX",
    "INTERNAL_CRAWL_ERROR",
    "INVALID_URL",
    "UNKNOWN",
  ]).optional(),
  googleCanonical: z.string().min(1).optional(),
  userCanonical: z.string().min(1).optional(),
  crawledAs: z.enum(["CRAWLING_USER_AGENT_UNSPECIFIED", "DESKTOP", "MOBILE", "UNKNOWN"]).optional(),
  sitemaps: z.array(z.string().min(1)).optional(),
}).strict();

export const SearchConsoleStatusJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.searchConsoleStatus),
  generatedAt: z.string().min(1),
  mode: z.enum(["mock", "live"]),
  requestedUrl: z.string().min(1),
  authorization: z.object({
    status: z.enum([
      "not_configured",
      "authorization_required",
      "authorized",
      "expired",
      "revoked",
    ]),
    scope: z.literal("https://www.googleapis.com/auth/webmasters.readonly").optional(),
  }).strict(),
  propertyMatch: z.object({
    status: z.enum(["not_checked", "matched", "not_accessible", "ambiguous"]),
    strategy: z.enum(["explicit", "most_specific_accessible"]),
    property: SearchConsolePropertySchema.optional(),
  }).strict(),
  sitemaps: z.object({
    status: z.enum(["not_checked", "none_submitted", "available", "error"]),
    entries: z.array(SearchConsoleSitemapEntrySchema),
  }).strict(),
  inspection: z.object({
    requested: z.boolean(),
    status: z.enum(["not_requested", "not_checked", "available", "quota_exceeded", "error"]),
    source: z.literal("google_index"),
    result: SearchConsoleInspectionResultSchema.optional(),
  }).strict(),
  limitations: z.array(z.string().min(1)).min(1),
  nextActions: z.array(z.string().min(1)).min(1),
}).strict().superRefine((status, context) => {
  if (status.mode === "mock" && status.authorization.scope) {
    context.addIssue({
      code: "custom",
      path: ["authorization", "scope"],
      message: "Mock mode must not claim an active OAuth scope.",
    });
  }
  if (status.propertyMatch.status === "matched" && !status.propertyMatch.property) {
    context.addIssue({
      code: "custom",
      path: ["propertyMatch", "property"],
      message: "A matched property status requires property evidence.",
    });
  }
  if (status.propertyMatch.status !== "matched" && status.propertyMatch.property) {
    context.addIssue({
      code: "custom",
      path: ["propertyMatch", "property"],
      message: "Property evidence is allowed only for a matched status.",
    });
  }
  if (status.sitemaps.status !== "available" && status.sitemaps.entries.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["sitemaps", "entries"],
      message: "Sitemap entries are allowed only when sitemap status is available.",
    });
  }
  if (!status.inspection.requested && status.inspection.status !== "not_requested") {
    context.addIssue({
      code: "custom",
      path: ["inspection", "status"],
      message: "An inspection that was not requested must use not_requested.",
    });
  }
  if (status.inspection.status === "available" && !status.inspection.result) {
    context.addIssue({
      code: "custom",
      path: ["inspection", "result"],
      message: "Available inspection status requires a result.",
    });
  }
});

const DnsResolutionStatusSchema = z.enum([
  "ok",
  "nxdomain",
  "nodata",
  "timeout",
  "error",
  "not_checked",
]);

const DnsCaaRecordSchema = z.object({
  flags: z.number().int().nonnegative().optional(),
  tag: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
}).strict();

const DnsHostSchema = z.object({
  host: z.string().min(1),
  role: z.enum(["apex", "www", "other"]),
  records: z.object({
    a: z.array(z.string().min(1)).optional(),
    aaaa: z.array(z.string().min(1)).optional(),
    cname: z.array(z.string().min(1)).optional(),
    txt: z.array(z.string().min(1)).optional(),
    caa: z.array(DnsCaaRecordSchema).optional(),
    ns: z.array(z.string().min(1)).optional(),
  }).strict(),
  resolution: z.object({
    status: DnsResolutionStatusSchema,
    message: z.string().min(1),
  }).strict(),
  cnameChain: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    status: z.enum(["followed", "loop", "too_deep", "target_missing", "error"]),
  }).strict()).optional(),
}).strict();

export const DnsStatusJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.dnsStatus),
  url: z.string().min(1),
  checkedAt: z.string().min(1),
  mode: z.enum(["live", "mock"]),
  domain: z.string().min(1),
  hosts: z.array(DnsHostSchema).min(1),
  canonical: z.object({
    expectedHost: z.string().min(1).optional(),
    observedFinalUrl: z.string().min(1).optional(),
    status: z.enum(["ok", "mismatch", "unknown", "not_checked"]),
    message: z.string().min(1),
  }).strict().optional(),
  dnssec: z.object({
    status: z.enum(["not_checked", "appears_ok", "appears_broken", "unknown"]),
    message: z.string().min(1),
  }).strict().optional(),
  caa: z.object({
    status: z.enum(["not_checked", "not_present", "present", "possible_issue", "unknown"]),
    message: z.string().min(1),
  }).strict().optional(),
  verification: z.object({
    searchConsoleTxt: z.object({
      status: z.enum(["not_checked", "found", "missing", "unknown"]),
      message: z.string().min(1),
    }).strict().optional(),
  }).strict().optional(),
  verdict: z.object({
    status: z.enum(["ready", "needs_attention", "blocked", "unknown"]),
    summary: z.string().min(1),
  }).strict(),
  limitations: z.array(z.string().min(1)).min(1),
  nextActions: z.array(z.string().min(1)).min(1),
}).strict().superRefine((status, context) => {
  const serialized = JSON.stringify(status);
  if (/google-site-verification=[A-Za-z0-9_-]{6,}/i.test(serialized)) {
    context.addIssue({
      code: "custom",
      path: ["verification"],
      message: "DNS status output must not expose raw Search Console verification tokens.",
    });
  }
});

const NotImplementedSchema = z.literal("not_implemented");

export const StatusJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.status),
  version: z.string().min(1),
  mode: z.object({
    cliFirst: z.literal(true),
    mcpSecond: z.literal(true),
    guiThird: z.literal(true),
  }).strict(),
  capabilities: z.object({
    cli: z.array(z.string().min(1)),
    mcp: z.object({
      stdio: z.literal(true),
      readOnlyTools: z.array(z.string().min(1)),
      writeTools: z.array(z.string().min(1)),
      remoteTransport: z.literal(false),
    }).strict(),
    gui: z.object({
      local: z.literal(true),
      writeEndpoint: z.literal(false),
    }).strict(),
  }).strict(),
  writePolicy: z.object({
    name: z.literal("WRITE_POLICY_V1"),
    id: z.literal(WRITE_POLICY_V1),
    summary: z.string().min(1),
    allowed: z.array(z.string().min(1)),
    forbidden: z.array(z.string().min(1)),
  }).strict(),
  integrations: z.object({
    searchConsole: z.enum(["not_implemented", "mock_prototype"]),
    dns: z.enum(["not_implemented", "read_only_status"]),
    dnsProviderWrites: NotImplementedSchema,
    dnsProviderIntegrations: NotImplementedSchema,
    github: NotImplementedSchema,
    deployment: NotImplementedSchema,
  }).strict(),
  demos: z.object({
    fodmappShare: z.string().min(1).optional(),
    fodmappVoiceover: z.string().min(1).optional(),
  }).strict(),
  nextRecommendedCommand: z.string().min(1),
  nextRecommendedPass: z.string().min(1),
}).strict();

export const DoctorCheckStatusSchema = z.enum(["pass", "warn", "fail", "skip"]);

export const DoctorCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: DoctorCheckStatusSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const DoctorJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.doctor),
  ok: z.boolean(),
  checks: z.array(DoctorCheckSchema),
  summary: z.object({
    pass: z.number().int().nonnegative(),
    warn: z.number().int().nonnegative(),
    fail: z.number().int().nonnegative(),
    skip: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((report, context) => {
  const actual = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const check of report.checks) actual[check.status] += 1;
  for (const status of DoctorCheckStatusSchema.options) {
    if (report.summary[status] !== actual[status]) {
      context.addIssue({
        code: "custom",
        path: ["summary", status],
        message: `Expected ${actual[status]} ${status} checks.`,
      });
    }
  }
  if (report.ok !== (actual.fail === 0)) {
    context.addIssue({
      code: "custom",
      path: ["ok"],
      message: "ok must be true exactly when no check failed.",
    });
  }
});

export const CliErrorCodeSchema = z.enum([
  "invalid_url",
  "invalid_timeout",
  "invalid_repo_path",
  "path_not_authorized",
  "fixture_not_found",
  "doc_not_found",
  "network_error",
  "render_error",
  "timeout",
  "cancelled",
  "contract_error",
  "write_forbidden",
  "unsupported_command",
  "internal_error",
  "invalid_mode",
  "write_validation_failed",
  "write_execution_failed",
  "command_failed",
]);

export const CliErrorContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.error),
  ok: z.literal(false),
  code: CliErrorCodeSchema,
  message: z.string(),
  error: z.string(),
  retryable: z.boolean().optional(),
  details: z.object({
    tool: z.string().optional(),
    stage: z.enum([
      "input",
      "authorization",
      "network",
      "render",
      "inspection",
      "contract",
      "cleanup",
    ]).optional(),
    timeoutMs: z.number().int().positive().optional(),
  }).optional(),
  result: WriteFixJsonContractSchema.optional(),
});

export type CliErrorCode = z.infer<typeof CliErrorCodeSchema>;
export type CliErrorContract = z.infer<typeof CliErrorContractSchema>;
export type AuditJsonContract = z.infer<typeof AuditJsonContractSchema>;
export type RepoInspectionJsonContract = z.infer<typeof RepoInspectionJsonContractSchema>;
export type FixPlanJsonContract = z.infer<typeof FixPlanJsonContractSchema>;
export type DryRunFixJsonContract = z.infer<typeof DryRunFixJsonContractSchema>;
export type WriteFixJsonContract = z.infer<typeof WriteFixJsonContractSchema>;
export type UiReportJsonContract = z.infer<typeof UiReportJsonContractSchema>;
export type SearchConsoleStatusJsonContract = z.infer<typeof SearchConsoleStatusJsonContractSchema>;
export type DnsStatusJsonContract = z.infer<typeof DnsStatusJsonContractSchema>;
export type StatusJsonContract = z.infer<typeof StatusJsonContractSchema>;
export type DoctorCheckStatus = z.infer<typeof DoctorCheckStatusSchema>;
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
export type DoctorJsonContract = z.infer<typeof DoctorJsonContractSchema>;
