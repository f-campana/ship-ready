import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("distribution documentation", () => {
  it("documents the v0 distribution decision with required sections", async () => {
    const doc = await readFile(join(root, "docs", "DISTRIBUTION.md"), "utf8");

    for (const heading of [
      "## Current truth",
      "## User-facing problem",
      "## Goals",
      "## Non-goals",
      "## Options considered",
      "## Recommendation",
      "## Source-checkout usage",
      "## Local link / global developer usage",
      "## npm / pnpm dlx readiness",
      "## Standalone binary readiness",
      "## MCP installation considerations",
      "## GUI launch considerations",
      "## Security and mutation boundaries",
      "## Release checklist before publishing",
      "## Decision",
    ]) {
      expect(doc).toContain(heading);
    }

    expect(doc).toContain("ShipReady is currently a repository-local tool");
    expect(doc).toContain("pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready audit https://example.com");
    expect(doc).toContain("pnpm --dir /Users/fabiencampana/Documents/ship-ready --silent shipready mcp --allow-root /path/to/repo");
    expect(doc).toContain("pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready gui");
    expect(doc).toContain("Preferred future package: `@ship-ready/cli`.");
    expect(doc).toContain("Do not claim this works yet.");
  });

  it("keeps README and command docs clear about current and future usage", async () => {
    const readme = await readFile(join(root, "README.md"), "utf8");
    const commands = await readFile(join(root, "docs", "COMMANDS.md"), "utf8");

    for (const doc of [readme, commands]) {
      expect(doc).toContain("repository-local");
      expect(doc).toContain("@ship-ready/cli");
      expect(doc).toContain("not yet published");
      expect(doc).toContain("pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready audit https://example.com");
    }

    expect(`${readme}\n${commands}`).not.toContain("pnpm dlx shipready audit");
  });

  it("links release readiness and status to the completed decision", async () => {
    const releaseReadiness = await readFile(join(root, "docs", "RELEASE_READINESS.md"), "utf8");
    const status = await readFile(join(root, "docs", "STATUS.md"), "utf8");
    const roadmap = await readFile(join(root, "docs", "ROADMAP.md"), "utf8");

    expect(releaseReadiness).toContain("[DISTRIBUTION.md](DISTRIBUTION.md)");
    expect(status).toContain("Distribution classification: **repository-local now; npm-ready direction documented, not published**");
    expect(roadmap).toContain("| Distribution | Complete |");
    expect(status.toLowerCase()).toContain("publish execution plan");
    expect(releaseReadiness).toContain("Decision: `Implement minimal TUI now`");
    expect(releaseReadiness).toContain("Package publish preparation");
  });
});
