import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { dryRunFixFromPlan } from "../src/fix/dryRunFix";
import { planFixesFromResults } from "../src/plan/planFixes";
import { inspectRepo } from "../src/repo/inspectRepo";
import { formatDryRunFixJsonReport } from "../src/report/formatDryRunFixJsonReport";
import type { AuditCheck, AuditResult, ExtractedPageMetadata } from "../src/types/audit";
import { DryRunFixResultSchema } from "../src/types/dryRunFix";

const execFileAsync = promisify(execFile);
const fixtureRoot = join(import.meta.dirname, "fixtures", "repos");
const projectRoot = join(import.meta.dirname, "..");

describe("dry-run fix preview", () => {
  it("fails safely when fix is run without --dry-run", async () => {
    try {
      await execFileAsync("pnpm", ["shipready", "fix", ".", "--url", "https://example.com"], {
        cwd: projectRoot,
        timeout: 10000,
      });
      throw new Error("Expected command to fail.");
    } catch (error) {
      const result = error as { code?: number; stderr?: string };
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        "ShipReady fix requires an explicit mode. Re-run with --dry-run to preview proposed changes or --write --allow-create to create eligible missing robots/sitemap files.",
      );
    }
  });

  it("produces no file changes for a clean supported plan", () => {
    const repoRoot = fixture("vite-react");
    const plan = planFixesFromResults(cleanAudit(), inspectRepo(repoRoot));
    const result = dryRunFixFromPlan(plan, {
      repoRoot,
      generatedAt: "2026-06-14T00:00:00.000Z",
    });

    expect(result.recommendedNextStep).toBe("no_changes_needed");
    expect(result.fileChanges).toEqual([]);
    expect(result.wroteFiles).toBe(false);
  });

  it("does not generate file changes for unknown frameworks", () => {
    const repoRoot = fixture("unknown");
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.title.missing", "Missing title in raw HTML", "The initial HTML does not include a title tag."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.recommendedNextStep).toBe("unsupported_project");
    expect(result.fileChanges).toEqual([]);
    expect(result.skippedActions[0]).toMatchObject({
      reasonKind: "unsupported",
    });
  });

  it("previews a Vite public sitemap create for missing or invalid sitemap findings", () => {
    const repoRoot = fixture("vite-react");
    const plan = planFixesFromResults(
      auditWithChecks([
        warning(
          "crawl.sitemap.invalid",
          "sitemap.xml is not a valid sitemap",
          "The sitemap.xml URL returned a success response, but the body did not look like an XML sitemap.",
        ),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "public/sitemap.xml",
          changeType: "create",
          requiresHumanReview: true,
          after: expect.stringContaining("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"),
          diff: expect.stringContaining("+++ public/sitemap.xml"),
        }),
      ]),
    );
    expect(existsSync(join(repoRoot, "public", "sitemap.xml"))).toBe(false);
  });

  it("previews sitemap changes as XML sitemaps with the audited URL only", () => {
    const repoRoot = fixture("vite-react");
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const change = result.fileChanges.find((item) => item.path === "public/sitemap.xml");

    expect(change?.after).toBe([
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
      "  <url>",
      "    <loc>https://example.com/</loc>",
      "  </url>",
      "</urlset>",
      "",
    ].join("\n"));
    expect(change?.after).not.toContain("<loc>https://example.com/about</loc>");
  });

  it("previews a Vite index.html update for missing canonical and Open Graph URL", () => {
    const repoRoot = fixture("vite-react");
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
        warning("social.og.url_missing", "Missing og:url", "Open Graph metadata should include the canonical page URL."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const change = result.fileChanges.find((item) => item.path === "index.html");

    expect(change).toMatchObject({
      changeType: "update",
      requiresHumanReview: true,
    });
    expect(change?.after).toContain("<link rel=\"canonical\" href=\"https://example.com/\" />");
    expect(change?.after).toContain("<meta property=\"og:url\" content=\"https://example.com/\" />");
    expect(result.safetyNotes).toContain(
      "This is fallback metadata for the app shell. Route-specific metadata may require prerendering, SSR, or a later framework-specific strategy.",
    );
  });

  it("previews a static HTML metadata update without writing the file", () => {
    const repoRoot = staticRepo("<!doctype html><html><head></head><body><h1>Example</h1></body></html>");
    const before = readFileSync(join(repoRoot, "index.html"), "utf8");
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.title.missing", "Missing title in raw HTML", "The initial HTML does not include a title tag."),
        critical("metadata.description.missing", "Missing meta description in raw HTML", "The initial HTML does not include a meta description."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges[0]).toMatchObject({
      path: "index.html",
      changeType: "update",
      requiresHumanReview: true,
      before,
    });
    expect(result.fileChanges[0]?.after).toContain("<title>TODO: Page title</title>");
    expect(result.fileChanges[0]?.diff).toContain("+  <meta name=\"description\" content=\"TODO: Page description\" />");
    expect(readFileSync(join(repoRoot, "index.html"), "utf8")).toBe(before);
  });

  it("inserts metadata inside head without rewriting unrelated HTML", () => {
    const html = [
      "<!doctype html>",
      "<html lang=\"en\">",
      "  <head>",
      "    <title>Example Site</title>",
      "    <meta name=\"description\" content=\"A concise factual description for tests.\" />",
      "  </head>",
      "  <body>",
      "    <main id=\"app\">",
      "      <p>Body content stays untouched.</p>",
      "    </main>",
      "  </body>",
      "</html>",
      "",
    ].join("\n");
    const repoRoot = staticRepo(html);
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
        warning("social.og.url_missing", "Missing og:url", "Open Graph metadata should include the canonical page URL."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const change = result.fileChanges.find((item) => item.path === "index.html");

    expect(change?.after).toContain("    <link rel=\"canonical\" href=\"https://example.com/\" />\n");
    expect(change?.after).toContain("  </head>\n  <body>");
    expect(change?.after).toContain([
      "  <body>",
      "    <main id=\"app\">",
      "      <p>Body content stays untouched.</p>",
      "    </main>",
      "  </body>",
    ].join("\n"));
    expect(change?.diff).not.toContain("-  <body>");
    expect(change?.diff).not.toContain("-    <main id=\"app\">");
  });

  it("does not show a whole-file replacement diff for normal multiline HTML", () => {
    const html = [
      "<!doctype html>",
      "<html lang=\"en\">",
      "  <head>",
      "    <title>Example Site</title>",
      "    <meta name=\"description\" content=\"A concise factual description for tests.\" />",
      "  </head>",
      "  <body>",
      "    <h1>Example</h1>",
      "    <p>Stable body copy.</p>",
      "  </body>",
      "</html>",
      "",
    ].join("\n");
    const repoRoot = staticRepo(html);
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const diff = result.fileChanges[0]?.diff ?? "";
    const removedContentLines = diff
      .split("\n")
      .filter((line) => line.startsWith("-") && !line.startsWith("---"));

    expect(removedContentLines).toHaveLength(0);
    expect(diff).toContain("@@ -3,");
    expect(diff.split("\n").length).toBeLessThan(30);
  });

  it("avoids duplicate canonical, Open Graph, and Twitter tags", () => {
    const html = [
      "<!doctype html>",
      "<html lang=\"en\">",
      "  <head>",
      "    <title>Example Site</title>",
      "    <meta name=\"description\" content=\"A concise factual description for tests.\" />",
      "    <link rel=\"canonical\" href=\"https://example.com/\" />",
      "    <meta property=\"og:url\" content=\"https://example.com/\" />",
      "    <meta name=\"twitter:card\" content=\"summary_large_image\" />",
      "  </head>",
      "  <body><h1>Example</h1></body>",
      "</html>",
      "",
    ].join("\n");
    const repoRoot = staticRepo(html);
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
        warning("social.og.url_missing", "Missing og:url", "Open Graph metadata should include the canonical page URL."),
        warning("social.twitter.card_missing", "Missing Twitter card", "Twitter metadata should include card type."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const after = result.fileChanges[0]?.after ?? "";

    expect(countMatches(after, "rel=\"canonical\"")).toBe(1);
    expect(countMatches(after, "property=\"og:url\"")).toBe(1);
    expect(countMatches(after, "name=\"twitter:card\"")).toBe(1);
  });

  it("marks JSON-LD preview as review-required", () => {
    const repoRoot = staticRepo(
      "<!doctype html><html><head><title>Example Site</title><meta name=\"description\" content=\"A concise factual description for tests.\" /></head><body><h1>Example</h1></body></html>",
    );
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("schema.jsonld.missing", "No JSON-LD detected", "No structured data script tags were found in the raw HTML."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges[0]).toMatchObject({
      path: "index.html",
      requiresHumanReview: true,
      risk: "medium",
      sourceActionIds: ["static_html.json_ld_review"],
    });
    expect(result.fileChanges[0]?.after).toContain("\"@type\": \"WebSite\"");
  });

  it("skips H1 and content changes", () => {
    const repoRoot = staticRepo("<!doctype html><html><head><title>Example</title></head><body></body></html>");
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("structure.h1.missing", "No H1 found", "The page should have one clear H1."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges).toEqual([]);
    expect(result.skippedActions[0]).toMatchObject({
      actionId: "static_html.heading",
      reason: "H1 review is a content change and requires human review.",
    });
  });

  it("emits JSON matching the dry-run schema", () => {
    const repoRoot = fixture("vite-react");
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const parsed = JSON.parse(formatDryRunFixJsonReport(result)) as unknown;

    expect(() => DryRunFixResultSchema.parse(parsed)).not.toThrow();
    const parsedResult = DryRunFixResultSchema.parse(parsed);
    expect(parsedResult.wroteFiles).toBe(false);
    expect(parsedResult.fileChanges[0]).toMatchObject({
      risk: "low",
      reviewStatus: "auto_candidate",
    });
  });

  it("previews a Next.js App Router robots.ts create without writing files", () => {
    const repoRoot = nextAppRepo();
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges).toEqual([
      expect.objectContaining({
        path: "src/app/robots.ts",
        changeType: "create",
        risk: "low",
        requiresHumanReview: false,
        reviewStatus: "auto_candidate",
        after: expect.stringContaining("export default function robots(): MetadataRoute.Robots"),
        diff: expect.stringContaining("+++ src/app/robots.ts"),
      }),
    ]);
    expect(result.fileChanges[0]?.after).toContain("sitemap: \"https://example.com/sitemap.xml\"");
    expect(existsSync(join(repoRoot, "src/app/robots.ts"))).toBe(false);
  });

  it("previews a Next.js App Router sitemap.ts create for an invalid sitemap", () => {
    const repoRoot = nextAppRepo();
    const plan = planFixesFromResults(
      auditWithChecks([
        warning(
          "crawl.sitemap.invalid",
          "sitemap.xml is not a valid sitemap",
          "The sitemap.xml URL returned a success response, but the body did not look like an XML sitemap.",
        ),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const change = result.fileChanges.find((item) => item.path === "src/app/sitemap.ts");

    expect(change).toMatchObject({
      changeType: "create",
      risk: "low",
      requiresHumanReview: true,
      reviewStatus: "review_required",
      sourceActionIds: ["next_app_router.sitemap"],
    });
    expect(change?.after).toContain("export default function sitemap(): MetadataRoute.Sitemap");
    expect(change?.after).toContain("url: \"https://example.com/\"");
    expect(change?.after).not.toContain("https://example.com/about");
    expect(existsSync(join(repoRoot, "src/app/sitemap.ts"))).toBe(false);
  });

  it("previews a simple Next.js root metadata export in src/app/layout.tsx", () => {
    const repoRoot = nextAppRepo();
    const before = readFileSync(join(repoRoot, "src/app/layout.tsx"), "utf8");
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.title.missing", "Missing title in raw HTML", "The initial HTML does not include a title tag."),
        critical("metadata.description.missing", "Missing meta description in raw HTML", "The initial HTML does not include a meta description."),
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
        warning("social.og.url_missing", "Missing og:url", "Open Graph metadata should include the canonical page URL."),
        warning("social.og.type_missing", "Missing og:type", "Open Graph metadata should include a type."),
        warning("social.twitter.card_missing", "Missing Twitter card", "Twitter metadata should include card type."),
        warning("social.og.image_missing", "Missing og:image", "Open Graph metadata should include an image."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const change = result.fileChanges.find((item) => item.path === "src/app/layout.tsx");

    expect(change).toMatchObject({
      changeType: "update",
      risk: "medium",
      requiresHumanReview: true,
      reviewStatus: "review_required",
      sourceActionIds: ["next_app_router.metadata_review"],
      before,
    });
    expect(change?.after).toContain("import type { Metadata } from \"next\";");
    expect(change?.after).toContain("export const metadata: Metadata = {");
    expect(change?.after).toContain("title: \"TODO: Page title\"");
    expect(change?.after).toContain("description: \"TODO: Page description\"");
    expect(change?.after).toContain("canonical: \"https://example.com/\"");
    expect(change?.after).toContain("openGraph: {");
    expect(change?.after).toContain("url: \"https://example.com/\"");
    expect(change?.after).toContain("type: \"website\"");
    expect(change?.after).toContain("twitter: {");
    expect(change?.after).toContain("card: \"summary_large_image\"");
    expect(change?.after).not.toContain("images:");
    expect(result.safetyNotes).toContain(
      "Skipped Next.js metadata fields that require factual assets or copy: openGraph.images.",
    );
    expect(readFileSync(join(repoRoot, "src/app/layout.tsx"), "utf8")).toBe(before);
  });

  it("keeps Next.js layout metadata diffs compact", () => {
    const repoRoot = nextAppRepo({
      layout: [
        "import { Suspense } from \"react\";",
        "",
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        "  return (",
        "    <html lang=\"en\">",
        "      <body>",
        "        <Suspense>{children}</Suspense>",
        "      </body>",
        "    </html>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const diff = result.fileChanges[0]?.diff ?? "";

    expect(diff).toContain("@@ -1,");
    expect(diff).toContain("+export const metadata: Metadata = {");
    expect(diff).not.toContain("-export default function RootLayout");
    expect(diff.split("\n").length).toBeLessThan(30);
  });

  it("skips Next.js metadata updates when generateMetadata already exists", () => {
    const repoRoot = nextAppRepo({
      layout: [
        "export async function generateMetadata() {",
        "  return { title: \"Dynamic\" };",
        "}",
        "",
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        "  return <html lang=\"en\"><body>{children}</body></html>;",
        "}",
        "",
      ].join("\n"),
    });
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges).toEqual([]);
    expect(result.skippedActions).toEqual([
      expect.objectContaining({
        actionId: "next_app_router.metadata_review",
        reason: "Existing generateMetadata found; dynamic metadata should be reviewed manually.",
      }),
    ]);
  });

  it("skips Next.js metadata updates when a metadata export already exists", () => {
    const repoRoot = nextAppRepo({
      layout: [
        "export const metadata = {",
        "  title: \"Existing title\",",
        "};",
        "",
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        "  return <html lang=\"en\"><body>{children}</body></html>;",
        "}",
        "",
      ].join("\n"),
    });
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges).toEqual([]);
    expect(result.skippedActions).toEqual([
      expect.objectContaining({
        actionId: "next_app_router.metadata_review",
        reason: "Existing metadata export found; merging metadata is skipped until a tested merge path exists.",
      }),
    ]);
  });

  it("skips TypeScript metadata insertion for Next.js .jsx layouts", () => {
    const repoRoot = nextAppRepo({
      appRoot: "app",
      layoutPath: "app/layout.jsx",
      pagePath: "app/page.jsx",
      layout: [
        "export default function RootLayout({ children }) {",
        "  return <html lang=\"en\"><body>{children}</body></html>;",
        "}",
        "",
      ].join("\n"),
      page: "export default function Page() { return <main>Home</main>; }\n",
    });
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges).toEqual([]);
    expect(result.skippedActions).toEqual([
      expect.objectContaining({
        actionId: "next_app_router.metadata_review",
        reason: "app/layout.jsx is not a .tsx layout; TypeScript metadata insertion is skipped.",
      }),
    ]);
  });

  it("prefers src/app when selecting Next.js App Router generated route targets", () => {
    const repoRoot = nextAppRepo({
      extraFiles: {
        "app/page.tsx": "export default function LegacyPage() { return <main>Legacy</main>; }\n",
      },
    });
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
        warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });

    expect(result.fileChanges.map((change) => change.path).sort()).toEqual([
      "src/app/robots.ts",
      "src/app/sitemap.ts",
    ]);
    expect(result.fileChanges.some((change) => change.path.startsWith("app/"))).toBe(false);
  });

  it("emits Next.js dry-run JSON with review and risk status", () => {
    const repoRoot = nextAppRepo();
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
      ]),
      inspectRepo(repoRoot),
    );
    const result = dryRunFixFromPlan(plan, { repoRoot });
    const parsed = DryRunFixResultSchema.parse(JSON.parse(formatDryRunFixJsonReport(result)) as unknown);

    expect(parsed.fileChanges[0]).toMatchObject({
      path: "src/app/layout.tsx",
      risk: "medium",
      requiresHumanReview: true,
      reviewStatus: "review_required",
    });
    expect(parsed.fileChanges[0]?.diff).toContain("+++ src/app/layout.tsx");
  });
});

