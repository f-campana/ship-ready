import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { dryRunFix, type DryRunFixOptions } from "../fix/dryRunFix";
import { createPatchExportFromDryRun } from "../patchExport/patchExport";
import { CONTRACT_NAMES, GithubPrDraftJsonContractSchema, type CliErrorCode } from "../types/contracts";
import type { DryRunFileChange, DryRunFixResult } from "../types/dryRunFix";
import { normalizeAuditUrl } from "../utils/url";
import {
  DEFAULT_GITHUB_PR_BASE_BRANCH,
  DEFAULT_GITHUB_PR_SUGGESTED_BRANCH,
  GITHUB_PR_DRAFT_POLICY,
  type GithubPrDraftExecution,
  type GithubPrDraftOutputRequest,
  type GithubPrDraftResult,
} from "./githubPrDraftTypes";

export type CreateGithubPrDraftOptions = {
  generatedAt?: string;
  githubRepo?: string;
  baseBranch?: string;
  suggestedBranch?: string;
  title?: string;
  includeGhCommand?: boolean;
  patchPath?: string;
  output: GithubPrDraftOutputRequest;
};

export type GithubPrDraftOptions = CreateGithubPrDraftOptions & {
  dryRunOptions?: DryRunFixOptions;
};

type PatchReference = {
  patchExportContract?: typeof CONTRACT_NAMES.patchExport;
  patchPath?: string;
  patchSha256: string;
  patchBytes: number;
  patchSource: "existing_file" | "regenerated_inline";
};

type DraftPayload = Omit<GithubPrDraftResult, "output">;

export class GithubPrDraftError extends Error {
  readonly code: CliErrorCode;
  readonly exitCode: 1 | 2;

