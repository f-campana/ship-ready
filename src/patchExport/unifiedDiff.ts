import type { DryRunFileChange } from "../types/dryRunFix";
import type { PatchExportSkippedChange } from "./patchExportTypes";

export type BuildUnifiedPatchInput = {
  generatedAt: string;
  url: string;
  repoPath: string;
  dryRunGeneratedAt: string;
  exportedChanges: DryRunFileChange[];
  skippedChanges: PatchExportSkippedChange[];
};

export function buildUnifiedPatch(input: BuildUnifiedPatchInput): string {
  const lines = [
    "# ShipReady patch export manifest",
    `# Generated at: ${input.generatedAt}`,
    `# URL: ${input.url}`,
    `# Repo: ${input.repoPath}`,
    "# Source: shipready.dryRunFix.v1",
    `# Source dry-run generated at: ${input.dryRunGeneratedAt}`,
    "# Policy: review_export_only",
    "# Safety: review-only artifact; not applied, not committed, not deployed.",
    "# Safety: ShipReady did not modify the inspected target repository.",
    "# Review: human review is required before using this patch with other tools.",
    `# Included changes: ${input.exportedChanges.length}`,
    `# Skipped changes: ${input.skippedChanges.length}`,
    "#",
  ];

  if (input.exportedChanges.length === 0) {
    lines.push("# No file changes were exported from the current dry-run.");
    return `${lines.join("\n")}\n`;
  }

  for (const change of input.exportedChanges) {
    lines.push("", ...formatFilePatch(change));
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function formatFilePatch(change: DryRunFileChange): string[] {
  if (change.changeType === "create" || change.before === undefined) {
    return formatCreatePatch(change.path, change.after);
  }

  return formatUpdatePatch(change);
}

function formatCreatePatch(path: string, after: string): string[] {
  const afterLines = contentLines(after);
  const hunkLength = afterLines.length;
  const lines = [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    `@@ -0,0 +1,${hunkLength} @@`,
    ...afterLines.map((line) => `+${line}`),
  ];

  if (!after.endsWith("\n") && after.length > 0) {
    lines.push("\\ No newline at end of file");
  }

  return lines;
}

function formatUpdatePatch(change: DryRunFileChange): string[] {
  const dryRunLines = change.diff.split("\n");
  const body = dryRunLines.map((line) => {
    if (line === `--- ${change.path}`) return `--- a/${change.path}`;
    if (line === `+++ ${change.path}`) return `+++ b/${change.path}`;
    return line;
  });

  if (!body.some((line) => line.startsWith("--- "))) {
    body.unshift(`--- a/${change.path}`);
  }
  if (!body.some((line) => line.startsWith("+++ "))) {
    const headerIndex = body.findIndex((line) => line.startsWith("--- "));
    body.splice(headerIndex + 1, 0, `+++ b/${change.path}`);
  }

  return [
    `diff --git a/${change.path} b/${change.path}`,
    ...body,
  ];
}

function contentLines(content: string): string[] {
  if (content.length === 0) return [];
  const lines = content.split("\n");
  if (content.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}