function countMatches(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function fixture(name: string): string {
  return join(fixtureRoot, name);
}

function staticRepo(indexHtml: string): string {
  const root = mkdtempSync(join(tmpdir(), "shipready-static-"));
  writeFileSync(join(root, "index.html"), indexHtml);
  return root;
}

function nextAppRepo(options: {
  appRoot?: "src/app" | "app";
  layoutPath?: string;
  pagePath?: string;
  layout?: string;
  page?: string;
  extraFiles?: Record<string, string>;
} = {}): string {
  const root = mkdtempSync(join(tmpdir(), "shipready-next-app-"));
  const appRoot = options.appRoot ?? "src/app";
  const layoutPath = options.layoutPath ?? `${appRoot}/layout.tsx`;
  const pagePath = options.pagePath ?? `${appRoot}/page.tsx`;
  writeFixtureFile(root, "package.json", JSON.stringify({
    dependencies: {
      next: "15.0.0",
      react: "19.0.0",
      "react-dom": "19.0.0",
    },
  }, null, 2));
  writeFixtureFile(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  writeFixtureFile(root, "next.config.mjs", "export default {};\n");
  writeFixtureFile(root, layoutPath, options.layout ?? [
    "export default function RootLayout({ children }: { children: React.ReactNode }) {",
    "  return <html lang=\"en\"><body>{children}</body></html>;",
    "}",
    "",
  ].join("\n"));
  writeFixtureFile(root, pagePath, options.page ?? "export default function Page() { return <main>Home</main>; }\n");

  for (const [path, content] of Object.entries(options.extraFiles ?? {})) {
    writeFixtureFile(root, path, content);
  }

  return root;
}

function writeFixtureFile(root: string, path: string, content: string): void {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function cleanAudit(): AuditResult {
  return auditWithChecks([
    passed("metadata.title.present", "Title present", "Raw title: Example"),
    passed("metadata.description.present", "Meta description present", "Raw meta description is present."),
    passed("metadata.canonical.present", "Canonical URL present", "https://example.com/"),
    passed("social.og.image_present", "og:image present", "https://example.com/og.png"),
    passed("social.twitter.card_present", "twitter:card present", "summary_large_image"),
    passed("schema.jsonld.valid", "Valid JSON-LD detected", "Valid blocks: 1"),
    passed("crawl.robots_txt.found", "robots.txt found", "https://example.com/robots.txt"),
    passed("crawl.sitemap.found", "sitemap.xml found", "https://example.com/sitemap.xml"),
  ], 100, "good");
}

function auditWithChecks(
  checks: AuditCheck[],
  score = 62,
  status: AuditResult["status"] = "needs_work",
): AuditResult {
  const snapshot = pageSnapshot();
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    auditedAt: "2026-06-14T00:00:00.000Z",
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
        exists: false,
        ok: false,
        statusCode: 404,
      },
      sitemapXml: {
        url: "https://example.com/sitemap.xml",
        exists: false,
        ok: false,
        statusCode: 404,
      },
    },
  };
}

function pageSnapshot(): ExtractedPageMetadata {
  return {
    source: "raw",
    url: "https://example.com/",
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
