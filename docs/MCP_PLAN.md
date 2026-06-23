# ShipReady MCP Plan

## 1. Decision and scope

This is the implementation specification and shipped boundary for roadmap Pass 5. ShipReady remains **CLI first, MCP second, GUI third**. MCP is an agent-facing adapter over the stable CLI JSON contracts; it is not a second product engine and must not introduce independent audit, inspection, planning, preview, reporting, or write rules.

Pass 5 is strictly read-only. It may read public HTTP(S) pages, explicitly authorized local repositories, canonical ShipReady documentation, and allowlisted validation fixtures. It must not expose a write tool, call `fix --write`, create or modify files, start the GUI, create branches/commits/PRs, deploy, mutate DNS or Search Console, or add metadata/content/JSON-LD/package/config writes. A `safeApply` field or guarded command in an existing report is data for review only and must never be executed by the MCP server.

This document specifies future write behavior so that it can be reviewed before implementation. The future tool in section 11 is not part of Pass 5 and must not be registered, advertised, or callable during Pass 5.

### Phase boundaries

| Phase | Roadmap pass | Included | Excluded |
|---|---:|---|---|
| 1 | Pass 5 | Live-site audit, repo inspection, fix planning, dry-run preview, UI report, canonical docs, deterministic contract fixtures, prompts | Every filesystem/external mutation and every write tool |
| 2 | Pass 6 or later | A future MCP wrapper for creation-only missing robots/sitemap files under `WRITE_POLICY_V1` | Overwrites, metadata/content/JSON-LD edits, Git operations, deploys, DNS, Search Console |
| 3 | Later roadmap passes | Search Console readiness, DNS readiness, reviewed patch export, GitHub PRs, social preview simulation, bounded crawl, other explicitly specified integrations | Anything not separately specified, authorized, and tested |

No prompt grants capabilities. Tool registration and server policy are the authority boundary.

## 2. Existing contracts and implementation facts

The source of truth is `src/types/contracts.ts`, with behavior documented in `docs/CONTRACTS.md`, fixtures in `validation/contracts/`, and drift tests in `tests/contracts.test.ts`.

| Contract | Current CLI source | Shared application entry point | Pass 5 MCP tool |
|---|---|---|---|
| `shipready.audit.v1` | `audit <url> --json` | `auditUrl` | `shipready.audit_site` |
| `shipready.repoInspection.v1` | `inspect-repo <path> --json` | `inspectRepo` | `shipready.inspect_repo` |
| `shipready.fixPlan.v1` | `plan-fixes <path> --url <url> --json` | `planFixes` | `shipready.plan_fixes` |
| `shipready.dryRunFix.v1` | `fix <path> --url <url> --dry-run --json` | `dryRunFix` | `shipready.preview_fixes` |
| `shipready.writeFix.v1` | `fix <path> --url <url> --write --allow-create --json` | `writeFix` | Future only: `shipready.write_safe_crawl_files` |
| `shipready.uiReport.v1` | `ui-report [path] --url <url> --json` | `createUiReport` | `shipready.get_ui_report` |
| `shipready.error.v1` | JSON action failures | MCP boundary normalizer | Every failed tool call |

Current capability details that Pass 5 must preserve:

- Audit, plan, dry-run, and UI report support a meaningful rendered-browser switch. The CLI expresses it as `--no-render`; the application functions use `render: boolean`. MCP exposes `rendered: boolean`, defaulting to `true`. When false, the current audit still populates the contract's `rendered` fields from raw HTML; it does not run Playwright.
- The CLI exposes `--user-agent`, but Pass 5 does not expose it to agents. The existing default remains in force.
- Repo inspection has internal `maxDepth`/`maxFiles` options, but the CLI does not expose them. Pass 5 uses the current defaults and does not add tool inputs for them.
- Tool timeouts are server policy, not agent-controlled inputs.
- `createUiReport` can return a valid `shipready.uiReport.v1` containing stage errors. That remains a successful contract result after MCP input/path validation; embedded report errors are not rewritten into a tool error.
- The shared functions return internal models without the CLI-only `contract` field. The MCP adapter must pass results through the existing JSON formatter and corresponding `*JsonContractSchema` (or an exactly equivalent shared contract serializer) before returning them.
- The current error schema does not yet contain all MCP boundary codes in section 8, and current application options do not accept `AbortSignal`. Those are explicit, reviewed Pass 5 implementation tasks, not capabilities that exist today.

## 3. Architecture choice

### Comparison

