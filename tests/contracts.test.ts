import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { formatCliErrorJson } from "../src/report/formatCliErrorJson";
import { formatDryRunFixJsonReport } from "../src/report/formatDryRunFixJsonReport";
import { formatFixPlanJsonReport } from "../src/report/formatFixPlanJsonReport";
import { formatJsonReport } from "../src/report/formatJsonReport";
import { formatRepoInspectionJsonReport } from "../src/report/formatRepoInspectionJsonReport";
import { formatUiReportJsonReport } from "../src/report/formatUiReportJsonReport";
import { formatWriteFixJsonReport } from "../src/report/formatWriteFixJsonReport";
import { AuditResultSchema } from "../src/types/audit";
import {
  AuditJsonContractSchema,
  CLI_JSON_CONTRACT_BY_COMMAND,
  CliErrorContractSchema,
  CONTRACT_NAMES,
  DryRunFixJsonContractSchema,
  FixPlanJsonContractSchema,
  RepoInspectionJsonContractSchema,
  UiReportJsonContractSchema,
  WriteFixJsonContractSchema,
} from "../src/types/contracts";
import { DryRunFixResultSchema } from "../src/types/dryRunFix";
import { FixPlanResultSchema } from "../src/types/fixPlan";
import { RepoInspectionResultSchema } from "../src/types/repoInspection";
import { UiReportSchema } from "../src/types/uiReport";
import { WriteFixResultSchema } from "../src/types/writeFix";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const contracts = join(root, "validation", "contracts");

