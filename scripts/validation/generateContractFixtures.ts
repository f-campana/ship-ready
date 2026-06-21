import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { dryRunFixFromPlan } from "../../src/fix/dryRunFix";
import { writeFixFromDryRun } from "../../src/fix/writeFix";
import { planFixesFromResults } from "../../src/plan/planFixes";
import { inspectRepo } from "../../src/repo/inspectRepo";
import { createUiReportFromResults } from "../../src/report/createUiReport";
import { formatCliErrorJson } from "../../src/report/formatCliErrorJson";
import { formatDryRunFixJsonReport } from "../../src/report/formatDryRunFixJsonReport";
import { formatFixPlanJsonReport } from "../../src/report/formatFixPlanJsonReport";
import { formatJsonReport } from "../../src/report/formatJsonReport";
import { formatRepoInspectionJsonReport } from "../../src/report/formatRepoInspectionJsonReport";
import { formatUiReportJsonReport } from "../../src/report/formatUiReportJsonReport";
import { formatWriteFixJsonReport } from "../../src/report/formatWriteFixJsonReport";
import type { AuditCheck, AuditResult, ExtractedPageMetadata } from "../../src/types/audit";

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = join(ROOT, "validation", "contracts");
const REPOS = join(ROOT, "tests", "fixtures", "repos");
const FIXED_AT = "2026-06-21T12:00:00.000Z";
const FIXTURE_PATH = "tests/fixtures/repos/next-app-router-dry-run";

mkdirSync(OUTPUT, { recursive: true });

const cleanAudit = auditResult([
  check("metadata.title.present", "passed"),
  check("metadata.description.present", "passed"),
  check("metadata.canonical.present", "passed"),
  check("crawl.robots_txt.found", "passed"),
  check("crawl.sitemap.found", "passed"),
], 100, "good", true);

const needsWorkAudit = auditResult([
  check("crawl.robots_txt.missing", "warning"),
  check("crawl.sitemap.missing", "warning"),
  check("metadata.canonical.missing", "critical"),
], 62, "needs_work", false);

const safeApplyAudit = auditResult([
  check("crawl.robots_txt.missing", "warning"),
  check("crawl.sitemap.missing", "warning"),
], 78, "needs_work", false);

const reviewRequiredAudit = auditResult([
  check("metadata.canonical.missing", "critical"),
  check("social.og.url_missing", "warning"),
], 64, "needs_work", true);

const nextInspection = deterministicInspection("next-app-router-dry-run", FIXTURE_PATH);
const viteInspection = deterministicInspection("vite-react", "tests/fixtures/repos/vite-react");

const safePlan = {
  ...planFixesFromResults(safeApplyAudit, nextInspection),
  plannedAt: FIXED_AT,
};
const reviewPlan = {
  ...planFixesFromResults(reviewRequiredAudit, viteInspection),
  plannedAt: FIXED_AT,
};
const skippedPlan = {
  ...planFixesFromResults(
    auditResult([check("schema.jsonld.missing", "critical")], 70, "needs_work", true),
    nextInspection,
  ),
  plannedAt: FIXED_AT,
};
const safeDryRun = dryRunFixFromPlan(safePlan, {
  repoRoot: join(REPOS, "next-app-router-dry-run"),
  generatedAt: FIXED_AT,
});
const reviewDryRun = dryRunFixFromPlan(reviewPlan, {
  repoRoot: join(REPOS, "vite-react"),
  generatedAt: FIXED_AT,
});
const skippedDryRun = dryRunFixFromPlan(skippedPlan, {
  repoRoot: join(REPOS, "next-app-router-dry-run"),
  generatedAt: FIXED_AT,
});

write("audit.clean.json", formatJsonReport(cleanAudit));
write("audit.needs-work.json", formatJsonReport(needsWorkAudit));
write("inspect-repo.next-app.json", formatRepoInspectionJsonReport(nextInspection));
write("inspect-repo.vite.json", formatRepoInspectionJsonReport(viteInspection));
write("plan-fixes.safe-apply.json", formatFixPlanJsonReport(safePlan));
write("plan-fixes.review-required.json", formatFixPlanJsonReport(reviewPlan));
write("fix-dry-run.safe-apply.json", formatDryRunFixJsonReport(safeDryRun));
write("fix-dry-run.review-required.json", formatDryRunFixJsonReport(reviewDryRun));
write("fix-dry-run.skipped.json", formatDryRunFixJsonReport(skippedDryRun));