| Concern | A. Invoke CLI commands internally | B. Call shared TypeScript functions directly |
|---|---|---|
| Contract consistency | Naturally receives CLI JSON, but must parse stdout and handle non-JSON Commander failures | Must deliberately use the existing formatter plus named contract schema; drift tests can enforce byte/shape equivalence |
| Error mapping | Exit codes, stdout, and stderr need classification; Commander pre-action stderr is a known gap | Typed/known application failures can be normalized before transport; no Commander parse layer exists per tool call |
| Testability | Requires subprocess fixtures and process-level timing | Functions, authorization, formatter, and transport adapter can be tested independently |
| Performance | Starts a Node process for every call and can start Playwright descendants | No per-call Node process; Playwright is started only when the selected application operation needs it |
| Path safety | Authorization must happen before constructing argv | Authorization happens before calling any repository function; canonical path can be passed directly |
| Validation reuse | Reuses CLI parsing and formatters | Reuses application Zod schemas, URL normalization, CLI formatters, and named contract schemas |
| Quoting/injection | Safe only with `execFile`/`spawn`, `shell: false`, fixed executable, and exact argv | No shell or argument quoting boundary |
| Cancellation | Must terminate the child and its descendants, then prove browser cleanup | Can propagate one request `AbortSignal` through fetch/render/inspection and close owned resources directly |

### Recommendation

Use **B: direct shared TypeScript functions** for Pass 5. The call sequence for a contract tool is:

1. Validate the MCP JSON input with an exact schema.
2. Normalize the URL and authorize/canonicalize any `repoPath`.
3. Create a deadline-bound `AbortSignal`.
4. Call the existing application entry point with the canonical inputs and signal.
5. Serialize with the existing CLI JSON formatter.
6. Parse the serialized object and validate it with the named `*JsonContractSchema`.
7. Return that exact object in MCP `structuredContent` and as the JSON text content.

This makes the CLI contract the output boundary even though the implementation does not spawn the CLI. Pass 5 must add contract-equivalence tests between the MCP adapter and CLI formatter. It must not fork application logic into `src/mcp/`.

If a later environment requires subprocess isolation, the only acceptable fallback is a fixed executable with `shell: false`, an exact argv array, bounded stdout/stderr, authorization before spawn, and process-group termination on abort. Raw Commander stderr must never be forwarded; it must be mapped to section 8. No subprocess path is needed for Pass 5.

## 4. Common tool protocol

All input schemas are JSON Schema 2020-12 objects with `additionalProperties: false`. Strings are trimmed before semantic validation. A required string that becomes empty is invalid. `repoPath` follows section 7. URLs are normalized by the current `normalizeAuditUrl`: absolute `http:`/`https:` only, no embedded credentials, fragment removed. Unknown fields are rejected rather than ignored.

On success, a contract-backed tool returns one MCP `CallToolResult` with:

- `isError: false` or omitted;
- `structuredContent`: the exact named CLI contract object, without another envelope;
- one text content item containing the same object serialized as JSON once.

`shipready.get_contract_fixture` returns the fixture's exact embedded contract object. `shipready.get_policy_doc` uses the standard text payload defined in section 5.7 because it is a document read, not a CLI product contract.

On failure, a tool returns exactly once with `isError: true`, a `shipready.error.v1` object in `structuredContent`, and the same safe JSON in text content. JSON-RPC framing/parsing failures that occur before a valid MCP request exists remain standard MCP protocol errors. Results are never partially returned or truncated; exceeding the planned 4 MiB tool-result limit returns `contract_error`.

## 5. Pass 5 tools

### 5.1 `shipready.audit_site`

- Purpose/classification: audit one live page; network-read-only.
- Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["url"],
  "properties": {
    "url": { "type": "string", "minLength": 1, "maxLength": 2048 },
    "rendered": { "type": "boolean", "default": true }
  }
}
```

- Normalization: trim and normalize `url`; default `rendered` to `true`; map it to `AuditUrlOptions.render`.
- Output: exact `shipready.audit.v1`, validated by `AuditJsonContractSchema`.
- Mapping: `audit <url> --json [--no-render]` / `auditUrl` / `formatJsonReport`.
- Success: readiness states such as `needs_work` or `critical` are successful audit results, not tool errors.
- Errors: `invalid_url`, `network_error`, `render_error`, `timeout`, `cancelled`, `contract_error`, or `internal_error`.
- Timeout: 30 seconds for the whole tool call.
- Cancellation/cleanup: propagate the request signal to raw fetches, crawl-resource fetches, and Playwright; close page, context, and browser in `finally`.
- Safety: no local path input and no files written. This is one page plus current robots/sitemap checks, not a bounded crawl.

### 5.2 `shipready.inspect_repo`

- Purpose/classification: inspect one explicit local project; local-read-only.
- Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["repoPath"],
  "properties": {
    "repoPath": { "type": "string", "minLength": 1, "maxLength": 4096 }
  }
}
```

- Normalization: require an absolute explicit path, reject `..` segments, then canonicalize and authorize it under section 7.
- Output: exact `shipready.repoInspection.v1`, validated by `RepoInspectionJsonContractSchema`.
- Mapping: `inspect-repo <path> --json` / `inspectRepo` / `formatRepoInspectionJsonReport`.
- Success: unknown framework, bounded-scan warnings, or a truncated scan are valid inspection results.
- Errors: `invalid_repo_path`, `path_not_authorized`, `timeout`, `cancelled`, `contract_error`, or `internal_error`.
- Timeout: 10 seconds.
- Cancellation/cleanup: check the signal before the scan and between directory entries/file reads. No temp files or child processes.
- Safety: retain current ignored directories, depth/file/size limits, and symlink-skipping behavior. Never scan an allowed root unless that exact root was supplied as `repoPath`.

