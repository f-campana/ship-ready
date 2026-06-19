import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { DryRunFileChange, DryRunFixResult } from "../types/dryRunFix";
import type { FrameworkId } from "../types/repoInspection";
import {
  WRITE_POLICY_V1,
  WriteFixResultSchema,
  type BlockedWriteChange,
  type SafetyCheck,
  type WriteFixResult,
  type WrittenFile,
} from "../types/writeFix";
import { dryRunFix, type DryRunFixOptions } from "./dryRunFix";
import {
  nextRobotsTsForUrl,
  nextSitemapTsForUrl,
  robotsTxtForUrl,
  sitemapXmlForUrl,
} from "./generatedCrawlFiles";

export type WriteFixOptions = DryRunFixOptions;

export type WriteCandidate = {
  path: string;
  absolutePath: string;
  content: string;
  reason: string;
  sourceActionIds: string[];
};

export type WriteCandidateValidationResult =
  | {
      ok: true;
      candidates: WriteCandidate[];
      blockedChanges: BlockedWriteChange[];
      safetyChecks: SafetyCheck[];
    }
  | {
      ok: false;
      blockedChanges: BlockedWriteChange[];
      safetyChecks: SafetyCheck[];
    };

export type WriteFixFromDryRunOptions = {
  generatedAt?: string;
  failAfterCreateCount?: number;
};

type ResolveTargetResult =
  | { ok: true; absolutePath: string }
  | { ok: false; reason: string };

export class WriteFixValidationError extends Error {
  constructor(message: string, readonly result: WriteFixResult) {
    super(message);
    this.name = "WriteFixValidationError";
  }
}

export class WriteFixExecutionError extends Error {
  constructor(message: string, readonly result: WriteFixResult) {
    super(message);
    this.name = "WriteFixExecutionError";
  }
}

export async function writeFix(
  repoPath: string,
  url: string,
  options: WriteFixOptions = {},
): Promise<WriteFixResult> {
  const repoRoot = resolve(options.repo?.cwd ?? process.cwd(), repoPath);
  const dryRun = await dryRunFix(repoPath, url, options);
  return writeFixFromDryRun(dryRun, repoRoot);
}

export function validateWriteCandidates(
  dryRunResult: DryRunFixResult,
  repoRoot: string,
): WriteCandidateValidationResult {
  const frameworkId = dryRunResult.planSummary.frameworkId as FrameworkId;
  const allowedPaths = allowedWritePaths(frameworkId);
  const candidates: WriteCandidate[] = [];
  const blockedChanges: BlockedWriteChange[] = [];
  const safetyChecks: SafetyCheck[] = [
    passed("current_dry_run", "Write candidates are selected only from the regenerated dry-run result."),
    passed("creation_only_policy", "Write policy is limited to missing robots/sitemap file creations."),
  ];
  let candidateValidationFailed = false;

  for (const change of dryRunResult.fileChanges) {
    if (isDangerousRelativePath(change.path)) {
      blockedChanges.push(blockedChange(change, "Target path is absolute or contains path traversal."));
      safetyChecks.push(blocked("path_traversal", `${change.path} was blocked because it is not a safe repo-relative path.`));
      candidateValidationFailed = true;
      continue;
    }

    if (!allowedPaths.has(change.path)) {
      blockedChanges.push(blockedChange(change, blockedReasonForNonAllowlistedChange(change)));
      continue;
    }

    if (change.changeType !== "create") {
      blockedChanges.push(blockedChange(change, "Existing robots/sitemap files are never overwritten in write mode."));
      continue;
    }

    const failures = validateAllowlistedCreate(change, dryRunResult, repoRoot, frameworkId);
    if (failures.length > 0) {
      blockedChanges.push(blockedChange(change, failures.join(" ")));
      safetyChecks.push(blocked("candidate_validation", `${change.path} failed write safety validation.`));
      candidateValidationFailed = true;
      continue;
    }

    const target = resolveWriteTarget(repoRoot, change.path);
    if (!target.ok) {
      blockedChanges.push(blockedChange(change, target.reason));
      safetyChecks.push(blocked("resolved_path", `${change.path} was blocked because ${target.reason}`));
      candidateValidationFailed = true;
      continue;
    }

    candidates.push({
      path: change.path,
      absolutePath: target.absolutePath,
      content: change.after,
      reason: change.reason,
      sourceActionIds: change.sourceActionIds,
    });
  }

  if (candidates.length === 0) {
    safetyChecks.push(passed("eligible_candidates", "No eligible missing robots/sitemap creations were found."));
  } else {
    safetyChecks.push(passed("eligible_candidates", `${candidates.length} eligible creation candidate(s) passed validation.`));
  }

  if (blockedChanges.length > 0) {
    safetyChecks.push(passed("blocked_non_writable_changes", "Non-writable dry-run changes were reported and left untouched."));
  }

  safetyChecks.push(
    passed("no_overwrites", "No existing files will be overwritten."),
    passed("no_git_operations", "No Git operations, commits, branches, or GitHub calls will be performed."),
    passed("no_dependency_operations", "No dependencies, package files, lockfiles, or config files will be changed."),
    passed("no_formatting_or_deploy", "No formatting or deploy commands will be run."),
  );

  if (candidateValidationFailed) {
    return { ok: false, blockedChanges, safetyChecks };
  }

  return { ok: true, candidates, blockedChanges, safetyChecks };
}

