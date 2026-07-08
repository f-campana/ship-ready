import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPatchExportFromDryRun } from "../src/patchExport/patchExport";
import { PatchExportJsonContractSchema } from "../src/types/contracts";
import { DryRunFixResultSchema, type DryRunFixResult } from "../src/types/dryRunFix";

const contracts = join(import.meta.dirname, "..", "validation", "contracts");

describe("patch export", () => {
  it("exports safe creation dry-run changes as standard new-file unified diffs", () => {
    const dryRun = dryRunFixture("fix-dry-run.safe-apply.json");
    const execution = createPatchExportFromDryRun(dryRun, fileOutput());
    const result = PatchExportJsonContractSchema.parse(execution.result);

    expect(result.summary).toMatchObject({
      exportedChanges: 2,
      skippedChanges: 0,
      safeAutoCandidates: 2,
      reviewRequired: 0,
    });
    expect(execution.artifactContent).toContain("diff --git a/src/app/robots.ts b/src/app/robots.ts");
    expect(execution.artifactContent).toContain("new file mode 100644");
    expect(execution.artifactContent).toContain("--- /dev/null");
    expect(execution.artifactContent).toContain("+++ b/src/app/sitemap.ts");
    expect(result.output).not.toHaveProperty("content");
  });

  it("exports review-required updates and marks them clearly", () => {
    const dryRun = dryRunFixture("fix-dry-run.review-required.json");
    const execution = createPatchExportFromDryRun(dryRun, fileOutput());
    const result = PatchExportJsonContractSchema.parse(execution.result);

    expect(result.exportedChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "index.html",
        changeType: "update",
        reviewStatus: "review_required",
        requiresHumanReview: true,
      }),
    ]));
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Review-required dry-run changes are included"),
    ]));
    expect(execution.artifactContent).toContain("diff --git a/index.html b/index.html");
    expect(execution.artifactContent).toContain("+++ b/index.html");
  });

  it("returns a valid no-change contract", () => {
    const dryRun = dryRunFixture("fix-dry-run.skipped.json");
    const noChangeDryRun: DryRunFixResult = {
      ...dryRun,
      fileChanges: [],
      skippedActions: [],
      recommendedNextStep: "no_changes_needed",
    };
    const execution = createPatchExportFromDryRun(noChangeDryRun, fileOutput());
    const result = PatchExportJsonContractSchema.parse(execution.result);

    expect(result.summary.exportedChanges).toBe(0);
    expect(result.summary.skippedChanges).toBe(0);
    expect(execution.artifactContent).toContain("No file changes were exported from the current dry-run.");
  });

  it("lists skipped dry-run actions and omitted file changes", () => {
    const skippedDryRun = dryRunFixture("fix-dry-run.skipped.json");
    const reviewDryRun = dryRunFixture("fix-dry-run.review-required.json");

    const skippedActions = createPatchExportFromDryRun(skippedDryRun, fileOutput()).result;
    const safeOnly = createPatchExportFromDryRun(reviewDryRun, {
      ...fileOutput(),
      safeOnly: true,
    }).result;

    expect(skippedActions.skippedChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "dry_run_action", included: false }),
    ]));
    expect(safeOnly.summary.exportedChanges).toBe(0);
    expect(safeOnly.skippedChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "file_change",
        path: "index.html",
        reason: expect.stringContaining("--safe-only"),
      }),
    ]));
  });

  it("is deterministic and only includes paths from the dry-run", () => {
    const dryRun = dryRunFixture("fix-dry-run.safe-apply.json");
    const first = createPatchExportFromDryRun(dryRun, fileOutput()).artifactContent;
    const second = createPatchExportFromDryRun(dryRun, fileOutput()).artifactContent;
    const dryRunPaths = new Set(dryRun.fileChanges.map((change) => change.path));
    const patchPaths = [...first.matchAll(/^diff --git a\/(.+?) b\/.+$/gm)].map((match) => match[1]);

    expect(second).toBe(first);
    expect(patchPaths.length).toBeGreaterThan(0);
    expect(patchPaths.every((path) => path && dryRunPaths.has(path))).toBe(true);
  });
});

function dryRunFixture(name: string): DryRunFixResult {
  return DryRunFixResultSchema.parse(
    JSON.parse(readFileSync(join(contracts, name), "utf8")),
  );
}

function fileOutput() {
  return {
    generatedAt: "2026-06-21T12:00:00.000Z",
    output: {
      kind: "file" as const,
      path: "validation/patches/test.patch",
      wroteArtifact: true,
    },
  };
}