  constructor(code: CliErrorCode, message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "GithubPrDraftError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export async function githubPrDraft(
  repoPath: string,
  url: string,
  options: GithubPrDraftOptions,
): Promise<GithubPrDraftExecution> {
  validateGithubPrDraftMetadata(options);
  const normalizedUrl = normalizeAuditUrl(url);
  const dryRun = await dryRunFix(repoPath, normalizedUrl, options.dryRunOptions ?? {});
  const output = options.output.kind === "file"
    ? {
        kind: "file" as const,
        path: await validateFileOutputPath(dryRun.repoPath, options.output.path),
        wroteArtifact: true as const,
      }
    : options.output;
  const execution = await createGithubPrDraftFromDryRun(dryRun, { ...options, output });

  if (output.kind === "file") {
    await writeFile(output.path, execution.artifactContent, "utf8");
  }

  return execution;
}

function validateGithubPrDraftMetadata(options: GithubPrDraftOptions): void {
  normalizeOptionalMetadata("github repository", options.githubRepo, validateGithubRepo);
  normalizeOptionalMetadata("base branch", options.baseBranch ?? DEFAULT_GITHUB_PR_BASE_BRANCH, validateBranchName);
  normalizeOptionalMetadata("suggested branch", options.suggestedBranch ?? DEFAULT_GITHUB_PR_SUGGESTED_BRANCH, validateBranchName);
  normalizeOptionalMetadata("title", options.title, (value) => value.length <= 140);
}

export async function createGithubPrDraftFromDryRun(
  dryRun: DryRunFixResult,
  options: CreateGithubPrDraftOptions,
): Promise<GithubPrDraftExecution> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const githubRepo = normalizeOptionalMetadata("github repository", options.githubRepo, validateGithubRepo);
  const baseBranch = normalizeMetadata("base branch", options.baseBranch ?? DEFAULT_GITHUB_PR_BASE_BRANCH, validateBranchName);
  const suggestedBranch = normalizeMetadata(
    "suggested branch",
    options.suggestedBranch ?? DEFAULT_GITHUB_PR_SUGGESTED_BRANCH,
    validateBranchName,
  );
  const patch = options.patchPath
    ? await existingPatchReference(options.patchPath)
    : regeneratedPatchReference(dryRun, generatedAt);
  const title = normalizeOptionalMetadata("title", options.title, (value) => value.length <= 140)
    ?? defaultTitle(dryRun);
  const files = dryRun.fileChanges.map(fileFromDryRunChange);
  const summary = {
    proposedChanges: proposedChanges(dryRun),
    safeAutoCandidates: dryRun.fileChanges.filter(isSafeAutoCandidate).length,
    reviewRequired: dryRun.fileChanges.filter((change) =>
      change.reviewStatus === "review_required" || change.requiresHumanReview).length,
    manualOnly: dryRun.skippedActions.length,
    skipped: dryRun.skippedActions.length,
  };
  const checklist = checklistForDraft(summary);
  const body = prBody({
    dryRun,
    title,
    summary,
    files,
    patch,
    checklist,
  });
  const commands = commandStrings({
    githubRepo,
    baseBranch,
    suggestedBranch,
    title,
    outputPath: options.output.kind === "file" ? options.output.path : undefined,
    patchPath: patch.patchPath,
    includeGhCommand: Boolean(options.includeGhCommand),
  });
  const payload: DraftPayload = {
    contract: CONTRACT_NAMES.githubPrDraft,
    generatedAt,
    url: dryRun.url,
    repoPath: dryRun.repoPath,
    github: {
      ...(githubRepo ? { repository: githubRepo } : {}),
      baseBranch,
      suggestedBranch,
    },
    source: {
      dryRunContract: CONTRACT_NAMES.dryRunFix,
      dryRunGeneratedAt: dryRun.generatedAt,
      ...(patch.patchExportContract ? { patchExportContract: patch.patchExportContract } : {}),
      ...(patch.patchPath ? { patchPath: patch.patchPath } : {}),
      patchSha256: patch.patchSha256,
      patchBytes: patch.patchBytes,
      patchSource: patch.patchSource,
      policy: GITHUB_PR_DRAFT_POLICY,
    },
    draft: {
      title,
      body,
      checklist,
      labels: ["shipready", "launch-readiness", "review-required"],
    },
    commands,
    summary,
    files,
    safety: {
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
    },
    warnings: warningsForDraft(summary),
    limitations: [
      "This is a PR draft and handoff artifact only; ShipReady did not create a pull request.",
      "ShipReady did not create a branch, run Git commands, commit, push, deploy, or call the GitHub API.",
      "Patch export remains review-only and is not applied by ShipReady.",
      "Local repository changes require a separate human-reviewed workflow and external deployment before the live site can change.",
      "Run ShipReady recheck after any external deployment to collect read-only public crawl-file evidence.",
    ],
    nextActions: [
      "Review the proposed changes and patch artifact before using any copied commands.",
      "If the draft is acceptable, a human may run the copied Git/GitHub commands outside ShipReady.",
      "Run project tests and ShipReady read-only checks after applying changes outside ShipReady.",
      "Deploy through the owner-controlled external workflow, then run ShipReady recheck.",
    ],
  };
  const artifactContent = formatGithubPrDraftMarkdownPayload(payload, options.output);
  const artifactSha256 = createHash("sha256").update(artifactContent).digest("hex");
  const artifactBytes = Buffer.byteLength(artifactContent, "utf8");
  const result = GithubPrDraftJsonContractSchema.parse({
    ...payload,
    output: {
      kind: options.output.kind,
      ...(options.output.kind === "file" ? { path: options.output.path } : {}),
      wroteArtifact: options.output.wroteArtifact,
      bytesWritten: options.output.wroteArtifact ? artifactBytes : 0,
      sha256: artifactSha256,
    },
  });

  return { result, artifactContent };
}

export function formatGithubPrDraftMarkdown(result: GithubPrDraftResult): string {
  return formatGithubPrDraftMarkdownPayload(result, {
    kind: result.output.kind,
    ...(result.output.kind === "file" && result.output.path ? { path: result.output.path, wroteArtifact: true as const } : {}),
    ...(result.output.kind !== "file" ? { wroteArtifact: false as const } : {}),
  } as GithubPrDraftOutputRequest);
}

