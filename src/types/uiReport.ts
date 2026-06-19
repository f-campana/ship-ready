import { z } from "zod";

export const UiUserSeveritySchema = z.enum([
  "blocking",
  "important",
  "recommended",
  "optional_polish",
  "ready",
]);

export const UiWorkflowStageSchema = z.enum([
  "audit",
  "repo_inspection",
  "fix_plan",
  "dry_run",
]);

export const UiWorkflowStepSchema = z.enum([
  "connect_repo",
  "review_readiness",
  "review_project",
  "review_fix_plan",
  "review_patch_preview",
  "apply_safe_fixes",
  "deploy_then_recheck",
  "no_changes_needed",
  "manual_review_required",
]);

export const UiNextActionSchema = z.object({
  label: z.string(),
  action: z.enum([
    "select_repo",
    "review_readiness",
    "review_project",
    "review_fix_plan",
    "review_patch_preview",
    "write_safe_fixes",
    "review_manual",
    "deploy_then_recheck",
    "retry",
    "none",
  ]),
  primary: z.boolean(),
  enabled: z.boolean(),
  explanation: z.string().optional(),
});

export const UiIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  explanation: z.string(),
  whyItMatters: z.string(),
  userSeverity: UiUserSeveritySchema,
  technicalSeverity: z.enum(["critical", "warning", "info", "passed"]),
  sourceCheckIds: z.array(z.string()),
  developerDetails: z.record(z.string(), z.unknown()).optional(),
});

export const UiReadinessSchema = z.object({
  label: z.enum(["ready", "almost_ready", "needs_attention"]),
  title: z.string(),
  summary: z.string(),
  score: z.number().optional(),
  topIssues: z.array(UiIssueSchema),
  passedHighlights: z.array(UiIssueSchema),
  optionalPolish: z.array(UiIssueSchema),
});

export const UiPreviewCardSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  card: z.string().optional(),
  missingFields: z.array(z.string()),
  source: z.enum(["raw", "rendered", "fallback"]),
});

export const UiPreviewCardsSchema = z.object({
  google: UiPreviewCardSchema.extend({
    url: z.string(),
  }),
  social: UiPreviewCardSchema,
  twitter: UiPreviewCardSchema,
  crawlerView: z.object({
    rawHtmlSummary: z.string(),
    renderedHtmlSummary: z.string(),
    renderOnlyWarnings: z.array(UiIssueSchema),
  }),
});

export const UiProjectSummarySchema = z.object({
  detected: z.boolean(),
  frameworkLabel: z.string(),
  confidenceLabel: z.enum(["good_match", "likely_match", "manual_review"]),
  explanation: z.string(),
  importantFiles: z.array(z.string()),
  supportedFixes: z.array(z.string()),
  limitations: z.array(z.string()),
});

export const UiFixActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  explanation: z.string(),
  targetLabel: z.string().optional(),
  affectsLiveSiteAfterDeploy: z.boolean(),
  safety: z.enum([
    "safe_to_apply",
    "needs_review",
    "manual_only",
    "preview_only",
    "already_good",
  ]),
  canApplyInV1: z.boolean(),
  reviewReason: z.string().optional(),
  sourceActionIds: z.array(z.string()),
  developerDetails: z.record(z.string(), z.unknown()).optional(),
});

export const UiActionGroupsSchema = z.object({
  safeToApply: z.array(UiFixActionSchema),
  needsReview: z.array(UiFixActionSchema),
  manualOnly: z.array(UiFixActionSchema),
  alreadyGood: z.array(UiIssueSchema),
  optionalPolish: z.array(UiIssueSchema),
});

export const UiPatchPreviewSummarySchema = z.object({
  hasPreview: z.boolean(),
  fileChanges: z.array(
    z.object({
      path: z.string(),
      changeType: z.enum(["create", "update"]),
      title: z.string(),
      risk: z.string(),
      reviewStatus: z.string(),
      eligibleForWrite: z.boolean(),
      writePolicy: z.literal("creation_only_robots_sitemap_v1"),
      writeBlockReason: z.string().optional(),
      sourceActionIds: z.array(z.string()),
      diff: z.string().optional(),
    }),
  ),
  skippedActions: z.array(
    z.object({
      title: z.string(),
      reason: z.string(),
    }),
  ),
});

