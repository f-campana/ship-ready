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
import { createStatus, formatStatusJson } from "../../src/status/status";
import {
  formatSearchConsoleStatusJson,
  getSearchConsoleStatus,
} from "../../src/searchConsole/searchConsoleStatus";
import { formatDnsStatusJson, getDnsStatus } from "../../src/dns/dnsStatus";
import { createRecheckResult } from "../../src/recheck/recheck";
import { formatRecheckJson } from "../../src/report/formatRecheckReport";
import { createDoctorReport, formatDoctorJson } from "../../src/doctor/doctor";
import { getSocialPreview } from "../../src/socialPreview/socialPreview";
import { formatSocialPreviewJson } from "../../src/report/formatSocialPreviewReport";
import { getGeneratedSiteSmells } from "../../src/smells/generatedSiteSmells";
import { formatGeneratedSiteSmellsJson } from "../../src/report/formatGeneratedSiteSmellsReport";
import { crawlSite } from "../../src/crawl/crawl";
import { formatCrawlJson } from "../../src/report/formatCrawlReport";
import type { DoctorCheck } from "../../src/types/contracts";
import type { AuditCheck, AuditResult, ExtractedPageMetadata } from "../../src/types/audit";
import { DOC_RESOURCES, FIXTURE_NAMES } from "../../src/mcp/resources";

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

const partialCrawlAudit: AuditResult = {
  ...cleanAudit,
  resources: {
    robotsTxt: resource("https://example.com/robots.txt", true),
    sitemapXml: resource("https://example.com/sitemap.xml", false),
  },
};

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
for (const [fileName, scenario] of [
  ["crawl.clean-small-site.json", "clean-small-site"],
  ["crawl.missing-descriptions.json", "missing-descriptions"],
  ["crawl.canonical-inconsistent.json", "canonical-inconsistent"],
  ["crawl.social-images-missing.json", "social-images-missing"],
  ["crawl.start-unreachable.json", "start-unreachable"],
  ["crawl.limit-reached.json", "limit-reached"],
  ["crawl.mixed-readiness.json", "mixed-readiness"],
] as const) {
  write(fileName, formatCrawlJson(await crawlSite({
    url: "https://example.com/",
    mock: scenario,
    checkedAt: FIXED_AT,
  })));
}
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

const expectedNextFiles = [
  { path: "src/app/robots.ts", kind: "robots" as const, exists: true },
  { path: "src/app/sitemap.ts", kind: "sitemap" as const, exists: true },
];
write("recheck.url-only-ready.json", formatRecheckJson(createRecheckResult({
  url: cleanAudit.url,
  checkedAt: FIXED_AT,
  audit: cleanAudit,
})));
write("recheck.url-only-needs-attention.json", formatRecheckJson(createRecheckResult({
  url: needsWorkAudit.url,
  checkedAt: FIXED_AT,
  audit: needsWorkAudit,
})));
write("recheck.repo-backed-appears-deployed.json", formatRecheckJson(createRecheckResult({
  url: cleanAudit.url,
  checkedAt: FIXED_AT,
  audit: cleanAudit,
  inspection: nextInspection,
  expectedFiles: expectedNextFiles,
})));
write("recheck.repo-backed-needs-deploy.json", formatRecheckJson(createRecheckResult({
  url: needsWorkAudit.url,
  checkedAt: FIXED_AT,
  audit: needsWorkAudit,
  inspection: nextInspection,
  expectedFiles: expectedNextFiles,
})));
write("recheck.repo-backed-partial.json", formatRecheckJson(createRecheckResult({
  url: partialCrawlAudit.url,
  checkedAt: FIXED_AT,
  audit: partialCrawlAudit,
  inspection: nextInspection,
  expectedFiles: expectedNextFiles,
})));
write("recheck.unknown.json", formatRecheckJson(createRecheckResult({
  url: "https://example.com/",
  checkedAt: FIXED_AT,
  auditUnavailable: true,
})));

