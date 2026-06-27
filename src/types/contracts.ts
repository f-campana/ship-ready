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
    searchConsole: NotImplementedSchema,
    dns: NotImplementedSchema,
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
export type StatusJsonContract = z.infer<typeof StatusJsonContractSchema>;
export type DoctorCheckStatus = z.infer<typeof DoctorCheckStatusSchema>;
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
export type DoctorJsonContract = z.infer<typeof DoctorJsonContractSchema>;
