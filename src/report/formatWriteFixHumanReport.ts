import type { SkippedFixAction } from "../types/dryRunFix";
import type { BlockedWriteChange, SafetyCheck, WriteFixResult, WrittenFile } from "../types/writeFix";

export function formatWriteFixHumanReport(result: WriteFixResult): string {
  const lines: string[] = [
    "ShipReady write result",
    `URL: ${result.url}`,
    `Repo: ${result.repoPath}`,
    "",
    "Mode: write",
    "Policy: creation-only robots/sitemap",
    `Files actually changed: ${result.createdFiles.length}`,
    "",
    `Created files: ${result.createdFiles.length}`,
    ...formatCreatedFiles(result.createdFiles),
    "",
    "Blocked changes:",
    ...formatBlockedChanges(result.blockedChanges),
    "",
    "Skipped actions:",
    ...formatSkippedActions(result.skippedActions),
    "",
    "Safety:",
    "- No existing files overwritten.",
    "- No files outside repo root touched.",
    "- No Git operations performed.",
    "- No commits created.",
    "- No dependencies installed.",
    "- No package files or lockfiles changed.",
    "- No formatting run.",
    "- No deploys performed.",
    ...formatSafetyChecks(result.safetyChecks),
    ...formatRollback(result),
    "",
    "Recommended next step:",
    `- ${formatRecommendedNextStep(result)}`,
  ];

  return `${lines.join("\n")}\n`;
}

function formatCreatedFiles(files: WrittenFile[]): string[] {
  if (files.length === 0) {
    return ["- None"];
  }

  return files.map(
    (file) => `- ${file.path} (${file.bytesWritten} bytes, sha256 ${file.sha256})`,
  );
}

function formatBlockedChanges(changes: BlockedWriteChange[]): string[] {
  if (changes.length === 0) {
    return ["- None"];
  }

  return changes.map(
    (change) =>
      `- ${change.path} was not written because ${change.reason} (dry-run: ${change.dryRunChangeType}, risk: ${change.risk}, review: ${change.reviewStatus})`,
  );
}

function formatSkippedActions(actions: SkippedFixAction[]): string[] {
  if (actions.length === 0) {
    return ["- None"];
  }

  return actions.map((action) => `- ${action.title}: ${action.reason}`);
}

function formatSafetyChecks(checks: SafetyCheck[]): string[] {
  if (checks.length === 0) {
    return [];
  }

  return checks.map((check) => `- ${check.status === "passed" ? "Passed" : "Blocked"}: ${check.message}`);
}

function formatRollback(result: WriteFixResult): string[] {
  if (!result.rollback) {
    return ["- Rollback not needed."];
  }

  if (result.rollback.remainingFiles.length === 0) {
    return [`- ${result.rollback.message}`];
  }

  return [
    `- ${result.rollback.message}`,
    `- Remaining files after rollback: ${result.rollback.remainingFiles.join(", ")}`,
  ];
}

function formatRecommendedNextStep(result: WriteFixResult): string {
  if (result.recommendedNextStep === "review_created_files") {
    return `Review created files and run your tests. Deploy through your external workflow, then run: pnpm shipready recheck ${result.repoPath} --url ${result.url}`;
  }

  if (result.recommendedNextStep === "run_audit_again") {
    return `After external deployment, run: pnpm shipready recheck ${result.repoPath} --url ${result.url}`;
  }

  if (result.recommendedNextStep === "manual_review_required") {
    return "Review blocked or skipped changes manually; write mode did not apply them.";
  }

  return "No changes needed.";
}
