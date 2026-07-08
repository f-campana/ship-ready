import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("release-readiness documentation", () => {
  it("keeps the v0 release-readiness checkpoint and required sections", async () => {
    const doc = await readFile(join(root, "docs", "RELEASE_READINESS.md"), "utf8");

    for (const heading of [
      "## Current product shape",
      "## Implemented surfaces",
      "## Command matrix",
      "## Contract matrix",
      "## MCP surface",
      "## GUI surface",
      "## Write policy",
      "## Safety boundaries",
      "## Known limitations",
      "## Validation status",
      "## Demo / dogfood commands",
      "## Release blockers",
      "## Release recommendation",
      "## Next roadmap",
    ]) {
      expect(doc).toContain(heading);
    }

    expect(doc).toContain("v0 local/agent release candidate");
    expect(doc).toContain("shipready.write_safe_crawl_files");
    expect(doc).toContain("POST /api/fix");
    expect(doc).toContain("DISTRIBUTION.md");
    expect(doc).toContain("TUI viewer feasibility / implementation");
  });

  it("documents source-checkout command usage without implying distribution", async () => {
    const readme = await readFile(join(root, "README.md"), "utf8");
    const commands = await readFile(join(root, "docs", "COMMANDS.md"), "utf8");
    const combined = `${readme}\n${commands}`;

    expect(combined).toContain("cd /Users/fabiencampana/Documents/ship-ready");
    expect(combined).toContain("pnpm shipready status");
    expect(combined).toContain("pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready status");
    expect(combined).toContain("does not imply a global install");
    expect(combined).toContain("pnpm dlx");
    expect(combined).toContain("not expected to work");
  });

  it("marks the original roadmap closed and future integrations as future", async () => {
    const roadmap = await readFile(join(root, "docs", "ROADMAP.md"), "utf8");

    expect(roadmap).toContain("The original 18-pass ShipReady roadmap is **complete and closed**");
    expect(roadmap).toContain("| 18 | Complete | Add GitHub PR draft / PR handoff artifacts.");
    expect(roadmap).toContain("| Distribution | Complete |");
    expect(roadmap).toContain("| Terminal output polish | Complete |");
    expect(roadmap).toContain("These candidates are future work only.");
    expect(roadmap).toContain("Live Search Console integration with explicit OAuth/token custody design");
  });
});
