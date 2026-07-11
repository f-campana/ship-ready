import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("publish execution plan documentation", () => {
  it("records the plan-only boundary, approvals, and post-publish sequencing", async () => {
    const plan = await readFile(join(root, "docs", "PUBLISH_EXECUTION_PLAN.md"), "utf8");

    for (const heading of [
      "## Current posture",
      "## Owner approvals required",
      "## Proposed release diff",
      "## Post-publish smoke",
      "## Docs switch after post-publish smoke",
      "## Stop conditions",
    ]) expect(plan).toContain(heading);

    expect(plan).toContain("This pass does not publish");
    expect(plan).toContain("Approval of this plan is not approval to publish");
    expect(plan).toContain("pnpm dlx @ship-ready/cli --version");
    expect(plan).toContain("Do not switch README installed usage");
    expect(plan).toContain("remains future-labeled");
    for (const target of ["GitHub Actions", "f-campana/ship-ready", "publish.yml", "npm-publish"]) {
      expect(plan).toContain(target);
    }
  });

  it("leaves package and workflow publication disabled", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const workflow = await readFile(join(root, ".github", "workflows", "publish.yml"), "utf8");

    expect(packageJson.name).toBe("@ship-ready/cli");
    expect(packageJson.private).toBe(true);
    expect(packageJson.bin?.shipready).toBe("./dist/index.js");
    expect(workflow).toContain("validation-only");
    expect(workflow).not.toMatch(/\bnpm publish\b|id-token:\s*write/i);
  });
});
