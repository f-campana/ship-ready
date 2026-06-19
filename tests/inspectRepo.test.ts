import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectRepo } from "../src/repo/inspectRepo";
import { formatRepoInspectionHumanReport } from "../src/report/formatRepoInspectionHumanReport";
import { formatRepoInspectionJsonReport } from "../src/report/formatRepoInspectionJsonReport";
import { RepoInspectionResultSchema, type FrameworkId, type PackageManager } from "../src/types/repoInspection";

const fixtureRoot = join(import.meta.dirname, "fixtures", "repos");

function repo(name: string): string {
  return join(fixtureRoot, name);
}

describe("inspectRepo", () => {
  it.each([
    ["next-app-router", "next_app_router", "high", "pnpm"],
    ["next-pages-router", "next_pages_router", "high", "npm"],
    ["vite-react", "vite_react", "high", "yarn"],
    ["astro", "astro", "high", "bun"],
    ["remix", "remix", "high", "unknown"],
    ["static-html", "static_html", "medium", "unknown"],
    ["unknown", "unknown", "low", "unknown"],
  ] satisfies Array<[string, FrameworkId, "high" | "medium" | "low", PackageManager]>)(
    "detects %s",
    (fixtureName, frameworkId, confidence, packageManager) => {
      const result = inspectRepo(repo(fixtureName));

      expect(result.framework.id).toBe(frameworkId);
      expect(result.framework.confidence).toBe(confidence);
      expect(result.packageManager).toBe(packageManager);
      expect(result.framework.evidence.length).toBeGreaterThan(0);
    },
  );

  it("infers important files, routes, metadata locations, and future fixes for Next.js App Router", () => {
    const result = inspectRepo(repo("next-app-router"));

    expect(result.importantFiles.some((file) => file.path === "src/app/layout.tsx")).toBe(true);
    expect(result.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "src/app/page.tsx", route: "/" }),
        expect.objectContaining({ path: "src/app/about/page.tsx", route: "/about" }),
      ]),
    );
    expect(result.metadataLocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "src/app/layout.tsx", exists: true }),
        expect.objectContaining({ path: "src/app/robots.ts", exists: true }),
        expect.objectContaining({ path: "src/app/sitemap.ts", exists: false }),
      ]),
    );
    expect(result.supportedFixes.some((fix) => fix.id === "next_app.metadata_export")).toBe(true);
    expect(result.limitations).toContain("File writing is disabled; use `shipready fix --dry-run` for supported patch previews.");
    expect(result.limitations).not.toContain("No fix generation implemented yet.");
  });

  it("ignores generated and dependency directories while detecting unknown projects", () => {
    const result = inspectRepo(repo("unknown"));

    expect(result.framework.id).toBe("unknown");
    expect(result.importantFiles.some((file) => file.path.includes(".next"))).toBe(false);
    expect(result.importantFiles.some((file) => file.path.includes("dist"))).toBe(false);
    expect(result.routes).toHaveLength(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Unsupported or unknown project type"),
        expect.stringContaining("No likely route or page files"),
      ]),
    );
  });

  it("emits JSON matching the repo inspection schema", () => {
    const result = inspectRepo(repo("vite-react"));
    const json = formatRepoInspectionJsonReport(result);
    const parsed = JSON.parse(json) as unknown;

    expect(() => RepoInspectionResultSchema.parse(parsed)).not.toThrow();
    expect(RepoInspectionResultSchema.parse(parsed).framework.id).toBe("vite_react");
  });

  it("formats a founder-readable human report", () => {
    const result = inspectRepo(repo("next-pages-router"));
    const report = formatRepoInspectionHumanReport(result);

    expect(report).toContain("ShipReady repo inspection:");
    expect(report).toContain("Detected: Next.js Pages Router");
    expect(report).toContain("Package manager");
    expect(report).toContain("Likely metadata locations");
    expect(report).toContain("Supported future fixes");
    expect(report).toContain("Use this inspection result with a URL audit");
  });
});
