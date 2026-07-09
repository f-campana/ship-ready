import { emitKeypressEvents } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";
import { crawlSite } from "../crawl/crawl";
import { getDnsStatus } from "../dns/dnsStatus";
import { recheck } from "../recheck/recheck";
import { formatUiReportHumanReport } from "../report/formatUiReportHumanReport";
import { createUiReport, type CreateUiReportInput } from "../ui/createUiReport";
import { getSearchConsoleStatus } from "../searchConsole/searchConsoleStatus";
import { getGeneratedSiteSmells } from "../smells/generatedSiteSmells";
import { getSocialPreview } from "../socialPreview/socialPreview";
import type {
  CrawlJsonContract,
  DnsStatusJsonContract,
  GeneratedSiteSmellsJsonContract,
  RecheckJsonContract,
  SearchConsoleStatusJsonContract,
  SocialPreviewJsonContract,
} from "../types/contracts";
import type { UiFixAction, UiIssue, UiReport } from "../types/uiReport";

export const TUI_INCLUDE_OPTIONS = [
  "social-preview",
  "crawl",
  "smells",
  "dns",
  "search-console",
  "recheck",
] as const;

export type TuiIncludeOption = (typeof TUI_INCLUDE_OPTIONS)[number];
export type TuiMockProfile = "demo";

export type TuiCommandInput = {
  url: string;
  repoPath?: string;
  include: TuiIncludeOption[];
  mockProfile?: TuiMockProfile;
  timeoutMs: number;
  render: boolean;
  userAgent?: string;
};

export type TuiOptionalChecks = {
  socialPreview?: TuiCheck<SocialPreviewJsonContract>;
  crawl?: TuiCheck<CrawlJsonContract>;
  smells?: TuiCheck<GeneratedSiteSmellsJsonContract>;
  dns?: TuiCheck<DnsStatusJsonContract>;
  searchConsole?: TuiCheck<SearchConsoleStatusJsonContract>;
  recheck?: TuiCheck<RecheckJsonContract>;
};

export type TuiCheck<T> =
  | { status: "not_run"; label: string; message: string }
  | { status: "skipped"; label: string; message: string }
  | { status: "error"; label: string; message: string }
  | { status: "ready"; label: string; result: T };

export type TuiSection = {
  id: string;
  label: string;
  lines: string[];
};

export type TuiViewModel = {
  title: string;
  target: string;
  repo?: string;
  status: string;
  next: string;
  mode: string;
  report: UiReport;
  sections: TuiSection[];
};

export type TuiRenderState = {
  sectionIndex: number;
  scroll: number;
  showHelp: boolean;
};

export type TuiRenderSize = {
  columns: number;
  rows: number;
};

export type TuiOperations = {
  createReport: (input: CreateUiReportInput) => Promise<UiReport>;
  socialPreview: typeof getSocialPreview;
  crawl: typeof crawlSite;
  smells: typeof getGeneratedSiteSmells;
  dnsStatus: typeof getDnsStatus;
  searchConsoleStatus: typeof getSearchConsoleStatus;
  recheck: typeof recheck;
};

type TuiStreams = {
  stdin: ReadStream;
  stdout: WriteStream;
  env: NodeJS.ProcessEnv;
};

const DEFAULT_OPERATIONS: TuiOperations = {
  createReport: createUiReport,
  socialPreview: getSocialPreview,
  crawl: crawlSite,
  smells: getGeneratedSiteSmells,
  dnsStatus: getDnsStatus,
  searchConsoleStatus: getSearchConsoleStatus,
  recheck,
};

const DEFAULT_TERMINAL_SIZE: TuiRenderSize = { columns: 100, rows: 30 };
const SECTION_IDS = {
  socialPreview: "social-preview",
  searchConsole: "search-console",
} as const;

export async function runTuiCommand(
  input: TuiCommandInput,
  streams: TuiStreams = {
    stdin: process.stdin as ReadStream,
    stdout: process.stdout as WriteStream,
    env: process.env,
  },
  operations: Partial<TuiOperations> = {},
): Promise<number> {
  const { report, checks } = await loadTuiData(input, operations);
  const model = createTuiViewModel(report, checks);

  if (!canEnterInteractiveTui(streams)) {
    streams.stdout.write(formatUiReportHumanReport(report));
    return report.errors.length > 0 ? 1 : 0;
  }

  await runInteractiveTui(model, streams);
  return report.errors.length > 0 ? 1 : 0;
}

