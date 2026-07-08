import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGithubPrDraftFromDryRun } from "../src/githubPrDraft/githubPrDraft";
import { GithubPrDraftJsonContractSchema } from "../src/types/contracts";
import { DryRunFixResultSchema, type DryRunFixResult } from "../src/types/dryRunFix";

const contracts = join(import.meta.dirname, "..", "validation", "contracts");

describe("GitHub PR draft", () => {
  it("creates a useful safe-creation PR handoff without live mutation claims", async () => {
    const execution = await createGithubPrDraftFromDryRun(dryRunFixture("fix-dry-run.safe-apply.json"), {
      generatedAt: "2026-06-21T12:00:00.000Z",
      githubRepo: "f-campana/ship-ready",
      includeGhCommand: true,
      output: {
        kind: "file",
        path: "/tmp/shipready-pr.md",
        wroteArtifact: true,
      },
    });
    const result = GithubPrDraftJsonContractSchema.parse(execution.result);

    expect(result.draft.title).toBe("Prepare launch-readiness crawl files");
    expect(result.summary).toMatchObject({
      safeAutoCandidates: 2,
      reviewRequired: 0,
      manualOnly: 0,
    });
    expect(result.draft.body).toContain("ShipReady did not create this PR");
    expect(result.draft.body).toContain("Patch export is review-only");
    expect(result.draft.body).toContain("Run ShipReady recheck after deployment");
    expect(result.commands.gh).toContain("gh pr create");
    expect(result.commands.git.join("\n")).toContain("git apply");
    expect(result.commands.notes.join("\n")).toContain("Not executed by ShipReady");
    expect(result.safety).toEqual({
      createdPullRequest: false,
      createdBranch: false,
      ranGitCommands: false,
      committed: false,
      pushed: false,
      deployed: false,
      calledGitHubApi: false,
      appliedPatch: false,
      mutatedTargetRepo: false,
      wroteDns: false,
      calledSearchConsoleLive: false,
    });
    expect(execution.artifactContent).toContain("# ShipReady GitHub PR Draft");
    expect(execution.artifactContent).toContain("Copyable Commands");
  });

  it("marks review-required changes clearly", async () => {
    const result = (await createGithubPrDraftFromDryRun(dryRunFixture("fix-dry-run.review-required.json"), {
      generatedAt: "2026-06-21T12:00:00.000Z",
      output: {
        kind: "stdout",
        wroteArtifact: false,
      },
    })).result;

    expect(result.summary.reviewRequired).toBeGreaterThan(0);
    expect(result.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ reviewStatus: "review_required", requiresHumanReview: true }),
    ]));
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Review-required changes are present"),
    ]));
    expect(result.draft.body).toContain("Review-required changes");
  });

  it("returns a useful no-change draft", async () => {
    const dryRun: DryRunFixResult = {
      ...dryRunFixture("fix-dry-run.skipped.json"),
      fileChanges: [],
      skippedActions: [],
      recommendedNextStep: "no_changes_needed",
    };
    const result = (await createGithubPrDraftFromDryRun(dryRun, {
      generatedAt: "2026-06-21T12:00:00.000Z",
      output: {
        kind: "inline",
        wroteArtifact: false,
      },
    })).result;

    expect(result.draft.title).toBe("Document ShipReady launch-readiness review");
    expect(result.summary.proposedChanges).toEqual([]);
    expect(result.draft.body).toContain("No file changes were proposed");
    expect(result.output).toMatchObject({ kind: "inline", wroteArtifact: false, bytesWritten: 0 });
  });
});

function dryRunFixture(name: string): DryRunFixResult {
  return DryRunFixResultSchema.parse(
    JSON.parse(readFileSync(join(contracts, name), "utf8")),
  );
}
