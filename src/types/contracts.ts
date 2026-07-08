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
  recheck: "shipready.recheck.v1",
  socialPreview: "shipready.socialPreview.v1",
  generatedSiteSmells: "shipready.generatedSiteSmells.v1",
  crawl: "shipready.crawl.v1",
  patchExport: "shipready.patchExport.v1",
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
  "recheck --json": CONTRACT_NAMES.recheck,
  "social-preview --json": CONTRACT_NAMES.socialPreview,
  "smells --json": CONTRACT_NAMES.generatedSiteSmells,
  "crawl --json": CONTRACT_NAMES.crawl,
  "patch-export --json": CONTRACT_NAMES.patchExport,
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

export const PatchExportFormatSchema = z.enum(["unified-diff", "bundle"]);
export const PatchExportOutputKindSchema = z.enum(["file", "stdout", "inline"]);

const PatchExportOutputSchema = z.object({
  kind: PatchExportOutputKindSchema,
  path: z.string().min(1).optional(),
  wroteArtifact: z.boolean(),
  bytes: z.number().int().nonnegative(),
  bytesWritten: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  content: z.string().optional(),
}).strict().superRefine((output, context) => {
  if (output.kind === "file") {
    if (!output.path) {
      context.addIssue({
        code: "custom",
        path: ["path"],
        message: "File patch exports require an output path.",
      });
    }
    if (!output.wroteArtifact) {
      context.addIssue({
        code: "custom",
        path: ["wroteArtifact"],
        message: "File patch exports must report the explicit artifact write.",
      });
    }
    if (output.bytesWritten !== output.bytes) {
      context.addIssue({
        code: "custom",
        path: ["bytesWritten"],
        message: "File patch exports must report the written artifact byte count.",
      });
    }
    if (output.content !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: "File patch export JSON must not embed patch content by default.",
      });
    }
  } else {
    if (output.wroteArtifact) {
      context.addIssue({
        code: "custom",
        path: ["wroteArtifact"],
        message: "Stdout and inline patch exports must not report file writes.",
      });
    }
    if (output.bytesWritten !== 0) {
      context.addIssue({
        code: "custom",
        path: ["bytesWritten"],
        message: "Stdout and inline patch exports must not report filesystem writes.",
      });
    }
  }
  if (output.kind === "inline" && output.content === undefined) {
    context.addIssue({
      code: "custom",
      path: ["content"],
      message: "Inline MCP patch exports must include patch content.",
    });
  }
});

const PatchExportChangeSchema = z.object({
  path: z.string().min(1),
  changeType: z.enum(["create", "update"]),
  risk: z.enum(["low", "medium", "high"]),
  reviewStatus: z.enum(["auto_candidate", "review_required"]),
  requiresHumanReview: z.boolean(),
  included: z.literal(true),
  reason: z.string().min(1),
  sourceActionIds: z.array(z.string().min(1)),
}).strict();

const PatchExportSkippedChangeSchema = z.object({
  kind: z.enum(["file_change", "dry_run_action"]),
  path: z.string().min(1).optional(),
  actionId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  changeType: z.enum(["create", "update"]).optional(),
  risk: z.enum(["low", "medium", "high"]),
  reviewStatus: z.enum(["auto_candidate", "review_required"]).optional(),
  requiresHumanReview: z.boolean().optional(),
  included: z.literal(false),
  reason: z.string().min(1),
  sourceActionIds: z.array(z.string().min(1)),
}).strict();