export async function loadTuiData(
  input: TuiCommandInput,
  operations: Partial<TuiOperations> = {},
): Promise<{ report: UiReport; checks: TuiOptionalChecks }> {
  const ops = { ...DEFAULT_OPERATIONS, ...operations };
  const report = await ops.createReport({
    url: input.url,
    repoPath: input.repoPath,
    timeoutMs: input.timeoutMs,
    userAgent: input.userAgent,
    render: input.render,
  });
  const include = new Set(input.include);
  const checks = defaultChecks(input.repoPath);
  const mockProfile = input.mockProfile;

  await Promise.all([
    include.has("social-preview")
      ? runCheck("Social preview", async () => ops.socialPreview({
          url: input.url,
          source: "both",
          mock: mockProfile === "demo" ? "complete" : undefined,
          timeoutMs: input.timeoutMs,
          userAgent: input.userAgent,
        })).then((check) => {
          checks.socialPreview = check;
        })
      : undefined,
    include.has("crawl")
      ? runCheck("Bounded crawl", async () => ops.crawl({
          url: input.url,
          rendered: input.render,
          mock: mockProfile === "demo" ? "clean-small-site" : undefined,
          timeoutMs: input.timeoutMs,
          userAgent: input.userAgent,
        })).then((check) => {
          checks.crawl = check;
        })
      : undefined,
    include.has("smells")
      ? input.repoPath
        ? runCheck("Project smells", async () => ops.smells({
            repoPath: input.repoPath as string,
            url: input.url,
            mock: mockProfile === "demo" ? "clean" : undefined,
            timeoutMs: input.timeoutMs,
            userAgent: input.userAgent,
            render: input.render,
          })).then((check) => {
            checks.smells = check;
          })
        : Promise.resolve().then(() => {
            checks.smells = {
              status: "skipped",
              label: "Project smells",
              message: "Not run. Project smells require a local repository path.",
            };
          })
      : undefined,
    include.has("dns")
      ? runCheck("DNS status", async () => ops.dnsStatus({
          url: input.url,
          mock: mockProfile === "demo" ? "ready" : undefined,
        })).then((check) => {
          checks.dns = check;
        })
      : undefined,
    include.has("search-console")
      ? runCheck("Search Console mock status", async () => ops.searchConsoleStatus({
          url: input.url,
          mock: mockProfile === "demo" ? "ready_sitemap_ok" : undefined,
        })).then((check) => {
          checks.searchConsole = check;
        })
      : undefined,
    include.has("recheck")
      ? runCheck("Post-deploy recheck", async () => ops.recheck({
          url: input.url,
          repoPath: input.repoPath,
          timeoutMs: input.timeoutMs,
          userAgent: input.userAgent,
        })).then((check) => {
          checks.recheck = check;
        })
      : undefined,
  ].filter(Boolean));

  return { report, checks };
}

export function createTuiViewModel(report: UiReport, checks: TuiOptionalChecks = defaultChecks(report.input.repoPath)): TuiViewModel {
  const next = report.workflow.availableNextActions.find((action) => action.primary)
    ?? report.workflow.availableNextActions[0];
  const status = report.errors.length > 0
    ? "Unknown"
    : report.readiness.label === "ready"
      ? "Ready"
      : "Needs attention";

  return {
    title: "ShipReady - Terminal Review",
    target: report.input.url,
    repo: report.input.repoPath,
    mode: report.input.mode === "url_and_repo" ? "URL + repo" : "URL only",
    status,
    next: next?.label ?? "Use ui-report --json for structured data.",
    report,
    sections: [
      overviewSection(report, status, next?.label),
      findingsSection(report),
      internetViewSection(report),
      socialPreviewSection(checks.socialPreview),
      crawlSection(checks.crawl),
      smellsSection(checks.smells),
      fixPlanSection(report),
      handoffSection(report),
      safetySection(),
      commandsSection(report),
    ],
  };
}

