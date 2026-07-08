import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { formatCliErrorJson } from "../src/report/formatCliErrorJson";
import { formatDryRunFixJsonReport } from "../src/report/formatDryRunFixJsonReport";
import { formatFixPlanJsonReport } from "../src/report/formatFixPlanJsonReport";
import { formatJsonReport } from "../src/report/formatJsonReport";
import { formatPatchExportJsonReport } from "../src/report/formatPatchExportReport";
import { formatRepoInspectionJsonReport } from "../src/report/formatRepoInspectionJsonReport";
import { formatUiReportJsonReport } from "../src/report/formatUiReportJsonReport";
import { formatWriteFixJsonReport } from "../src/report/formatWriteFixJsonReport";
import { formatSearchConsoleStatusJson } from "../src/searchConsole/searchConsoleStatus";
import { formatDnsStatusJson } from "../src/dns/dnsStatus";
import { formatRecheckJson } from "../src/report/formatRecheckReport";
import { formatSocialPreviewJson } from "../src/report/formatSocialPreviewReport";
import { formatGeneratedSiteSmellsJson } from "../src/report/formatGeneratedSiteSmellsReport";
import { formatCrawlJson } from "../src/report/formatCrawlReport";
import { AuditResultSchema } from "../src/types/audit";
import {
  AuditJsonContractSchema,
  CLI_JSON_CONTRACT_BY_COMMAND,
  CliErrorContractSchema,
  CONTRACT_NAMES,
  CrawlJsonContractSchema,
  DnsStatusJsonContractSchema,
  DryRunFixJsonContractSchema,
  FixPlanJsonContractSchema,
  GeneratedSiteSmellsJsonContractSchema,
  PatchExportJsonContractSchema,
  RepoInspectionJsonContractSchema,
  RecheckJsonContractSchema,
  SearchConsoleStatusJsonContractSchema,
  SocialPreviewJsonContractSchema,
  UiReportJsonContractSchema,
  WriteFixJsonContractSchema,
  StatusJsonContractSchema,
  DoctorJsonContractSchema,
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
    ["crawl.clean-small-site.json", CrawlJsonContractSchema, CONTRACT_NAMES.crawl],
    ["crawl.missing-descriptions.json", CrawlJsonContractSchema, CONTRACT_NAMES.crawl],
    ["crawl.canonical-inconsistent.json", CrawlJsonContractSchema, CONTRACT_NAMES.crawl],
    ["crawl.social-images-missing.json", CrawlJsonContractSchema, CONTRACT_NAMES.crawl],
    ["crawl.start-unreachable.json", CrawlJsonContractSchema, CONTRACT_NAMES.crawl],
    ["crawl.limit-reached.json", CrawlJsonContractSchema, CONTRACT_NAMES.crawl],
    ["crawl.mixed-readiness.json", CrawlJsonContractSchema, CONTRACT_NAMES.crawl],
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
    ["search-console.not-configured.json", SearchConsoleStatusJsonContractSchema, CONTRACT_NAMES.searchConsoleStatus],
    ["search-console.unauthorized.json", SearchConsoleStatusJsonContractSchema, CONTRACT_NAMES.searchConsoleStatus],
    ["search-console.property-not-found.json", SearchConsoleStatusJsonContractSchema, CONTRACT_NAMES.searchConsoleStatus],
    ["search-console.ready-sitemap-ok.json", SearchConsoleStatusJsonContractSchema, CONTRACT_NAMES.searchConsoleStatus],
    ["search-console.ready-sitemap-warning.json", SearchConsoleStatusJsonContractSchema, CONTRACT_NAMES.searchConsoleStatus],
    ["search-console.inspection-canonical-mismatch.json", SearchConsoleStatusJsonContractSchema, CONTRACT_NAMES.searchConsoleStatus],
    ["search-console.inspection-not-indexed.json", SearchConsoleStatusJsonContractSchema, CONTRACT_NAMES.searchConsoleStatus],
    ["dns.ready.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.apex-ok-www-missing.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.www-cname-ok.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.nxdomain.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.nodata.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.timeout.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.cname-chain-issue.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.caa-present.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.txt-found.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.txt-missing.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["dns.canonical-mismatch.json", DnsStatusJsonContractSchema, CONTRACT_NAMES.dnsStatus],
    ["error.invalid-url.json", CliErrorContractSchema, CONTRACT_NAMES.error],
    ["status.default.json", StatusJsonContractSchema, CONTRACT_NAMES.status],
    ["doctor.default.json", DoctorJsonContractSchema, CONTRACT_NAMES.doctor],
    ["recheck.url-only-ready.json", RecheckJsonContractSchema, CONTRACT_NAMES.recheck],
    ["recheck.url-only-needs-attention.json", RecheckJsonContractSchema, CONTRACT_NAMES.recheck],
    ["recheck.repo-backed-appears-deployed.json", RecheckJsonContractSchema, CONTRACT_NAMES.recheck],
    ["recheck.repo-backed-needs-deploy.json", RecheckJsonContractSchema, CONTRACT_NAMES.recheck],
    ["recheck.repo-backed-partial.json", RecheckJsonContractSchema, CONTRACT_NAMES.recheck],
    ["recheck.unknown.json", RecheckJsonContractSchema, CONTRACT_NAMES.recheck],
    ["social-preview.complete.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.missing-image.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.rendered-only-metadata.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.twitter-fallback.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.missing-description.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.missing-og-url.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.raw-rendered-different.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.image-unreachable.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["social-preview.minimal-title-only.json", SocialPreviewJsonContractSchema, CONTRACT_NAMES.socialPreview],
    ["generated-site-smells.clean.json", GeneratedSiteSmellsJsonContractSchema, CONTRACT_NAMES.generatedSiteSmells],
    ["generated-site-smells.vite-client-only-metadata.json", GeneratedSiteSmellsJsonContractSchema, CONTRACT_NAMES.generatedSiteSmells],
    ["generated-site-smells.placeholder-content.json", GeneratedSiteSmellsJsonContractSchema, CONTRACT_NAMES.generatedSiteSmells],
    ["generated-site-smells.missing-social-assets.json", GeneratedSiteSmellsJsonContractSchema, CONTRACT_NAMES.generatedSiteSmells],
    ["generated-site-smells.hardcoded-localhost.json", GeneratedSiteSmellsJsonContractSchema, CONTRACT_NAMES.generatedSiteSmells],
    ["generated-site-smells.unsupported-framework.json", GeneratedSiteSmellsJsonContractSchema, CONTRACT_NAMES.generatedSiteSmells],
    ["generated-site-smells.repo-plus-url-rendered-only.json", GeneratedSiteSmellsJsonContractSchema, CONTRACT_NAMES.generatedSiteSmells],
    ["patch-export.safe-creations.json", PatchExportJsonContractSchema, CONTRACT_NAMES.patchExport],
    ["patch-export.review-required.json", PatchExportJsonContractSchema, CONTRACT_NAMES.patchExport],
    ["patch-export.no-changes.json", PatchExportJsonContractSchema, CONTRACT_NAMES.patchExport],
    ["patch-export.skipped.json", PatchExportJsonContractSchema, CONTRACT_NAMES.patchExport],
    ["patch-export.stdout.json", PatchExportJsonContractSchema, CONTRACT_NAMES.patchExport],
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
      "search-console status --json": "shipready.searchConsoleStatus.v1",
      "dns status --json": "shipready.dnsStatus.v1",
      "recheck --json": "shipready.recheck.v1",
      "social-preview --json": "shipready.socialPreview.v1",
      "smells --json": "shipready.generatedSiteSmells.v1",
      "crawl --json": "shipready.crawl.v1",
      "patch-export --json": "shipready.patchExport.v1",
      "status --json": "shipready.status.v1",
      "doctor --json": "shipready.doctor.v1",
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
    expect(contractOf(formatSearchConsoleStatusJson(
      SearchConsoleStatusJsonContractSchema.parse(readFixture("search-console.ready-sitemap-ok.json")),
    ))).toBe(CONTRACT_NAMES.searchConsoleStatus);
    expect(contractOf(formatDnsStatusJson(
      DnsStatusJsonContractSchema.parse(readFixture("dns.ready.json")),
    ))).toBe(CONTRACT_NAMES.dnsStatus);
    expect(contractOf(formatRecheckJson(
      RecheckJsonContractSchema.parse(readFixture("recheck.url-only-ready.json")),
    ))).toBe(CONTRACT_NAMES.recheck);
    expect(contractOf(formatSocialPreviewJson(
      SocialPreviewJsonContractSchema.parse(readFixture("social-preview.complete.json")),
    ))).toBe(CONTRACT_NAMES.socialPreview);
    expect(contractOf(formatGeneratedSiteSmellsJson(
      GeneratedSiteSmellsJsonContractSchema.parse(readFixture("generated-site-smells.clean.json")),
    ))).toBe(CONTRACT_NAMES.generatedSiteSmells);
    expect(contractOf(formatCrawlJson(
      CrawlJsonContractSchema.parse(readFixture("crawl.clean-small-site.json")),
    ))).toBe(CONTRACT_NAMES.crawl);
    expect(contractOf(formatPatchExportJsonReport(
      PatchExportJsonContractSchema.parse(readFixture("patch-export.safe-creations.json")),
    ))).toBe(CONTRACT_NAMES.patchExport);
  });

  it("keeps patch export fixtures review-only and constrained", () => {
    const safe = PatchExportJsonContractSchema.parse(readFixture("patch-export.safe-creations.json"));
    const review = PatchExportJsonContractSchema.parse(readFixture("patch-export.review-required.json"));
    const noChanges = PatchExportJsonContractSchema.parse(readFixture("patch-export.no-changes.json"));
    const skipped = PatchExportJsonContractSchema.parse(readFixture("patch-export.skipped.json"));
    const stdout = PatchExportJsonContractSchema.parse(readFixture("patch-export.stdout.json"));

    expect(safe).toMatchObject({
      mode: "patch_export",
      format: "unified-diff",
      source: { dryRunContract: "shipready.dryRunFix.v1", policy: "review_export_only" },
      output: { kind: "file", wroteArtifact: true },
    });
    expect(safe.exportedChanges.map((change) => change.path).sort()).toEqual([
      "src/app/robots.ts",
      "src/app/sitemap.ts",
    ]);
    expect(safe.output).not.toHaveProperty("content");
    expect(review.exportedChanges.some((change) => change.reviewStatus === "review_required")).toBe(true);
    expect(review.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Review-required dry-run changes are included"),
    ]));
    expect(noChanges.summary.exportedChanges).toBe(0);
    expect(skipped.skippedChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "dry_run_action", included: false }),
    ]));
    expect(stdout.output).toMatchObject({
      kind: "stdout",
      wroteArtifact: false,
      bytesWritten: 0,
      content: expect.stringContaining("diff --git a/src/app/robots.ts b/src/app/robots.ts"),
    });
    for (const fixture of [safe, review, noChanges, skipped, stdout]) {
      expect(fixture.output.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(fixture.repoPath).not.toContain("/Users/");
      expect(fixture.limitations.join("\n")).toContain("does not modify the inspected target repository");
      expect(fixture.limitations.join("\n")).toContain("does not apply this patch");
    }
  });

  it("keeps crawl fixtures deterministic, bounded, and constrained", () => {
    const clean = CrawlJsonContractSchema.parse(readFixture("crawl.clean-small-site.json"));
    const missingDescriptions = CrawlJsonContractSchema.parse(readFixture("crawl.missing-descriptions.json"));
    const canonical = CrawlJsonContractSchema.parse(readFixture("crawl.canonical-inconsistent.json"));
    const socialImages = CrawlJsonContractSchema.parse(readFixture("crawl.social-images-missing.json"));
    const unreachable = CrawlJsonContractSchema.parse(readFixture("crawl.start-unreachable.json"));
    const limitReached = CrawlJsonContractSchema.parse(readFixture("crawl.limit-reached.json"));

    expect(clean.summary.status).toBe("ready");
    expect(missingDescriptions.repeatedFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "metadata.description.missing", count: 4 }),
    ]));
    expect(canonical.consistency.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "metadata.canonical.host_inconsistent" }),
    ]));
    expect(socialImages.repeatedFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "social.og.image_missing", count: 3 }),
    ]));
    expect(unreachable.summary.status).toBe("unknown");
    expect(limitReached.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "limit_reached" }),
    ]));
    for (const fixture of [clean, missingDescriptions, canonical, socialImages, unreachable, limitReached]) {
      expect(fixture.pages.length).toBeLessThanOrEqual(25);
      expect(fixture.options.maxDepth).toBeLessThanOrEqual(2);
      expect(["live", "mock"]).toContain(fixture.mode);
      expect(["ready", "needs_attention", "unknown"]).toContain(fixture.summary.status);
      expect(JSON.stringify(fixture)).not.toMatch(/<html|<!doctype/i);
      expect(JSON.stringify(fixture)).not.toMatch(/[?&](token|secret|key|password|code)=/i);
    }
  });

  it("keeps generated-site smell fixtures deterministic and constrained", () => {
    const clean = GeneratedSiteSmellsJsonContractSchema.parse(readFixture("generated-site-smells.clean.json"));
    const clientOnly = GeneratedSiteSmellsJsonContractSchema.parse(readFixture("generated-site-smells.vite-client-only-metadata.json"));
    const placeholder = GeneratedSiteSmellsJsonContractSchema.parse(readFixture("generated-site-smells.placeholder-content.json"));
    const missingAssets = GeneratedSiteSmellsJsonContractSchema.parse(readFixture("generated-site-smells.missing-social-assets.json"));
    const unsupported = GeneratedSiteSmellsJsonContractSchema.parse(readFixture("generated-site-smells.unsupported-framework.json"));
    const renderedOnly = GeneratedSiteSmellsJsonContractSchema.parse(readFixture("generated-site-smells.repo-plus-url-rendered-only.json"));

    expect(clean.summary.status).toBe("clean");
    expect(clientOnly.findings).toEqual(expect.arrayContaining([expect.objectContaining({ id: "metadata.client_only_metadata" })]));
    expect(placeholder.findings).toEqual(expect.arrayContaining([expect.objectContaining({ category: "content_placeholders" })]));
    expect(missingAssets.findings).toEqual(expect.arrayContaining([expect.objectContaining({ id: "assets.missing_social_image" })]));
    expect(unsupported.summary.status).toBe("manual_review");
    expect(renderedOnly.url).toBe("https://example.com/");
    for (const fixture of [clean, clientOnly, placeholder, missingAssets, unsupported, renderedOnly]) {
      expect(["repo_only", "repo_plus_url", "mock"]).toContain(fixture.mode);
      expect(fixture.scanned.limits.maxFiles).toBeGreaterThan(0);
      for (const finding of fixture.findings) {
        expect(["high", "medium", "low", "info"]).toContain(finding.severity);
        expect(["high", "medium", "low"]).toContain(finding.confidence);
        expect(["needs_attention", "manual_review", "info"]).toContain(finding.status);
      }
      expect(JSON.stringify(fixture)).not.toContain("?token=");
    }
  });

  it("keeps social preview fixtures deterministic and constrained", () => {
    const complete = SocialPreviewJsonContractSchema.parse(readFixture("social-preview.complete.json"));
    const missingImage = SocialPreviewJsonContractSchema.parse(readFixture("social-preview.missing-image.json"));
    const renderedOnly = SocialPreviewJsonContractSchema.parse(readFixture("social-preview.rendered-only-metadata.json"));
    const imageUnreachable = SocialPreviewJsonContractSchema.parse(readFixture("social-preview.image-unreachable.json"));

    expect(complete.verdict.status).toBe("ready");
    expect(missingImage.verdict.status).toBe("needs_attention");
    expect(renderedOnly.comparison.rawVsRendered).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "present_after_render_only" }),
    ]));
    expect(imageUnreachable.image.assetStatus).toBe("unreachable");
    for (const fixture of [complete, missingImage, renderedOnly, imageUnreachable]) {
      expect(["raw", "rendered", "both"]).toContain(fixture.sourceMode);
      for (const field of fixture.fields) {
        expect(["present", "missing", "fallback", "unknown"]).toContain(field.status);
      }
    }
  });

  it("keeps recheck deployment and verdict states constrained", () => {
    const fixtures = [
      "recheck.url-only-ready.json",
      "recheck.url-only-needs-attention.json",
      "recheck.repo-backed-appears-deployed.json",
      "recheck.repo-backed-needs-deploy.json",
      "recheck.repo-backed-partial.json",
      "recheck.unknown.json",
    ];
    for (const fixtureName of fixtures) {
      const result = RecheckJsonContractSchema.parse(readFixture(fixtureName));
      expect(["not_checked", "appears_deployed", "appears_not_deployed", "partially_deployed", "unknown"])
        .toContain(result.deployment.status);
      expect(["ready", "needs_deploy", "needs_attention", "unknown"])
        .toContain(result.verdict.status);
    }
  });

  it("keeps DNS readiness verdicts and host resolution statuses constrained", () => {
    const fixtures = [
      "dns.ready.json",
      "dns.nxdomain.json",
      "dns.timeout.json",
      "dns.txt-found.json",
      "dns.canonical-mismatch.json",
    ];
    for (const fixtureName of fixtures) {
      const status = DnsStatusJsonContractSchema.parse(readFixture(fixtureName));
      expect(["ready", "needs_attention", "blocked", "unknown"]).toContain(status.verdict.status);
      for (const host of status.hosts) {
        expect(["ok", "nxdomain", "nodata", "timeout", "error", "not_checked"]).toContain(host.resolution.status);
      }
      expect(JSON.stringify(status)).not.toContain("redacted-example-token");
    }
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
      await execFileAsync("pnpm", ["--silent", ...args], {
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