async function validateFileOutputPath(repoPath: string, outputPath: string): Promise<string> {
  if (!outputPath.trim()) {
    throw new GithubPrDraftError("invalid_output_path", "Invalid output path. Provide a PR draft file path outside the inspected repository.");
  }

  const repoRoot = await realpath(repoPath).catch(() => {
    throw new GithubPrDraftError("invalid_repo_path", "Repository path must be an existing accessible directory.");
  });
  const repoStats = await stat(repoRoot).catch(() => undefined);
  if (!repoStats?.isDirectory()) {
    throw new GithubPrDraftError("invalid_repo_path", "Repository path must be an existing accessible directory.");
  }

  const absoluteOutputPath = resolve(process.cwd(), outputPath);
  const parentPath = dirname(absoluteOutputPath);
  const parentRealPath = await realpath(parentPath).catch(() => {
    throw new GithubPrDraftError("invalid_output_path", "Invalid output path. The output directory must already exist.");
  });
  const parentStats = await stat(parentRealPath).catch(() => undefined);
  if (!parentStats?.isDirectory()) {
    throw new GithubPrDraftError("invalid_output_path", "Invalid output path. The output directory must be a directory.");
  }

  if (isContained(repoRoot, absoluteOutputPath) || isContained(repoRoot, parentRealPath)) {
    throw new GithubPrDraftError(
      "invalid_output_path",
      "Invalid output path. GitHub PR draft artifacts must be written outside the inspected repository by default.",
    );
  }

  const existing = await lstat(absoluteOutputPath).catch(() => undefined);
  if (existing?.isDirectory() || existing?.isSymbolicLink()) {
    throw new GithubPrDraftError("invalid_output_path", "Invalid output path. Provide a regular file path, not a directory or symlink.");
  }

  await access(parentRealPath, constants.W_OK).catch(() => {
    throw new GithubPrDraftError("invalid_output_path", "Invalid output path. The output directory is not writable.");
  });

  return absoluteOutputPath;
}

async function existingPatchReference(patchPath: string): Promise<PatchReference> {
  const absolutePatchPath = resolve(process.cwd(), patchPath);
  const stats = await stat(absolutePatchPath).catch(() => undefined);
  if (!stats?.isFile()) {
    throw new GithubPrDraftError("invalid_output_path", "Patch path must point to an existing patch artifact file.");
  }
  const content = await readFile(absolutePatchPath);
  return {
    patchPath: absolutePatchPath,
    patchSha256: createHash("sha256").update(content).digest("hex"),
    patchBytes: content.byteLength,
    patchSource: "existing_file",
  };
}

function regeneratedPatchReference(dryRun: DryRunFixResult, generatedAt: string): PatchReference {
  const patchExport = createPatchExportFromDryRun(dryRun, {
    generatedAt,
    output: {
      kind: "stdout",
      wroteArtifact: false,
      includeContent: true,
    },
  });
  return {
    patchExportContract: CONTRACT_NAMES.patchExport,
    patchSha256: patchExport.result.output.sha256,
    patchBytes: patchExport.result.output.bytes,
    patchSource: "regenerated_inline",
  };
}

function defaultTitle(dryRun: DryRunFixResult): string {
  const safe = dryRun.fileChanges.filter(isSafeAutoCandidate).length;
  const review = dryRun.fileChanges.filter((change) => change.requiresHumanReview).length;
  if (safe > 0 && review === 0) return "Prepare launch-readiness crawl files";
  if (dryRun.fileChanges.length > 0) return "Prepare launch-readiness updates for review";
  return "Document ShipReady launch-readiness review";
}

function fileFromDryRunChange(change: DryRunFileChange): GithubPrDraftResult["files"][number] {
  return {
    path: change.path,
    changeType: change.changeType,
    risk: change.risk,
    reviewStatus: change.reviewStatus,
    requiresHumanReview: change.requiresHumanReview,
  };
}

function proposedChanges(dryRun: DryRunFixResult): string[] {
  const changes = dryRun.fileChanges.map((change) =>
    `${change.changeType === "create" ? "Create" : "Update"} ${change.path} (${reviewStatusLabel(change.reviewStatus)}).`);
  const skipped = dryRun.skippedActions.map((action) =>
    `Manual review: ${action.title} (${action.reason}).`);
  return [...changes, ...skipped];
}

function checklistForDraft(summary: DraftPayload["summary"]): string[] {
  const checklist = [
    "Review the ShipReady dry-run output and patch artifact before applying anything.",
    "Confirm review-required changes are factually correct for the site and business.",
    "Run the project test/build commands after applying changes outside ShipReady.",
    "Confirm no unrelated files are staged before a human commit.",
    "Deploy through the normal external workflow if the changes are approved.",
    "Run ShipReady recheck after deployment to compare public crawl-file evidence.",
  ];
  if (summary.safeAutoCandidates > 0) {
    checklist.unshift("Confirm safe crawl-file creations are still missing before applying the patch outside ShipReady.");
  }
  if (summary.proposedChanges.length === 0) {
    checklist.unshift("Confirm no repository changes are needed before opening a PR.");
  }
  return checklist;
}

