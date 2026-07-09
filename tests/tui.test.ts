import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTuiViewModel,
  parseTuiInclude,
  renderTuiScreen,
  type TuiOptionalChecks,
} from "../src/tui/tuiViewer";
import type { UiReport } from "../src/types/uiReport";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const cli = join(root, "src", "cli", "index.ts");
const fixtureRepo = join(root, "tests", "fixtures", "repos", "static-html");
const tempDirs: string[] = [];

let server: { url: string; close: () => Promise<void> } | undefined;

beforeEach(async () => {
  server = await auditServer();
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("TUI viewer", () => {
  it("builds a render model with target, status, next action, and required sections", () => {
    const model = createTuiViewModel(sampleReport());

    expect(model.title).toBe("ShipReady - Terminal Review");
    expect(model.target).toBe("https://example.com/");
    expect(model.status).toBe("Needs attention");
    expect(model.next).toBe("Select project folder");
    expect(model.sections.map((section) => section.label)).toEqual([
      "Overview",
      "Findings",
      "Internet view",
      "Social preview",
      "Crawl",
      "Project smells",
      "Fix plan",
      "Handoff",
      "Safety",
      "Commands",
    ]);
  });

  it("keeps safety and limitation labels visible in the sections", () => {
    const text = createTuiViewModel(sampleReport()).sections
      .flatMap((section) => section.lines)
      .join("\n");

    expect(text).toContain("Patch export: Review-only. Not applied. Target repo not modified.");
    expect(text).toContain("GitHub PR draft: Draft only. No PR created. No Git or GitHub command executed.");
    expect(text).toContain("Safe write: Only eligible missing robots/sitemap files can be created under WRITE_POLICY_V1.");
    expect(text).toContain("Social preview: Approximation from observed metadata. Platforms may differ.");
    expect(text).toContain("Crawl: Bounded same-origin sample. Not exhaustive.");
    expect(text).toContain("Smells: Heuristic implementation signals. Not authorship proof.");
    expect(text).toContain("Search Console: Mock-backed only. No live Google API or OAuth.");
    expect(text).toContain("DNS: Read-only DNS evidence. No provider writes.");
    expect(text).toContain("Distribution: Repository-local v0. Use pnpm --dir from outside the checkout.");
  });

  it("wraps and truncates long values to the terminal width", () => {
    const model = createTuiViewModel(sampleReport({
      url: "https://example.com/a-very-long-path-that-should-not-break-the-terminal-layout-or-overflow-the-rendered-screen",
      title: "A very long readiness finding title that should wrap in a narrow terminal without leaking past the viewport width",
    }));
    const rendered = renderTuiScreen(model, { sectionIndex: 0, scroll: 0, showHelp: false }, { columns: 56, rows: 18 });

    for (const line of rendered.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(56);
    }
    expect(rendered).toContain("...");
  });

  it("parses optional include values strictly", () => {
    expect(parseTuiInclude("social-preview,crawl,smells")).toEqual([
      "social-preview",
      "crawl",
      "smells",
    ]);
    expect(parseTuiInclude("crawl,crawl")).toEqual(["crawl"]);
    expect(parseTuiInclude("crawl,deploy")).toBeInstanceOf(Error);
  });

  it("renders optional read-only check summaries when provided", () => {
    const checks: TuiOptionalChecks = {
      socialPreview: {
        status: "ready",
        label: "Social preview",
        result: {
          verdict: { status: "ready" },
          mode: "mock",
          sourceMode: "both",
          warnings: [],
          previews: {
            google_search: {},
            generic_social: {},
            x_twitter: {},
            slack_discord: {},
            linkedin: {},
          },
        } as never,
      },
      crawl: {
        status: "ready",
        label: "Bounded crawl",
        result: {
          summary: {
            status: "ready",
            pagesChecked: 3,
            pagesDiscovered: 3,
            pagesSkipped: 0,
            repeatedIssues: 0,
          },
          options: { maxPages: 8, maxDepth: 1 },
        } as never,
      },
    };
    const text = createTuiViewModel(sampleReport(), checks).sections
      .flatMap((section) => section.lines)
      .join("\n");

    expect(text).toContain("Status: ready");
    expect(text).toContain("Pages checked: 3");
    expect(text).toContain("Approximation from observed metadata");
    expect(text).toContain("Bounded same-origin sample");
  });

  it("falls back to plain terminal review output in CI without ANSI control sequences", async () => {
    const { stdout, stderr } = await run(["tui", "--url", server!.url, "--no-render"], { CI: "true" });

    expect(stderr).toBe("");
    expect(stdout).toContain("ShipReady UI report");
    expect(stdout).toContain(`Target: ${server!.url}`);
    expect(stdout).toContain("Mode: URL only");
    expect(stdout).toContain("Read-only UI data. No files were modified");
    expect(stdout).not.toMatch(/\x1B\[[0-9;?]*[A-Za-z]/);
  });

  it("supports repo-backed fallback without hanging", async () => {
    const { stdout, stderr } = await run(["tui", fixtureRepo, "--url", server!.url, "--no-render"], { CI: "true" });

    expect(stderr).toBe("");
    expect(stdout).toContain("ShipReady UI report");
    expect(stdout).toContain("Mode: URL + repo");
    expect(stdout).toContain(`Repo: ${fixtureRepo}`);
  });

  it("returns a safe nonzero invalid-URL report", async () => {
    await expect(run(["tui", "--url", "not-a-url"], { CI: "true" })).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("ShipReady UI report"),
      stderr: "",
    });
  });

  it("does not write files while rendering the fallback report", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "shipready-tui-"));
    tempDirs.push(tempRoot);
    const marker = join(tempRoot, "marker.txt");
    await writeFile(marker, "before\n", "utf8");

    await run(["tui", tempRoot, "--url", server!.url, "--no-render"], { CI: "true" });

    expect(await readFile(marker, "utf8")).toBe("before\n");
  });

  it("does not add write, deploy, Git, or GitHub execution paths", async () => {
    const source = await readFile(join(root, "src", "tui", "tuiViewer.ts"), "utf8");

    expect(source).not.toContain("child_process");
    expect(source).not.toContain("writeFile");
    expect(source).not.toContain("writeFix");
    expect(source).not.toContain("exportPatch(");
    expect(source).not.toContain("githubPrDraft(");
  });
});

