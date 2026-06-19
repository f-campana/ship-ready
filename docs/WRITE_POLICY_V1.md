# ShipReady Write Policy V1

## 1. Scope

This document defines the strict first write policy for a future ShipReady command:

```bash
pnpm shipready fix <path> --url <url> --write --allow-create
```

This policy is design-only. It does not imply that write mode exists yet.

V1 write mode should be creation-only. It may create missing robots and sitemap files that already appear in the regenerated dry-run result as low-risk automation candidates. It must never overwrite user code, merge metadata, edit content, format files, run Git, commit, deploy, or install dependencies.

The first implementation should answer one narrow question:

> Which dry-run file creations are safe enough to write to disk without human editing?

The answer for V1 is: only deterministic missing robots/sitemap files, only in supported framework locations, and only after all safety gates pass.

## 2. Non-Goals

V1 write mode must not write:

- metadata exports
- `generateMetadata`
- JSON-LD
- H1 or page content changes
- alt text changes
- existing files
- dependency or config changes
- branch, commit, PR, deploy, or GitHub changes

Metadata and content previews may continue to exist in dry-run output, but they are not writable in V1.

## 3. Supported Frameworks

V1 write mode should support only the framework families that already have conservative dry-run creation previews:

- static HTML / static repos
- Vite React
- Next.js App Router

Unknown frameworks and all other detected frameworks must write nothing.

## 4. Allowed File Creations

The allowlist is exact and framework-aware.

Static HTML / static repos:

- `robots.txt`
- `sitemap.xml`

Vite React:

- `public/robots.txt`
- `public/sitemap.xml`

Next.js App Router:

- `app/robots.ts`
- `app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/sitemap.ts`

These files may be created only when:

- the dry-run result contains a matching `create` change
- the target file does not already exist at write time
- the path is still inside the repository root after resolution
- the generated content is deterministic from known inputs, primarily the audited URL and framework route convention

For the first implementation, ShipReady should write both eligible robots and sitemap files in one command when both pass all gates. The operation must still be all-or-nothing.

## 5. Forbidden Writes

V1 write mode must forbid writing all files and operations outside the allowlist, including:

- `index.html`
- `layout.tsx`
- `layout.jsx`
- `page.tsx`
- `page.jsx`
- metadata exports
- `generateMetadata`
- JSON-LD
- H1/content changes
- alt text changes
- `package.json`
- lockfiles
- dependencies
- config files
- existing `robots` files
- existing `sitemap` files
- any overwrite
- any delete
- any rename
- any formatting of existing files
- any Git operation
- any branch creation
- any commit
- any GitHub API call

If a dry-run preview contains both allowed creations and forbidden updates, only the allowed creations may be considered. Forbidden changes must be reported as blocked and must not be written.

## 6. Safety Gates

All gates must pass before any file is written:

1. The user passes explicit `--write`.
2. The user passes explicit `--allow-create`.
3. The write candidate comes from the current dry-run result.
4. `changeType === "create"`.
5. `risk === "low"`.
6. `reviewStatus` is an automation candidate. In the current dry-run model this is `auto_candidate`; if renamed later, normalize it to the same strict meaning.
7. `requiresHumanReview === false`.
8. The target file path is in the framework-specific allowlist.
9. The target file does not exist at write time.
10. The resolved target path stays inside the repo root.
11. The repo is re-inspected immediately before writing.
12. The plan and dry-run are regenerated immediately before writing.
13. The generated content is deterministic and contains no placeholders or invented facts.
14. The generated content matches the dry-run `after` content that passed validation.
15. After writing, ShipReady reports exactly what files were created.
16. After writing, ShipReady does not auto-format, commit, deploy, install dependencies, or call Git/GitHub APIs.

If any gate fails, no files should be written.

Recommended implementation detail: build a `validateWriteCandidates(result, repoRoot)` step that returns either a complete write set or a complete failure. Do not stream validation and writing together.

## 7. CLI Behavior

Dry-run remains explicit and read-only:

```bash
pnpm shipready fix ./site --url https://example.com --dry-run
```

This previews changes only.

Write mode requires both flags:

```bash
pnpm shipready fix ./site --url https://example.com --write --allow-create
```

This creates only eligible missing robots/sitemap files.

Write without `--allow-create` fails:

```bash
pnpm shipready fix ./site --url https://example.com --write
```

Expected message:

```txt
ShipReady write mode is currently creation-only. Re-run with --write --allow-create to create eligible missing robots/sitemap files.
```

Write and dry-run together fail because modes conflict:

```bash
pnpm shipready fix ./site --url https://example.com --write --dry-run
```

No mode should continue to fail safely:

```bash
pnpm shipready fix ./site --url https://example.com
```

The current fail-closed behavior should remain. Do not silently default to dry-run.

`--json` should return the structured write result when write mode succeeds. On write-mode validation failure, `--json` should return a structured command error and no files should be written.

## 8. Result Model

Proposed write result:

```ts
type WriteFixResult = {
  url: string;
  repoPath: string;
  generatedAt: string;
  mode: "write";
  wroteFiles: boolean;
  policy: "creation_only_robots_sitemap_v1";
  createdFiles: WrittenFile[];
  skippedActions: SkippedFixAction[];
  blockedChanges: BlockedWriteChange[];
  safetyChecks: SafetyCheck[];
  recommendedNextStep:
    | "review_created_files"
    | "run_audit_again"
    | "manual_review_required"
    | "no_changes_needed";
};

type WrittenFile = {
  path: string;
  reason: string;
  sourceActionIds: string[];
  bytesWritten: number;
  sha256: string;
};

type BlockedWriteChange = {
  path: string;
  reason: string;
  dryRunChangeType: string;
  risk: string;
  reviewStatus: string;
};

type SafetyCheck = {
  id: string;
  status: "passed" | "blocked";
  message: string;
};
```

`wroteFiles` should be `true` only when at least one file was created. A successful write-mode run with no eligible changes should return `wroteFiles: false`, `createdFiles: []`, and `recommendedNextStep: "no_changes_needed"` or `"manual_review_required"` depending on blocked changes.

Each written file must include a byte count and SHA-256 hash of the exact bytes written.

## 9. Human Report Behavior

The human report should make write effects unambiguous:

```txt
ShipReady write result
URL: https://example.com
Repo: ./site

Mode: write
Policy: creation-only robots/sitemap

Created files: 2
- app/robots.ts
- app/sitemap.ts

Blocked changes:
- app/layout.tsx metadata update was not written because metadata edits require human review.
- JSON-LD was not written because structured data facts require review.

Safety:
- No existing files overwritten.
- No files outside repo root touched.
- No Git operations performed.
- No dependencies installed.
- No formatting run.

Recommended next step:
- Review created files, run your tests, then run:
  pnpm shipready audit https://example.com
```

The report must clearly state:

- write mode was used
- the policy name
- files created
- files skipped or blocked
- files actually changed
- no overwrites happened
- no commits or deploys happened
- the recommended next step

## 10. Atomicity Policy

V1 write mode should be all-or-nothing.

Process:

1. Re-inspect the repo.
2. Regenerate the plan and dry-run.
3. Collect candidate creations.
4. Validate every safety gate for every candidate.
5. If any candidate fails validation, abort before writing anything.
6. If all candidates pass, create all files.
7. Report created files with hashes and byte counts.

No partial success should be allowed in the first implementation.

Because V1 only creates new files, rollback is simpler if an unexpected write error occurs. If a write fails after one or more files are created, ShipReady should attempt to remove only the files it created during that same run. The final report must state whether rollback fully succeeded. If rollback cannot fully succeed, the report must list the created files that remain.

## 11. Validation Plan

Use temporary copies of fixture repos for write-mode validation. Do not run write mode directly against real repositories.

Automated tests:

- write without `--allow-create` fails
- `--write --dry-run` fails
- no mode still fails safely
- unknown repo writes nothing
- clean site writes nothing
- static missing robots writes `robots.txt`
- static missing sitemap writes `sitemap.xml`
- Vite missing robots writes `public/robots.txt`
- Vite missing sitemap writes `public/sitemap.xml`
- Next App Router missing robots/sitemap writes `app/robots.ts` / `app/sitemap.ts`
- Next App Router `src/app` projects write `src/app/robots.ts` / `src/app/sitemap.ts`
- existing `robots` file is never overwritten
- existing `sitemap` file is never overwritten
- non-allowlisted file change is blocked
- metadata update is blocked
- `generateMetadata` is blocked
- JSON-LD update is blocked
- H1/content update is blocked
- alt text change is blocked
- `package.json`, lockfile, dependency, and config changes are blocked
- path traversal is blocked
- symlink or resolved-path escape is blocked
- all-or-nothing behavior aborts before any write when one candidate fails
- rollback is reported if an unexpected write error occurs after creation starts
- result includes hashes and byte counts for written files
- human report states no overwrites, no Git operations, no dependency installs, no formatting, and no deploys

Manual validation:

- copy static, Vite, and Next App Router fixtures to temporary directories
- run write mode only against the copied fixtures
- verify only expected robots/sitemap files are created
- verify no other files change
- verify existing files are not modified
- inspect filesystem diff or checksums before and after
- run `pnpm shipready inspect-repo <copy>`
- run `pnpm shipready plan-fixes <copy> --url <url>`
- run `pnpm shipready fix <copy> --url <url> --dry-run`
- run `pnpm shipready audit <url>` where the target URL is reachable
- run the target project's own tests/build only when available and cheap

ShipReady repo validation after implementation:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 12. Open Questions

- Should the dry-run schema rename `auto_candidate` to `automation_candidate`, or should write mode keep a normalization layer for backward compatibility?
- Should write mode require a clean Git worktree when the target repo is a Git repository? V1 already forbids Git operations, but a clean-worktree warning may help users verify changes.
- Should sitemap creation be allowed when the remote audit reports an invalid sitemap but the local target file is missing? The strict V1 answer can be yes only if the local write is still a missing-file creation and all gates pass.
- Should `lastModified` be omitted from V1 Next.js sitemap output to keep content fully deterministic across runs?
- Should write mode expose a `--policy creation-only-robots-sitemap-v1` option later, or keep the policy implicit until additional write policies exist?

## 13. Recommendation

Implement `--write --allow-create` next, but only under this V1 policy.

The first implementation should write both robots and sitemap in one command if both are eligible. It must validate all eligible writes first and then create them all together. If any gate fails, it should write nothing and report the blocked reason.

Do not implement metadata, JSON-LD, content, alt text, dependency, config, formatting, Git, GitHub, commit, or deploy writes in V1.