export function writeFixFromDryRun(
  dryRunResult: DryRunFixResult,
  repoRoot: string,
  options: WriteFixFromDryRunOptions = {},
): WriteFixResult {
  const validation = validateWriteCandidates(dryRunResult, repoRoot);
  const baseResult = baseWriteResult(dryRunResult, validation.blockedChanges, validation.safetyChecks, options.generatedAt);

  if (!validation.ok) {
    throw new WriteFixValidationError(
      "ShipReady write validation blocked one or more creation candidates. No files were written.",
      WriteFixResultSchema.parse({
        ...baseResult,
        recommendedNextStep: "manual_review_required",
      }),
    );
  }

  if (validation.candidates.length === 0) {
    return WriteFixResultSchema.parse({
      ...baseResult,
      recommendedNextStep: validation.blockedChanges.length > 0 || dryRunResult.skippedActions.length > 0
        ? "manual_review_required"
        : "no_changes_needed",
    });
  }

  const createdFiles: WrittenFile[] = [];
  const createdDuringRun: Array<{ path: string; absolutePath: string }> = [];

  try {
    for (const candidate of validation.candidates) {
      mkdirSync(dirname(candidate.absolutePath), { recursive: true });
      writeFileSync(candidate.absolutePath, candidate.content, { encoding: "utf8", flag: "wx" });
      createdDuringRun.push({ path: candidate.path, absolutePath: candidate.absolutePath });
      createdFiles.push(writtenFile(candidate));

      if (
        options.failAfterCreateCount !== undefined &&
        createdFiles.length >= options.failAfterCreateCount
      ) {
        throw new Error("Injected write failure after file creation.");
      }
    }

    return WriteFixResultSchema.parse({
      ...baseResult,
      wroteFiles: createdFiles.length > 0,
      createdFiles,
      safetyChecks: [
        ...validation.safetyChecks,
        passed("files_created", `${createdFiles.length} file(s) were created with exclusive create semantics.`),
      ],
      recommendedNextStep: "review_created_files",
    });
  } catch (error) {
    const rollback = rollbackCreatedFiles(createdDuringRun);
    const message = error instanceof Error ? error.message : "Unexpected write failure.";
    const result = WriteFixResultSchema.parse({
      ...baseResult,
      wroteFiles: false,
      createdFiles,
      safetyChecks: [
        ...validation.safetyChecks,
        blocked("write_error", `Unexpected write error: ${message}`),
        rollback.succeeded
          ? passed("rollback", rollback.message)
          : blocked("rollback", rollback.message),
      ],
      rollback,
      recommendedNextStep: "manual_review_required",
    });

    throw new WriteFixExecutionError(
      "ShipReady write mode failed after creation started. Rollback was attempted.",
      result,
    );
  }
}