export function renderTuiScreen(
  model: TuiViewModel,
  state: TuiRenderState,
  size: Partial<TuiRenderSize> = {},
): string {
  const columns = Math.max(40, size.columns ?? DEFAULT_TERMINAL_SIZE.columns);
  const rows = Math.max(12, size.rows ?? DEFAULT_TERMINAL_SIZE.rows);
  const section = model.sections[clamp(state.sectionIndex, 0, model.sections.length - 1)] ?? model.sections[0];
  const header = [
    model.title,
    `Target: ${model.target}`,
    ...(model.repo ? [`Repo: ${model.repo}`] : []),
    `Mode: ${model.mode}`,
    `Status: ${model.status}`,
    `Next: ${model.next}`,
    `Section ${state.sectionIndex + 1}/${model.sections.length}: ${section.label}`,
    "Navigation: q quits | Ctrl+C exits | left/right section | up/down scroll | ? help",
  ];
  const help = state.showHelp
    ? [
        "",
        "Help",
        "- q: quit and restore terminal",
        "- Ctrl+C: quit and restore terminal",
        "- left/right: move between sections",
        "- up/down: scroll current section",
        "- ?: toggle help",
      ]
    : [];
  const body = wrapLines([...section.lines, ...help], columns);
  const maxBodyRows = Math.max(1, rows - header.length - 2);
  const scroll = clamp(state.scroll, 0, Math.max(0, body.length - maxBodyRows));
  const visibleBody = body.slice(scroll, scroll + maxBodyRows);
  const footer = body.length > maxBodyRows
    ? `Showing ${scroll + 1}-${Math.min(scroll + maxBodyRows, body.length)} of ${body.length}`
    : "End";

  return [
    ...wrapLines(header, columns),
    horizontalRule(columns),
    ...visibleBody,
    horizontalRule(columns),
    truncateTuiValue(footer, columns),
  ].join("\n");
}

export function parseTuiInclude(value: string | undefined): TuiIncludeOption[] | Error {
  if (!value) return [];
  const requested = value.split(",").map((item) => item.trim()).filter(Boolean);
  const invalid = requested.filter((item) => !isTuiIncludeOption(item));
  if (invalid.length > 0) {
    return new Error(`Unsupported TUI include value: ${invalid.join(", ")}. Use one or more of: ${TUI_INCLUDE_OPTIONS.join(", ")}.`);
  }
  return Array.from(new Set(requested)) as TuiIncludeOption[];
}

export function parseTuiMockProfile(value: string | undefined): TuiMockProfile | undefined | Error {
  if (!value) return undefined;
  if (value === "demo") return value;
  return new Error("Unsupported TUI mock profile. Use: demo.");
}

export function truncateTuiValue(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 3) return ".".repeat(maxLength);
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function defaultChecks(repoPath?: string): TuiOptionalChecks {
  return {
    socialPreview: notRun("Social preview", "Not run. Use --include social-preview to run the read-only social preview simulator."),
    crawl: notRun("Bounded crawl", "Not run. Use --include crawl to run bounded crawl."),
    smells: repoPath
      ? notRun("Project smells", "Not run. Use --include smells to run heuristic project smell review.")
      : { status: "skipped", label: "Project smells", message: "Not run. Project smells require a local repository path." },
    dns: notRun("DNS status", "Not run. Use --include dns to run read-only DNS evidence."),
    searchConsole: notRun("Search Console mock status", "Not run. Use --include search-console to run mock-backed Search Console status."),
    recheck: notRun("Post-deploy recheck", "Not run. Use --include recheck after an external deployment to read public crawl-file evidence."),
  };
}

function notRun(label: string, message: string): TuiCheck<never> {
  return { status: "not_run", label, message };
}

async function runCheck<T>(label: string, callback: () => Promise<T>): Promise<TuiCheck<T>> {
  try {
    return { status: "ready", label, result: await callback() };
  } catch (error) {
    return {
      status: "error",
      label,
      message: error instanceof Error ? error.message : `${label} failed.`,
    };
  }
}

function overviewSection(report: UiReport, status: string, next: string | undefined): TuiSection {
  return {
    id: "overview",
    label: "Overview",
    lines: [
      `Status: ${status}`,
      `Target: ${report.input.url}`,
      ...(report.input.repoPath ? [`Repo: ${report.input.repoPath}`] : []),
      `Mode: ${report.input.mode === "url_and_repo" ? "URL + repo" : "URL only"}`,
      `Next: ${next ?? "Use ui-report --json for structured data."}`,
      `Completed stages: ${report.workflow.completedStages.join(", ") || "none"}`,
      "",
      report.readiness.title,
      report.readiness.summary,
      "",
      "Decision: Implement minimal TUI now. This viewer is read-only and reuses ui-report-v1 data.",
      "No JSON contract changes are required for the TUI viewer.",
    ],
  };
}