### 5.3 `shipready.plan_fixes`

- Purpose/classification: combine a live audit with authorized repo inspection; network/local-read-only.
- Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["url", "repoPath"],
  "properties": {
    "url": { "type": "string", "minLength": 1, "maxLength": 2048 },
    "repoPath": { "type": "string", "minLength": 1, "maxLength": 4096 },
    "rendered": { "type": "boolean", "default": true }
  }
}
```

- Normalization: apply the URL and path rules above; map `rendered` to `PlanFixesOptions.render`.
- Output: exact `shipready.fixPlan.v1`, validated by `FixPlanJsonContractSchema`.
- Mapping: `plan-fixes <path> --url <url> --json [--no-render]` / `planFixes` / `formatFixPlanJsonReport`.
- Success: `manual_review_required`, `unsupported_project`, and `no_changes_needed` are successful plan outcomes.
- Errors: the union of audit and inspection errors plus `contract_error` and `internal_error`.
- Timeout: 45 seconds for the combined operation, not 45 seconds per stage.
- Cancellation/cleanup: one signal covers the parallel audit/inspection; abort the remaining branch after either terminal timeout/cancellation and close Playwright resources.
- Safety: action fields are recommendations/capability labels only and cannot execute changes.

### 5.4 `shipready.preview_fixes`

- Purpose/classification: generate the current exact dry-run preview; network/local-read-only.
- Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["url", "repoPath"],
  "properties": {
    "url": { "type": "string", "minLength": 1, "maxLength": 2048 },
    "repoPath": { "type": "string", "minLength": 1, "maxLength": 4096 },
    "rendered": { "type": "boolean", "default": true }
  }
}
```

- Normalization: URL/path authorization as above; map `rendered` to `DryRunFixOptions.render`.
- Output: exact `shipready.dryRunFix.v1`, validated by `DryRunFixJsonContractSchema`; `mode` must be `dry_run` and `wroteFiles` must be `false`.
- Mapping: `fix <path> --url <url> --dry-run --json [--no-render]` / `dryRunFix` / `formatDryRunFixJsonReport`.
- Success: empty changes, skipped actions, review-required changes, and `auto_candidate` previews are all valid results.
- Errors: the union of audit/inspection errors plus `contract_error` and `internal_error`.
- Timeout: 45 seconds total.
- Cancellation/cleanup: same as planning; local preview reads must check cancellation at safe boundaries.
- Safety: never call `writeFix` or `writeFixFromDryRun`. A preview may contain proposed metadata/content/JSON-LD changes, but none is written or authorized.

### 5.5 `shipready.get_ui_report`

- Purpose/classification: build the normalized current UI/report model in URL-only or URL-plus-repo mode; network read and optional authorized local read.
- Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["url"],
  "properties": {
    "url": { "type": "string", "minLength": 1, "maxLength": 2048 },
    "repoPath": { "type": "string", "minLength": 1, "maxLength": 4096 },
    "rendered": { "type": "boolean", "default": true }
  }
}
```

- Normalization: validate URL before application execution. If `repoPath` is present, it must pass section 7; an empty value is invalid rather than URL-only.
- Output: exact `shipready.uiReport.v1`, validated by `UiReportJsonContractSchema`, retaining `schemaVersion: "ui-report-v1"`.
- Mapping: `ui-report [path] --url <url> --json [--no-render]` / `createUiReport` / `formatUiReportJsonReport`.
- Success: a schema-valid report is returned even when its `errors` array contains normalized audit/repo/plan/dry-run stage errors, matching current report semantics.
- Errors: boundary failures (`invalid_url`, `invalid_repo_path`, `path_not_authorized`, `timeout`, `cancelled`, `contract_error`, `internal_error`). Stage failures caught by `createUiReport` remain inside the successful report.
- Timeout: 45 seconds total.
- Cancellation/cleanup: one request signal covers every performed stage; close Playwright on every path.
- Safety: does not start the GUI or render/write an HTML file. Any safe-apply command is non-executable report text.

### 5.6 `shipready.get_contract_fixture`

- Purpose/classification: return one deterministic, allowlisted contract fixture; local canonical-read-only.
- Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["fixtureName"],
  "properties": {
    "fixtureName": {
      "type": "string",
      "enum": [
        "audit.clean.json",
        "audit.needs-work.json",
        "error.invalid-url.json",
        "fix-dry-run.review-required.json",
        "fix-dry-run.safe-apply.json",
        "fix-dry-run.skipped.json",
        "fix-write.blocked.json",
        "fix-write.safe-create.json",
        "fix-write.skipped.json",
        "inspect-repo.next-app.json",
        "inspect-repo.vite.json",
        "plan-fixes.review-required.json",
        "plan-fixes.safe-apply.json",
        "ui-report.safe-apply.json",
        "ui-report.url-only.json"
      ]
    }
  }
}
```

