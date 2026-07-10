import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const forbiddenReleaseBehavior = /(?:^|\s)npm (?:publish|login)|NPM_TOKEN|NODE_AUTH_TOKEN|gh release|git tag|upload-artifact|id-token:\s*write/i;

describe("validation-only publish workflow scaffold", () => {
  it("uses the stable workflow and environment identity without release capability", async () => {
    const workflow = await readFile(join(root, ".github", "workflows", "publish.yml"), "utf8");

    expect(workflow).toContain("name: Publish Release Gate");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\bpull_request:|\bpush:|\brelease:/);
    expect(workflow).toContain("confirm_no_publish:");
    expect(workflow).toContain('!= "NO_PUBLISH"');
    expect(workflow).toContain("environment: npm-publish");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pnpm publish:preflight");
    expect(workflow).toContain("pnpm package:smoke");
    expect(workflow).toContain("No package was published. This workflow is validation-only.");
    expect(workflow).not.toMatch(forbiddenReleaseBehavior);
  });

  it("documents the exact owner-side trusted publisher target while keeping publish unauthorized", async () => {
    const runbook = await readFile(join(root, "docs", "PUBLISH_RUNBOOK.md"), "utf8");
    const blockers = await readFile(join(root, "docs", "PACKAGE_PUBLISH_BLOCKERS.md"), "utf8");
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      name?: string;
      private?: boolean;
    };

    for (const target of ["@ship-ready/cli", "GitHub Actions", "f-campana/ship-ready", "publish.yml", "npm-publish"]) {
      expect(runbook).toContain(target);
    }
    expect(runbook).toContain("It is not authorization to publish");
    expect(blockers).toContain("Actual npm publish remains unauthorized");
    expect(packageJson.name).toBe("@ship-ready/cli");
    expect(packageJson.private).toBe(true);
  });
});
