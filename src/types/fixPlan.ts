import { z } from "zod";

export const FixPlanCategorySchema = z.enum([
  "safe_automated_later",
  "automated_with_review",
  "manual_recommendation",
]);

export const FixPlanPrioritySchema = z.enum(["critical", "high", "medium", "low"]);
export const FixPlanRiskSchema = z.enum(["low", "medium", "high"]);
export const FixPlanConfidenceSchema = z.enum(["high", "medium", "low"]);

export const FutureAutomationSchema = z.object({
  canAutomate: z.boolean(),
  requiresHumanReview: z.boolean(),
  reason: z.string(),
});

export const FixPlanActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  sourceCheckIds: z.array(z.string()),
  category: FixPlanCategorySchema,
  priority: FixPlanPrioritySchema,
  risk: FixPlanRiskSchema,
  confidence: FixPlanConfidenceSchema,
  frameworkStrategy: z.string(),
  targetFiles: z.array(z.string()),
  targetLocations: z.array(z.string()),
  futureAutomation: FutureAutomationSchema,
});

export const NoActionCheckSchema = z.object({
  checkId: z.string(),
  title: z.string(),
  reason: z.string(),
});

export const FixPlanResultSchema = z.object({
  url: z.string(),
  repoPath: z.string(),
  plannedAt: z.string(),
  auditSummary: z.object({
    score: z.number(),
    status: z.enum(["good", "needs_work", "critical"]),
    criticalCount: z.number(),
    warningCount: z.number(),
    noteCount: z.number(),
  }),
  repoSummary: z.object({
    frameworkId: z.string(),
    frameworkName: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    packageManager: z.string(),
  }),
  actions: z.array(FixPlanActionSchema),
  noActionChecks: z.array(NoActionCheckSchema),
  optionalNotes: z.array(z.string()),
  limitations: z.array(z.string()),
  recommendedNextStep: z.enum([
    "no_changes_needed",
    "review_plan",
    "manual_review_required",
    "unsupported_project",
  ]),
});

export type FixPlanCategory = z.infer<typeof FixPlanCategorySchema>;
export type FixPlanPriority = z.infer<typeof FixPlanPrioritySchema>;
export type FixPlanRisk = z.infer<typeof FixPlanRiskSchema>;
export type FixPlanConfidence = z.infer<typeof FixPlanConfidenceSchema>;
export type FutureAutomation = z.infer<typeof FutureAutomationSchema>;
export type FixPlanAction = z.infer<typeof FixPlanActionSchema>;
export type NoActionCheck = z.infer<typeof NoActionCheckSchema>;
export type FixPlanResult = z.infer<typeof FixPlanResultSchema>;