describe("CLI JSON contracts", () => {
  it.each([
    ["audit.clean.json", AuditJsonContractSchema, CONTRACT_NAMES.audit],
    ["audit.needs-work.json", AuditJsonContractSchema, CONTRACT_NAMES.audit],
    ["inspect-repo.next-app.json", RepoInspectionJsonContractSchema, CONTRACT_NAMES.repoInspection],
    ["inspect-repo.vite.json", RepoInspectionJsonContractSchema, CONTRACT_NAMES.repoInspection],
    ["plan-fixes.safe-apply.json", FixPlanJsonContractSchema, CONTRACT_NAMES.fixPlan],
    ["plan-fixes.review-required.json", FixPlanJsonContractSchema, CONTRACT_NAMES.fixPlan],
    ["fix-dry-run.safe-apply.json", DryRunFixJsonContractSchema, CONTRACT_NAMES.dryRunFix],
    ["fix-dry-run.review-required.json", DryRunFixJsonContractSchema, CONTRACT_NAMES.dryRunFix],
    ["fix-dry-run.skipped.json", DryRunFixJsonContractSchema, CONTRACT_NAMES.dryRunFix],
    ["fix-write.safe-create.json", WriteFixJsonContractSchema, CONTRACT_NAMES.writeFix],
    ["fix-write.blocked.json", WriteFixJsonContractSchema, CONTRACT_NAMES.writeFix],
    ["fix-write.skipped.json", WriteFixJsonContractSchema, CONTRACT_NAMES.writeFix],
    ["ui-report.safe-apply.json", UiReportJsonContractSchema, CONTRACT_NAMES.uiReport],
    ["ui-report.url-only.json", UiReportJsonContractSchema, CONTRACT_NAMES.uiReport],
    ["error.invalid-url.json", CliErrorContractSchema, CONTRACT_NAMES.error],
  ] as const)("parses %s and preserves its discriminator", (name, schema, contract) => {
    const fixture = readFixture(name);

    expect(() => schema.parse(fixture)).not.toThrow();
    expect(fixture).toMatchObject({ contract });
  });

  it("keeps the command-to-contract mapping explicit", () => {
    expect(CLI_JSON_CONTRACT_BY_COMMAND).toEqual({
      "audit --json": "shipready.audit.v1",
      "inspect-repo --json": "shipready.repoInspection.v1",
      "plan-fixes --json": "shipready.fixPlan.v1",
      "fix --dry-run --json": "shipready.dryRunFix.v1",
      "fix --write --allow-create --json": "shipready.writeFix.v1",
      "ui-report --json": "shipready.uiReport.v1",
    });
  });

  it("adds contract discriminators at every runtime formatter boundary", () => {
    expect(contractOf(formatJsonReport(
      AuditResultSchema.parse(readFixture("audit.clean.json")),
    ))).toBe(CONTRACT_NAMES.audit);
    expect(contractOf(formatRepoInspectionJsonReport(
      RepoInspectionResultSchema.parse(readFixture("inspect-repo.next-app.json")),
    ))).toBe(CONTRACT_NAMES.repoInspection);
    expect(contractOf(formatFixPlanJsonReport(
      FixPlanResultSchema.parse(readFixture("plan-fixes.safe-apply.json")),
    ))).toBe(CONTRACT_NAMES.fixPlan);
    expect(contractOf(formatDryRunFixJsonReport(
      DryRunFixResultSchema.parse(readFixture("fix-dry-run.safe-apply.json")),
    ))).toBe(CONTRACT_NAMES.dryRunFix);
    expect(contractOf(formatWriteFixJsonReport(
      WriteFixResultSchema.parse(readFixture("fix-write.safe-create.json")),
    ))).toBe(CONTRACT_NAMES.writeFix);
    expect(contractOf(formatUiReportJsonReport(
      UiReportSchema.parse(readFixture("ui-report.url-only.json")),
    ))).toBe(CONTRACT_NAMES.uiReport);
  });

  it("keeps dry-run preview, skipped, and review-required states distinct", () => {
    const safe = DryRunFixJsonContractSchema.parse(readFixture("fix-dry-run.safe-apply.json"));
    const review = DryRunFixJsonContractSchema.parse(readFixture("fix-dry-run.review-required.json"));
    const skipped = DryRunFixJsonContractSchema.parse(readFixture("fix-dry-run.skipped.json"));

    expect(safe.fileChanges.some((change) => change.reviewStatus === "auto_candidate")).toBe(true);
    expect(review.fileChanges.some((change) => change.reviewStatus === "review_required")).toBe(true);
    expect(skipped.fileChanges).toEqual([]);
    expect(skipped.skippedActions).toEqual([
      expect.objectContaining({ reasonKind: "requires_more_information" }),
    ]);
  });

  it("keeps written, skipped, and blocked write states as separate fields", () => {
    const written = WriteFixJsonContractSchema.parse(readFixture("fix-write.safe-create.json"));
    const blocked = WriteFixJsonContractSchema.parse(readFixture("fix-write.blocked.json"));
    const skipped = WriteFixJsonContractSchema.parse(readFixture("fix-write.skipped.json"));

    expect(written).toMatchObject({
      mode: "write",
      wroteFiles: true,
      policy: "creation_only_robots_sitemap_v1",
    });
    expect(written.createdFiles).toHaveLength(2);
    expect(written.skippedActions).toEqual([]);
    expect(written.blockedChanges).toEqual([]);
    expect(written.createdFiles[0]).toEqual(expect.objectContaining({
      bytesWritten: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(blocked.wroteFiles).toBe(false);
    expect(blocked.createdFiles).toEqual([]);
    expect(blocked.blockedChanges).toEqual([
      expect.objectContaining({ path: "index.html", reviewStatus: "review_required" }),
    ]);
    expect(skipped.wroteFiles).toBe(false);
    expect(skipped.createdFiles).toEqual([]);
    expect(skipped.skippedActions).toEqual([
      expect.objectContaining({ reasonKind: "requires_more_information" }),
    ]);
  });

  it("preserves the ui-report v1 discriminator", () => {
    const report = UiReportJsonContractSchema.parse(readFixture("ui-report.safe-apply.json"));

    expect(report.contract).toBe("shipready.uiReport.v1");
    expect(report.schemaVersion).toBe("ui-report-v1");
    expect(report.safeApply?.available).toBe(true);
  });

  it("keeps stable JSON error code and message semantics", () => {
    const fixture = CliErrorContractSchema.parse(readFixture("error.invalid-url.json"));
    const runtime = CliErrorContractSchema.parse(JSON.parse(formatCliErrorJson({
      code: "invalid_url",
      message: fixture.message,
    })));

    expect(runtime).toEqual(fixture);
    expect(runtime.error).toBe(runtime.message);
  });

  it.each([
    [
      "invalid_url",
      "Invalid URL. Provide an absolute http:// or https:// URL.",
      ["shipready", "audit", "not-a-url", "--json"],
    ],
    [
      "invalid_timeout",
      "Invalid timeout. Provide a positive number of milliseconds.",
      ["shipready", "audit", "https://example.com", "--timeout", "0", "--json"],
    ],
    [
      "invalid_mode",
      "ShipReady fix requires an explicit mode. Re-run with --dry-run to preview proposed changes or --write --allow-create to create eligible missing robots/sitemap files.",
      ["shipready", "fix", ".", "--url", "https://example.com", "--json"],
    ],
  ] as const)("emits error contract code %s with exit code 1", async (code, message, args) => {
    try {
      await execFileAsync("pnpm", [...args], {
        cwd: root,
        timeout: 10_000,
      });
      throw new Error("Expected command to fail.");
    } catch (error) {
      const result = error as { code?: number; stdout?: string; stderr?: string };
      expect(result.code).toBe(1);
      expect(result.stderr).toBe("");
      expect(CliErrorContractSchema.parse(JSON.parse(result.stdout ?? ""))).toMatchObject({
        contract: "shipready.error.v1",
        code,
        message,
      });
    }
  });
});

function readFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(contracts, name), "utf8")) as Record<string, unknown>;
}

function contractOf(json: string): string | undefined {
  return (JSON.parse(json) as { contract?: string }).contract;
}