function run(args: string[], env: Record<string, string> = {}) {
  return execFileAsync(tsx, [cli, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    timeout: 20_000,
  });
}

async function auditServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const testServer = createServer((request, response) => {
    if (request.url === "/robots.txt" || request.url === "/sitemap.xml") {
      response.statusCode = 404;
      response.setHeader("content-type", "text/plain");
      response.end("not found");
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end("<!doctype html><html lang=\"en\"><head><title>TUI fixture</title><meta name=\"description\" content=\"TUI fixture description.\"></head><body><h1>TUI fixture</h1></body></html>");
  });
  await listen(testServer);
  const address = testServer.address();
  if (!address || typeof address === "string") throw new Error("No test server address.");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => testServer.close((error) => error ? reject(error) : resolve())),
  };
}

function listen(testServer: Server): Promise<void> {
  return new Promise((resolve) => testServer.listen(0, "127.0.0.1", resolve));
}

function sampleReport(input: { url?: string; title?: string } = {}): UiReport {
  return {
    schemaVersion: "ui-report-v1",
    generatedAt: "2026-07-09T00:00:00.000Z",
    input: {
      url: input.url ?? "https://example.com/",
      mode: "url_only",
    },
    workflow: {
      currentRecommendedStep: "connect_repo",
      completedStages: ["audit"],
      availableNextActions: [{
        label: "Select project folder",
        action: "select_repo",
        primary: true,
        enabled: true,
      }],
    },
    readiness: {
      label: "needs_attention",
      title: "Needs attention before launch",
      summary: "2 issue(s) need review before this page should be considered launch-ready.",
      topIssues: [{
        id: "metadata.description.missing",
        title: input.title ?? "The page description is missing from the first HTML response.",
        explanation: "The initial HTML does not include a meta description.",
        whyItMatters: "Descriptions help previews explain the page.",
        userSeverity: "blocking",
        technicalSeverity: "critical",
        sourceCheckIds: ["metadata.description.missing"],
      }],
      passedHighlights: [{
        id: "metadata.title.present",
        title: "Title present",
        explanation: "The title is available.",
        whyItMatters: "Titles help previews.",
        userSeverity: "ready",
        technicalSeverity: "passed",
        sourceCheckIds: ["metadata.title.present"],
      }],
      optionalPolish: [],
    },
    previews: {
      google: {
        title: "Example",
        url: input.url ?? "https://example.com/",
        missingFields: ["description"],
        source: "raw",
      },
      social: {
        title: "Example",
        url: input.url ?? "https://example.com/",
        missingFields: ["description", "image"],
        source: "raw",
      },
      twitter: {
        title: "Example",
        missingFields: ["card", "description", "image"],
        source: "raw",
      },
      crawlerView: {
        rawHtmlSummary: "Raw HTML includes title, 0 Open Graph field(s), 0 Twitter/X field(s), and 0 JSON-LD block(s).",
        renderedHtmlSummary: "Rendered HTML includes title, 0 Open Graph field(s), 0 Twitter/X field(s), and 0 JSON-LD block(s).",
        renderOnlyWarnings: [],
      },
    },
    liveVsLocal: {
      localChangesAffectLiveSite: false,
      deploymentRequired: false,
      message: "This report audits the live URL only. Select a local project folder before previewing local changes.",
    },
    errors: [],
    developerDetails: {},
  };
}