export const PatchExportJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.patchExport),
  generatedAt: z.string().min(1),
  url: z.string().min(1),
  repoPath: z.string().min(1),
  mode: z.literal("patch_export"),
  format: PatchExportFormatSchema,
  options: z.object({
    safeOnly: z.boolean(),
    includeReviewRequired: z.boolean(),
  }).strict(),
  output: PatchExportOutputSchema,
  source: z.object({
    dryRunContract: z.literal(CONTRACT_NAMES.dryRunFix),
    dryRunGeneratedAt: z.string().min(1),
    policy: z.literal("review_export_only"),
  }).strict(),
  summary: z.object({
    exportedChanges: z.number().int().nonnegative(),
    skippedChanges: z.number().int().nonnegative(),
    safeAutoCandidates: z.number().int().nonnegative(),
    reviewRequired: z.number().int().nonnegative(),
    manualOnly: z.number().int().nonnegative(),
  }).strict(),
  exportedChanges: z.array(PatchExportChangeSchema),
  skippedChanges: z.array(PatchExportSkippedChangeSchema),
  warnings: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)).min(1),
  nextActions: z.array(z.string().min(1)).min(1),
}).strict().superRefine((result, context) => {
  if (result.summary.exportedChanges !== result.exportedChanges.length) {
    context.addIssue({
      code: "custom",
      path: ["summary", "exportedChanges"],
      message: "exportedChanges count must match the exportedChanges array length.",
    });
  }
  if (result.summary.skippedChanges !== result.skippedChanges.length) {
    context.addIssue({
      code: "custom",
      path: ["summary", "skippedChanges"],
      message: "skippedChanges count must match the skippedChanges array length.",
    });
  }
  if (result.mode !== "patch_export" || result.source.policy !== "review_export_only") {
    context.addIssue({
      code: "custom",
      path: ["mode"],
      message: "Patch export must remain a review-only export mode.",
    });
  }
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

const RecheckLiveResourceSchema = z.object({
  status: z.enum(["present", "missing", "invalid", "unreachable", "unknown"]),
  url: z.string().min(1).optional(),
  httpStatus: z.number().int().optional(),
  message: z.string().min(1),
}).strict();

export const RecheckJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.recheck),
  url: z.string().min(1),
  checkedAt: z.string().min(1),
  mode: z.enum(["url_only", "repo_backed"]),
  live: z.object({
    robots: RecheckLiveResourceSchema,
    sitemap: RecheckLiveResourceSchema,
    auditContract: z.literal(CONTRACT_NAMES.audit).optional(),
  }).strict(),
  local: z.object({
    repoPath: z.string().min(1),
    framework: z.string().min(1).optional(),
    expectedFiles: z.array(z.object({
      path: z.string().min(1),
      kind: z.enum(["robots", "sitemap"]),
      exists: z.boolean(),
    }).strict()),
    inspectionContract: z.literal(CONTRACT_NAMES.repoInspection),
  }).strict().optional(),
  deployment: z.object({
    status: z.enum([
      "not_checked",
      "appears_deployed",
      "appears_not_deployed",
      "partially_deployed",
      "unknown",
    ]),
    message: z.string().min(1),
  }).strict(),
  verdict: z.object({
    status: z.enum(["ready", "needs_deploy", "needs_attention", "unknown"]),
    summary: z.string().min(1),
  }).strict(),
  limitations: z.array(z.string().min(1)).min(1),
  nextActions: z.array(z.string().min(1)).min(1),
}).strict().superRefine((result, context) => {
  if (result.mode === "url_only" && result.local) {
    context.addIssue({
      code: "custom",
      path: ["local"],
      message: "URL-only recheck must not include local repository evidence.",
    });
  }
  if (result.mode === "url_only" && result.deployment.status !== "not_checked") {
    context.addIssue({
      code: "custom",
      path: ["deployment", "status"],
      message: "URL-only recheck cannot infer deployment status.",
    });
  }
  if (result.mode === "repo_backed" && !result.local) {
    context.addIssue({
      code: "custom",
      path: ["local"],
      message: "Repo-backed recheck requires local repository evidence.",
    });
  }
});

const SocialPreviewSourceFieldNameSchema = z.enum([
  "title",
  "meta description",
  "canonical",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:type",
  "og:site_name",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
]);

const SocialPreviewFieldStatusSchema = z.enum([
  "present",
  "missing",
  "fallback",
  "unknown",
]);

