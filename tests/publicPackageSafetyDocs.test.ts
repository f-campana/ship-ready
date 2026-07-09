import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("public package safety review", () => {
  it("keeps the guarded write command enabled only under current V1 boundaries", async () => {
    const doc = await readFile(join(root, "docs", "PUBLIC_PACKAGE_SAFETY_REVIEW.md"), "utf8");

    expect(doc).toContain("Keep `fix --write --allow-create` enabled for v0");
    expect(doc).toContain("Do not hide it behind an environment flag now.");
    expect(doc).toContain("double explicitness (`--write --allow-create`) plus `WRITE_POLICY_V1`");

    for (const boundary of [
      "`POST /api/fix` returns `404`",
      "MCP remains stdio-only",
      "MCP exposes exactly one target-repo write tool",
      "`WRITE_POLICY_V1` remains canonical",
      "Writes are limited to creation-only missing robots/sitemap files",
      "Patch export is review-only",
      "GitHub PR draft is review-only",
      "Search Console remains mock-backed only",
      "DNS readiness is read-only",
      "No hosted SaaS behavior",
    ]) {
      expect(doc).toContain(boundary);
    }
  });

  it("requires conservative public wording and package contents", async () => {
    const doc = await readFile(join(root, "docs", "PUBLIC_PACKAGE_SAFETY_REVIEW.md"), "utf8");

    expect(doc).toContain("ShipReady is a local launch-readiness CLI for generated websites.");
    expect(doc).toContain("Say early preview.");
    expect(doc).toContain("support is limited");
    expect(doc).toContain("Keep installed usage future-labeled until publication and post-publish smoke pass.");
    expect(doc).toContain("Confirm these are absent:");
    expect(doc).toContain("generated `.tgz` tarballs");
    expect(doc).toContain("untracked `validation/e2e-project-review/`");
  });
});