function findingsSection(report: UiReport): TuiSection {
  const issues = report.readiness.topIssues;
  return {
    id: "findings",
    label: "Findings",
    lines: [
      "Top issues",
      ...listIssues(issues, "No top readiness issues in the UI report."),
      "",
      "Passed highlights",
      ...listIssues(report.readiness.passedHighlights.slice(0, 8), "No passed highlights were reported."),
      "",
      "Optional polish",
      ...listIssues(report.readiness.optionalPolish.slice(0, 8), "No optional polish items were reported."),
    ],
  };
}

function internetViewSection(report: UiReport): TuiSection {
  return {
    id: "internet-view",
    label: "Internet view",
    lines: [
      "Google-style preview",
      `- Title: ${formatMaybe(report.previews.google.title)}`,
      `- Description: ${formatMaybe(report.previews.google.description)}`,
      `- URL: ${formatMaybe(report.previews.google.url)}`,
      `- Missing: ${formatList(report.previews.google.missingFields)}`,
      "",
      "Social preview card inputs",
      `- Title: ${formatMaybe(report.previews.social.title)}`,
      `- Description: ${formatMaybe(report.previews.social.description)}`,
      `- Image: ${formatMaybe(report.previews.social.image)}`,
      `- URL: ${formatMaybe(report.previews.social.url)}`,
      `- Missing: ${formatList(report.previews.social.missingFields)}`,
      "",
      "X/Twitter card inputs",
      `- Card: ${formatMaybe(report.previews.twitter.card)}`,
      `- Title: ${formatMaybe(report.previews.twitter.title)}`,
      `- Description: ${formatMaybe(report.previews.twitter.description)}`,
      `- Image: ${formatMaybe(report.previews.twitter.image)}`,
      `- Missing: ${formatList(report.previews.twitter.missingFields)}`,
      "",
      "Crawler view",
      `- Raw: ${report.previews.crawlerView.rawHtmlSummary}`,
      `- Rendered: ${report.previews.crawlerView.renderedHtmlSummary}`,
      ...listIssues(report.previews.crawlerView.renderOnlyWarnings, "No render-only crawler warnings were reported."),
    ],
  };
}

function socialPreviewSection(check: TuiOptionalChecks["socialPreview"]): TuiSection {
  return {
    id: SECTION_IDS.socialPreview,
    label: "Social preview",
    lines: [
      ...checkLines(check, (result) => [
        `Status: ${result.verdict.status}`,
        `Mode: ${result.mode}; source ${result.sourceMode}`,
        `Warnings: ${result.warnings.length}`,
        `Surfaces: ${Object.keys(result.previews).join(", ")}`,
      ]),
      "",
      "Safety",
      "- Social preview: Approximation from observed metadata. Platforms may differ.",
      "- No social platform APIs, screenshots, image generation, deployment, or writes are used.",
    ],
  };
}

function crawlSection(check: TuiOptionalChecks["crawl"]): TuiSection {
  return {
    id: "crawl",
    label: "Crawl",
    lines: [
      ...checkLines(check, (result) => [
        `Status: ${result.summary.status}`,
        `Pages checked: ${result.summary.pagesChecked}`,
        `Pages discovered: ${result.summary.pagesDiscovered}`,
        `Pages skipped: ${result.summary.pagesSkipped}`,
        `Repeated findings: ${result.summary.repeatedIssues}`,
        `Limits: maxPages ${result.options.maxPages}, maxDepth ${result.options.maxDepth}`,
      ]),
      "",
      "Safety",
      "- Crawl: Bounded same-origin sample. Not exhaustive.",
      "- No files, DNS records, Search Console state, social platforms, GitHub, Git, or deployments are changed.",
    ],
  };
}

function smellsSection(check: TuiOptionalChecks["smells"]): TuiSection {
  return {
    id: "project-smells",
    label: "Project smells",
    lines: [
      ...checkLines(check, (result) => [
        `Status: ${result.summary.status}`,
        `Findings: ${result.summary.findingCount}`,
        `Framework: ${result.framework.name} (${result.framework.confidence} confidence)`,
        `Scanned: ${result.scanned.files} files, ${result.scanned.bytes} bytes`,
      ]),
      "",
      "Safety",
      "- Smells: Heuristic implementation signals. Not authorship proof.",
      "- Read-only. No fixes, Git/GitHub, deploy, DNS, Search Console, social platform, OAuth, or token behavior is used.",
    ],
  };
}