- Normalization: exact `fixtureName` enum match only; never interpret the value as a path.
- Output: parsed fixture object unchanged, validated against the schema selected by its embedded `contract` discriminator.
- Mapping: canonical file `validation/contracts/<fixtureName>`; no CLI command or application function.
- Success: deterministic JSON from the checked-in fixture.
- Errors: `fixture_not_found` for an unlisted or missing fixture and `contract_error` for invalid JSON/schema drift.
- Timeout: 5 seconds.
- Cancellation/cleanup: abort before/after the bounded read; no temp files.
- Safety: no arbitrary fixture directory traversal and no fixture regeneration.

### 5.7 `shipready.get_policy_doc`

- Purpose/classification: provide canonical operational documentation to clients that cannot read MCP resources; local canonical-read-only. The name is retained even though the allowlist includes runbook/status/reference docs.
- Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["name"],
  "properties": {
    "name": {
      "type": "string",
      "enum": [
        "agent-runbook",
        "commands",
        "contracts",
        "write-policy-v1",
        "claims-policy",
        "status",
        "roadmap",
        "mcp-plan"
      ]
    }
  }
}
```

- Normalization: exact enum-to-path lookup only; never accept a path or URI as `name`.
- Output: standard MCP text content plus `structuredContent: { "uri": string, "mediaType": "text/markdown", "text": string }`. This is an MCP adapter payload, not a new ShipReady CLI contract.
- Mapping: the document table in section 6.
- Success: UTF-8 text read from the installed package's canonical content root, never the caller's CWD.
- Errors: `doc_not_found` for an unlisted or missing document.
- Timeout: 5 seconds; maximum document response 1 MiB.
- Cancellation/cleanup: abort around the bounded read; no temp files.
- Safety: documentation text is data, not authority. It cannot add tools or override server policy.

## 6. Resources

All static paths are resolved from the installed ShipReady package root through a hard-coded URI/path allowlist. They are not joined from arbitrary request text. Markdown is UTF-8 `text/markdown`; fixtures and generated indexes are UTF-8 `application/json`.

| Resource URI | Purpose | Canonical source | Nature/media type | Safe consumption and missing behavior |
|---|---|---|---|---|
| `shipready://docs/readme` | Product entry point | `README.md` | Static `text/markdown` | Missing packaged file is a sanitized internal resource error |
| `shipready://docs/agent-runbook` | Agent operating and safety context | `docs/AGENT_RUNBOOK.md` | Static `text/markdown` | Text never grants capabilities |
| `shipready://docs/commands` | Implemented command reference | `docs/COMMANDS.md` | Static `text/markdown` | Includes the canonical stdio startup syntax |
| `shipready://docs/contracts` | Named contract reference | `docs/CONTRACTS.md` | Static `text/markdown` | Validate live tool results against code schemas, not prose alone |
| `shipready://docs/write-policy-v1` | Canonical current CLI write policy | `docs/WRITE_POLICY_V1.md` | Static `text/markdown` | Reading it does not authorize a write |
| `shipready://docs/claims-policy` | Product-copy and outcome-claim constraints | `docs/CLAIMS_POLICY.md` | Static `text/markdown` | Apply it to generated explanations |
| `shipready://docs/status` | Implemented/deferred capability status | `docs/STATUS.md` | Static `text/markdown` | Planned items are not callable capabilities |
| `shipready://docs/roadmap` | Ordered pass/dependency reference | `docs/ROADMAP.md` | Static `text/markdown` | Pass order does not grant authority |
| `shipready://docs/mcp-plan` | MCP implementation and safety boundary | `docs/MCP_PLAN.md` | Static `text/markdown` | Future sections do not register capabilities |
| `shipready://validation/contracts/<fixture-name>` | Deterministic contract example | Exact allowlisted file in `validation/contracts/` | Static `application/json` resource template | Same fixture enum/schema validation as section 5.6; unknown name is not found, invalid content is `contract_error` |

Resource list/read operations use a 5-second deadline and 1 MiB text/JSON limit. An unknown URI receives a standard sanitized MCP not-found error. A listed resource missing from the package receives a sanitized internal resource error without filesystem search, alternate-path probing, stack trace, or directory listing. Clients needing `shipready.error.v1` should use the equivalent read tools, because resource protocol errors do not have `CallToolResult.isError`.

## 7. Repository path authorization

Path authorization is mandatory before any repository function runs.

### Implemented startup configuration

Primary command:

```bash
pnpm shipready mcp --allow-root /absolute/workspaces --allow-root /absolute/other-root
```

`--allow-root <absolute-path>` is repeatable. Non-interactive configuration may use a JSON array:

```bash
SHIPREADY_MCP_ALLOWED_ROOTS='["/absolute/workspaces","/absolute/other-root"]'
```

If one or more CLI flags are present, they replace the environment value completely. Otherwise the environment value is used. There is no CWD, home-directory, workspace-discovery, prose, or GUI-input fallback. With no configured roots, the server fails startup before opening the MCP transport. Filesystem roots and the user's home directory are rejected as overbroad allow roots; configure specific descendants instead.