const SocialPreviewFieldSourceSchema = z.enum([
  "raw_html",
  "rendered_html",
  "fallback",
  "unknown",
]);

const SocialPreviewObservedFieldSchema = z.object({
  name: SocialPreviewSourceFieldNameSchema,
  rawValue: z.string().min(1).optional(),
  renderedValue: z.string().min(1).optional(),
  selectedValue: z.string().min(1).optional(),
  selectedSource: SocialPreviewFieldSourceSchema,
  status: SocialPreviewFieldStatusSchema,
}).strict();

const SocialPreviewFieldSchema = z.object({
  status: SocialPreviewFieldStatusSchema,
  value: z.string().min(1).optional(),
  source: SocialPreviewFieldSourceSchema,
  sourceField: SocialPreviewSourceFieldNameSchema.optional(),
  message: z.string().min(1),
}).strict();

const SocialPreviewImageFieldSchema = SocialPreviewFieldSchema.extend({
  assetStatus: z.enum(["not_checked", "reachable", "unreachable", "unknown"]),
  assetMessage: z.string().min(1),
}).strict();

const SocialPreviewSurfaceSchema = z.object({
  surface: z.enum([
    "google_search",
    "generic_social",
    "x_twitter",
    "slack_discord",
    "linkedin",
  ]),
  label: z.string().min(1),
  fields: z.object({
    title: SocialPreviewFieldSchema,
    description: SocialPreviewFieldSchema,
    url: SocialPreviewFieldSchema,
    cardType: SocialPreviewFieldSchema.optional(),
    image: SocialPreviewImageFieldSchema.optional(),
  }).strict(),
  warnings: z.array(z.string().min(1)),
}).strict();

const SocialPreviewRawRenderedDifferenceSchema = z.object({
  field: SocialPreviewSourceFieldNameSchema,
  rawValue: z.string().min(1).optional(),
  renderedValue: z.string().min(1).optional(),
  status: z.enum([
    "missing_in_both",
    "present_in_raw",
    "present_after_render_only",
    "changed_after_render",
  ]),
}).strict();

export const SocialPreviewJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.socialPreview),
  url: z.string().min(1),
  checkedAt: z.string().min(1),
  mode: z.enum(["live", "mock"]),
  sourceMode: z.enum(["raw", "rendered", "both"]),
  canonicalUrl: z.string().min(1).optional(),
  previews: z.object({
    google_search: SocialPreviewSurfaceSchema,
    generic_social: SocialPreviewSurfaceSchema,
    x_twitter: SocialPreviewSurfaceSchema,
    slack_discord: SocialPreviewSurfaceSchema,
    linkedin: SocialPreviewSurfaceSchema,
  }).strict(),
  fields: z.array(SocialPreviewObservedFieldSchema).min(1),
  image: SocialPreviewImageFieldSchema,
  warnings: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)).min(1),
  comparison: z.object({
    rawVsRendered: z.array(SocialPreviewRawRenderedDifferenceSchema),
  }).strict(),
  verdict: z.object({
    status: z.enum(["ready", "needs_attention", "unknown"]),
    summary: z.string().min(1),
  }).strict(),
  nextActions: z.array(z.string().min(1)).min(1),
}).strict().superRefine((result, context) => {
  for (const [key, preview] of Object.entries(result.previews)) {
    if (preview.surface !== key) {
      context.addIssue({
        code: "custom",
        path: ["previews", key, "surface"],
        message: "Preview surface key must match its surface discriminator.",
      });
    }
  }
  if (result.verdict.status === "ready") {
    const hasMissing = Object.values(result.previews).some((preview) =>
      Object.values(preview.fields).some((field) => field?.status === "missing"));
    if (hasMissing) {
      context.addIssue({
        code: "custom",
        path: ["verdict", "status"],
        message: "A ready simulated preview must not contain missing preview fields.",
      });
    }
  }
});

