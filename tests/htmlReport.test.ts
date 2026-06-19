import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { renderHtmlReport } from "../src/report/renderHtmlReport";
import type { UiFixAction, UiIssue, UiReport } from "../src/types/uiReport";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("HTML report rendering", () => {
  it("renders from a clean ui-report", () => {
    const html = renderHtmlReport(baseReport());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("ShipReady report");
    expect(html).toContain("Ready");
    expect(html).toContain("Core launch checks look good and no changes are needed.");
  });

  it("renders safe apply availability", () => {
    const html = renderHtmlReport(safeApplyReport());

    expect(html).toContain("Safe automatic fix available");
    expect(html).toContain("ShipReady can create these missing crawl files without overwriting existing files");
    expect(html).toContain("app/robots.ts");
    expect(html).toContain("pnpm shipready fix /tmp/example-app --url https://example.com/ --write --allow-create");
    expect(html).toContain("No overwrites");
    expect(html).toContain("No metadata or content edits");
  });

  it("renders a needs-attention decision summary near the top", () => {
    const html = renderHtmlReport(safeApplyReport());
    const hero = html.slice(html.indexOf("<header"), html.indexOf('<section class="section">'));

    expect(hero).toContain("Needs attention before launch");
    expect(hero).toContain("Issue review");
    expect(hero).toContain("1 issue needs review");
    expect(hero).toContain("Safe apply");
    expect(hero).toContain("Available");
    expect(hero).toContain("Next best action");
    expect(hero).toContain("Apply the safe crawl-file fix");
  });

  it("limits passed highlights and collapses the rest in needs-attention reports", () => {
    const report = safeApplyReport();
    const passedHighlights = Array.from({ length: 5 }, (_, index) =>
      issue({
        id: `passed.${index}`,
        title: `Passed check ${index + 1}`,
        explanation: `Passed explanation ${index + 1}`,
      }),
    );
    report.readiness.passedHighlights = passedHighlights;
    report.actionGroups!.alreadyGood = passedHighlights;

    const html = renderHtmlReport(report);
    const overview = html.slice(html.indexOf("Readiness overview"), html.indexOf("Preview cards"));
    const visibleHighlightCount = overview.match(/class="mini-issue-card"/g)?.length ?? 0;

    expect(visibleHighlightCount).toBe(3);
    expect(overview).toContain("View remaining passed checks");
    expect(overview).toContain('<span class="summary-count">2 items</span>');
  });

  it("renders unavailable safe apply copy without implying automatic changes", () => {
    const html = renderHtmlReport(needsReviewReport());

    expect(html).toContain("No safe automatic fix available");
    expect(html).toContain("ShipReady found changes, but they require review before they should be applied.");
    expect(html).toContain("Blocked from safe apply");
    expect(html).not.toContain("--write --allow-create");
  });

  it("keeps unknown clean local repos calm", () => {
    const html = renderHtmlReport(baseReport({
      project: {
        detected: false,
        frameworkLabel: "Unknown",
        confidenceLabel: "manual_review",
        explanation: "ShipReady could not confidently detect a supported project type.",
        importantFiles: ["package.json"],
        supportedFixes: ["None yet"],
        limitations: ["Unsupported project type."],
      },
    }));

    expect(html).toContain("The live page looks ready");
    expect(html).toContain("will not suggest local changes");
    expect(html).not.toContain("This local folder needs manual review");
  });

  it("renders URL-only reports", () => {
    const html = renderHtmlReport(urlOnlyReport());

    expect(html).toContain("URL only");
    expect(html).toContain("No local fix plan is available in URL-only mode.");
    expect(html).toContain("No local changes to apply");
    expect(html).toContain("This URL-only report did not inspect a local project folder");
    expect(html).not.toContain("Project understanding");
  });

  it("escapes HTML in titles, descriptions, and diffs", () => {
    const report = baseReport({
      readiness: {
        ...baseReport().readiness,
        title: '<script>alert("readiness")</script>',
        summary: "Summary & <b>bad</b>",
      },
      previews: {
        ...baseReport().previews,
        google: {
          ...baseReport().previews.google,
          title: '<img src=x onerror="alert(1)">',
          description: 'Tom & "Jerry"',
        },
      },
      actionGroups: {
        ...baseReport().actionGroups!,
        needsReview: [
          action({
            title: '<script>alert("action")</script>',
            explanation: "Use <b>bold</b> & check",
            reviewReason: "Review > write",
          }),
        ],
      },
      patchPreview: {
        hasPreview: true,
        fileChanges: [
          {
            path: "index.html",
            changeType: "update",
            title: "Update index.html",
            risk: "medium",
            reviewStatus: "review_required",
            eligibleForWrite: false,
            writePolicy: "creation_only_robots_sitemap_v1",
            writeBlockReason: "Existing files are not overwritten.",
            sourceActionIds: ["metadata.title.missing"],
            diff: 'diff --git\n+<div onclick="bad">& hi</div>',
          },
        ],
        skippedActions: [],
      },
    });

    const html = renderHtmlReport(report);

    expect(html).not.toContain('<script>alert("action")</script>');
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(&quot;action&quot;)&lt;/script&gt;");
    expect(html).toContain("+&lt;div onclick=&quot;bad&quot;&gt;&amp; hi&lt;/div&gt;");
  });

  it("includes the readiness summary", () => {
    const html = renderHtmlReport(baseReport());

    expect(html).toContain("Core launch checks look good and no changes are needed.");
  });

  it("includes preview cards", () => {
    const html = renderHtmlReport(baseReport());

    expect(html).toContain("Google preview");
    expect(html).toContain("Social preview");
    expect(html).toContain("X/Twitter preview");
    expect(html).toContain("Crawler view");
  });

  it("includes action groups", () => {
    const html = renderHtmlReport(safeApplyReport());

    expect(html).toContain("Safe to apply");
    expect(html).toContain("Needs review");
    expect(html).toContain("Manual only");
    expect(html).toContain("Already good");
    expect(html).toContain("Optional polish");
  });

  it("keeps lower-priority action groups collapsed", () => {
    const html = renderHtmlReport(safeApplyReport());

    expect(html).toContain('<details class="action-group quiet-group">');
    expect(html).toContain('<span class="summary-count">1 item</span>');
  });

  it("includes local-vs-live warning when a repo path exists", () => {
    const html = renderHtmlReport(baseReport());

    expect(html).toContain("Local changes do not affect the live website until you deploy.");
  });

  it("does not include local-vs-live apply messaging in URL-only mode", () => {
    const html = renderHtmlReport(urlOnlyReport());

    expect(html).not.toContain("Local changes do not affect the live website until you deploy.");
    expect(html).not.toContain("--write --allow-create");
  });

  it("includes developer details in native details", () => {
    const html = renderHtmlReport(baseReport());

    expect(html).toContain('<details class="developer-details">');
    expect(html).toContain("Raw JSON report");
    expect(html).toContain("&quot;schemaVersion&quot;: &quot;ui-report-v1&quot;");
  });

  it("keeps patch diffs behind native details", () => {
    const html = renderHtmlReport(safeApplyReport());

    expect(html).toContain('<details class="diff-details">');
    expect(html).toContain("<summary>View diff</summary>");
    expect(html).toContain("+++ app/robots.ts");
  });

  it("does not emit script tags", () => {
    const html = renderHtmlReport(baseReport());

    expect(html).not.toMatch(/<script\b/i);
  });

  it("does not emit external asset tags or CSS imports", () => {
    const html = renderHtmlReport(baseReport());

    expect(html).not.toMatch(/<(?:script|img|iframe|source)\b[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link\b[^>]+href=["']https?:/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/url\(/i);
  });

  it("escapes and wrap-protects long URLs and paths", () => {
    const longPath = `/tmp/example-<app>&-${"nested-path-".repeat(16)}page.tsx`;
    const html = renderHtmlReport(baseReport({
      input: {
        url: "https://example.com/very/long/path?with=<unsafe>&value=1",
        repoPath: longPath,
        mode: "url_and_repo",
      },
      project: {
        ...baseReport().project!,
        importantFiles: [longPath],
      },
    }));

    expect(html).toContain("wrap-safe");
    expect(html).toContain("/tmp/example-&lt;app&gt;&amp;-");
    expect(html).toContain("https://example.com/very/long/path?with=&lt;unsafe&gt;&amp;value=1");
    expect(html).not.toContain("/tmp/example-<app>&-");
  });

  it("still includes all required report sections", () => {
    const html = renderHtmlReport(baseReport());

    for (const section of [
      "Readiness overview",
      "Preview cards",
      "Project understanding",
      "Fix plan",
      "Patch preview",
      "Safe apply",
      "Developer details",
    ]) {
      expect(html).toContain(section);
    }
  });

  it("CLI writes the output file", async () => {
    const tempDir = await makeTempDir();
    const outputFile = join(tempDir, "report.html");
    await withStaticServer(async (url) => {
      const result = await execFileAsync(
        "pnpm",
        ["shipready", "html-report", "--url", url, "--output", outputFile, "--no-render"],
        { cwd: process.cwd(), timeout: 30000 },
      );

      expect(result.stdout).toContain("ShipReady HTML report written to");
      const html = await readFile(outputFile, "utf8");
      expect(html).toContain("ShipReady report");
      expect(html).toContain(url);
    });
  }, 40000);

  it("CLI handles missing --output clearly", async () => {
    await expect(
      execFileAsync(
        "pnpm",
        ["shipready", "html-report", "--url", "https://example.com", "--no-render"],
        { cwd: process.cwd(), timeout: 15000 },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing --output. Provide a target HTML file path."),
    });
  });
});

function baseReport(overrides: Partial<UiReport> = {}): UiReport {
  const report: UiReport = {
    schemaVersion: "ui-report-v1",
    generatedAt: "2026-06-15T12:00:00.000Z",
    input: {
      url: "https://example.com/",
      repoPath: "/tmp/example-app",
      mode: "url_and_repo",
    },
    workflow: {
      currentRecommendedStep: "no_changes_needed",
      completedStages: ["audit", "repo_inspection"],
      availableNextActions: [
        {
          label: "No changes needed",
          action: "none",
          primary: true,
          enabled: true,
        },
      ],
    },
    readiness: {
      label: "ready",
      title: "Ready to ship",
      summary: "Core launch checks look good and no changes are needed.",
      score: 98,
      topIssues: [],
      passedHighlights: [issue()],
      optionalPolish: [],
    },
    previews: {
      google: {
        title: "Example",
        url: "https://example.com/",
        description: "A clean launch page.",
        missingFields: [],
        source: "raw",
      },
      social: {
        title: "Example",
        url: "https://example.com/",
        description: "A clean launch page.",
        image: "https://example.com/og.png",
        missingFields: [],
        source: "raw",
      },
      twitter: {
        card: "summary_large_image",
        title: "Example",
        description: "A clean launch page.",
        image: "https://example.com/og.png",
        missingFields: [],
        source: "raw",
      },
      crawlerView: {
        rawHtmlSummary: "Raw HTML includes title, description, canonical, 4 Open Graph field(s), 4 Twitter/X field(s), and 1 JSON-LD block(s).",
        renderedHtmlSummary: "Rendered HTML includes title, description, canonical, 4 Open Graph field(s), 4 Twitter/X field(s), and 1 JSON-LD block(s).",
        renderOnlyWarnings: [],
      },
    },
    project: {
      detected: true,
      frameworkLabel: "Next.js App Router",
      confidenceLabel: "good_match",
      explanation: "ShipReady detected Next.js from local project files.",
      importantFiles: ["src/app/layout.tsx"],
      supportedFixes: ["Create robots.ts", "Create sitemap.ts"],
      limitations: [],
    },
    actionGroups: {
      safeToApply: [],
      needsReview: [],
      manualOnly: [],
      alreadyGood: [issue()],
      optionalPolish: [],
    },
    patchPreview: {
      hasPreview: false,
      fileChanges: [],
      skippedActions: [],
    },
    safeApply: {
      available: false,
      buttonLabel: "No safe automatic fixes",
      explanation: "No dry-run file change currently qualifies for V1 safe apply.",
      eligibleFiles: [],
      blockedFiles: [],
      policy: "creation_only_robots_sitemap_v1",
      safetyNotes: ["This ui-report command never writes files."],
    },
    liveVsLocal: {
      localChangesAffectLiveSite: false,
      deploymentRequired: false,
      message:
        "A local repository was inspected, but no local changes are proposed. Future local changes still require deployment before affecting the live site.",
    },
    errors: [],
    developerDetails: {
      rawAudit: { status: "good" },
      rawRepoInspection: { framework: "next" },
    },
  };

  return { ...report, ...overrides };
}

function urlOnlyReport(): UiReport {
  return baseReport({
    input: {
      url: "https://example.com/",
      mode: "url_only",
    },
    workflow: {
      currentRecommendedStep: "connect_repo",
      completedStages: ["audit"],
      availableNextActions: [
        {
          label: "Select project folder",
          action: "select_repo",
          primary: true,
          enabled: true,
          explanation: "Connect the local project before previewing or applying fixes.",
        },
      ],
    },
    project: undefined,
    actionGroups: undefined,
    patchPreview: undefined,
    safeApply: {
      available: false,
      buttonLabel: "No safe automatic fixes",
      explanation: "No dry-run file change currently qualifies for V1 safe apply.",
      eligibleFiles: [],
      blockedFiles: [],
      policy: "creation_only_robots_sitemap_v1",
      safetyNotes: ["This ui-report command never writes files."],
    },
    liveVsLocal: {
      localChangesAffectLiveSite: false,
      deploymentRequired: false,
      message: "This report audits the live URL only. Select a local project folder before previewing local changes.",
    },
  });
}

function safeApplyReport(): UiReport {
  return baseReport({
    readiness: {
      ...baseReport().readiness,
      label: "needs_attention",
      title: "Needs attention before launch",
      summary: "1 issue(s) need review before this page should be considered launch-ready.",
      topIssues: [
        issue({
          id: "crawl.robots_txt.missing",
          title: "Your site does not have crawl instructions yet.",
          explanation: "A robots file gives crawlers basic instructions.",
          userSeverity: "important",
          technicalSeverity: "warning",
        }),
      ],
    },
    workflow: {
      currentRecommendedStep: "apply_safe_fixes",
      completedStages: ["audit", "repo_inspection", "fix_plan", "dry_run"],
      availableNextActions: [
        {
          label: "Create safe crawl files",
          action: "write_safe_fixes",
          primary: true,
          enabled: true,
        },
      ],
    },
    actionGroups: {
      safeToApply: [
        action({
          title: "Create app/robots.ts",
          targetLabel: "app/robots.ts",
          safety: "safe_to_apply",
          canApplyInV1: true,
        }),
      ],
      needsReview: [],
      manualOnly: [],
      alreadyGood: [issue()],
      optionalPolish: [],
    },
    patchPreview: {
      hasPreview: true,
      fileChanges: [
        {
          path: "app/robots.ts",
          changeType: "create",
          title: "Create app/robots.ts",
          risk: "low",
          reviewStatus: "auto_candidate",
          eligibleForWrite: true,
          writePolicy: "creation_only_robots_sitemap_v1",
          sourceActionIds: ["crawl.robots_txt.missing"],
          diff: "+++ app/robots.ts\n+export default function robots() {\n+  return { rules: { userAgent: '*', allow: '/' } };\n+}",
        },
      ],
      skippedActions: [],
    },
    safeApply: {
      available: true,
      buttonLabel: "Create safe crawl files",
      explanation:
        "ShipReady can create the listed missing robots/sitemap files, but this report does not apply them automatically.",
      eligibleFiles: ["app/robots.ts"],
      blockedFiles: [],
      policy: "creation_only_robots_sitemap_v1",
      safetyNotes: ["ShipReady will not overwrite existing files in V1 safe apply."],
    },
    liveVsLocal: {
      localChangesAffectLiveSite: false,
      deploymentRequired: true,
      message: "Local changes will not affect the live site until this repository is deployed and the URL is re-checked.",
    },
  });
}

function needsReviewReport(): UiReport {
  return baseReport({
    readiness: {
      ...baseReport().readiness,
      label: "needs_attention",
      title: "Needs attention before launch",
      summary: "2 issue(s) need review before this page should be considered launch-ready.",
      topIssues: [
        issue({
          id: "metadata.canonical.missing",
          title: "Search engines do not have a clear preferred URL.",
          explanation: "This page is missing a canonical URL.",
          userSeverity: "important",
          technicalSeverity: "warning",
        }),
      ],
    },
    workflow: {
      currentRecommendedStep: "review_patch_preview",
      completedStages: ["audit", "repo_inspection", "fix_plan", "dry_run"],
      availableNextActions: [
        {
          label: "Review patch preview",
          action: "review_patch_preview",
          primary: true,
          enabled: true,
        },
      ],
    },
    actionGroups: {
      safeToApply: [],
      needsReview: [
        action({
          title: "Update metadata",
          targetLabel: "src/app/layout.tsx",
          safety: "needs_review",
          canApplyInV1: false,
          reviewReason: "Metadata edits require human review.",
        }),
      ],
      manualOnly: [],
      alreadyGood: [issue()],
      optionalPolish: [],
    },
    patchPreview: {
      hasPreview: true,
      fileChanges: [
        {
          path: "src/app/layout.tsx",
          changeType: "update",
          title: "Update src/app/layout.tsx",
          risk: "medium",
          reviewStatus: "review_required",
          eligibleForWrite: false,
          writePolicy: "creation_only_robots_sitemap_v1",
          writeBlockReason: "Metadata edits require human review.",
          sourceActionIds: ["metadata.canonical.missing"],
          diff: "--- src/app/layout.tsx\n+++ src/app/layout.tsx\n+export const metadata = {};",
        },
      ],
      skippedActions: [],
    },
    safeApply: {
      available: false,
      buttonLabel: "No safe automatic fixes",
      explanation: "No dry-run file change currently qualifies for V1 safe apply.",
      eligibleFiles: [],
      blockedFiles: [
        {
          path: "src/app/layout.tsx",
          reason: "Metadata edits require human review.",
        },
      ],
      policy: "creation_only_robots_sitemap_v1",
      safetyNotes: ["This ui-report command never writes files."],
    },
  });
}

function issue(overrides: Partial<UiIssue> = {}): UiIssue {
  return {
    id: "metadata.title.present",
    title: "Title present",
    explanation: "The page includes a clear title.",
    whyItMatters: "Titles help search results and link previews explain the page.",
    userSeverity: "ready",
    technicalSeverity: "passed",
    sourceCheckIds: ["metadata.title.present"],
    ...overrides,
  };
}

function action(overrides: Partial<UiFixAction> = {}): UiFixAction {
  return {
    id: "file.app-robots",
    title: "Create app/robots.ts",
    explanation: "Create a crawl instruction file.",
    targetLabel: "app/robots.ts",
    affectsLiveSiteAfterDeploy: true,
    safety: "needs_review",
    canApplyInV1: false,
    reviewReason: "Review the generated file before applying.",
    sourceActionIds: ["crawl.robots_txt.missing"],
    ...overrides,
  };
}

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "shipready-html-report-"));
  tempDirs.push(dir);
  return dir;
}

async function withStaticServer(run: (url: string) => Promise<void>): Promise<void> {
  let baseUrl = "";
  const server: Server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}sitemap.xml\n`);
      return;
    }

    if (request.url === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml; charset=utf-8" });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}</loc></url>
</urlset>`);
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
<html lang="en">
  <head>
    <title>Local ShipReady Test</title>
    <meta name="description" content="A local page used by the html-report CLI test.">
    <link rel="canonical" href="${baseUrl}">
    <meta property="og:title" content="Local ShipReady Test">
    <meta property="og:description" content="A local page used by the html-report CLI test.">
    <meta property="og:image" content="${baseUrl}og.png">
    <meta property="og:url" content="${baseUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Local ShipReady Test">
    <meta name="twitter:description" content="A local page used by the html-report CLI test.">
    <meta name="twitter:image" content="${baseUrl}og.png">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Local ShipReady Test"}</script>
  </head>
  <body>
    <h1>Local ShipReady Test</h1>
    <img src="${baseUrl}og.png" alt="Preview">
  </body>
</html>`);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