writeFixtureFromDryRun("fix-write.safe-create.json", safeDryRun, "next-app-router-dry-run");
writeFixtureFromDryRun("fix-write.blocked.json", reviewDryRun, "vite-react");
writeFixtureFromDryRun("fix-write.skipped.json", skippedDryRun, "next-app-router-dry-run");

write("ui-report.safe-apply.json", formatUiReportJsonReport(createUiReportFromResults({
  url: safeApplyAudit.url,
  repoPath: FIXTURE_PATH,
  generatedAt: FIXED_AT,
  audit: safeApplyAudit,
  repoInspection: nextInspection,
  fixPlan: safePlan,
  dryRun: safeDryRun,
  repoRoot: join(REPOS, "next-app-router-dry-run"),
})));

write("ui-report.url-only.json", formatUiReportJsonReport(createUiReportFromResults({
  url: cleanAudit.url,
  generatedAt: FIXED_AT,
  audit: cleanAudit,
})));

write("error.invalid-url.json", formatCliErrorJson({
  code: "invalid_url",
  message: "Invalid URL. Provide an absolute http:// or https:// URL.",
}));

function deterministicInspection(fixture: string, displayPath: string) {
  return {
    ...inspectRepo(join(REPOS, fixture)),
    path: displayPath,
    inspectedAt: FIXED_AT,
  };
}

function auditResult(
  checks: AuditCheck[],
  score: number,
  status: AuditResult["status"],
  resourcesExist: boolean,
): AuditResult {
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    auditedAt: FIXED_AT,
    httpStatus: 200,
    score,
    status,
    raw: pageSnapshot("raw"),
    rendered: pageSnapshot("rendered"),
    comparison: { fields: [] },
    checks,
    resources: {
      robotsTxt: resource("https://example.com/robots.txt", resourcesExist),
      sitemapXml: resource("https://example.com/sitemap.xml", resourcesExist),
    },
  };
}

function pageSnapshot(source: "raw" | "rendered"): ExtractedPageMetadata {
  return {
    source,
    url: "https://example.com/",
    metadata: {
      htmlLang: "en",
      title: "Example",
      description: "A deterministic ShipReady contract fixture.",
      canonical: "https://example.com/",
      faviconLinks: [],
      openGraph: {},
      twitter: {},
    },
    headings: { h1: ["Example"], all: [{ level: 1, text: "Example" }] },
    images: { total: 0, missingAlt: 0, items: [] },
    links: { total: 0, missingAccessibleText: 0, items: [] },
    jsonLd: [],
  };
}

function check(id: string, severity: AuditCheck["severity"]): AuditCheck {
  return {
    id,
    category: id.startsWith("crawl.")
      ? "crawlability"
      : id.startsWith("social.")
        ? "social"
        : "metadata",
    severity,
    title: id,
    description: `Deterministic evidence for ${id}.`,
    confidence: "high",
    fixability: severity === "passed" ? "not_fixable" : "plan_only",
  };
}

function resource(url: string, exists: boolean) {
  return {
    url,
    finalUrl: url,
    exists,
    ok: exists,
    statusCode: exists ? 200 : 404,
  };
}

function write(name: string, contents: string): void {
  const target = join(OUTPUT, name);
  writeFileSync(target, contents, "utf8");
  process.stdout.write(`${relative(ROOT, target)}\n`);
}

function writeFixtureFromDryRun(
  name: string,
  dryRun: Parameters<typeof writeFixFromDryRun>[0],
  sourceFixture: string,
): void {
  const tempRoot = mkdtempSync(join(tmpdir(), "shipready-contract-write-"));
  try {
    cpSync(join(REPOS, sourceFixture), tempRoot, { recursive: true });
    const result = writeFixFromDryRun(dryRun, tempRoot, { generatedAt: FIXED_AT });
    write(name, formatWriteFixJsonReport(result));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