for (const [fileName, scenario] of [
  ["social-preview.complete.json", "complete"],
  ["social-preview.missing-image.json", "missing-image"],
  ["social-preview.rendered-only-metadata.json", "rendered-only-metadata"],
  ["social-preview.twitter-fallback.json", "twitter-fallback"],
  ["social-preview.missing-description.json", "missing-description"],
  ["social-preview.missing-og-url.json", "missing-og-url"],
  ["social-preview.raw-rendered-different.json", "raw-rendered-different"],
  ["social-preview.image-unreachable.json", "image-unreachable"],
  ["social-preview.minimal-title-only.json", "minimal-title-only"],
] as const) {
  write(fileName, formatSocialPreviewJson(await getSocialPreview({
    url: "https://example.com/",
    mock: scenario,
    source: "both",
  })));
}

for (const [fileName, scenario, fixture, url] of [
  ["generated-site-smells.clean.json", "clean", "vite-react", undefined],
  ["generated-site-smells.vite-client-only-metadata.json", "vite-client-only-metadata", "vite-react", undefined],
  ["generated-site-smells.placeholder-content.json", "placeholder-content", "vite-react", undefined],
  ["generated-site-smells.missing-social-assets.json", "missing-social-assets", "vite-react", undefined],
  ["generated-site-smells.hardcoded-localhost.json", "hardcoded-localhost", "vite-react", undefined],
  ["generated-site-smells.unsupported-framework.json", "unsupported-framework", "unknown", undefined],
  ["generated-site-smells.repo-plus-url-rendered-only.json", "repo-plus-url-rendered-only", "vite-react", "https://example.com/?token=redacted"],
] as const) {
  write(fileName, formatGeneratedSiteSmellsJson(await getGeneratedSiteSmells({
    repoPath: join(REPOS, fixture),
    url,
    mock: scenario,
    checkedAt: FIXED_AT,
    cwd: ROOT,
  })));
}

for (const [fileName, scenario, inspect] of [
  ["search-console.not-configured.json", "not_configured", false],
  ["search-console.unauthorized.json", "unauthorized", false],
  ["search-console.property-not-found.json", "property_not_found", false],
  ["search-console.ready-sitemap-ok.json", "ready_sitemap_ok", false],
  ["search-console.ready-sitemap-warning.json", "ready_sitemap_warning", false],
  ["search-console.inspection-canonical-mismatch.json", "inspection_canonical_mismatch", true],
  ["search-console.inspection-not-indexed.json", "inspection_not_indexed", true],
] as const) {
  write(fileName, formatSearchConsoleStatusJson(await getSearchConsoleStatus({
    url: "https://example.com/",
    mock: scenario,
    inspect,
  })));
}

const dnsFixtures: Array<{
  fileName: string;
  scenario: string;
  url?: string;
  expectedWwwMode?: string;
  expectedSearchConsoleTxt?: string;
  expectedCanonicalHost?: string;
}> = [
  { fileName: "dns.ready.json", scenario: "ready" },
  { fileName: "dns.apex-ok-www-missing.json", scenario: "apex-ok-www-missing" },
  { fileName: "dns.www-cname-ok.json", scenario: "www-cname-ok", url: "https://www.example.com/" },
  { fileName: "dns.nxdomain.json", scenario: "nxdomain" },
  { fileName: "dns.nodata.json", scenario: "nodata" },
  { fileName: "dns.timeout.json", scenario: "timeout" },
  { fileName: "dns.cname-chain-issue.json", scenario: "cname-chain-issue", expectedWwwMode: "www" },
  { fileName: "dns.caa-present.json", scenario: "caa-present" },
  { fileName: "dns.txt-found.json", scenario: "txt-found", expectedSearchConsoleTxt: "redacted-example-token" },
  { fileName: "dns.txt-missing.json", scenario: "txt-missing", expectedSearchConsoleTxt: "redacted-example-token" },
  { fileName: "dns.canonical-mismatch.json", scenario: "canonical-mismatch", expectedCanonicalHost: "example.com" },
];

for (const fixture of dnsFixtures) {
  write(fixture.fileName, formatDnsStatusJson(await getDnsStatus({
    url: fixture.url ?? "https://example.com/",
    mock: fixture.scenario,
    expectedWwwMode: fixture.expectedWwwMode,
    expectedSearchConsoleTxt: fixture.expectedSearchConsoleTxt,
    expectedCanonicalHost: fixture.expectedCanonicalHost,
  })));
}

