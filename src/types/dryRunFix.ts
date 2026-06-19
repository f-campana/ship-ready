import { z } from "zod";

export const DryRunFileChangeSchema = z.object({
  path: z.string(),
  changeType: z.enum(["create", "update"]),
  reason: z.string(),
  sourceActionIds: z.array(z.string()),
  risk: z.enum(["low", "medium", "high"]),
  requiresHumanReview: z.boolean(),
  reviewStatus: z.enum(["auto_candidate", "review_required"]),
  before: z.string().optional(),
  after: z.string(),
  diff: z.string(),
});

export const SkippedFixActionSchema = z.object({
  actionId: z.string(),
  title: z.string(),
  reasonKind: z.enum(["unsafe", "unsupported", "requires_more_information", "not_in_scope"]),
  reason: z.string(),
  sourceActionIds: z.array(z.string()),
  risk: z.enum(["low", "medium", "high"]),
});

export const DryRunFixResultSchema = z.object({
  url: z.string(),
  repoPath: z.string(),
  generatedAt: z.string(),
  mode: z.literal("dry_run"),
  wroteFiles: z.literal(false),
  planSummary: z.object({
    auditScore: z.number(),
    auditStatus: z.enum(["good", "needs_work", "critical"]),
    frameworkId: z.string(),
    frameworkName: z.string(),
    recommendedNextStep: z.string(),
  }),
  fileChanges: z.array(DryRunFileChangeSchema),
  skippedActions: z.array(SkippedFixActionSchema),
  safetyNotes: z.array(z.string()),
  recommendedNextStep: z.enum([
    "review_patch_preview",
    "no_changes_needed",
    "manual_review_required",
    "unsupported_project",
  ]),
});

export type DryRunFileChange = z.infer<typeof DryRunFileChangeSchema>;
export type SkippedFixAction = z.infer<typeof SkippedFixActionSchema>;
export type DryRunFixResult = z.infer<typeof DryRunFixResultSchema>;