At startup, each allowed root must be absolute, exist, be a readable directory, and resolve through `realpath`. Inaccessible/invalid roots fail the whole startup. Canonically identical roots are deduplicated. A nested root already covered by a configured parent is redundant and removed after validation; only a count-level warning is logged by default.

### Per-request algorithm

For every provided `repoPath`:

1. Require an explicit non-empty absolute string. Relative paths are rejected for MCP even though the CLI accepts them.
2. Reject any raw path segment equal to `..` before normalization.
3. Resolve the absolute path, then obtain its native realpath. A nonexistent path is `invalid_repo_path`.
4. Require it to be a directory for all Pass 5 repo tools.
5. Compare the canonical repo path with every canonical allowed root using `path.relative`/path-segment rules: allow equality or a relative result that is non-empty, non-absolute, and does not begin with `..` plus a separator.
6. Reject sibling-prefix tricks (`/allowed-other`), traversal, symlink escape, and a path whose realpath is outside every allowed root as `path_not_authorized`.
7. Pass only the canonical authorized path to application code.

Authorization applies to the repository root and every MCP-owned follow-up file read. Existing repo inspection continues to skip symlink entries. Future write authorization must additionally realpath the nearest existing parent of every target immediately before exclusive creation.

Do not lowercase paths blindly. Use native realpaths and platform path APIs. On case-insensitive filesystems, authorization follows filesystem identity; on case-sensitive filesystems, case differences remain distinct. On Windows, normalize drive/separator representation through native path functions and reject cross-volume relative results. Tests must cover the platform in CI plus portable sibling-prefix and symlink cases.

The server never scans allowed roots to discover repositories, never scans the home directory broadly, and never infers a repository from prompt prose. Only a schema field supplied to a repo-capable tool selects the path.

## 8. Error mapping

### MCP error envelope

Pass 5 must extend the existing `shipready.error.v1` code enum through an explicit compatibility change while retaining all current CLI codes and the required `error === message` alias. The MCP boundary adds these stable codes and optional safe fields:

```ts
type McpShipReadyError = {
  contract: "shipready.error.v1";
  ok: false;
  code:
    | "invalid_url"
    | "invalid_repo_path"
    | "path_not_authorized"
    | "fixture_not_found"
    | "doc_not_found"
    | "network_error"
    | "render_error"
    | "timeout"
    | "cancelled"
    | "contract_error"
    | "write_forbidden"
    | "unsupported_command"
    | "internal_error";
  message: string;
  error: string;
  retryable?: boolean;
  details?: {
    tool?: string;
    stage?: "input" | "authorization" | "network" | "render" | "inspection" | "contract" | "cleanup";
    timeoutMs?: number;
  };
};
```

These additions are implemented compatibly in `src/types/contracts.ts`. Existing CLI codes (`invalid_timeout`, `invalid_mode`, `write_validation_failed`, `write_execution_failed`, `command_failed`) remain valid for CLI compatibility; agents do not supply per-tool timeouts or modes in Pass 5.

| Code | Use | Retry guidance |
|---|---|---|
| `invalid_url` | Missing/malformed/unsupported URL or embedded credentials | No; correct input |
| `invalid_repo_path` | Empty/relative/nonexistent/non-directory/inaccessible repo path | No; correct input or access |
| `path_not_authorized` | Canonical path is outside configured roots or escapes through traversal/symlink | No; operator must change startup authorization |
| `fixture_not_found` | Fixture is absent from the exact allowlist or packaged content | No; use the advertised fixture enum |
| `doc_not_found` | Document is absent from the exact allowlist or packaged content | No; use the advertised document enum |
| `network_error` | Fetch/DNS/TLS/connection failure not caused by cancellation/deadline | Usually retryable once; do not loop automatically |
| `render_error` | Playwright launch/navigation/content failure distinct from deadline | Retryable once, or retry with `rendered: false` when acceptable |
| `timeout` | Server deadline expired | Retryable after operator timeout/config review |
| `cancelled` | Client/request cancellation won the race | Do not retry automatically; retry only as a new user action |
| `contract_error` | Formatter output, fixture, or result fails its named schema/size limit | Not retryable; implementation/contract drift |
| `write_forbidden` | Any attempted write tool/capability during Pass 5, and future write-policy rejection | Not retryable without a later authorized phase/preconditions |
| `unsupported_command` | Unknown tool/doc/fixture request or unsupported operation | No; use advertised allowlist |
| `internal_error` | Sanitized unexpected server failure or cleanup failure | Usually not retryable; inspect server logs |

Input schema failures map to the closest code above; unknown extra fields/unknown tools map to `unsupported_command`. URL normalization occurs before network work. Path authorization occurs before application work, so an unauthorized path must not be passed to repo inspection even to determine framework.