function fixPlanSection(report: UiReport): TuiSection {
  const groups = report.actionGroups;
  return {
    id: "fix-plan",
    label: "Fix plan",
    lines: [
      "Safe/create",
      ...listActions(groups?.safeToApply ?? [], "No V1-safe crawl-file creations are available in this report."),
      "",
      "Review-only items",
      ...listActions(groups?.needsReview ?? [], "No review-only patch preview items were reported."),
      "",
      "Manual items",
      ...listActions(groups?.manualOnly ?? [], "No manual-only items were reported."),
      "",
      "Live state",
      `- ${report.liveVsLocal.message}`,
    ],
  };
}

function handoffSection(report: UiReport): TuiSection {
  return {
    id: "handoff",
    label: "Handoff",
    lines: [
      "Safe/create options",
      `- Safe apply available: ${report.safeApply?.available ? "yes" : "no"}`,
      `- Eligible files: ${formatList(report.safeApply?.eligibleFiles ?? [])}`,
      `- Policy: ${report.safeApply?.policy ?? "creation_only_robots_sitemap_v1"}`,
      "",
      "Review-only handoffs",
      "- Patch export: Review-only. Not applied. Target repo not modified.",
      "- GitHub PR draft: Draft only. No PR created. No Git or GitHub command executed.",
      "",
      "Next command",
      `- ${nextCommand(report)}`,
    ],
  };
}

function safetySection(): TuiSection {
  return {
    id: "safety",
    label: "Safety",
    lines: [
      "- TUI viewer: Read-only. No files are written and no GUI server is started.",
      "- Patch export: Review-only. Not applied. Target repo not modified.",
      "- GitHub PR draft: Draft only. No PR created. No Git or GitHub command executed.",
      "- Safe write: Only eligible missing robots/sitemap files can be created under WRITE_POLICY_V1.",
      "- Social preview: Approximation from observed metadata. Platforms may differ.",
      "- Crawl: Bounded same-origin sample. Not exhaustive.",
      "- Smells: Heuristic implementation signals. Not authorship proof.",
      "- Search Console: Mock-backed only. No live Google API or OAuth.",
      "- DNS: Read-only DNS evidence. No provider writes.",
      "- Distribution: Repository-local v0. Use pnpm --dir from outside the checkout.",
      "- Out of scope: deploys, Git/GitHub execution, live PR creation, DNS writes, live Search Console, social platform APIs, telemetry, auth/accounts/billing, remote MCP, and broader WRITE_POLICY_V1 behavior.",
    ],
  };
}

function commandsSection(report: UiReport): TuiSection {
  const target = formatCommandArg(report.input.url);
  const repo = report.input.repoPath ? formatCommandArg(report.input.repoPath) : undefined;
  return {
    id: "commands",
    label: "Commands",
    lines: [
      "Source-checkout usage",
      "- cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready status",
      "- pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready status",
      "",
      "Review commands",
      `- pnpm shipready ui-report ${repo ? `${repo} ` : ""}--url ${target}`,
      `- pnpm shipready tui ${repo ? `${repo} ` : ""}--url ${target}`,
      `- pnpm shipready social-preview --url ${target} --json`,
      `- pnpm shipready crawl --url ${target} --json`,
      ...(repo ? [`- pnpm shipready smells ${repo} --url ${target} --json`] : []),
      ...(repo ? [`- pnpm shipready patch-export ${repo} --url ${target} --stdout`] : []),
      ...(repo ? [`- pnpm shipready github-pr-draft ${repo} --url ${target} --stdout`] : []),
      "",
      "Distribution boundary",
      "- Installed npm usage, standalone binaries, hosted app behavior, and remote MCP are not supported until a publish execution pass verifies them.",
    ],
  };
}

function checkLines<T>(check: TuiCheck<T> | undefined, readyLines: (result: T) => string[]): string[] {
  if (!check) return ["Not run."];
  if (check.status === "ready") return readyLines(check.result);
  if (check.status === "error") return [`Error: ${check.message}`];
  return [check.message];
}

function listIssues(issues: UiIssue[], empty: string): string[] {
  if (issues.length === 0) return [`- ${empty}`];
  return issues.map((issue) => `- ${issue.userSeverity}: ${issue.title}`);
}

