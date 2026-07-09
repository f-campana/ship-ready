# TUI Framework Evaluation

Evaluation date: 2026-07-09

Decision: **improve current TUI manually**.

ShipReady should not adopt Ink or OpenTUI before the next polish pass. The current dependency-free TUI is safe, functional, and already aligned with the source-checkout-only v0 posture, but it should get a second manual layout pass before package publish preparation resumes if the terminal cockpit is meant to feel polished rather than report-like.

Sources checked: current `src/tui/tuiViewer.ts`, `tests/tui.test.ts`, `package.json`, `pnpm-lock.yaml`, [Ink README](https://github.com/vadimdemedes/ink), [Ink npm package](https://www.npmjs.com/package/ink), [OpenTUI docs](https://opentui.com/docs/getting-started/), [OpenTUI homepage](https://opentui.com/), [OpenTUI GitHub](https://github.com/anomalyco/opentui), [@opentui/core npm package](https://www.npmjs.com/package/@opentui/core), and [@opentui/react npm package](https://www.npmjs.com/package/@opentui/react).

## Current TUI assessment

The current `tui` command is a human-only terminal viewer over `ui-report-v1`. It preserves the important boundaries:

- no JSON contract;
- no runtime dependency beyond the current package set;
- no write behavior;
- no GUI server;
- no Git, GitHub, deploy, DNS write, live Search Console, OAuth, token storage, social-platform API, telemetry, remote MCP, or `WRITE_POLICY_V1` broadening;
- CI/non-TTY fallback to the plain `ui-report` human report;
- optional read-only sections run only when requested with `--include`.

The current implementation is also testable. Existing tests cover view-model sections, visible safety and limitation labels, terminal-width wrapping/truncation, strict include parsing, optional check summaries, CI fallback without ANSI control sequences, repo-backed fallback, invalid URL fallback, no fallback writes, and absence of write/deploy/Git/GitHub execution paths in the TUI module.

The weakness is presentation quality. The renderer has a linear header, one active section, horizontal rules, plain bullets, and simple left/right/up/down keyboard handling. It is safe and useful, but it still reads close to a paged terminal report rather than a composed cockpit.

## Goals

- Make the terminal cockpit feel more deliberate without changing product behavior.
- Keep `ui-report-v1` as the data source.
- Keep JSON contracts unchanged.
- Keep all optional checks explicitly opt-in.
- Preserve source-checkout-only distribution.
- Preserve CI, redirected-output, and non-TTY readability.
- Preserve all write and integration safety boundaries.
- Avoid adding framework/runtime dependencies unless a later approved prototype proves the value is worth the package and maintenance cost.

## Non-goals

- Replace the current TUI in this pass.
- Add Ink, OpenTUI, React, Bun, native bindings, or other runtime dependencies.
- Add a new aggregate `review` command.
- Add a JSON contract for `tui`.
- Add any write surface.
- Add live GitHub, Git execution in target repos, deploy, DNS writes, live Search Console, OAuth/token storage, remote MCP, telemetry, hosted SaaS, accounts, or billing.
- Publish to npm or prepare package publishing.
- Change `WRITE_POLICY_V1`.
- Use Fodmapp as a mutation target.

## Option A: dependency-free TUI

Assessment: **best next step**.

The current dependency-free TUI can be made visually good enough for v0 with a second manual pass. The current code already has a view model, sections, wrapping, terminal sizing, and keyboard handling. That is enough structure to improve the composition without changing product behavior or contracts.

High-value improvements for a second pass:

- render a stronger cockpit shell with a bordered header, status badge text, and fixed footer;
- use a left navigation rail or top tab row instead of a plain "Section X/Y" line;
- split overview content into compact blocks for target, mode, status, next action, and safety;
- add section-local subheadings, dividers, and consistent spacing;
- add page-up/page-down/home/end keys while keeping `q`, Ctrl+C, arrows, and `?`;
- clamp scroll state after section changes and terminal resizes;
- add deterministic render snapshots at a few terminal sizes;
- add a small screenshot/PTY smoke if needed, still without adding runtime dependencies.

Limits:

- Manual layout means no full Flexbox engine.
- Borders, panels, and truncation must remain handcrafted.
- Complex nested responsive layouts will become harder to maintain if the TUI grows into a primary app surface.
- Color should remain conservative because the source-checkout and non-TTY story depends on readable plain fallback.

The current TUI should stay dependency-free until manual polish has clearly hit its ceiling.

## Option B: Ink

Assessment: **conservative framework candidate, but not now**.

Ink is the lower-risk framework option if ShipReady later needs a component model. It is established, React-based, and uses Yoga for terminal Flexbox layout. Its documentation also points to `ink-testing-library`, which gives a reasonable snapshot-style test path for component output.

Current package metadata checked on 2026-07-09:

- `ink@7.1.0`;
- direct dependencies include ANSI/string width/wrapping packages, cursor/terminal helpers, `react-reconciler`, `scheduler`, `ws`, and `yoga-layout`;
- peer dependencies include `react >=19.2.0`, `@types/react >=19.2.0`, and `react-devtools-core >=6.1.2`;
- engine requirement is Node `>=22`;
- `ink-testing-library@4.0.0` has Node `>=18`.

Implications:

- Dependency footprint: materially larger than the current zero-framework TUI. It would add React and terminal rendering packages to the runtime graph.
- React dependency implications: ShipReady currently is not a React CLI. Adopting Ink makes the TUI a React subtree and introduces React peer/version management.
- Build implications: the current `tsup` ESM build can likely handle Ink, but JSX/TSX configuration and published package smoke tests would be required.
- Testing/snapshot story: good relative to manual rendering because component frames can be rendered in tests.
- Non-TTY behavior: Ink has interactive-mode controls, but ShipReady should keep its explicit CI/non-TTY fallback before invoking Ink.
- Package publish implications: package publish preparation would need to account for React peers, Node `>=22`, the larger dependency graph, and packed-tarball behavior.
- Layout quality: strong for terminal panels, boxes, wrapping, focus, and keyboard flows.
- Developer ergonomics: good for engineers comfortable with React; less direct for the current small plain-TypeScript CLI.

Ink is worth prototyping only after a manual TUI polish pass proves insufficient, and only in an isolated prototype path first.

## Option C: OpenTUI

Assessment: **premium framework candidate, too risky for v0 packaging**.

OpenTUI is the most visually capable option. Its docs describe a native terminal UI core written in Zig with TypeScript bindings, a C ABI, Yoga-powered layout, rich components such as `Text`, `Box`, `Input`, `Select`, `ScrollBox`, `Code`, and `Diff`, built-in focus/input handling, React/Solid bindings, and animation support.

Current package metadata checked on 2026-07-09:

- `@opentui/core@0.4.3`;
- `@opentui/react@0.4.3`;
- `@opentui/core` direct dependencies include `diff`, `marked`, `strip-ansi`, `string-width`, and `bun-ffi-structs`;
- `@opentui/core` peers on `web-tree-sitter`;
- `@opentui/react` depends on `@opentui/core` and `react-reconciler`, and peers on React, `ws`, and React devtools packages.

Implications:

- Native Zig core: this is the biggest adoption risk. A native renderer changes install, CI, platform support, and failure modes.
- TypeScript bindings: useful for ShipReady, but they wrap native behavior rather than staying pure TypeScript.
- Build/install requirements: OpenTUI examples use Bun. The docs say Node can import packages without FFI, but creating the native renderer in Node requires Node.js 26.4.0 with `--experimental-ffi`; Node permissions also require `--allow-ffi` and filesystem permissions.
- Cross-platform behavior: likely promising, but ShipReady would need explicit macOS/Linux/Windows smoke tests before claiming package readiness.
- Package publish implications: much heavier than Ink because packed-tarball, postinstall, native library, Node version, Bun/Node split, FFI flags, and CI matrix behavior all become release questions.
- `pnpm dlx` implications: a published CLI depending on OpenTUI would need a clean ephemeral install/run story for native assets and runtime flags. That conflicts with the current source-checkout-only v0 posture.
- CI implications: CI would need to decide whether to skip native renderer tests, run Bun, or run Node 26.4.0 with experimental FFI. That is not appropriate as incidental TUI polish work.
- Layout quality: highest of the options for a rich cockpit.
- Long-term maintenance risk: higher than Ink because the native core and Node FFI requirements are newer and more operationally specific.

OpenTUI should be deferred until after ShipReady has an accepted packaging story and a clear reason to invest in a premium native terminal surface.

## Comparison matrix

| Option | Fit now | Runtime dependency impact | Layout quality | Testing story | Packaging risk | Maintenance risk | Recommendation |
|---|---|---:|---|---|---|---|---|
| Dependency-free TUI | High | None | Medium after manual polish | Existing unit tests plus snapshots | Low | Low to medium | Improve manually |
| Ink | Medium later | High | High | Good with `ink-testing-library` | Medium | Medium | Prototype later if manual polish fails |
| OpenTUI | Low now | High plus native/FFI | Very high | Needs investigation | High | High | Defer |

## Packaging implications

The current package metadata remains source-checkout-only: `private: true`, no publish-ready `files`, `main`, `exports`, `license`, `repository`, or `engines`, and no npm publication claim. The current TUI fits that posture because it adds no package surface.

Adding Ink before package publish preparation would make the publish checklist larger: React peer/dependency policy, Node `>=22`, bundled output checks, packed-tarball smoke tests, and TUI fallback tests would need to become part of release readiness.

Adding OpenTUI before package publish preparation would be larger still: Node 26.4.0 with experimental FFI or Bun, native Zig assets, CI platform coverage, runtime flags, and `pnpm dlx` behavior would need explicit design. That is not compatible with a conservative v0 package preparation pass.

## Testing implications

For the current TUI:

- keep model tests;
- add render snapshots for 80x24, 100x30, and narrow widths;
- add tests for page-up/page-down/home/end if those keys are added;
- keep CI/non-TTY fallback tests;
- keep no-write/source-scan tests.

For Ink:

- add component tests with `ink-testing-library`;
- keep an outer wrapper test that proves non-TTY fallback happens before Ink starts interactive rendering;
- add packed-package smoke tests once package publish preparation begins.

For OpenTUI:

- define whether native renderer tests run in CI or are isolated;
- test Node/Bun runtime behavior separately;
- add platform install tests before adoption;
- verify non-TTY fallback before native renderer startup.

## Safety implications

All options can preserve ShipReady's safety boundaries if the TUI remains a read-only view over existing contracts. The practical risk is accidental surface expansion:

- framework adoption must not introduce a JSON contract for `tui`;
- framework adoption must not add write callbacks or command execution paths;
- optional checks must remain opt-in;
- non-TTY fallback must remain explicit and test-covered;
- package install scripts or native dependencies must not become publish behavior without separate approval.

This evaluation changes no product behavior, JSON contract, write policy, or runtime dependency.

## Recommendation

**Improve current TUI manually.**

Do not adopt Ink or OpenTUI in the next pass. Ink is the most plausible future framework, but the current TUI has enough structure to justify one dependency-free polish pass first. OpenTUI should be deferred until after package publish preparation and only revisited if ShipReady explicitly wants a premium native terminal app surface.

## Next step

Run a scoped manual TUI polish pass before package publish preparation resumes:

- keep the current dependency-free implementation;
- improve shell layout, borders, section navigation, spacing, keyboard handling, and render snapshots;
- do not change `ui-report-v1`;
- do not add dependencies;
- do not add write behavior;
- do not publish or prepare publishing.

After that polish pass, package publish preparation can resume with the source-checkout-only v0 boundary still intact.
