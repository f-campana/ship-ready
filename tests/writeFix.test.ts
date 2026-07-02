import { execFile } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { dryRunFixFromPlan } from "../src/fix/dryRunFix";
import { nextRobotsTsForUrl, nextSitemapTsForUrl, robotsTxtForUrl, sitemapXmlForUrl } from "../src/fix/generatedCrawlFiles";
import {
  writeFixFromDryRun,
  WriteFixExecutionError,
  WriteFixValidationError,
} from "../src/fix/writeFix";
import { planFixesFromResults } from "../src/plan/planFixes";
import { inspectRepo } from "../src/repo/inspectRepo";
import { formatWriteFixHumanReport } from "../src/report/formatWriteFixHumanReport";
import type { AuditCheck, AuditResult, ExtractedPageMetadata } from "../src/types/audit";
import { DryRunFixResultSchema, type DryRunFileChange, type DryRunFixResult } from "../src/types/dryRunFix";
import type { FrameworkId } from "../src/types/repoInspection";

const execFileAsync = promisify(execFile);
const fixtureRoot = join(import.meta.dirname, "fixtures", "repos");
const projectRoot = join(import.meta.dirname, "..");
const finalUrl = "https://example.com/";

describe("write fix mode", () => {
  it("fails when --write is used without --allow-create", async () => {
    try {
      await execFileAsync("pnpm", ["--silent", "shipready", "fix", ".", "--url", finalUrl, "--write"], {
        cwd: projectRoot,
        timeout: 10000,
      });
      throw new Error("Expected command to fail.");
    } catch (error) {
      const result = error as { code?: number; stderr?: string };
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        "ShipReady write mode is currently creation-only. Re-run with --write --allow-create to create eligible missing robots/sitemap files.",
      );
    }
  });

  it("fails when --write and --dry-run are used together", async () => {
    try {
      await execFileAsync("pnpm", ["--silent", "shipready", "fix", ".", "--url", finalUrl, "--write", "--dry-run"], {
        cwd: projectRoot,
        timeout: 10000,
      });
      throw new Error("Expected command to fail.");
    } catch (error) {
      const result = error as { code?: number; stderr?: string };
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("ShipReady fix modes conflict.");
    }
  });

  it("fails safely when no fix mode is provided", async () => {
    try {
      await execFileAsync("pnpm", ["--silent", "shipready", "fix", ".", "--url", finalUrl], {
        cwd: projectRoot,
        timeout: 10000,
      });
      throw new Error("Expected command to fail.");
    } catch (error) {
      const result = error as { code?: number; stderr?: string };
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("ShipReady fix requires an explicit mode.");
    }
  });

  it("writes nothing for unknown repositories", () => {
    const repoRoot = copyFixture("unknown");
    const result = writeFromChecks(repoRoot, [
      critical("metadata.title.missing", "Missing title", "The initial HTML does not include a title tag."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(result.createdFiles).toEqual([]);
    expect(result.recommendedNextStep).toBe("manual_review_required");
  });

  it("writes nothing for a clean supported site", () => {
    const repoRoot = copyFixture("vite-react");
    const result = writeFromChecks(repoRoot, cleanAuditChecks());

    expect(result.wroteFiles).toBe(false);
    expect(result.createdFiles).toEqual([]);
    expect(result.blockedChanges).toEqual([]);
    expect(result.recommendedNextStep).toBe("no_changes_needed");
  });

  it("creates static robots.txt when it is missing", () => {
    const repoRoot = copyFixture("static-html");
    unlinkSync(join(repoRoot, "robots.txt"));

    const result = writeFromChecks(repoRoot, [
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
    ]);

    expect(readFileSync(join(repoRoot, "robots.txt"), "utf8")).toBe(robotsTxtForUrl(finalUrl));
    expect(result.createdFiles).toEqual([
      expect.objectContaining({
        path: "robots.txt",
        bytesWritten: Buffer.byteLength(robotsTxtForUrl(finalUrl), "utf8"),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
  });

  it("creates static sitemap.xml when it is missing", () => {
    const repoRoot = copyFixture("static-html");
    unlinkSync(join(repoRoot, "sitemap.xml"));

    const result = writeFromChecks(repoRoot, [
      warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
    ]);

    expect(readFileSync(join(repoRoot, "sitemap.xml"), "utf8")).toBe(sitemapXmlForUrl(finalUrl));
    expect(result.createdFiles[0]).toMatchObject({ path: "sitemap.xml" });
  });

  it("creates Vite public/robots.txt when it is missing", () => {
    const repoRoot = copyFixture("vite-react");

    const result = writeFromChecks(repoRoot, [
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
    ]);

    expect(readFileSync(join(repoRoot, "public", "robots.txt"), "utf8")).toBe(robotsTxtForUrl(finalUrl));
    expect(result.createdFiles[0]).toMatchObject({ path: "public/robots.txt" });
  });

  it("creates Vite public/sitemap.xml when it is missing", () => {
    const repoRoot = copyFixture("vite-react");

    const result = writeFromChecks(repoRoot, [
      warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
    ]);

    expect(readFileSync(join(repoRoot, "public", "sitemap.xml"), "utf8")).toBe(sitemapXmlForUrl(finalUrl));
    expect(result.createdFiles[0]).toMatchObject({ path: "public/sitemap.xml" });
  });

  it("creates Next App Router app/robots.ts and app/sitemap.ts", () => {
    const repoRoot = copyFixture("next-app-router-root-app");

    const result = writeFromChecks(repoRoot, [
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
      warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
    ]);

    expect(readFileSync(join(repoRoot, "app", "robots.ts"), "utf8")).toBe(nextRobotsTsForUrl(finalUrl));
    expect(readFileSync(join(repoRoot, "app", "sitemap.ts"), "utf8")).toBe(nextSitemapTsForUrl(finalUrl));
    expect(result.createdFiles.map((file) => file.path).sort()).toEqual(["app/robots.ts", "app/sitemap.ts"]);
  });

  it("creates Next App Router src/app/robots.ts and src/app/sitemap.ts", () => {
    const repoRoot = copyFixture("next-app-router-dry-run");

    const result = writeFromChecks(repoRoot, [
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
      warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
    ]);

    expect(readFileSync(join(repoRoot, "src", "app", "robots.ts"), "utf8")).toBe(nextRobotsTsForUrl(finalUrl));
    expect(readFileSync(join(repoRoot, "src", "app", "sitemap.ts"), "utf8")).toBe(nextSitemapTsForUrl(finalUrl));
    expect(result.createdFiles.map((file) => file.path).sort()).toEqual([
      "src/app/robots.ts",
      "src/app/sitemap.ts",
    ]);
  });

  it("never overwrites an existing robots file", () => {
    const repoRoot = copyFixture("static-html");
    const before = readFileSync(join(repoRoot, "robots.txt"), "utf8");

    const result = writeFromChecks(repoRoot, [
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(readFileSync(join(repoRoot, "robots.txt"), "utf8")).toBe(before);
  });

  it("never overwrites an existing sitemap file", () => {
    const repoRoot = copyFixture("static-html");
    const before = readFileSync(join(repoRoot, "sitemap.xml"), "utf8");

    const result = writeFromChecks(repoRoot, [
      warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(result.blockedChanges[0]).toMatchObject({
      path: "sitemap.xml",
      dryRunChangeType: "update",
    });
    expect(readFileSync(join(repoRoot, "sitemap.xml"), "utf8")).toBe(before);
  });

  it("blocks non-allowlisted file creations", () => {
    const repoRoot = copyFixture("vite-react");
    const result = writeFixFromDryRun(
      dryRunWithFileChanges(repoRoot, "vite_react", [
        fileChange({ path: "index.html", after: "<html></html>\n" }),
      ]),
      repoRoot,
    );

    expect(result.wroteFiles).toBe(false);
    expect(result.blockedChanges[0]).toMatchObject({ path: "index.html" });
    expect(readFileSync(join(repoRoot, "index.html"), "utf8")).not.toBe("<html></html>\n");
  });

  it("blocks metadata updates", () => {
    const repoRoot = copyFixture("next-app-router-dry-run");
    const before = readFileSync(join(repoRoot, "src", "app", "layout.tsx"), "utf8");

    const result = writeFromChecks(repoRoot, [
      critical("metadata.canonical.missing", "Missing canonical", "The raw HTML does not include a canonical link."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(result.blockedChanges[0]).toMatchObject({ path: "src/app/layout.tsx" });
    expect(readFileSync(join(repoRoot, "src", "app", "layout.tsx"), "utf8")).toBe(before);
  });

  it("blocks generateMetadata changes by leaving them skipped", () => {
    const repoRoot = copyFixture("next-app-router-dry-run");
    writeFile(
      repoRoot,
      "src/app/layout.tsx",
      [
        "export async function generateMetadata() {",
        "  return { title: \"Dynamic\" };",
        "}",
        "",
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        "  return <html lang=\"en\"><body>{children}</body></html>;",
        "}",
        "",
      ].join("\n"),
    );
    const before = readFileSync(join(repoRoot, "src", "app", "layout.tsx"), "utf8");

    const result = writeFromChecks(repoRoot, [
      critical("metadata.canonical.missing", "Missing canonical", "The raw HTML does not include a canonical link."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(result.skippedActions[0]?.reason).toContain("Existing generateMetadata found");
    expect(readFileSync(join(repoRoot, "src", "app", "layout.tsx"), "utf8")).toBe(before);
  });

  it("blocks JSON-LD updates", () => {
    const repoRoot = copyFixture("static-html");
    writeFile(
      repoRoot,
      "index.html",
      "<!doctype html><html><head><title>Example</title><meta name=\"description\" content=\"A factual description for tests.\" /></head><body><h1>Example</h1></body></html>\n",
    );

    const result = writeFromChecks(repoRoot, [
      critical("schema.jsonld.missing", "No JSON-LD", "No structured data script tags were found in the raw HTML."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(result.blockedChanges[0]).toMatchObject({ path: "index.html" });
    expect(readFileSync(join(repoRoot, "index.html"), "utf8")).not.toContain("application/ld+json");
  });

  it("blocks H1 and content updates by leaving them skipped", () => {
    const repoRoot = copyFixture("static-html");

    const result = writeFromChecks(repoRoot, [
      warning("structure.h1.missing", "No H1 found", "The page should have one clear H1."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(result.skippedActions[0]?.reason).toContain("H1 review is a content change");
  });

  it("blocks alt text changes by leaving them skipped", () => {
    const repoRoot = copyFixture("vite-react");

    const result = writeFromChecks(repoRoot, [
      warning("a11y.image.alt_missing", "Image alt text missing", "Images need accurate alt text."),
    ]);

    expect(result.wroteFiles).toBe(false);
    expect(result.skippedActions[0]?.reason).toContain("Accessibility text changes require human-authored content.");
  });

  it("blocks package, config, dependency, and lockfile changes", () => {
    const repoRoot = copyFixture("vite-react");
    const result = writeFixFromDryRun(
      dryRunWithFileChanges(repoRoot, "vite_react", [
        fileChange({ path: "package.json", changeType: "update", before: "{}", after: "{\"dependencies\":{}}\n" }),
        fileChange({ path: "pnpm-lock.yaml", after: "lockfileVersion: '9.0'\n" }),
        fileChange({ path: "vite.config.ts", changeType: "update", before: "", after: "export default {};\n" }),
      ]),
      repoRoot,
    );

    expect(result.wroteFiles).toBe(false);
    expect(result.blockedChanges.map((change) => change.path)).toEqual([
      "package.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
    ]);
    expect(existsSync(join(repoRoot, "pnpm-lock.yaml"))).toBe(false);
  });

  it("blocks path traversal before writing anything", () => {
    const repoRoot = copyFixture("vite-react");

    expect(() =>
      writeFixFromDryRun(
        dryRunWithFileChanges(repoRoot, "vite_react", [
          fileChange({ path: "public/../robots.txt", after: robotsTxtForUrl(finalUrl), sourceActionIds: ["vite_react.robots"] }),
        ]),
        repoRoot,
      ),
    ).toThrow(WriteFixValidationError);
    expect(existsSync(join(repoRoot, "robots.txt"))).toBe(false);
  });

  it("blocks symlink parent escapes", () => {
    const repoRoot = copyFixture("vite-react");
    const outsideRoot = mkdtempSync(join(tmpdir(), "shipready-outside-"));
    symlinkSync(outsideRoot, join(repoRoot, "public"), "dir");

    expect(() =>
      writeFixFromDryRun(
        dryRunWithFileChanges(repoRoot, "vite_react", [
          fileChange({ path: "public/robots.txt", after: robotsTxtForUrl(finalUrl), sourceActionIds: ["vite_react.robots"] }),
        ]),
        repoRoot,
      ),
    ).toThrow(WriteFixValidationError);
    expect(existsSync(join(outsideRoot, "robots.txt"))).toBe(false);
  });

  it("aborts all writes before creation when one candidate fails validation", () => {
    const repoRoot = copyFixture("vite-react");
    writeFile(repoRoot, "public/sitemap.xml", "existing\n");

    expect(() =>
      writeFixFromDryRun(
        dryRunWithFileChanges(repoRoot, "vite_react", [
          fileChange({ path: "public/robots.txt", after: robotsTxtForUrl(finalUrl), sourceActionIds: ["vite_react.robots"] }),
          fileChange({ path: "public/sitemap.xml", after: sitemapXmlForUrl(finalUrl), sourceActionIds: ["vite_react.sitemap"] }),
        ]),
        repoRoot,
      ),
    ).toThrow(WriteFixValidationError);
    expect(existsSync(join(repoRoot, "public", "robots.txt"))).toBe(false);
    expect(readFileSync(join(repoRoot, "public", "sitemap.xml"), "utf8")).toBe("existing\n");
  });

  it("reports rollback when an unexpected write error happens after creation starts", () => {
    const repoRoot = copyFixture("vite-react");
    const dryRun = dryRunWithFileChanges(repoRoot, "vite_react", [
      fileChange({ path: "public/robots.txt", after: robotsTxtForUrl(finalUrl), sourceActionIds: ["vite_react.robots"] }),
      fileChange({ path: "public/sitemap.xml", after: sitemapXmlForUrl(finalUrl), sourceActionIds: ["vite_react.sitemap"] }),
    ]);

    try {
      writeFixFromDryRun(dryRun, repoRoot, { failAfterCreateCount: 1 });
      throw new Error("Expected write failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(WriteFixExecutionError);
      const result = (error as WriteFixExecutionError).result;
      expect(result.rollback).toMatchObject({
        attempted: true,
        succeeded: true,
        remainingFiles: [],
      });
    }

    expect(existsSync(join(repoRoot, "public", "robots.txt"))).toBe(false);
    expect(existsSync(join(repoRoot, "public", "sitemap.xml"))).toBe(false);
  });

  it("includes hashes and byte counts in write results", () => {
    const repoRoot = copyFixture("static-html");
    unlinkSync(join(repoRoot, "robots.txt"));

    const result = writeFromChecks(repoRoot, [
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
    ]);

    expect(result.createdFiles[0]).toMatchObject({
      bytesWritten: Buffer.byteLength(robotsTxtForUrl(finalUrl), "utf8"),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("states no overwrites, Git operations, dependency installs, formatting, or deploys in the human report", () => {
    const repoRoot = copyFixture("static-html");
    unlinkSync(join(repoRoot, "robots.txt"));
    const result = writeFromChecks(repoRoot, [
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
    ]);

    const report = formatWriteFixHumanReport(result);
    expect(report).toContain("Mode: write");
    expect(report).toContain("Policy: creation-only robots/sitemap");
    expect(report).toContain("- No existing files overwritten.");
    expect(report).toContain("- No Git operations performed.");
    expect(report).toContain("- No dependencies installed.");
    expect(report).toContain("- No formatting run.");
    expect(report).toContain("- No deploys performed.");
    expect(report).toContain("Deploy through your external workflow");
    expect(report).toContain("pnpm shipready recheck");
  });
});

function writeFromChecks(repoRoot: string, checks: AuditCheck[]) {
  return writeFixFromDryRun(dryRunForChecks(repoRoot, checks), repoRoot, {
    generatedAt: "2026-06-15T00:00:00.000Z",
  });
}

function dryRunForChecks(repoRoot: string, checks: AuditCheck[]): DryRunFixResult {
  const plan = planFixesFromResults(auditWithChecks(checks), inspectRepo(repoRoot));
  return dryRunFixFromPlan(plan, {
    repoRoot,
    generatedAt: "2026-06-15T00:00:00.000Z",
  });
}

function dryRunWithFileChanges(
  repoRoot: string,
  frameworkId: FrameworkId,
  fileChanges: DryRunFileChange[],
): DryRunFixResult {
  return DryRunFixResultSchema.parse({
    url: finalUrl,
    repoPath: repoRoot,
    generatedAt: "2026-06-15T00:00:00.000Z",
    mode: "dry_run",
    wroteFiles: false,
    planSummary: {
      auditScore: 62,
      auditStatus: "needs_work",
      frameworkId,
      frameworkName: frameworkName(frameworkId),
      recommendedNextStep: "review_plan",
    },
    fileChanges,
    skippedActions: [],
    safetyNotes: [],
    recommendedNextStep: "review_patch_preview",
  });
}

function fileChange(input: {
  path: string;
  changeType?: "create" | "update";
  before?: string;
  after: string;
  sourceActionIds?: string[];
  risk?: "low" | "medium" | "high";
  requiresHumanReview?: boolean;
  reviewStatus?: "auto_candidate" | "review_required";
}): DryRunFileChange {
  return {
    path: input.path,
    changeType: input.changeType ?? "create",
    reason: "Test dry-run change.",
    sourceActionIds: input.sourceActionIds ?? ["vite_react.robots"],
    risk: input.risk ?? "low",
    requiresHumanReview: input.requiresHumanReview ?? false,
    reviewStatus: input.reviewStatus ?? "auto_candidate",
    before: input.before,
    after: input.after,
    diff: `+++ ${input.path}`,
  };
}

function copyFixture(name: string): string {
  const parent = mkdtempSync(join(tmpdir(), "shipready-write-fixture-"));
  const target = join(parent, name);
  cpSync(join(fixtureRoot, name), target, { recursive: true });
  rmSync(join(target, "node_modules"), { recursive: true, force: true });
  return target;
}

function writeFile(root: string, path: string, content: string): void {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function cleanAuditChecks(): AuditCheck[] {
  return [
    passed("metadata.title.present", "Title present", "Raw title: Example"),
    passed("metadata.description.present", "Meta description present", "Raw meta description is present."),
    passed("metadata.canonical.present", "Canonical URL present", finalUrl),
    passed("social.og.image_present", "og:image present", "https://example.com/og.png"),
    passed("social.twitter.card_present", "twitter:card present", "summary_large_image"),
    passed("schema.jsonld.valid", "Valid JSON-LD detected", "Valid blocks: 1"),
    passed("crawl.robots_txt.found", "robots.txt found", "https://example.com/robots.txt"),
    passed("crawl.sitemap.found", "sitemap.xml found", "https://example.com/sitemap.xml"),
  ];
}

function auditWithChecks(
  checks: AuditCheck[],
  score = checks.every((check) => check.severity === "passed") ? 100 : 62,
  status: AuditResult["status"] = checks.every((check) => check.severity === "passed") ? "good" : "needs_work",
): AuditResult {
  const snapshot = pageSnapshot();
  const resourcesFound = checks.some((check) => check.id === "crawl.robots_txt.found") ||
    checks.some((check) => check.id === "crawl.sitemap.found");

  return {
    url: finalUrl,
    finalUrl,
    auditedAt: "2026-06-15T00:00:00.000Z",
    httpStatus: 200,
    score,
    status,
    raw: snapshot,
    rendered: snapshot,
    comparison: { fields: [] },
    checks,
    resources: {
      robotsTxt: {
        url: "https://example.com/robots.txt",
        exists: resourcesFound,
        ok: resourcesFound,
        statusCode: resourcesFound ? 200 : 404,
      },
      sitemapXml: {
        url: "https://example.com/sitemap.xml",
        exists: resourcesFound,
        ok: resourcesFound,
        statusCode: resourcesFound ? 200 : 404,
      },
    },
  };
}

function pageSnapshot(): ExtractedPageMetadata {
  return {
    source: "raw",
    url: finalUrl,
    metadata: {
      faviconLinks: [],
      openGraph: {},
      twitter: {},
    },
    headings: { h1: [], all: [] },
    images: { total: 0, missingAlt: 0, items: [] },
    links: { total: 0, missingAccessibleText: 0, items: [] },
    jsonLd: [],
  };
}

function critical(id: string, title: string, description: string): AuditCheck {
  return check(id, title, description, "critical");
}

function warning(id: string, title: string, description: string): AuditCheck {
  return check(id, title, description, "warning");
}

function passed(id: string, title: string, description: string): AuditCheck {
  return check(id, title, description, "passed");
}

function check(
  id: string,
  title: string,
  description: string,
  severity: AuditCheck["severity"],
): AuditCheck {
  return {
    id,
    title,
    description,
    severity,
    category: id.startsWith("social.")
      ? "social"
      : id.startsWith("schema.")
        ? "schema"
        : id.startsWith("crawl.")
          ? "crawlability"
          : id.startsWith("structure.")
            ? "structure"
            : id.startsWith("a11y.")
              ? "accessibility"
              : "metadata",
    confidence: "high",
    fixability: severity === "passed" ? "not_fixable" : "plan_only",
  };
}

function frameworkName(frameworkId: FrameworkId): string {
  if (frameworkId === "next_app_router") return "Next.js App Router";
  if (frameworkId === "vite_react") return "Vite React";
  if (frameworkId === "static_html") return "Static HTML";
  if (frameworkId === "next_pages_router") return "Next.js Pages Router";
  if (frameworkId === "astro") return "Astro";
  if (frameworkId === "remix") return "Remix";
  return "Unknown";
}
