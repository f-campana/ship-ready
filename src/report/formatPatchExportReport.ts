import {
  CONTRACT_NAMES,
  PatchExportJsonContractSchema,
  type PatchExportJsonContract,
} from "../types/contracts";

export function formatPatchExportJsonReport(result: PatchExportJsonContract): string {
  const contract = PatchExportJsonContractSchema.parse({
    ...result,
    contract: CONTRACT_NAMES.patchExport,
  });
  return `${JSON.stringify(contract, null, 2)}\n`;
}

export function formatPatchExportHumanReport(result: PatchExportJsonContract): string {
  const lines = [
    "Patch export",
    `URL: ${result.url}`,
    `Repo: ${result.repoPath}`,
    "",
    "Source dry-run",
    `- Contract: ${result.source.dryRunContract}`,
    `- Generated at: ${result.source.dryRunGeneratedAt}`,
    `- Policy: ${result.source.policy}`,
    "",
    "Output artifact",
    `- Kind: ${result.output.kind}`,
    ...(result.output.path ? [`- Path: ${result.output.path}`] : []),
    `- Wrote artifact: ${result.output.wroteArtifact ? "yes" : "no"}`,
    `- Format: ${result.format}`,
    `- Bytes: ${result.output.bytes}`,
    `- SHA-256: ${result.output.sha256}`,
    "",
    "Included changes",
    ...formatIncludedChanges(result),
    "",
    "Skipped changes",
    ...formatSkippedChanges(result),
    "",
    "Safety",
    ...result.limitations.map((item) => `- ${item}`),
    "",
    "Next actions",
    ...result.nextActions.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}`;
}

function formatIncludedChanges(result: PatchExportJsonContract): string[] {
  if (result.exportedChanges.length === 0) return ["- None"];
  return result.exportedChanges.map((change) =>
    `- ${change.path} (${change.changeType}; risk: ${change.risk}; ${formatReviewStatus(change.reviewStatus)})`);
}

function formatSkippedChanges(result: PatchExportJsonContract): string[] {
  if (result.skippedChanges.length === 0) return ["- None"];
  return result.skippedChanges.map((change) => {
    const label = change.path ?? change.title ?? change.actionId ?? "dry-run action";
    return `- ${label}: ${change.reason}`;
  });
}

function formatReviewStatus(status: "auto_candidate" | "review_required"): string {
  return status === "review_required" ? "review required" : "automation candidate";
}
