import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("0.1.0 release notes", () => {
  it("keeps the experimental preview unreleased and preserves public safety boundaries", async () => {
    const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");

    expect(changelog).toContain("## 0.1.0 - Unreleased");
    expect(changelog).toContain("Experimental early preview");
    expect(changelog).toContain("explicitly approved publish execution pass");
    for (const boundary of [
      "Not hosted SaaS",
      "No live GitHub PR creation",
      "No deploy automation",
      "No DNS writes",
      "No live Search Console",
      "No telemetry",
      "`WRITE_POLICY_V1`",
    ]) {
      expect(changelog).toContain(boundary);
    }
  });

  it("keeps installed usage future-labeled and source checkout as current truth", async () => {
    const docs = await Promise.all([
      "README.md",
      "docs/DISTRIBUTION.md",
      "docs/PACKAGE_PUBLISH_DECISION.md",
      "docs/PACKAGE_PUBLISH_PREPARATION.md",
      "docs/PUBLISH_RUNBOOK.md",
    ].map((path) => readFile(join(root, path), "utf8")));
    const combined = docs.join("\n");

    expect(combined).toContain("pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready");
    expect(combined).toContain("Future intended");
    expect(combined).toContain("pnpm dlx @ship-ready/cli audit https://example.com");
    expect(combined).toContain("not live yet");
  });
});