Commander pre-action errors are normalized at the MCP boundary rather than forwarded. Under the recommended direct-function architecture, missing tool fields and unknown arguments are handled by MCP schemas and never enter Commander. If a subprocess adapter is ever used, missing required CLI arguments, unknown options, non-JSON stderr, exit 5, and malformed stdout must be classified into the safe codes above; raw stderr is diagnostic input only and is never returned.

Messages may identify the tool and invalid field but must not include stack traces, environment variables, credentials, raw HTML, arbitrary stderr, directory listings, allowed-root lists, or broad filesystem paths. Logs may include a request ID and code; verbose path/error diagnostics require an explicit local debug mode and still redact credentials/secrets.

## 9. Timeouts, cancellation, and lifecycle

### Defaults and configuration

| Operation | Implemented fixed default | Future override range |
|---|---:|---:|
| `audit_site` | 30 s | 5–120 s |
| `inspect_repo` | 10 s | 1–30 s |
| `plan_fixes` | 45 s | 5–120 s |
| `preview_fixes` | 45 s | 5–120 s |
| `get_ui_report` | 45 s | 5–120 s |
| doc/resource/fixture reads | 5 s | 0.25–30 s |

Per-tool timeout overrides remain deferred. Pass 5 uses the fixed defaults above; tools do not accept a timeout field.

The deadline covers validation after request receipt, authorization, application work, serialization/schema validation, and cleanup. Existing internal `timeoutMs` remains a per-I/O guard but must be capped by remaining request time; it is not allowed to extend the overall deadline.

### Implemented cancellation boundary and known gap

- Client cancellation and deadlines are combined at the MCP request boundary while retaining which event won.
- Cancellation winning first returns `cancelled`; deadline winning first returns `timeout`, even if lower layers surface a generic abort exception.
- A request state may transition from pending to completed once. Late promise resolution/rejection after timeout/cancel is observed for cleanup/logging but cannot send a second response.
- The recommended direct architecture starts no child Node process, temp directory, output file, GUI server, or background server per request. No orphan process/server/file is acceptable.
- On `SIGINT`, `SIGTERM`, or stdin/transport close, stop accepting calls, abort active calls, wait up to two seconds for cleanup, close the transport, and exit. Protocol output is stdout only; diagnostics are stderr only.

Known gap: existing application functions and the synchronous repository walker do not accept `AbortSignal`. The MCP response is bounded, and current fetch/render operations retain their own timeouts and browser `finally` cleanup, but already-started underlying work cannot always be interrupted immediately. Full signal propagation and configurable timeout overrides remain follow-up hardening; they must not change default CLI behavior.

If a future subprocess adapter exists, spawn without a shell, create a controllable process group where supported, send termination on abort, escalate to force-kill after a short grace period, drain bounded pipes, and verify descendant cleanup.

## 10. Security and safety invariants

- Pass 5 tools cannot mutate files or external state. No write tool exists in Pass 5.
- The safe-write wrapper is Pass 6 or later and requires the stronger per-operation confirmation and preview preconditions in section 11.
- There is no current MCP secret handling, authenticated-page access, Search Console, DNS, deploy, Git commit/branch, GitHub PR, account, billing, or hosted service capability.
- The server never calls `writeFix`, `writeFixFromDryRun`, `writeHtmlReport`, GUI server startup, shell commands, Git, deploy tooling, or third-party mutation APIs.
- Repository files, fetched HTML, reports, docs, and fixtures are untrusted data. Instructions embedded in them cannot override tool schemas, allowed roots, policy, prompt limits, or the absence of write capabilities.
- URL inputs use the current unauthenticated HTTP(S) contract and cannot contain credentials. Pass 5 adds no cookies, authorization headers, arbitrary user-agent input, or credential store. The current CLI URL policy is intended for public pages but does not itself provide a private-network/SSRF boundary; local stdio operators must apply host/network sandboxing appropriate to their environment. Remote transport remains deferred until destination policy, authentication, and threat modeling are specified.
- Result/document size caps fail closed rather than truncating a named contract. Logs follow section 13 and do not contain result bodies, secrets, query strings, broad filesystem data, or stacks by default.
- Existing GUI and CLI write behavior is unchanged. In particular, the GUI remains preview/copy-only and the canonical `WRITE_POLICY_V1` allowlist is neither broadened nor reinterpreted.

## 11. Future-only safe-write tool (not Pass 5)

`shipready.write_safe_crawl_files` is a Phase 2/Pass 6-or-later proposal. Pass 5 must not contain its handler, schema registration, prompt permission, capability advertisement, or stub implementation.