write("status.default.json", formatStatusJson(createStatus()));
write("doctor.default.json", formatDoctorJson(createDoctorReport([
  doctorCheck("node-version", "Node.js", "pass", "Node.js 22.0.0 is supported.", { version: "22.0.0", minimumMajor: 20 }),
  doctorCheck("pnpm", "pnpm", "pass", "pnpm 10.28.2 is available.", { version: "10.28.2" }),
  doctorCheck("playwright-browser", "Playwright Chromium", "pass", "The Playwright Chromium executable is installed."),
  doctorCheck("ffmpeg", "FFmpeg", "warn", "FFmpeg is optional and only needed for demo composition."),
  doctorCheck("package-root", "Package content", "pass", "The ShipReady package content root is available."),
  doctorCheck("mcp-sdk", "MCP SDK", "pass", "The MCP SDK dependency is installed."),
  doctorCheck("mcp-configuration", "MCP configuration", "pass", "The local stdio MCP command can accept an explicit allowed root; no server was started."),
  doctorCheck("contract-fixtures", "Contract fixtures", "pass", `${FIXTURE_NAMES.length} canonical contract fixtures exist and parse.`, { count: FIXTURE_NAMES.length }),
  doctorCheck("canonical-docs", "Canonical docs", "pass", `${new Set(Object.values(DOC_RESOURCES)).size} canonical documentation files are present.`, { checked: new Set(Object.values(DOC_RESOURCES)).size, missing: [] }),
  doctorCheck("search-console-prototype", "Search Console mock prototype", "pass", "The Search Console specification and 7 deterministic mock fixtures are present; no Google credentials are required.", { liveIntegration: false, oauthRequired: false, fixtures: 7, missing: [] }),
  doctorCheck("dns-readiness", "DNS readiness", "pass", "The DNS specification, Node DNS APIs, and 11 deterministic mock fixtures are present; no DNS provider credentials are required.", { readOnly: true, providerWrites: false, providerIntegrations: false, fixtures: 11, nodeDnsApisAvailable: true, missing: [] }),
  doctorCheck("post-write-recheck", "Post-write recheck", "pass", "The read-only recheck guide, skill workflow, and 6 deterministic fixtures are present; no network or deployment credentials are required by doctor.", { readOnly: true, networkRequired: false, deploymentCredentialsRequired: false, fixtures: 6, missing: [], skillReferencesRecheck: true }),
  doctorCheck("social-preview-simulator", "Social preview simulator", "pass", "The read-only social preview simulator guidance and 9 deterministic fixtures are present; no social platform credentials or network checks are required by doctor.", { readOnly: true, socialPlatformApis: false, exactRenderingGuarantee: false, networkRequired: false, fixtures: 9, missing: [], skillReferencesSocialPreview: true }),
  doctorCheck("generated-site-smells", "Generated-site smell detector", "pass", "The read-only generated-site smell detector guidance and 7 deterministic fixtures are present; no repo input or network is required by doctor.", { readOnly: true, autoFixes: false, authorshipIdentification: false, networkRequired: false, fixtures: 7, missing: [], docsReferenceLimitations: true }),
  doctorCheck("bounded-crawl", "Bounded multi-page crawl", "pass", "The read-only bounded crawl guidance and 7 deterministic fixtures are present; doctor performs no network crawl.", { readOnly: true, networkRequired: false, fullSiteCrawler: false, monitoring: false, fixtures: 7, missing: [], docsReferenceLimitations: true }),
  doctorCheck("write-policy", "WRITE_POLICY_V1", "pass", "The canonical creation_only_robots_sitemap_v1 policy document is present."),
  doctorCheck("local-gui-spec", "LOCAL_FIRST_GUI_SPEC", "pass", "The canonical local-first GUI specification is present."),
  doctorCheck("demo-artifacts", "Demo artifacts", "warn", "Optional demo artifacts are incomplete; core CLI operation is unaffected.", { missing: ["validation/example.mp4"] }),
])));

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

function doctorCheck(
  id: string,
  label: string,
  status: DoctorCheck["status"],
  message: string,
  details?: Record<string, unknown>,
): DoctorCheck {
  return { id, label, status, message, ...(details ? { details } : {}) };
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