const GeneratedSiteSmellCategorySchema = z.enum([
  "metadata",
  "crawlability",
  "preview",
  "routing",
  "assets",
  "content_placeholders",
  "configuration",
  "framework",
  "generated_boilerplate",
  "unknown",
]);

const GeneratedSiteSmellSeveritySchema = z.enum(["high", "medium", "low", "info"]);
const GeneratedSiteSmellConfidenceSchema = z.enum(["high", "medium", "low"]);
const GeneratedSiteSmellFindingStatusSchema = z.enum(["needs_attention", "manual_review", "info"]);

const GeneratedSiteSmellEvidenceSchema = z.object({
  source: z.enum(["repo", "audit", "social_preview", "scanner", "mock"]),
  path: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  field: z.string().min(1).optional(),
  valuePreview: z.string().min(1).max(140).optional(),
  message: z.string().min(1),
}).strict();

const GeneratedSiteSmellFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: GeneratedSiteSmellCategorySchema,
  severity: GeneratedSiteSmellSeveritySchema,
  confidence: GeneratedSiteSmellConfidenceSchema,
  status: GeneratedSiteSmellFindingStatusSchema,
  evidence: z.array(GeneratedSiteSmellEvidenceSchema).min(1).max(8),
  whyItMatters: z.string().min(1),
  nextAction: z.string().min(1),
  relatedCommands: z.array(z.string().min(1)),
  relatedContracts: z.array(z.string().min(1)),
}).strict();

export const GeneratedSiteSmellsJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.generatedSiteSmells),
  checkedAt: z.string().min(1),
  mode: z.enum(["repo_only", "repo_plus_url", "mock"]),
  repoPath: z.string().min(1),
  url: z.string().min(1).optional(),
  framework: z.object({
    kind: z.string().min(1),
    name: z.string().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    evidence: z.array(z.object({
      kind: z.string().min(1),
      path: z.string().min(1).optional(),
      value: z.string().min(1),
      weight: z.enum(["strong", "medium", "weak"]),
    }).strict()),
  }).strict(),
  summary: z.object({
    status: z.enum(["clean", "needs_attention", "manual_review", "unknown"]),
    severityCounts: z.object({
      high: z.number().int().nonnegative(),
      medium: z.number().int().nonnegative(),
      low: z.number().int().nonnegative(),
      info: z.number().int().nonnegative(),
    }).strict(),
    findingCount: z.number().int().nonnegative(),
  }).strict(),
  findings: z.array(GeneratedSiteSmellFindingSchema),
  scanned: z.object({
    files: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
    skippedFiles: z.number().int().nonnegative(),
    truncated: z.boolean(),
    limits: z.object({
      maxFiles: z.number().int().positive(),
      maxBytes: z.number().int().positive(),
      maxFileBytes: z.number().int().positive(),
      maxFindings: z.number().int().positive(),
      maxValuePreviewLength: z.number().int().positive(),
    }).strict(),
  }).strict(),
  limitations: z.array(z.string().min(1)).min(1),
  nextActions: z.array(z.string().min(1)).min(1),
}).strict().superRefine((result, context) => {
  const severityCounts = { high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of result.findings) severityCounts[finding.severity] += 1;
  for (const severity of GeneratedSiteSmellSeveritySchema.options) {
    if (result.summary.severityCounts[severity] !== severityCounts[severity]) {
      context.addIssue({
        code: "custom",
        path: ["summary", "severityCounts", severity],
        message: `Expected ${severityCounts[severity]} ${severity} generated-site smell findings.`,
      });
    }
  }
  if (result.summary.findingCount !== result.findings.length) {
    context.addIssue({
      code: "custom",
      path: ["summary", "findingCount"],
      message: "findingCount must match findings length.",
    });
  }
  if (result.mode === "repo_only" && result.url) {
    context.addIssue({
      code: "custom",
      path: ["url"],
      message: "Repo-only generated-site smell results must not include a URL.",
    });
  }
  const serialized = JSON.stringify(result);
  if (/[?&](token|secret|key|password|code)=/i.test(serialized)) {
    context.addIssue({
      code: "custom",
      path: ["findings"],
      message: "Generated-site smell output must not expose sensitive query strings.",
    });
  }
});

