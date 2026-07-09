import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStatus } from "../src/status/status";

const root = join(import.meta.dirname, "..");

describe("package publish decision documentation", () => {
  it("contains the required decision sections", async () => {
    const doc = await readFile(join(root, "docs", "PACKAGE_PUBLISH_DECISION.md"), "utf8");

    for (const heading of [
      "## Current state",
      "## Decision summary",
      "## Name / scope options",
      "## npm registry check",
      "## Recommended package name",
      "## License decision",
      "## Browser install decision",
      "## CLI-only / import API decision",
      "## Publish authority",
      "## Publish process",
      "## Rollback / deprecate process",
      "## CI package smoke decision",
      "## Remaining blockers",
      "## Recommendation",
      "## Next step",
    ]) {
      expect(doc).toContain(heading);
    }
  });

  it("records registry checks and keeps publication unauthorized", async () => {
    const doc = await readFile(join(root, "docs", "PACKAGE_PUBLISH_DECISION.md"), "utf8");

    for (const packageName of [
      "`shipready`",
      "`@shipready/cli`",
      "`@f-campana/shipready`",
      "`@f-campana/shipready-cli`",
    ]) {
      expect(doc).toContain(packageName);
    }

    expect(doc).toContain("No name was published, reserved, claimed, or logged into during this pass.");
    expect(doc).toContain("Do not publish ShipReady to npm in v0.");
    expect(doc).toContain("Recommended future package name: `@f-campana/shipready`.");
  });

  it("keeps package metadata private and source-checkout claims intact", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      private?: unknown;
      license?: string;
      scripts?: Record<string, string>;
      main?: unknown;
      exports?: unknown;
    };
    const readme = await readFile(join(root, "README.md"), "utf8");
    const commands = await readFile(join(root, "docs", "COMMANDS.md"), "utf8");
    const distribution = await readFile(join(root, "docs", "DISTRIBUTION.md"), "utf8");
    const status = await readFile(join(root, "docs", "STATUS.md"), "utf8");
    const decision = await readFile(join(root, "docs", "PACKAGE_PUBLISH_DECISION.md"), "utf8");
    const publicDocs = `${readme}\n${commands}\n${distribution}\n${status}\n${decision}`;

    expect(packageJson.private).toBe(true);
    expect(packageJson.license).toBe("UNLICENSED");
    expect(packageJson.scripts?.postinstall).toBeUndefined();
    expect(packageJson.main).toBeUndefined();
    expect(packageJson.exports).toBeUndefined();

    expect(publicDocs).toContain("source-checkout-only");
    expect(publicDocs).toContain("pnpm dlx");
    expect(publicDocs).toContain("not expected to work");
    expect(publicDocs).toContain("Do not publish");
    expect(readme).not.toContain("npm install -g shipready");
    expect(readme).not.toContain("pnpm dlx shipready audit");
  });

  it("keeps status pointed at the publish blockers closure pass", () => {
    expect(createStatus().nextRecommendedPass).toBe("Package publish blockers closure");
  });
});