export const UiSafeApplySummarySchema = z.object({
  available: z.boolean(),
  buttonLabel: z.string(),
  explanation: z.string(),
  eligibleFiles: z.array(z.string()),
  blockedFiles: z.array(
    z.object({
      path: z.string(),
      reason: z.string(),
    }),
  ),
  policy: z.literal("creation_only_robots_sitemap_v1"),
  safetyNotes: z.array(z.string()),
});

export const UiLiveVsLocalStateSchema = z.object({
  localChangesAffectLiveSite: z.literal(false),
  deploymentRequired: z.boolean(),
  message: z.string(),
});

export const UiErrorSchema = z.object({
  stage: z.enum(["audit", "repo_inspection", "fix_plan", "dry_run"]),
  code: z.enum([
    "invalid_url",
    "network_error",
    "timeout",
    "invalid_repo_path",
    "unsupported_repo",
    "command_failed",
    "unknown",
  ]),
  title: z.string(),
  message: z.string(),
  suggestedAction: z.string(),
  retryable: z.boolean(),
  developerDetails: z.unknown().optional(),
});

export const UiDeveloperDetailsSchema = z.object({
  rawAudit: z.unknown().optional(),
  rawRepoInspection: z.unknown().optional(),
  rawFixPlan: z.unknown().optional(),
  rawDryRun: z.unknown().optional(),
});

export const UiReportSchema = z.object({
  schemaVersion: z.literal("ui-report-v1"),
  generatedAt: z.string(),
  input: z.object({
    url: z.string(),
    repoPath: z.string().optional(),
    mode: z.enum(["url_only", "url_and_repo"]),
  }),
  workflow: z.object({
    currentRecommendedStep: UiWorkflowStepSchema,
    completedStages: z.array(UiWorkflowStageSchema),
    availableNextActions: z.array(UiNextActionSchema),
  }),
  readiness: UiReadinessSchema,
  previews: UiPreviewCardsSchema,
  project: UiProjectSummarySchema.optional(),
  actionGroups: UiActionGroupsSchema.optional(),
  patchPreview: UiPatchPreviewSummarySchema.optional(),
  safeApply: UiSafeApplySummarySchema.optional(),
  liveVsLocal: UiLiveVsLocalStateSchema,
  errors: z.array(UiErrorSchema),
  developerDetails: UiDeveloperDetailsSchema,
});

export type UiUserSeverity = z.infer<typeof UiUserSeveritySchema>;
export type UiWorkflowStage = z.infer<typeof UiWorkflowStageSchema>;
export type UiWorkflowStep = z.infer<typeof UiWorkflowStepSchema>;
export type UiIssue = z.infer<typeof UiIssueSchema>;
export type UiNextAction = z.infer<typeof UiNextActionSchema>;
export type UiWorkflow = z.infer<typeof UiReportSchema>["workflow"];
export type UiReadiness = z.infer<typeof UiReadinessSchema>;
export type UiPreviewSource = UiPreviewCards["google"]["source"];
export type UiPreviewCards = z.infer<typeof UiPreviewCardsSchema>;
export type UiProjectSummary = z.infer<typeof UiProjectSummarySchema>;
export type UiFixAction = z.infer<typeof UiFixActionSchema>;
export type UiActionGroups = z.infer<typeof UiActionGroupsSchema>;
export type UiPatchPreviewSummary = z.infer<typeof UiPatchPreviewSummarySchema>;
export type UiSafeApplySummary = z.infer<typeof UiSafeApplySummarySchema>;
export type UiLiveVsLocalState = z.infer<typeof UiLiveVsLocalStateSchema>;
export type UiError = z.infer<typeof UiErrorSchema>;
export type UiDeveloperDetails = z.infer<typeof UiDeveloperDetailsSchema>;
export type UiReport = z.infer<typeof UiReportSchema>;