const CrawlPageStatusSchema = z.enum(["ready", "needs_attention", "critical", "unknown"]);
const CrawlIssueSeveritySchema = z.enum(["critical", "warning", "info"]);
const CrawlSourceSchema = z.enum(["start", "links", "sitemap"]);
const CrawlSkippedReasonSchema = z.enum([
  "outside_origin",
  "unsupported_protocol",
  "asset",
  "duplicate",
  "limit_reached",
  "query_skipped",
  "robots_disallowed",
  "error",
]);

const CrawlTopIssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: CrawlIssueSeveritySchema,
  category: z.enum([
    "metadata",
    "social",
    "schema",
    "crawlability",
    "structure",
    "accessibility",
    "launch_hygiene",
    "unknown",
  ]),
}).strict();

const CrawlPageSummarySchema = z.object({
  url: z.string().min(1),
  depth: z.number().int().nonnegative(),
  discoveredFrom: z.string().min(1).optional(),
  source: CrawlSourceSchema,
  status: CrawlPageStatusSchema,
  httpStatus: z.number().int().optional(),
  score: z.number().optional(),
  title: z.string().min(1).max(180).optional(),
  description: z.string().min(1).max(240).optional(),
  canonicalUrl: z.string().min(1).optional(),
  issueSummary: z.object({
    critical: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    topIssueTitles: z.array(z.string().min(1)).max(5),
  }).strict(),
  topIssues: z.array(CrawlTopIssueSchema).max(5),
  auditContract: z.literal(CONTRACT_NAMES.audit).optional(),
}).strict();

const CrawlRepeatedFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  severity: CrawlIssueSeveritySchema,
  count: z.number().int().positive(),
  affectedPages: z.array(z.string().min(1)).min(1),
  message: z.string().min(1),
}).strict();

const CrawlConsistencyIssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: CrawlIssueSeveritySchema,
  message: z.string().min(1),
  affectedPages: z.array(z.string().min(1)).min(1),
}).strict();

const CrawlSkippedUrlSchema = z.object({
  url: z.string().min(1).optional(),
  discoveredFrom: z.string().min(1).optional(),
  source: z.enum(["links", "sitemap"]).optional(),
  reason: CrawlSkippedReasonSchema,
  message: z.string().min(1),
}).strict();

