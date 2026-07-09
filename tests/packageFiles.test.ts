import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("package files whitelist", () => {
  it("includes runtime resources and excludes development or validation-only trees", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      files?: string[];
    };
    const files = packageJson.files ?? [];

    for (const required of [
      "dist/",
      "README.md",
      "docs/",
      "skills/shipready-launch-readiness/SKILL.md",
      "skills/shipready-launch-readiness/agents/",
      "skills/shipready-launch-readiness/examples/",
      "validation/contracts/",
    ]) {
      expect(files).toContain(required);
    }

    for (const excluded of [
      "src/",
      "tests/",
      "coverage/",
      "validation/e2e-project-review/",
      "validation/demo-fodmapp/",
      "validation/demo-fodmapp-share/",
      "validation/demo-fodmapp-voiceover-final/",
      ".env",
    ]) {
      expect(files).not.toContain(excluded);
    }
  });
});