Future input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["url", "repoPath", "confirmation", "preconditionToken"],
  "properties": {
    "url": { "type": "string", "minLength": 1, "maxLength": 2048 },
    "repoPath": { "type": "string", "minLength": 1, "maxLength": 4096 },
    "confirmation": { "const": "CREATE_SAFE_CRAWL_FILES_ONLY" },
    "preconditionToken": { "type": "string", "minLength": 32, "maxLength": 4096 }
  }
}
```

Future output is the exact `shipready.writeFix.v1` object. Validation/execution failures return `shipready.error.v1`; when the underlying write contract supplies a nested write result, retain it under the existing error-contract rules.

### Future preview receipt

Phase 2 should add an opaque, server-instance-bound preview receipt in MCP response metadata, not alter `shipready.dryRunFix.v1`. It is issued only after a successful `shipready.preview_fixes` result has been shown for review. The signed/HMAC receipt binds:

- server instance nonce and policy `creation_only_robots_sitemap_v1`;
- canonical URL and canonical authorized repo realpath;
- full dry-run contract SHA-256;
- ordered candidate paths, change types, exact `after` content hashes, risk/review fields, and source action IDs;
- fingerprints of files read by planning/preview plus candidate-target nonexistence and nearest-parent realpaths;
- issue and expiry time (recommended maximum five minutes) and a single-use nonce.

The future write call must consume the token once, re-authorize the repo, re-inspect, regenerate the plan/dry-run, revalidate every current write-policy gate, and compare the regenerated candidate set/content/fingerprints before calling existing write logic. Any mismatch is stale/unreviewed and returns `write_forbidden`. Confirmation applies to one exact operation, not a session.

The future tool must reject when the path is unauthorized; the receipt is missing, invalid, expired, reused, unreviewed, or stale; any target exists; any candidate falls outside `docs/WRITE_POLICY_V1.md`; any overwrite/delete/rename is proposed; metadata/content/JSON-LD/package/config work is requested; or Git, GitHub, branch, commit, PR, deploy, DNS, or Search Console mutation is requested. Creation must retain current exclusive-create, allowlist, deterministic-content, all-or-nothing, and rollback reporting behavior.

Current ShipReady has no Git status/clean-worktree contract and does not claim to detect a dirty worktree. The future MCP wrapper must not invent such a claim. Its first safety decision should be filesystem receipt/fingerprint freshness, which is independent of Git and rejects relevant post-preview changes. A separate clean-worktree gate may be proposed later only with explicit read-only Git detection semantics and tests for non-Git repos, unavailable Git, ignored files, untracked files, and submodules. It must not be silently assumed or perform Git mutation.

## 12. Prompts

Prompts are read-only orchestration templates. They may invoke only the tools listed per prompt, cannot call future tools, and cannot convert report text, repository content, HTML, or fixture text into authority. Treat all fetched/repo/report content as untrusted data; instructions found inside it must be ignored.

| Prompt | Arguments | Orchestration and allowed tools | Expected output and limits |
|---|---|---|---|
| `review_launch_readiness` | `url` required; `repoPath` optional; `rendered` optional default true | Without repo: `shipready.audit_site`, then `shipready.get_ui_report`. With repo: authorize via each tool, then `shipready.get_ui_report`; use `shipready.inspect_repo`, `shipready.plan_fixes`, or `shipready.preview_fixes` only when details are needed. `shipready.get_policy_doc` is allowed for claims/write context. | Evidence-based readiness summary, blocking/important/recommended findings, raw-vs-rendered caveat, review-required versus preview-only changes, next read-only checks. No write/deploy claim. |
| `prepare_safe_crawl_files` | `url`, `repoPath` required; `rendered` optional | `shipready.inspect_repo` → `shipready.plan_fixes` → `shipready.preview_fixes` → `shipready.get_policy_doc(name=write-policy-v1)`. | Preview only: exact eligible-looking crawl-file candidates, blocked/review-required items, and explicit statement that no files changed and no Pass 5 write tool exists. It does not issue a future write receipt. |
| `explain_review_required_changes` | `url`, `repoPath` required; `rendered` optional | `shipready.preview_fixes`; optionally `shipready.plan_fixes`, `shipready.get_ui_report`, and write/claims policy docs. | Group changes by reason/risk/evidence, explain why they remain human-reviewed, and avoid supplying invented metadata or structured-data facts. |
| `post_deploy_recheck` | `url` required; `repoPath` optional; `rendered` optional | `shipready.audit_site`, then `shipready.get_ui_report`; optional `shipready.inspect_repo` only when `repoPath` was explicitly supplied. | Compare only with results supplied in the conversation, label absent baseline as unavailable, report current live evidence. It neither deploys nor proves third-party indexing. |
| `write_policy_summary` | No arguments | `shipready.get_policy_doc(name=write-policy-v1)` and optionally `shipready.get_policy_doc(name=claims-policy)`. | Concise current CLI V1 allowlist, gates, forbidden operations, and distinction between current CLI write capability, absent Pass 5 MCP writes, and future Phase 2 proposal. |

Prompt argument validation uses the corresponding tool rules. Prompt rendering may name a tool but does not execute it automatically; the client remains responsible for calls and showing results.

## 13. Implemented Pass 5 server shape

Implemented files:

```text
src/mcp/config.ts                   # startup flags/env/defaults
src/mcp/server.ts                   # MCP capability registration and stdio lifecycle
src/mcp/errors.ts                   # shipready.error.v1 normalization/redaction
src/mcp/pathAuthorization.ts        # canonical allowed-root enforcement
src/mcp/timeouts.ts                 # deadline/client signal composition
src/mcp/tools.ts                    # seven read-only handlers
src/mcp/resources.ts                # URI/path allowlist and resource template
src/mcp/prompts.ts                  # five prompt templates
tests/mcp/pathAuthorization.test.ts
tests/mcp/tools.test.ts
tests/mcp/resourcesPrompts.test.ts
tests/mcp/server.test.ts
```

Implemented canonical command:

```bash
pnpm shipready mcp --allow-root /absolute/workspace
```

The CLI subcommand is canonical. No separate package alias exists.

Use local stdio transport only in Pass 5. It matches local-agent use, avoids authentication/listener/CORS exposure, and has the smallest lifecycle surface. HTTP, SSE, and Streamable HTTP are deferred until a separate remote-host/auth/threat specification exists.

The official MCP TypeScript SDK is the only new runtime dependency; existing Zod contracts validate inputs and outputs. No HTTP framework, database, auth system, telemetry service, shell helper, or duplicate schema library was added.

Stdout is reserved exclusively for MCP frames. Startup/config failures go to stderr without arguments, result bodies, document text, allowed-root lists, environment values, stacks, or raw filesystem errors. Startup validates config and canonical content before transport connection. Shutdown follows section 9.

## 14. Pass 5 test and validation plan

The focused suite covers the shipped registry, canonical reads/prompts, path containment and symlink escape, stable representative errors, practical deadline behavior, contract outputs, a full dry-run tree digest, and an SDK stdio initialize/list/call/read/get-prompt smoke. The deeper interruption points listed below remain the cancellation hardening gap described in section 9.

### Automated coverage

- Tool schema tests: required fields, empty/oversized values, unknown fields, URL protocol/credentials, `rendered` default/type, optional repo semantics.
- Contract tests: every contract-backed tool result parses with its named schema; compare MCP adapter output with the existing formatter; validate all checked-in fixtures; fail closed on formatter/schema drift and oversized output.
- Path authorization: no roots, invalid/inaccessible/relative/overbroad roots, flag/env precedence, duplicates/nesting, exact root, child, sibling-prefix, `..`, nonexistent/file paths, symlink inside, symlink escape, and platform case/separator behavior.
- Read-only invariants: hash fixture trees before/after every repo-capable tool and prompt flow using paths, file types, modes, symlink targets, sizes, and content hashes; exclude access timestamps only. Assert no created/deleted/modified entries and no temp artifacts.
- Error mapping: every code in section 8, redaction, retryability, exactly one response, unknown tool/doc/fixture, malformed contract, and cleanup failure. Mirror Commander pre-action cases (missing required argument, unknown option, plain stderr, exit 5) and prove they become safe MCP input/unsupported errors rather than leaked stderr.
- Timeout/cancellation: client cancellation before start, during fetch, render, repo walk, serialization, and cleanup; deadline race; cancellation-vs-timeout winner; browser closure; late-result suppression; no orphan processes/servers/files.
- Resources: exact URI allowlist, media types, canonical content-root resolution, fixture template enum/schema, missing resource behavior, and size cap.
- Prompts: all five exist, validate arguments, name only allowed tools, state safety limitations, and resist untrusted instructions embedded in mocked reports/docs/repo content.
- Startup/transport: required roots, CLI/environment root precedence, stdio initialize/list/call/read/get-prompt smoke, stdout protocol purity, sanitized stderr, and stdin close/SIGTERM cleanup.
- Regression: `POST /api/fix` remains 404; GUI client remains preview/copy-only and calls no write endpoint; `docs/WRITE_POLICY_V1.md` semantics and writable allowlist are unchanged; no metadata/content/JSON-LD/package/config write becomes eligible.

Use temporary fixture copies only. Never execute guarded write mode against `/Users/fabiencampana/Documents/fodmapp/apps/marketing` or any real repository.

### Pass 5 completion gates

1. All seven read-only tools, resources, and five prompts match this specification.
2. No write tool is registered or present as a callable/stub handler.
3. Named output contracts and expanded error compatibility tests pass.
4. Path authorization and no-mutation hashes pass, including symlink escape.
5. Boundary timeout/cancellation and stdio smoke tests pass; deeper signal propagation is deferred as documented in section 9.
6. Full `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check` pass because Pass 5 changes source/package behavior.
7. Documentation is updated from **Planned** to implemented only after the implementation and evidence pass.

## 15. Explicitly deferred

Pass 5 does not implement or add secrets, authentication, accounts, billing, hosted SaaS, remote MCP transport, Search Console, DNS, deployment, Git/GitHub operations, patch export, social preview simulation, implementation-smell detection, bounded multi-page crawl, broader safe writes, metadata/content/JSON-LD/package/config writes, HTML-report file creation, GUI write execution, or the future safe-write tool.

The recommended next pass is exactly: **Pass 6 — MCP safe-write wrapper**, limited to the existing creation-only robots/sitemap policy and the preview-receipt design in section 11.