export const CrawlJsonContractSchema = z.object({
  contract: z.literal(CONTRACT_NAMES.crawl),
  checkedAt: z.string().min(1),
  mode: z.enum(["live", "mock"]),
  startUrl: z.string().min(1),
  origin: z.string().min(1),
  options: z.object({
    maxPages: z.number().int().positive().max(25),
    maxDepth: z.number().int().nonnegative().max(2),
    source: z.enum(["sitemap", "links", "both"]),
    rendered: z.boolean(),
  }).strict(),
  summary: z.object({
    status: z.enum(["ready", "needs_attention", "unknown"]),
    pagesChecked: z.number().int().nonnegative(),
    pagesDiscovered: z.number().int().nonnegative(),
    pagesSkipped: z.number().int().nonnegative(),
    criticalIssues: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    repeatedIssues: z.number().int().nonnegative(),
  }).strict(),
  pages: z.array(CrawlPageSummarySchema).max(25),
  repeatedFindings: z.array(CrawlRepeatedFindingSchema).max(20),
  consistency: z.object({
    canonicalHosts: z.array(z.object({
      host: z.string().min(1),
      count: z.number().int().positive(),
      urls: z.array(z.string().min(1)).min(1),
    }).strict()),
    titlePatterns: z.object({
      duplicateTitles: z.array(z.object({
        title: z.string().min(1).max(180),
        count: z.number().int().positive(),
        urls: z.array(z.string().min(1)).min(1),
      }).strict()),
      missingTitles: z.number().int().nonnegative(),
    }).strict(),
    missingMetadata: z.array(z.object({
      field: z.enum(["title", "description", "canonical", "og:image"]),
      count: z.number().int().positive(),
      urls: z.array(z.string().min(1)).min(1),
    }).strict()),
    issues: z.array(CrawlConsistencyIssueSchema).max(20),
  }).strict(),
  skipped: z.array(CrawlSkippedUrlSchema).max(50),
  limitations: z.array(z.string().min(1)).min(1),
  nextActions: z.array(z.string().min(1)).min(1),
}).strict().superRefine((result, context) => {
  if (result.summary.pagesChecked !== result.pages.length) {
    context.addIssue({
      code: "custom",
      path: ["summary", "pagesChecked"],
      message: "pagesChecked must match the compact pages array length.",
    });
  }
  if (result.summary.repeatedIssues !== result.repeatedFindings.length) {
    context.addIssue({
      code: "custom",
      path: ["summary", "repeatedIssues"],
      message: "repeatedIssues must match repeatedFindings length.",
    });
  }
  const serialized = JSON.stringify(result);
  if (/<(?:!doctype|html|head|body|script|meta)\b/i.test(serialized)) {
    context.addIssue({
      code: "custom",
      path: ["pages"],
      message: "Crawl output must not embed raw HTML bodies.",
    });
  }
  if (/[?&](token|secret|key|password|code|session|auth)=/i.test(serialized)) {
    context.addIssue({
      code: "custom",
      path: ["pages"],
      message: "Crawl output must not expose sensitive query strings.",
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
    boundedMultiPageCrawl: z.literal("read_only_bounded_sample"),
    fullSiteCrawler: NotImplementedSchema,
    monitoring: NotImplementedSchema,
    scheduledCrawls: NotImplementedSchema,
    patchExport: z.literal("review_only_export"),
    patchApply: NotImplementedSchema,
    generatedSiteSmells: z.literal("read_only_detector"),
    aiAuthorshipDetection: NotImplementedSchema,
    smellDetectorAutoFixes: NotImplementedSchema,
    socialPreview: z.literal("read_only_simulator"),
    socialPlatformApis: NotImplementedSchema,
    exactSocialRenderingGuarantee: z.literal(false),
    searchConsole: z.enum(["not_implemented", "mock_prototype"]),
    dns: z.enum(["not_implemented", "read_only_status"]),
    dnsProviderWrites: NotImplementedSchema,
    dnsProviderIntegrations: NotImplementedSchema,
    github: NotImplementedSchema,
    deployment: NotImplementedSchema,
    postWriteRecheck: z.literal("read_only"),
    deploymentAutomation: NotImplementedSchema,
    deployProviderIntegrations: NotImplementedSchema,
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
  "invalid_output_path",
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
export type PatchExportJsonContract = z.infer<typeof PatchExportJsonContractSchema>;
export type UiReportJsonContract = z.infer<typeof UiReportJsonContractSchema>;
export type SearchConsoleStatusJsonContract = z.infer<typeof SearchConsoleStatusJsonContractSchema>;
export type DnsStatusJsonContract = z.infer<typeof DnsStatusJsonContractSchema>;
export type RecheckJsonContract = z.infer<typeof RecheckJsonContractSchema>;
export type SocialPreviewJsonContract = z.infer<typeof SocialPreviewJsonContractSchema>;
export type GeneratedSiteSmellsJsonContract = z.infer<typeof GeneratedSiteSmellsJsonContractSchema>;
export type CrawlJsonContract = z.infer<typeof CrawlJsonContractSchema>;
export type StatusJsonContract = z.infer<typeof StatusJsonContractSchema>;
export type DoctorCheckStatus = z.infer<typeof DoctorCheckStatusSchema>;
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
export type DoctorJsonContract = z.infer<typeof DoctorJsonContractSchema>;
