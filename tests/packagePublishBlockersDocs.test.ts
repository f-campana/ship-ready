import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("package publish blockers documentation", () => {
  it("tracks closed and remaining blockers without authorizing publish", async () => {
    const doc = await readFile(join(root, "docs", "PACKAGE_PUBLISH_BLOCKERS.md"), "utf8");

    for (const heading of [
      "## Closed in this pass",
      "## Still blocking publish",
      "## npm verification summary",
      "## Safety gates before publish",
      "## Recommendation",
    ]) {
      expect(doc).toContain(heading);
    }

    expect(doc).toContain("Preferred future package recorded: `@ship-ready/cli`.");
    expect(doc).toContain("Fallback package recorded: `@f-campana/shipready`.");
    expect(doc).toContain("Actual npm publish remains unauthorized.");
    expect(doc).toContain("`private` remains `true`.");
    expect(doc).toContain("`npm whoami` returned `kobol909`");
    expect(doc).toContain("`npm view @ship-ready/cli --json` returned `E404`.");
    expect(doc).toContain("An `E404` package view is not ownership.");
  });

  it("preserves hard safety gates for public package readiness", async () => {
    const doc = await readFile(join(root, "docs", "PACKAGE_PUBLISH_BLOCKERS.md"), "utf8");

    for (const boundary of [
      "GUI local/read-only",
      "`POST /api/fix` returning `404`",
      "MCP stdio-only with exactly one target-repo write tool",
      "`WRITE_POLICY_V1` canonical",
      "Patch export review-only",
      "GitHub PR draft review-only",
      "Search Console mock-backed only",
      "DNS read-only",
      "no telemetry",
      "Keep Fodmapp unchanged",
    ]) {
      expect(doc).toContain(boundary);
    }
  });
});
