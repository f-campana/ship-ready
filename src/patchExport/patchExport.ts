import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { dryRunFix, type DryRunFixOptions } from "../fix/dryRunFix";
import {
  CONTRACT_NAMES,
  PatchExportJsonContractSchema,
  type CliErrorCode,
} from "../types/contracts";
import type { DryRunFileChange, DryRunFixResult, SkippedFixAction } from "../types/dryRunFix";
import { buildUnifiedPatch } from "./unifiedDiff";
import {
  PATCH_EXPORT_POLICY,
  type PatchExportExecution,
  type PatchExportFormat,
  type PatchExportOutputRequest,
  type PatchExportSkippedChange,
} from "./patchExportTypes";

export type CreatePatchExportOptions = {
  generatedAt?: string;
  format?: PatchExportFormat;
  safeOnly?: boolean;
  includeReviewRequired?: boolean;
  output: PatchExportOutputRequest;
};

export type ExportPatchOptions = Omit<CreatePatchExportOptions, "output"> & {
  output:
    | { kind: "file"; path: string }
    | { kind: "stdout"; includeContent?: boolean }
    | { kind: "inline"; includeContent?: boolean };
  dryRunOptions?: DryRunFixOptions;
};

export class PatchExportError extends Error {
  readonly code: CliErrorCode;
  readonly exitCode: 1 | 2;