function validateAllowlistedCreate(
  change: DryRunFileChange,
  dryRunResult: DryRunFixResult,
  repoRoot: string,
  frameworkId: FrameworkId,
): string[] {
  const failures: string[] = [];

  if (change.risk !== "low") {
    failures.push(`Risk must be low; dry-run risk was ${change.risk}.`);
  }

  if (normalizeReviewStatus(change.reviewStatus) !== "auto_candidate") {
    failures.push(`Review status must be auto_candidate; dry-run status was ${change.reviewStatus}.`);
  }

  if (change.requiresHumanReview) {
    failures.push("Changes that require human review are not writable.");
  }

  if (!change.sourceActionIds.some(isRobotsOrSitemapAction)) {
    failures.push("Source action is not a robots/sitemap action.");
  }

  const expectedContent = expectedContentForPath(frameworkId, change.path, dryRunResult.url);
  if (expectedContent === undefined) {
    failures.push("No deterministic V1 content generator exists for this path.");
  } else if (change.after !== expectedContent) {
    failures.push("Generated content does not match the validated dry-run after content.");
  }

  if (containsPlaceholder(change.after)) {
    failures.push("Generated content contains a placeholder or review marker.");
  }

  const repoStats = safeLstat(repoRoot);
  if (!repoStats?.isDirectory()) {
    failures.push("Repository root is not an existing directory at write time.");
  }

  return failures;
}

function resolveWriteTarget(repoRoot: string, relativePath: string): ResolveTargetResult {
  if (isDangerousRelativePath(relativePath)) {
    return { ok: false, reason: "target path is not repo-relative" };
  }

  const root = resolve(repoRoot);
  let realRoot: string;
  try {
    realRoot = realpathSync.native(root);
  } catch {
    return { ok: false, reason: "repository root could not be resolved" };
  }

  const absolutePath = resolve(root, relativePath);
  if (!isInsidePath(root, absolutePath)) {
    return { ok: false, reason: "resolved target path escapes the repository root" };
  }

  if (existsSync(absolutePath) || safeLstat(absolutePath)) {
    return { ok: false, reason: "target file already exists at write time" };
  }

  const nearestParent = nearestExistingParent(dirname(absolutePath), root);
  if (!nearestParent) {
    return { ok: false, reason: "no existing parent directory could be found inside the repository" };
  }

  let realParent: string;
  try {
    realParent = realpathSync.native(nearestParent);
  } catch {
    return { ok: false, reason: "target parent directory could not be resolved" };
  }

  if (!isInsidePath(realRoot, realParent)) {
    return { ok: false, reason: "resolved target parent escapes the repository root" };
  }

  return { ok: true, absolutePath };
}

function baseWriteResult(
  dryRunResult: DryRunFixResult,
  blockedChanges: BlockedWriteChange[],
  safetyChecks: SafetyCheck[],
  generatedAt?: string,
): WriteFixResult {
  return WriteFixResultSchema.parse({
    url: dryRunResult.url,
    repoPath: dryRunResult.repoPath,
    generatedAt: generatedAt ?? new Date().toISOString(),
    mode: "write",
    wroteFiles: false,
    policy: WRITE_POLICY_V1,
    createdFiles: [],
    skippedActions: dryRunResult.skippedActions,
    blockedChanges,
    safetyChecks,
    recommendedNextStep: "no_changes_needed",
  });
}

function allowedWritePaths(frameworkId: FrameworkId): Set<string> {
  if (frameworkId === "static_html") {
    return new Set(["robots.txt", "sitemap.xml"]);
  }

  if (frameworkId === "vite_react") {
    return new Set(["public/robots.txt", "public/sitemap.xml"]);
  }

  if (frameworkId === "next_app_router") {
    return new Set(["app/robots.ts", "app/sitemap.ts", "src/app/robots.ts", "src/app/sitemap.ts"]);
  }

  return new Set();
}

