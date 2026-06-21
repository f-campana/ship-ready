import { z } from "zod";
import { AuditResultSchema } from "./audit";
import { DryRunFixResultSchema } from "./dryRunFix";
import { FixPlanResultSchema } from "./fixPlan";
import { RepoInspectionResultSchema } from "./repoInspection";
import { UiReportSchema } from "./uiReport";
import { WriteFixResultSchema } from "./writeFix";

export const CONTRACT_NAMES = {
  audit: "shipready.audit.v1",
  repoInspection: "shipready.repoInspection.v1",
  fixPlan: "shipready.fixPlan.v1",
  dryRunFix: "shipready.dryRunFix.v1",
  writeFix: "shipready.writeFix.v1",
  uiReport: "shipready.uiReport.v1",
  error: "shipready.error.v1",
} as const;

export const CLI_JSON_CONTRACT_BY_COMMAND = {
  "audit --json": CONTRACT_NAMES.audit,
  "inspect-repo --json": CONTRACT_NAMES.repoInspection,
  "plan-fixes --json": CONTRACT_NAMES.fixPlan,
  "fix --dry-run --json": CONTRACT_NAMES.dryRunFix,
  "fix --write --allow-create --json": CONTRACT_NAMES.writeFix,
  "ui-report --json": CONTRACT_NAMES.uiReport,
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

export const CliErrorCodeSchema = z.enum([
  "invalid_url",
  "invalid_timeout",
  "invalid_repo_path",
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
