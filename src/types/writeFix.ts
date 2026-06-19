import { z } from "zod";
import { SkippedFixActionSchema } from "./dryRunFix";

export const WRITE_POLICY_V1 = "creation_only_robots_sitemap_v1" as const;

export const WrittenFileSchema = z.object({
  path: z.string(),
  reason: z.string(),
  sourceActionIds: z.array(z.string()),
  bytesWritten: z.number().int().nonnegative(),
  sha256: z.string(),
});

export const BlockedWriteChangeSchema = z.object({
  path: z.string(),
  reason: z.string(),
  dryRunChangeType: z.string(),
  risk: z.string(),
  reviewStatus: z.string(),
});

export const SafetyCheckSchema = z.object({
  id: z.string(),
  status: z.enum(["passed", "blocked"]),
  message: z.string(),
});

export const RollbackResultSchema = z.object({
  attempted: z.boolean(),
  succeeded: z.boolean(),
  remainingFiles: z.array(z.string()),
  message: z.string(),
});

export const WriteFixResultSchema = z.object({
  url: z.string(),
  repoPath: z.string(),
  generatedAt: z.string(),
  mode: z.literal("write"),
  wroteFiles: z.boolean(),
  policy: z.literal(WRITE_POLICY_V1),
  createdFiles: z.array(WrittenFileSchema),
  skippedActions: z.array(SkippedFixActionSchema),
  blockedChanges: z.array(BlockedWriteChangeSchema),
  safetyChecks: z.array(SafetyCheckSchema),
  rollback: RollbackResultSchema.optional(),
  recommendedNextStep: z.enum([
    "review_created_files",
    "run_audit_again",
    "manual_review_required",
    "no_changes_needed",
  ]),
});

export type WrittenFile = z.infer<typeof WrittenFileSchema>;
export type BlockedWriteChange = z.infer<typeof BlockedWriteChangeSchema>;
export type SafetyCheck = z.infer<typeof SafetyCheckSchema>;
export type RollbackResult = z.infer<typeof RollbackResultSchema>;
export type WriteFixResult = z.infer<typeof WriteFixResultSchema>;