function listActions(actions: UiFixAction[], empty: string): string[] {
  if (actions.length === 0) return [`- ${empty}`];
  return actions.slice(0, 8).map((action) => {
    const target = action.targetLabel ? ` (${action.targetLabel})` : "";
    const review = action.reviewReason ? ` - ${action.reviewReason}` : "";
    return `- ${action.safety}: ${action.title}${target}${review}`;
  });
}

function nextCommand(report: UiReport): string {
  if (!report.input.repoPath) {
    return `pnpm shipready ui-report --url ${formatCommandArg(report.input.url)}`;
  }
  if (report.safeApply?.available) {
    return `pnpm shipready fix ${formatCommandArg(report.input.repoPath)} --url ${formatCommandArg(report.input.url)} --dry-run`;
  }
  return `pnpm shipready ui-report ${formatCommandArg(report.input.repoPath)} --url ${formatCommandArg(report.input.url)}`;
}

function formatMaybe(value: string | undefined): string {
  return value ? truncateTuiValue(value) : "missing";
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
  return `'${value.split("'").join("'\\''")}'`;
}

function canEnterInteractiveTui(streams: TuiStreams): boolean {
  return Boolean(streams.stdin.isTTY && streams.stdout.isTTY && streams.env.CI !== "true");
}

function runInteractiveTui(model: TuiViewModel, streams: TuiStreams): Promise<void> {
  return new Promise((resolve) => {
    const state: TuiRenderState = { sectionIndex: 0, scroll: 0, showHelp: false };
    const stdin = streams.stdin;
    const stdout = streams.stdout;
    const hadRawMode = Boolean(stdin.isRaw);
    let cleaned = false;

    emitKeypressEvents(stdin);
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdout.write("\x1b[?25l");

    const render = () => {
      const size = {
        columns: stdout.columns ?? DEFAULT_TERMINAL_SIZE.columns,
        rows: stdout.rows ?? DEFAULT_TERMINAL_SIZE.rows,
      };
      stdout.write(`\x1b[2J\x1b[H${renderTuiScreen(model, state, size)}`);
    };

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stdin.off("keypress", onKeypress);
      process.off("SIGINT", cleanup);
      if (stdin.setRawMode) stdin.setRawMode(hadRawMode);
      stdout.write("\x1b[?25h\x1b[0m\x1b[2J\x1b[H");
      resolve();
    };

    const onKeypress = (_input: string, key: { name?: string; ctrl?: boolean }) => {
      if ((key.ctrl && key.name === "c") || key.name === "q") {
        cleanup();
        return;
      }
      if (key.name === "right") {
        state.sectionIndex = (state.sectionIndex + 1) % model.sections.length;
        state.scroll = 0;
        render();
        return;
      }
      if (key.name === "left") {
        state.sectionIndex = (state.sectionIndex + model.sections.length - 1) % model.sections.length;
        state.scroll = 0;
        render();
        return;
      }
      if (key.name === "down") {
        state.scroll += 1;
        render();
        return;
      }
      if (key.name === "up") {
        state.scroll = Math.max(0, state.scroll - 1);
        render();
        return;
      }
      if (key.name === "?") {
        state.showHelp = !state.showHelp;
        render();
      }
    };

    stdin.on("keypress", onKeypress);
    process.once("SIGINT", cleanup);
    render();
  });
}

function wrapLines(lines: string[], columns: number): string[] {
  return lines.flatMap((line) => wrapLine(line, columns));
}

function wrapLine(line: string, columns: number): string[] {
  if (line.length <= columns) return [line];
  const indent = /^\s*- /.test(line) ? "  " : "";
  const words = line.split(/\s+/);
  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > columns) {
      if (current) {
        wrapped.push(current);
        current = indent;
      }
      wrapped.push(truncateTuiValue(word, columns));
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > columns) {
      wrapped.push(current);
      current = indent ? `${indent}${word}` : word;
    } else {
      current = candidate;
    }
  }

  if (current) wrapped.push(current);
  return wrapped.length > 0 ? wrapped : [""];
}

function horizontalRule(columns: number): string {
  return "-".repeat(Math.min(columns, 120));
}

function isTuiIncludeOption(value: string): value is TuiIncludeOption {
  return (TUI_INCLUDE_OPTIONS as readonly string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
