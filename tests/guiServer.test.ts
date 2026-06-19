import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createUiReportApiResult, type GuiApiResult } from "../src/gui/guiApi";
import { startGuiServer, type RunningGuiServer } from "../src/gui/startGuiServer";
import type { CreateUiReportInput } from "../src/report/createUiReport";
import type { UiReport } from "../src/types/uiReport";

describe("ShipReady local GUI", () => {
  it("registers the gui command", async () => {
    const source = await readFile(join(import.meta.dirname, "..", "src", "cli", "index.ts"), "utf8");

    expect(source).toContain('.command("gui")');
    expect(source).toContain("--host <host>");
    expect(source).toContain("--port <port>");
  });

  it("starts on 127.0.0.1 by default", async () => {
    await withServer(async (server) => {
      expect(server.host).toBe("127.0.0.1");
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    });
  });

  it("serves the homepage", async () => {
    await withServer(async (server) => {
      const response = await fetch(`${server.url}/`);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(html).toContain("ShipReady local UI");
      expect(html).toContain("Check if your website is ready to share and index.");
      expect(html).toContain("Check launch-readiness");
      expect(html).toContain("data-connect-form novalidate");
      expect(html).toContain('input name="url" type="text" inputmode="url"');
    });
  });

  it("includes the key section labels on the homepage", async () => {
    await withServer(async (server) => {
      const html = await fetchText(`${server.url}/`);

      for (const label of [
        "Decision panel",
        "Readiness",
        "Preview cards",
        "Project understanding",
        "Fix plan",
        "Patch preview",
        "Safe apply",
        "Developer details",
      ]) {
        expect(html).toContain(label);
      }
    });
  });

  it("does not reference remote scripts, styles, or assets", async () => {
    await withServer(async (server) => {
      const html = await fetchText(`${server.url}/`);
      const css = await fetchText(`${server.url}/assets/gui.css`);
      const js = await fetchText(`${server.url}/assets/gui.js`);

      expect(html).not.toMatch(/\b(?:src|href)=["']https?:\/\//i);
      expect(css).not.toMatch(/url\(["']?https?:\/\//i);
      expect(js).not.toMatch(/https?:\/\//i);
    });
  });

  it("accepts URL-only ui-report requests", async () => {
    const calls: CreateUiReportInput[] = [];
    await withServer(async (server) => {
      const response = await postJson(server, {
        url: "https://example.com",
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      if (response.body.ok) {
        expect(response.body.report.input.mode).toBe("url_only");
      }
      expect(calls[0]).toMatchObject({
        url: "https://example.com",
        repoPath: undefined,
      });
    }, calls);
  });

  it("accepts URL plus local repo ui-report requests", async () => {
    const calls: CreateUiReportInput[] = [];
    const repoPath = join(import.meta.dirname, "fixtures", "repos", "next-app-router-dry-run");

    await withServer(async (server) => {
      const response = await postJson(server, {
        url: "https://example.com",
        repoPath,
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      if (response.body.ok) {
        expect(response.body.report.input.mode).toBe("url_and_repo");
        expect(response.body.report.project?.frameworkLabel).toBe("Next.js");
      }
      expect(calls[0]).toMatchObject({
        url: "https://example.com",
        repoPath,
      });
    }, calls);
  });

  it("returns a structured error for missing URL", async () => {
    await withServer(async (server) => {
      const response = await postJson(server, {
        repoPath: "/tmp/example",
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          stage: "audit",
          message: "Enter a website URL before running the check.",
        },
      });
    });
  });

  it("returns a structured error for invalid URL", async () => {
    const result = await createUiReportApiResult({
      url: "not-a-url",
    });

    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({
      ok: false,
      error: {
        stage: "audit",
        message: "Invalid URL. Provide an absolute http:// or https:// URL.",
      },
    });
  });

  it("returns a structured error for invalid JSON", async () => {
    await withServer(async (server) => {
      const response = await fetch(`${server.url}/api/ui-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        ok: false,
        error: {
          stage: "parse",
          message: "Request body must be valid JSON.",
        },
      });
    });
  });

  it("does not write files from /api/ui-report", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "shipready-gui-test-"));
    const markerPath = join(tempRoot, "marker.txt");
    await writeFile(markerPath, "before", "utf8");

    try {
      await withServer(async (server) => {
        const response = await postJson(server, {
          url: "https://example.com",
          repoPath: tempRoot,
        });
        const marker = await readFile(markerPath, "utf8");

        expect(response.body.ok).toBe(true);
        expect(marker).toBe("before");
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("displays safe apply as a command and does not add an execute endpoint", async () => {
    await withServer(async (server) => {
      const js = await fetchText(`${server.url}/assets/gui.js`);

      expect(js).toContain("pnpm shipready fix");
      expect(js).toContain("Copy command");
      expect(js).toContain("Guarded command copied. No files were changed.");
      expect(js).toContain("Demo-safe: this GUI does not write files.");
      expect(js).toContain("Safe apply remains a command you run separately after a repo-based dry run.");
      expect(js).not.toContain("/api/fix");
      expect(js).not.toContain("child_process");
      expect(js).not.toContain("exec(");
    });
  });

  it("keeps developer details collapsed on initial page load", async () => {
    await withServer(async (server) => {
      const html = await fetchText(`${server.url}/`);

      expect(html).toContain('<details class="developer-details">');
      expect(html).not.toContain('<details class="developer-details" open>');
    });
  });

  it("handles user-facing strings through textContent instead of HTML injection", async () => {
    await withServer(async (server) => {
      const js = await fetchText(`${server.url}/assets/gui.js`);

      expect(js).toContain("textContent");
      expect(js).toContain("Invalid URL. Provide a full website URL that starts with http or https.");
      expect(js).toContain("shouldCollapseActionGroup");
      expect(js).not.toContain("innerHTML");
      expect(js).not.toContain("insertAdjacentHTML");
    });
  });
});

async function withServer(
  callback: (server: RunningGuiServer) => Promise<void>,
  calls: CreateUiReportInput[] = [],
): Promise<void> {
  const server = await startGuiServer({
    port: 0,
    createReport: async (input) => {
      calls.push(input);
      return sampleReport(input);
    },
  });

  try {
    await callback(server);
  } finally {
    await server.close();
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return response.text();
}

async function postJson(
  server: RunningGuiServer,
  payload: unknown,
): Promise<{ status: number; body: GuiApiResult["body"] }> {
  const response = await fetch(`${server.url}/api/ui-report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function sampleReport(input: CreateUiReportInput): UiReport {
  const hasRepo = Boolean(input.repoPath);

  return {
    schemaVersion: "ui-report-v1",
    generatedAt: "2026-06-16T00:00:00.000Z",
    input: {
      url: input.url,
      repoPath: input.repoPath,
      mode: hasRepo ? "url_and_repo" : "url_only",
    },
    workflow: {
      currentRecommendedStep: hasRepo ? "apply_safe_fixes" : "connect_repo",
      completedStages: hasRepo ? ["audit", "repo_inspection", "fix_plan", "dry_run"] : ["audit"],
      availableNextActions: [{
        label: hasRepo ? "Create safe crawl files" : "Select project folder",
        action: hasRepo ? "write_safe_fixes" : "select_repo",
        primary: true,
        enabled: true,
        explanation: hasRepo
          ? "Only V1-eligible robots/sitemap creations qualify."
          : "Connect the local project before previewing fixes.",
      }],
    },
    readiness: {
      label: "almost_ready",
      title: "Almost ready",
      summary: "1 recommended improvement remains before this page is fully polished.",
      score: 86,
      topIssues: [{
        id: "crawl.sitemap.missing",
        title: "Your site does not have a sitemap yet.",
        explanation: "A sitemap lists the pages you want crawlers to discover.",
        whyItMatters: "A valid sitemap helps crawlers discover the pages you want indexed.",
        userSeverity: "recommended",
        technicalSeverity: "warning",
        sourceCheckIds: ["crawl.sitemap.missing"],
      }],
      passedHighlights: [{
        id: "metadata.title.present",
        title: "Title is visible.",
        explanation: "The page title is available in raw HTML.",
        whyItMatters: "Titles help previews and browser tabs.",
        userSeverity: "ready",
        technicalSeverity: "passed",
        sourceCheckIds: ["metadata.title.present"],
      }],
      optionalPolish: [],
    },
    previews: {
      google: {
        title: "Example",
        url: input.url,
        description: "Example description.",
        missingFields: [],
        source: "raw",
      },
      social: {
        title: "Example",
        url: input.url,
        description: "Example description.",
        image: undefined,
        missingFields: ["image"],
        source: "raw",
      },
      twitter: {
        card: undefined,
        title: "Example",
        description: "Example description.",
        image: undefined,
        missingFields: ["card", "image"],
        source: "raw",
      },
      crawlerView: {
        rawHtmlSummary: "Raw HTML includes title and description.",
        renderedHtmlSummary: "Rendered HTML includes title and description.",
        renderOnlyWarnings: [],
      },
    },
    project: hasRepo
      ? {
          detected: true,
          frameworkLabel: "Next.js",
          confidenceLabel: "good_match",
          explanation: "ShipReady detected Next.js from local project files.",
          importantFiles: ["src/app/robots.ts", "src/app/sitemap.ts"],
          supportedFixes: ["Create robots file", "Create sitemap file"],
          limitations: ["No metadata writes in V1."],
        }
      : undefined,
    actionGroups: hasRepo
      ? {
          safeToApply: [{
            id: "file.src/app/sitemap.ts",
            title: "Create src/app/sitemap.ts",
            explanation: "Create a sitemap route for crawlers.",
            targetLabel: "src/app/sitemap.ts",
            affectsLiveSiteAfterDeploy: true,
            safety: "safe_to_apply",
            canApplyInV1: true,
            sourceActionIds: ["crawl.sitemap.missing.sitemap"],
          }],
          needsReview: [],
          manualOnly: [],
          alreadyGood: [],
          optionalPolish: [],
        }
      : undefined,
    patchPreview: hasRepo
      ? {
          hasPreview: true,
          fileChanges: [{
            path: "src/app/sitemap.ts",
            changeType: "create",
            title: "Create src/app/sitemap.ts",
            risk: "low",
            reviewStatus: "auto_candidate",
            eligibleForWrite: true,
            writePolicy: "creation_only_robots_sitemap_v1",
            sourceActionIds: ["crawl.sitemap.missing.sitemap"],
            diff: "--- /dev/null\\n+++ src/app/sitemap.ts\\n",
          }],
          skippedActions: [],
        }
      : undefined,
    safeApply: hasRepo
      ? {
          available: true,
          buttonLabel: "Create safe crawl files",
          explanation: "ShipReady can create the listed missing robots/sitemap files.",
          eligibleFiles: ["src/app/sitemap.ts"],
          blockedFiles: [],
          policy: "creation_only_robots_sitemap_v1",
          safetyNotes: [
            "This ui-report command never writes files.",
            "ShipReady will not run Git operations, create commits, push, or deploy.",
          ],
        }
      : {
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
      deploymentRequired: hasRepo,
      message: hasRepo
        ? "Local changes will not affect the live site until this repository is deployed and the URL is re-checked."
        : "This report audits the live URL only. Select a local project folder before previewing local changes.",
    },
    errors: [],
    developerDetails: {
      rawAudit: {
        title: "<script>alert('escaped')</script>",
      },
    },
  };
}