function prBody(input: {
  dryRun: DryRunFixResult;
  title: string;
  summary: DraftPayload["summary"];
  files: GithubPrDraftResult["files"];
  patch: PatchReference;
  checklist: string[];
}): string {
  return [
    "## Summary",
    "",
    "This PR draft was generated from a ShipReady dry-run and review-only patch export handoff.",
    "ShipReady did not create this PR, create a branch, run Git commands, commit, push, deploy, call GitHub, or apply the patch.",
    "",
    "## Proposed Changes",
    "",
    ...listOrNone(input.summary.proposedChanges),
    "",
    "## Classification",
    "",
    `- Safe auto candidates: ${input.summary.safeAutoCandidates}`,
    `- Review-required changes: ${input.summary.reviewRequired}`,
    `- Manual-only actions: ${input.summary.manualOnly}`,
    `- Skipped actions: ${input.summary.skipped}`,
    "",
    "## Files",
    "",
    ...fileLines(input.files),
    "",
    "## Patch Artifact",
    "",
    input.patch.patchPath
      ? `- Path: ${input.patch.patchPath}`
      : "- Path: regenerated inline by ShipReady for this handoff; no patch file was written.",
    `- SHA-256: ${input.patch.patchSha256}`,
    "- Patch export is review-only and requires human review before use.",
    "",
    "## Validation Checklist",
    "",
    ...input.checklist.map((item) => `- [ ] ${item}`),
    "",
    "## Safety Limitations",
    "",
    "- ShipReady did not create a PR, branch, commit, push, or deployment.",
    "- ShipReady did not call GitHub APIs, validate GitHub auth, run `gh`, or run `git`.",
    "- ShipReady did not mutate the inspected repository or apply exported patches.",
    "- Local changes require deployment through an external workflow before the live site can change.",
    "- Recheck after external deployment is required for read-only public evidence.",
    "",
  ].join("\n");
}

function commandStrings(input: {
  githubRepo?: string;
  baseBranch: string;
  suggestedBranch: string;
  title: string;
  outputPath?: string;
  patchPath?: string;
  includeGhCommand: boolean;
}): GithubPrDraftResult["commands"] {
  const bodyFile = input.outputPath ?? "shipready-pr-draft.md";
  const ghBase = [
    "gh",
    "pr",
    "create",
    ...(input.githubRepo ? ["--repo", input.githubRepo] : []),
    "--base",
    input.baseBranch,
    "--head",
    input.suggestedBranch,
    "--title",
    input.title,
    "--body-file",
    bodyFile,
  ].map(formatCommandArg).join(" ");
  const git = [
    `git checkout -b ${formatCommandArg(input.suggestedBranch)}`,
    input.patchPath
      ? `git apply ${formatCommandArg(input.patchPath)}`
      : "pnpm shipready patch-export <repo-path> --url <url> --output /tmp/shipready.patch && git apply /tmp/shipready.patch",
    "git status",
    "git add <reviewed-files>",
    `git commit -m ${formatCommandArg(input.title)}`,
    `git push -u origin ${formatCommandArg(input.suggestedBranch)}`,
    ghBase,
  ];
  return {
    ...(input.includeGhCommand ? { gh: ghBase } : {}),
    git,
    notes: [
      "Copyable commands only. Not executed by ShipReady.",
      "Review the patch and working tree before running any command.",
      "Future live GitHub integration requires separate authorization.",
    ],
  };
}

function warningsForDraft(summary: DraftPayload["summary"]): string[] {
  const warnings: string[] = [];
  if (summary.reviewRequired > 0) {
    warnings.push("Review-required changes are present and must be checked by a human before use.");
  }
  if (summary.manualOnly > 0) {
    warnings.push("Manual-only actions are present and are not represented as automatic changes.");
  }
  if (summary.proposedChanges.length === 0) {
    warnings.push("No file changes were proposed by the current dry-run.");
  }
  return warnings;
}

