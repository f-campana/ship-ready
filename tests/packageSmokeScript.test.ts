import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("package smoke automation", () => {
  it("wires package smoke as an explicit non-test script", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["package:smoke"]).toBe("node scripts/package-smoke.mjs");
    expect(packageJson.scripts?.test).toBe("vitest run");
    expect(packageJson.scripts?.test).not.toContain("package:smoke");
  });

  it("keeps the package smoke script local, temporary, and non-publishing", async () => {
    const script = await readFile(join(root, "scripts", "package-smoke.mjs"), "utf8");

    for (const required of [
      "mkdtemp",
      "\"pnpm\", [\"build\"]",
      "\"pnpm\", [\"pack\", \"--pack-destination\", packDir]",
      "\"pnpm\", [\"add\", tarballPath, \"--ignore-scripts\"]",
      "\"pnpm\", [\"exec\", \"shipready\", \"--version\"]",
      "\"pnpm\", [\"exec\", \"shipready\", \"status\", \"--json\"]",
      "\"pnpm\", [\"exec\", \"shipready\", \"doctor\", \"--json\"]",
      "\"audit\", fixtureUrl, \"--no-render\", \"--json\"",
      "\"tui\", \"--url\", fixtureUrl, \"--no-render\"",
      "assertNoRepoTarballs",
      "startFixtureServer",
    ]) {
      expect(script).toContain(required);
    }

    expect(script).not.toMatch(/npm publish|npm login|NPM_TOKEN|Fodmapp|upload-artifact|createRelease/);
  });

  it("adds a package-smoke workflow without publish credentials or release behavior", async () => {
    const workflow = await readFile(join(root, ".github", "workflows", "package-smoke.yml"), "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("pnpm playwright:install");
    expect(workflow).toContain("pnpm package:smoke");
    expect(workflow).not.toMatch(/npm publish|NPM_TOKEN|NODE_AUTH_TOKEN|id-token: write|create-release|upload-artifact/);
  });
});
