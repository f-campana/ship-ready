import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("publish preflight scanner", () => {
  it("scans every validation-only workflow, script, and package manifest target", async () => {
    const script = await readFile(join(root, "scripts", "publish-preflight.mjs"), "utf8");

    for (const target of [
      ".github/workflows/publish.yml",
      ".github/workflows/publish-preflight.yml",
      ".github/workflows/package-smoke.yml",
      "scripts/package-smoke.mjs",
      "package.json",
    ]) {
      expect(script).toContain(`"${target}"`);
    }

    for (const stopGate of ["publish|login", "gh\\s+release", "git\\s+tag", "upload-artifact", "id-token\\s*:\\s*write", "NPM_TOKEN|NODE_AUTH_TOKEN"]) {
      expect(script).toContain(stopGate);
    }
  });
});