function expectedContentForPath(
  frameworkId: FrameworkId,
  path: string,
  url: string,
): string | undefined {
  if (frameworkId === "static_html") {
    if (path === "robots.txt") return robotsTxtForUrl(url);
    if (path === "sitemap.xml") return sitemapXmlForUrl(url);
  }

  if (frameworkId === "vite_react") {
    if (path === "public/robots.txt") return robotsTxtForUrl(url);
    if (path === "public/sitemap.xml") return sitemapXmlForUrl(url);
  }

  if (frameworkId === "next_app_router") {
    if (path === "app/robots.ts" || path === "src/app/robots.ts") return nextRobotsTsForUrl(url);
    if (path === "app/sitemap.ts" || path === "src/app/sitemap.ts") return nextSitemapTsForUrl(url);
  }

  return undefined;
}

function writtenFile(candidate: WriteCandidate): WrittenFile {
  const bytes = Buffer.byteLength(candidate.content, "utf8");
  return {
    path: candidate.path,
    reason: candidate.reason,
    sourceActionIds: candidate.sourceActionIds,
    bytesWritten: bytes,
    sha256: createHash("sha256").update(candidate.content, "utf8").digest("hex"),
  };
}

function rollbackCreatedFiles(createdFiles: Array<{ path: string; absolutePath: string }>) {
  if (createdFiles.length === 0) {
    return {
      attempted: false,
      succeeded: true,
      remainingFiles: [],
      message: "Rollback was not needed because no files had been created.",
    };
  }

  const remainingFiles: string[] = [];
  for (const file of [...createdFiles].reverse()) {
    try {
      unlinkSync(file.absolutePath);
    } catch {
      if (existsSync(file.absolutePath)) {
        remainingFiles.push(file.path);
      }
    }
  }

  return {
    attempted: true,
    succeeded: remainingFiles.length === 0,
    remainingFiles,
    message: remainingFiles.length === 0
      ? "Rollback fully succeeded; files created during this run were removed."
      : `Rollback could not remove ${remainingFiles.length} file(s).`,
  };
}

function nearestExistingParent(path: string, root: string): string | undefined {
  let current = resolve(path);
  const resolvedRoot = resolve(root);

  while (isInsidePath(resolvedRoot, current)) {
    if (existsSync(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }

  return undefined;
}

function safeLstat(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

function isDangerousRelativePath(path: string): boolean {
  return isAbsolute(path) || path.split("/").includes("..") || path.length === 0;
}

function isInsidePath(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function normalizeReviewStatus(status: string): "auto_candidate" | "review_required" | string {
  return status === "automation_candidate" ? "auto_candidate" : status;
}

function isRobotsOrSitemapAction(actionId: string): boolean {
  return actionId.endsWith(".robots") || actionId.endsWith(".sitemap");
}

function containsPlaceholder(content: string): boolean {
  return /\bTODO\b|TODO\(|PLACEHOLDER|REPLACE_WITH|REPLACE\b/i.test(content);
}

function blockedReasonForNonAllowlistedChange(change: DryRunFileChange): string {
  if (change.path === "package.json" || /(?:^|\/)(?:pnpm-lock|package-lock|yarn\.lock|bun\.lockb?)/.test(change.path)) {
    return "Package and lockfile changes are outside the V1 write policy.";
  }

  if (/\b(?:layout|page)\.(?:tsx|jsx|ts|js)$/.test(change.path)) {
    return "Metadata, generateMetadata, JSON-LD, H1, content, and alt text changes require human review.";
  }

  if (/\b(?:index\.html|vite\.config|next\.config|astro\.config|remix\.config)/.test(change.path)) {
    return "HTML, metadata, and config updates are outside the V1 write policy.";
  }

  return "Only missing robots/sitemap creations in framework-specific locations are writable in V1.";
}

function blockedChange(change: DryRunFileChange, reason: string): BlockedWriteChange {
  return {
    path: change.path,
    reason,
    dryRunChangeType: change.changeType,
    risk: change.risk,
    reviewStatus: change.reviewStatus,
  };
}

function passed(id: string, message: string): SafetyCheck {
  return { id, status: "passed", message };
}

function blocked(id: string, message: string): SafetyCheck {
  return { id, status: "blocked", message };
}
