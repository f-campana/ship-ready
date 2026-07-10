import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("package publish preparation documentation", () => {
  it("contains the required preparation sections", async () => {
    const doc = await readFile(join(root, "docs", "PACKAGE_PUBLISH_PREPARATION.md"), "utf8");

    for (const heading of [
      "## Current status",
      "## Goals",
      "## Non-goals",
      "## Package metadata audit",
      "## Files to include",
      "## Files to exclude",
      "## Runtime resource requirements",
      "## CLI smoke matrix",
      "## TUI packaging behavior",
      "## GUI packaging behavior",
      "## MCP packaging behavior",
      "## Playwright/browser story",
      "## Security and mutation boundaries",
      "## Local tarball smoke results",
      "## Remaining publish blockers",
      "## Recommendation",
      "## Next step",
    ]) {
      expect(doc).toContain(heading);
    }
  });

  it("keeps public docs clear that installed usage is future until publish is approved", async () => {
    const readme = await readFile(join(root, "README.md"), "utf8");
    const commands = await readFile(join(root, "docs", "COMMANDS.md"), "utf8");
    const distribution = await readFile(join(root, "docs", "DISTRIBUTION.md"), "utf8");
    const status = await readFile(join(root, "docs", "STATUS.md"), "utf8");
    const combined = `${readme}\n${distribution}\n${status}`;
    const commandSurface = `${readme}\n${commands}\n${status}`;

    expect(combined).toContain("repository-local");
    expect(combined).toContain("@ship-ready/cli");
    expect(combined).toContain("not yet published");
    expect(combined).toContain("PACKAGE_PUBLISH_PREPARATION.md");
    expect(combined).toContain("package-smoke");
    expect(commandSurface).not.toContain("pnpm dlx shipready audit");
  });
});