function formatGithubPrDraftMarkdownPayload(payload: DraftPayload | GithubPrDraftResult, output: GithubPrDraftOutputRequest): string {
  const status = payload.summary.reviewRequired > 0 || payload.summary.manualOnly > 0
    ? "Manual review"
    : payload.summary.proposedChanges.length > 0
      ? "Needs attention"
      : "Ready";
  return [
    "# ShipReady GitHub PR Draft",
    "",
    "This is a review artifact. ShipReady did not create a live pull request, branch, commit, push, deployment, or GitHub update.",
    "Draft only. No PR created. No Git or GitHub command executed.",
    "",
    "## Terminal Review",
    "",
    `- Target: ${payload.url}`,
    `- Repo: ${payload.repoPath}`,
    `- Status: ${status}`,
    `- Next: ${payload.nextActions[0]}`,
    "",
    "## PR Title",
    "",
    payload.draft.title,
    "",
    "## PR Body",
    "",
    payload.draft.body.trimEnd(),
    "",
    "## Copyable Commands",
    "",
    "Not executed by ShipReady. Review before running outside ShipReady.",
    "",
    ...(payload.commands.gh ? ["### GitHub CLI", "", codeBlock(payload.commands.gh), ""] : []),
    "### Manual Git Handoff",
    "",
    codeBlock(payload.commands.git.join("\n")),
    "",
    "## Source Evidence",
    "",
    `- Dry-run contract: ${payload.source.dryRunContract}`,
    `- Dry-run generated at: ${payload.source.dryRunGeneratedAt}`,
    `- Patch source: ${payload.source.patchSource}`,
    ...(payload.source.patchPath ? [`- Patch path: ${payload.source.patchPath}`] : []),
    `- Patch SHA-256: ${payload.source.patchSha256}`,
    `- Patch bytes: ${payload.source.patchBytes}`,
    "",
    "## Output",
    "",
    `- Kind: ${output.kind}`,
    ...(output.kind === "file" ? [`- Path: ${output.path}`] : []),
    `- Wrote artifact: ${output.wroteArtifact ? "yes" : "no"}`,
    "",
    "## Safety",
    "",
    ...payload.limitations.map((item) => `- ${item}`),
    "",
    "## Next Actions",
    "",
    ...payload.nextActions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function listOrNone(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- No file changes were proposed by the current dry-run."];
}

function fileLines(files: GithubPrDraftResult["files"]): string[] {
  if (files.length === 0) return ["- No file changes were proposed."];
  return files.map((file) =>
    `- ${file.path}: ${file.changeType}; risk ${file.risk}; ${reviewStatusLabel(file.reviewStatus)}; human review ${file.requiresHumanReview ? "required" : "not required"}.`);
}

function isSafeAutoCandidate(change: DryRunFileChange): boolean {
  return change.reviewStatus === "auto_candidate" && !change.requiresHumanReview && change.risk === "low";
}

function reviewStatusLabel(status: "auto_candidate" | "review_required"): string {
  return status === "review_required" ? "review required" : "safe auto candidate";
}

function normalizeMetadata(
  label: string,
  value: string,
  validator: (value: string) => boolean,
): string {
  const trimmed = value.trim();
  if (!trimmed || !validator(trimmed)) {
    throw new GithubPrDraftError(label === "github repository" ? "invalid_github_repo" as CliErrorCode : "invalid_mode", `Invalid ${label}.`);
  }
  return trimmed;
}

function normalizeOptionalMetadata(
  label: string,
  value: string | undefined,
  validator: (value: string) => boolean,
): string | undefined {
  if (value === undefined) return undefined;
  return normalizeMetadata(label, value, validator);
}

function validateGithubRepo(value: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function validateBranchName(value: string): boolean {
  return value.length <= 240 && !/[\s~^:?*[\\\]\0]/.test(value) && !value.startsWith("/") && !value.endsWith("/");
}

function formatCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
  return `'${value.split("'").join("'\\''")}'`;
}

function codeBlock(value: string): string {
  return ["```bash", value, "```"].join("\n");
}

function isContained(root: string, candidate: string): boolean {
  if (root === candidate) return true;
  const fromRoot = relative(root, candidate);
  return Boolean(fromRoot) && !isAbsolute(fromRoot) && !fromRoot.startsWith(`..${sep}`) && fromRoot !== "..";
}