  constructor(code: CliErrorCode, message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "PatchExportError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export async function exportPatch(
  repoPath: string,
  url: string,
  options: ExportPatchOptions,
): Promise<PatchExportExecution> {
  const dryRun = await dryRunFix(repoPath, url, options.dryRunOptions ?? {});

  if (options.output.kind === "file") {
    const outputPath = await validateFileOutputPath(dryRun.repoPath, options.output.path);
    const execution = createPatchExportFromDryRun(dryRun, {
      ...options,
      output: {
        kind: "file",
        path: outputPath,
        wroteArtifact: true,
      },
    });
    await writeFile(outputPath, execution.artifactContent, "utf8");
    return execution;
  }

  return createPatchExportFromDryRun(dryRun, {
    ...options,
    output: {
      kind: options.output.kind,
      wroteArtifact: false,
      includeContent: options.output.includeContent,
    },
  });
}

export function createPatchExportFromDryRun(
  dryRun: DryRunFixResult,
  options: CreatePatchExportOptions,
): PatchExportExecution {
  const format = options.format ?? "unified-diff";
  if (format !== "unified-diff") {
    throw new PatchExportError(
      "invalid_mode",
      "Unsupported patch export format. Pass --format unified-diff.",
      1,
    );
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const includeReviewRequired = options.includeReviewRequired ?? true;
  const safeOnly = options.safeOnly ?? false;
  const classified = classifyDryRunChanges(dryRun, { safeOnly, includeReviewRequired });
  const artifactContent = buildUnifiedPatch({
    generatedAt,
    url: dryRun.url,
    repoPath: dryRun.repoPath,
    dryRunGeneratedAt: dryRun.generatedAt,
    exportedChanges: classified.exportedChanges,
    skippedChanges: classified.skippedChanges,
  });
  const bytes = Buffer.byteLength(artifactContent, "utf8");
  const sha256 = createHash("sha256").update(artifactContent).digest("hex");
  const reviewRequiredIncluded = classified.exportedChanges.some((change) => change.requiresHumanReview);
  const output = {
    kind: options.output.kind,
    ...(options.output.path ? { path: options.output.path } : {}),
    wroteArtifact: options.output.wroteArtifact,
    bytes,
    bytesWritten: options.output.wroteArtifact ? bytes : 0,
    sha256,
    ...(options.output.includeContent ? { content: artifactContent } : {}),
  };

  const result = PatchExportJsonContractSchema.parse({
    contract: CONTRACT_NAMES.patchExport,
    generatedAt,
    url: dryRun.url,
    repoPath: dryRun.repoPath,
    mode: "patch_export",
    format,
    options: {
      safeOnly,
      includeReviewRequired,
    },
    output,
    source: {
      dryRunContract: CONTRACT_NAMES.dryRunFix,
      dryRunGeneratedAt: dryRun.generatedAt,
      policy: PATCH_EXPORT_POLICY,
    },
    summary: {
      exportedChanges: classified.exportedChanges.length,
      skippedChanges: classified.skippedChanges.length,
      safeAutoCandidates: dryRun.fileChanges.filter((change) =>
        change.reviewStatus === "auto_candidate" &&
        change.requiresHumanReview === false &&
        change.risk === "low").length,
      reviewRequired: dryRun.fileChanges.filter((change) =>
        change.reviewStatus === "review_required" || change.requiresHumanReview).length,
      manualOnly: dryRun.skippedActions.length,
    },
    exportedChanges: classified.exportedChanges.map((change) => ({
      path: change.path,
      changeType: change.changeType,
      risk: change.risk,
      reviewStatus: change.reviewStatus,
      requiresHumanReview: change.requiresHumanReview,
      included: true,
      reason: change.reason,
      sourceActionIds: change.sourceActionIds,
    })),
    skippedChanges: classified.skippedChanges,
    warnings: warningsForExport({
      reviewRequiredIncluded,
      skippedCount: classified.skippedChanges.length,
      safeOnly,
      exportedCount: classified.exportedChanges.length,
    }),
    limitations: limitationsForExport({ safeOnly }),
    nextActions: [
      "Review the exported patch artifact with a human before using it with other tools.",
      "Use your own tooling outside ShipReady for any repository changes, tests, commits, pushes, pull requests, or deployments.",
      "Run ShipReady read-only checks again after any external deployment you perform.",
    ],
  });

  return { result, artifactContent };
}

async function validateFileOutputPath(repoPath: string, outputPath: string): Promise<string> {
  if (!outputPath.trim()) {
    throw new PatchExportError("invalid_output_path", "Invalid output path. Provide a file path outside the inspected repository.");
  }

  const repoRoot = await realpath(repoPath).catch(() => {
    throw new PatchExportError("invalid_repo_path", "Repository path must be an existing accessible directory.");
  });
  const repoStats = await stat(repoRoot).catch(() => undefined);
  if (!repoStats?.isDirectory()) {
    throw new PatchExportError("invalid_repo_path", "Repository path must be an existing accessible directory.");
  }

  const absoluteOutputPath = resolve(process.cwd(), outputPath);
  const parentPath = dirname(absoluteOutputPath);
  const parentRealPath = await realpath(parentPath).catch(() => {
    throw new PatchExportError("invalid_output_path", "Invalid output path. The output directory must already exist.");
  });
  const parentStats = await stat(parentRealPath).catch(() => undefined);
  if (!parentStats?.isDirectory()) {
    throw new PatchExportError("invalid_output_path", "Invalid output path. The output directory must be a directory.");
  }

  if (isContained(repoRoot, absoluteOutputPath) || isContained(repoRoot, parentRealPath)) {
    throw new PatchExportError(
      "invalid_output_path",
      "Invalid output path. Patch export artifacts must be written outside the inspected repository by default.",
    );
  }

  const existing = await lstat(absoluteOutputPath).catch(() => undefined);
  if (existing?.isDirectory() || existing?.isSymbolicLink()) {
    throw new PatchExportError("invalid_output_path", "Invalid output path. Provide a regular file path, not a directory or symlink.");
  }

  await access(parentRealPath, constants.W_OK).catch(() => {
    throw new PatchExportError("invalid_output_path", "Invalid output path. The output directory is not writable.");
  });

  return absoluteOutputPath;
}

function classifyDryRunChanges(
  dryRun: DryRunFixResult,
  options: { safeOnly: boolean; includeReviewRequired: boolean },
): { exportedChanges: DryRunFileChange[]; skippedChanges: PatchExportSkippedChange[] } {
  const exportedChanges: DryRunFileChange[] = [];
  const skippedChanges: PatchExportSkippedChange[] = [];

  for (const change of dryRun.fileChanges) {
    const skipReason = skipReasonForFileChange(change, options);
    if (skipReason) {
      skippedChanges.push(skippedFileChange(change, skipReason));
    } else {
      exportedChanges.push(change);
    }
  }

  for (const action of dryRun.skippedActions) {
    skippedChanges.push(skippedAction(action));
  }

  return { exportedChanges, skippedChanges };
}

function skipReasonForFileChange(
  change: DryRunFileChange,
  options: { safeOnly: boolean; includeReviewRequired: boolean },
): string | undefined {
  if (!isSafePatchPath(change.path)) {
    return "Skipped because the dry-run path cannot be represented safely in a portable patch.";
  }
  if (options.safeOnly && !isSafeAutoCandidate(change)) {
    return "Skipped by --safe-only because this dry-run change is review-required or not a low-risk automation candidate.";
  }
  if (!options.includeReviewRequired && change.requiresHumanReview) {
    return "Skipped because review-required dry-run changes were excluded.";
  }
  if (!change.diff.trim()) {
    return "Skipped because the dry-run did not include patch hunk text for this file change.";
  }
  return undefined;
}

function isSafeAutoCandidate(change: DryRunFileChange): boolean {
  return change.reviewStatus === "auto_candidate" && !change.requiresHumanReview && change.risk === "low";
}

function skippedFileChange(change: DryRunFileChange, reason: string): PatchExportSkippedChange {
  return {
    kind: "file_change",
    path: change.path,
    changeType: change.changeType,
    risk: change.risk,
    reviewStatus: change.reviewStatus,
    requiresHumanReview: change.requiresHumanReview,
    included: false,
    reason,
    sourceActionIds: change.sourceActionIds,
  };
}

function skippedAction(action: SkippedFixAction): PatchExportSkippedChange {
  return {
    kind: "dry_run_action",
    actionId: action.actionId,
    title: action.title,
    risk: action.risk,
    included: false,
    reason: action.reason,
    sourceActionIds: action.sourceActionIds,
  };
}

function isSafePatchPath(path: string): boolean {
  return (
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.split("/").includes("..") &&
    !/[\r\n\t]/.test(path)
  );
}

function warningsForExport(input: {
  reviewRequiredIncluded: boolean;
  skippedCount: number;
  safeOnly: boolean;
  exportedCount: number;
}): string[] {
  const warnings: string[] = [];
  if (input.reviewRequiredIncluded) {
    warnings.push("Review-required dry-run changes are included because patch export is review-only.");
  }
  if (input.safeOnly) {
    warnings.push("Safe-only export omitted dry-run changes that require human review.");
  }
  if (input.skippedCount > 0) {
    warnings.push("Some dry-run actions or file changes were not included; review skippedChanges before using the artifact.");
  }
  if (input.exportedCount === 0) {
    warnings.push("No file changes were exported from the current dry-run.");
  }
  return warnings;
}

function limitationsForExport(input: { safeOnly: boolean }): string[] {
  return [
    "Patch export is generated only from the current ShipReady dry-run preview.",
    "Patch export is not write mode and does not modify the inspected target repository.",
    "ShipReady does not apply this patch, stage files, commit, push, open pull requests, deploy, write DNS, or call provider APIs.",
    "Review-required changes may contain placeholders or factual assumptions that require human review before use.",
    ...(input.safeOnly ? ["Safe-only mode excludes review-required dry-run changes from the artifact."] : []),
  ];
}

function isContained(root: string, candidate: string): boolean {
  if (root === candidate) return true;
  const fromRoot = relative(root, candidate);
  return Boolean(fromRoot) && !isAbsolute(fromRoot) && !fromRoot.startsWith(`..${sep}`) && fromRoot !== "..";
}
