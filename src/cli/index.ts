#!/usr/bin/env node
import { Command } from "commander";
import { z } from "zod";
import { auditUrl } from "../audit/auditUrl";
import { crawlSite } from "../crawl/crawl";
import { CrawlError } from "../crawl/crawlTypes";
import { dryRunFix } from "../fix/dryRunFix";
import { writeFix, WriteFixExecutionError, WriteFixValidationError } from "../fix/writeFix";
import { startGuiServer } from "../gui/startGuiServer";
import { planFixes } from "../plan/planFixes";
import { inspectRepo } from "../repo/inspectRepo";
import { formatDryRunFixHumanReport } from "../report/formatDryRunFixHumanReport";
import { formatDryRunFixJsonReport } from "../report/formatDryRunFixJsonReport";
import { formatCliErrorJson } from "../report/formatCliErrorJson";
import { formatFixPlanHumanReport } from "../report/formatFixPlanHumanReport";
import { formatFixPlanJsonReport } from "../report/formatFixPlanJsonReport";
import { formatHumanReport } from "../report/formatHumanReport";
import { formatJsonReport } from "../report/formatJsonReport";
import { formatRepoInspectionHumanReport } from "../report/formatRepoInspectionHumanReport";
import { formatRepoInspectionJsonReport } from "../report/formatRepoInspectionJsonReport";
import { formatUiReportJsonReport } from "../report/formatUiReportJsonReport";
import { formatWriteFixHumanReport } from "../report/formatWriteFixHumanReport";
import { formatWriteFixJsonReport } from "../report/formatWriteFixJsonReport";
import { writeHtmlReport } from "../report/writeHtmlReport";
import { createUiReport } from "../ui/createUiReport";
import type { CliErrorCode } from "../types/contracts";
import { resolveAllowedRoots } from "../mcp/config";
import { startMcpServer } from "../mcp/server";
import { createStatus, formatStatusHuman, formatStatusJson } from "../status/status";
import { formatDoctorHuman, formatDoctorJson, runDoctor } from "../doctor/doctor";
import { SearchConsoleStatusError } from "../searchConsole/searchConsoleErrors";
import {
  formatSearchConsoleStatusHuman,
  formatSearchConsoleStatusJson,
  getSearchConsoleStatus,
} from "../searchConsole/searchConsoleStatus";
import { DnsStatusError } from "../dns/dnsErrors";
import {
  formatDnsStatusHuman,
  formatDnsStatusJson,
  getDnsStatus,
} from "../dns/dnsStatus";
import { SHIPREADY_VERSION } from "../version";
import { recheck } from "../recheck/recheck";
import { formatRecheckHuman, formatRecheckJson } from "../report/formatRecheckReport";
import {
  classifySocialPreviewError,
  getSocialPreview,
} from "../socialPreview/socialPreview";
import {
  formatSocialPreviewHuman,
  formatSocialPreviewJson,
} from "../report/formatSocialPreviewReport";
import {
  classifyGeneratedSiteSmellsError,
  getGeneratedSiteSmells,
} from "../smells/generatedSiteSmells";
import {
  formatGeneratedSiteSmellsHuman,
  formatGeneratedSiteSmellsJson,
} from "../report/formatGeneratedSiteSmellsReport";
import { formatCrawlHuman, formatCrawlJson } from "../report/formatCrawlReport";

const program = new Command();

program
  .name("shipready")
  .description("Production-readiness hygiene checks for generated websites.")
  .version(SHIPREADY_VERSION);

program
  .command("status")
  .description("Show the current ShipReady capabilities and safety posture.")
  .option("--json", "Output structured JSON")
  .action((options: StatusCommandOptions) => {
    const status = createStatus();
    process.stdout.write(options.json ? formatStatusJson(status) : formatStatusHuman(status));
  });

program
  .command("doctor")
  .description("Check local ShipReady runtime readiness without network access or writes.")
  .option("--json", "Output structured JSON")
  .action(async (options: DoctorCommandOptions) => {
    const report = await runDoctor();
    process.stdout.write(options.json ? formatDoctorJson(report) : formatDoctorHuman(report));
    if (!report.ok) process.exitCode = 1;
  });

program
  .command("crawl")
  .description("Run a read-only bounded same-origin launch-readiness crawl.")
  .requiredOption("--url <url>", "Public HTTP(S) URL to start from")
  .option("--json", "Output structured JSON")
  .option("--max-pages <n>", "Maximum pages to audit, capped at 25")
  .option("--max-depth <n>", "Maximum link depth to discover, capped at 2")
  .option("--source <source>", "Discovery source: sitemap, links, or both", "both")
  .option("--no-render", "Skip the Playwright rendered pass for page audits")
  .option("--mock <scenario>", "Deterministic mock scenario")
  .option("--timeout <ms>", "Network and render timeout in milliseconds per page read", "15000")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (options: CrawlCommandOptions) => {
    const timeoutMs = Number(options.timeout);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeTypedCommandError(
        "crawl",
        "invalid_timeout",
        "Invalid timeout. Provide a positive number of milliseconds.",
        options.json,
        1,
      );
      return;
    }

    const maxPages = parsePositiveIntegerOption(options.maxPages, "max-pages");
    if (maxPages instanceof Error) {
      writeTypedCommandError("crawl", "invalid_mode", maxPages.message, options.json, 1);
      return;
    }
    const maxDepth = parseNonnegativeIntegerOption(options.maxDepth, "max-depth");
    if (maxDepth instanceof Error) {
      writeTypedCommandError("crawl", "invalid_mode", maxDepth.message, options.json, 1);
      return;
    }

    try {
      const result = await crawlSite({
        url: options.url,
        maxPages,
        maxDepth,
        source: options.source,
        rendered: options.render,
        mock: options.mock,
        timeoutMs,
        userAgent: options.userAgent,
      });
      process.stdout.write(options.json ? formatCrawlJson(result) : formatCrawlHuman(result));
    } catch (error) {
      const code = error instanceof CrawlError
        ? error.code
        : classifyCommandError(error instanceof Error ? error.message : "");
      const message = error instanceof Error && code !== "internal_error"
        ? error.message
        : "ShipReady bounded crawl could not complete.";
      writeTypedCommandError(
        "crawl",
        code,
        message,
        options.json,
        code === "invalid_url" || code === "invalid_mode" || code === "invalid_timeout" ? 1 : 2,
      );
    }
  });

program
  .command("recheck")
  .description("Compare live crawl-file evidence with optional local expected files; never deploys or writes.")
  .argument("[path]", "Optional local repository path for a repo-backed comparison")
  .requiredOption("--url <url>", "Public HTTP(S) URL to recheck")
  .option("--json", "Output structured JSON")
  .option("--timeout <ms>", "Network timeout in milliseconds", "15000")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (path: string | undefined, options: RecheckCommandOptions) => {
    const timeoutMs = Number(options.timeout);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeCommandError("recheck", "Invalid timeout. Provide a positive number of milliseconds.", options.json, 1);
      return;
    }

    try {
      const result = await recheck({
        url: options.url,
        repoPath: path,
        timeoutMs,
        userAgent: options.userAgent,
      });
      process.stdout.write(options.json ? formatRecheckJson(result) : formatRecheckHuman(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected recheck failure.";
      const code = classifyCommandError(message);
      if (code === "invalid_url") {
        writeTypedCommandError("recheck", code, message, options.json, 1);
      } else if (code === "invalid_repo_path") {
        writeTypedCommandError(
          "recheck",
          code,
          "Repository path must be an existing accessible directory.",
          options.json,
          1,
        );
      } else if (error instanceof z.ZodError) {
        writeTypedCommandError(
          "recheck",
          "contract_error",
          "ShipReady produced data that did not match its published recheck contract.",
          options.json,
          2,
        );
      } else {
        writeTypedCommandError(
          "recheck",
          "internal_error",
          "ShipReady recheck could not complete.",
          options.json,
          2,
        );
      }
    }
  });

program
  .command("social-preview")
  .description("Simulate likely search and social preview inputs from observed page metadata; read-only approximation.")
  .requiredOption("--url <url>", "Public HTTP(S) URL to simulate")
  .option("--json", "Output structured JSON")
  .option("--source <source>", "Metadata source to use: raw, rendered, or both", "both")
  .option("--check-assets", "Request image asset reachability status when safe")
  .option("--mock <scenario>", "Deterministic mock scenario")
  .option("--timeout <ms>", "Network and render timeout in milliseconds", "15000")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (options: SocialPreviewCommandOptions) => {
    const timeoutMs = Number(options.timeout);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeTypedCommandError(
        "social-preview",
        "invalid_timeout",
        "Invalid timeout. Provide a positive number of milliseconds.",
        options.json,
        1,
      );
      return;
    }

    try {
      const result = await getSocialPreview({
        url: options.url,
        source: options.source,
        checkAssets: options.checkAssets,
        mock: options.mock,
        timeoutMs,
        userAgent: options.userAgent,
      });
      process.stdout.write(options.json ? formatSocialPreviewJson(result) : formatSocialPreviewHuman(result));
    } catch (error) {
      const code = classifySocialPreviewError(error);
      const message = error instanceof Error && code !== "internal_error"
        ? error.message
        : "ShipReady social preview simulation could not complete.";
      writeTypedCommandError(
        "social-preview",
        code,
        message,
        options.json,
        code === "invalid_url" || code === "invalid_mode" || code === "invalid_timeout" ? 1 : 2,
      );
    }
  });

program
  .command("smells")
  .description("Detect read-only generated-site implementation smells in a local repository.")
  .argument("<path>", "Local repository path to scan")
  .option("--url <url>", "Optional public HTTP(S) URL for raw/rendered cross-check evidence")
  .option("--json", "Output structured JSON")
  .option("--mock <scenario>", "Deterministic mock scenario")
  .option("--max-files <n>", "Maximum text/config files to scan")
  .option("--max-bytes <n>", "Maximum text/config bytes to read")
  .option("--timeout <ms>", "Network and render timeout in milliseconds when --url is used", "15000")
  .option("--no-render", "Skip the Playwright rendered pass when --url is used")
  .option("--user-agent <ua>", "Override the default user agent when --url is used")
  .action(async (path: string, options: GeneratedSiteSmellsCommandOptions) => {
    const timeoutMs = Number(options.timeout);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeTypedCommandError(
        "smells",
        "invalid_timeout",
        "Invalid timeout. Provide a positive number of milliseconds.",
        options.json,
        1,
      );
      return;
    }

    const maxFiles = parsePositiveIntegerOption(options.maxFiles, "max-files");
    if (maxFiles instanceof Error) {
      writeTypedCommandError("smells", "invalid_mode", maxFiles.message, options.json, 1);
      return;
    }
    const maxBytes = parsePositiveIntegerOption(options.maxBytes, "max-bytes");
    if (maxBytes instanceof Error) {
      writeTypedCommandError("smells", "invalid_mode", maxBytes.message, options.json, 1);
      return;
    }

    try {
      const result = await getGeneratedSiteSmells({
        repoPath: path,
        url: options.url,
        mock: options.mock,
        maxFiles,
        maxBytes,
        timeoutMs,
        userAgent: options.userAgent,
        render: options.render,
      });
      process.stdout.write(
        options.json
          ? formatGeneratedSiteSmellsJson(result)
          : formatGeneratedSiteSmellsHuman(result),
      );
    } catch (error) {
      const code = classifyGeneratedSiteSmellsError(error);
      const message = error instanceof Error && code !== "internal_error"
        ? error.message
        : "ShipReady generated-site smell detection could not complete.";
      writeTypedCommandError(
        "smells",
        code,
        message,
        options.json,
        code === "invalid_url" || code === "invalid_repo_path" || code === "invalid_mode" || code === "invalid_timeout" ? 1 : 2,
      );
    }
  });

const searchConsole = program
  .command("search-console")
  .description("Read mock-backed Search Console status without Google API access or writes.");

searchConsole
  .command("status")
  .description("Show deterministic read-only Search Console prototype status.")
  .requiredOption("--url <url>", "Public HTTP(S) URL represented by the mock status")
  .option("--mock <scenario>", "Deterministic mock scenario")
  .option("--provider <provider>", "Provider selection; only mock is available")
  .option("--inspect", "Include one mock indexed-version URL inspection when the scenario supports it")
  .option("--json", "Output structured JSON")
  .action(async (options: SearchConsoleStatusCommandOptions) => {
    if (options.provider && options.provider !== "mock") {
      writeTypedCommandError(
        "search-console status",
        "invalid_mode",
        `Unsupported Search Console provider: ${options.provider}. Only mock is available in Pass 9.`,
        options.json,
        1,
      );
      return;
    }

    try {
      const status = await getSearchConsoleStatus({
        url: options.url,
        mock: options.mock,
        inspect: options.inspect,
      });
      process.stdout.write(
        options.json
          ? formatSearchConsoleStatusJson(status)
          : formatSearchConsoleStatusHuman(status),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected Search Console prototype failure.";
      const code = error instanceof SearchConsoleStatusError
        ? error.code
        : classifyCommandError(message);
      writeTypedCommandError("search-console status", code, message, options.json, code === "invalid_url" || code === "invalid_mode" ? 1 : 2);
    }
  });

const dns = program
  .command("dns")
  .description("Read DNS readiness evidence without provider credentials or DNS writes.");

dns
  .command("status")
  .description("Show read-only DNS readiness for one HTTP(S) URL.")
  .requiredOption("--url <url>", "Public HTTP(S) URL whose host should be checked")
  .option("--expected-canonical-host <host>", "Expected final HTTP canonical host")
  .option("--expected-www-mode <mode>", "Interpret readiness for apex, www, or either")
  .option("--expected-search-console-txt <token>", "Expected Search Console DNS TXT verification token")
  .option("--check-http", "Also read the URL to observe the final canonical host")
  .option("--mock <scenario>", "Deterministic mock DNS scenario")
  .option("--json", "Output structured JSON")
  .action(async (options: DnsStatusCommandOptions) => {
    try {
      const status = await getDnsStatus({
        url: options.url,
        expectedCanonicalHost: options.expectedCanonicalHost,
        expectedWwwMode: options.expectedWwwMode,
        expectedSearchConsoleTxt: options.expectedSearchConsoleTxt,
        checkHttp: options.checkHttp,
        mock: options.mock,
      });
      process.stdout.write(options.json ? formatDnsStatusJson(status) : formatDnsStatusHuman(status));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected DNS status failure.";
      const code = error instanceof DnsStatusError
        ? error.code
        : classifyCommandError(message);
      writeTypedCommandError(
        "dns status",
        code,
        message,
        options.json,
        code === "invalid_url" || code === "invalid_mode" ? 1 : 2,
      );
    }
  });

program
  .command("mcp")
  .description("Start the local ShipReady MCP stdio server (thirteen read-only tools, one guarded V1 write tool).")
  .option(
    "--allow-root <absolute-path>",
    "Authorize one repository root (repeatable)",
    collectOption,
    [],
  )
  .action(async (options: McpCommandOptions) => {
    try {
      await startMcpServer({
        allowRoots: resolveAllowedRoots(options.allowRoot),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ShipReady MCP startup failed.";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("audit")
  .argument("<url>", "Public page URL to audit")
  .option("--json", "Output structured JSON")
  .option("--timeout <ms>", "Network and render timeout in milliseconds", "15000")
  .option("--no-render", "Skip the Playwright rendered pass")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (url: string, options: AuditCommandOptions) => {
    const timeoutMs = Number(options.timeout);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeCommandError("audit", "Invalid timeout. Provide a positive number of milliseconds.", options.json, 1);
      return;
    }

    try {
      const result = await auditUrl(url, {
        timeoutMs,
        userAgent: options.userAgent,
        render: options.render,
      });
      process.stdout.write(options.json ? formatJsonReport(result) : formatHumanReport(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected audit failure.";
      writeCommandError("audit", message, options.json, isInputError(message) ? 1 : 2);
    }
  });

program
  .command("fix")
  .argument("<path>", "Local repository path to inspect")
  .requiredOption("--url <url>", "Public page URL to audit and plan against")
  .option("--dry-run", "Preview proposed changes without writing files")
  .option("--write", "Create eligible missing robots/sitemap files")
  .option("--allow-create", "Allow creation-only write mode for eligible missing robots/sitemap files")
  .option("--json", "Output structured JSON")
  .option("--timeout <ms>", "Network and render timeout in milliseconds", "15000")
  .option("--no-render", "Skip the Playwright rendered pass")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (path: string, options: FixCommandOptions) => {
    if (options.write && options.dryRun) {
      writeModeError("ShipReady fix modes conflict. Use either --dry-run or --write, not both.", options.json);
      return;
    }

    if (options.write && !options.allowCreate) {
      writeModeError(
        "ShipReady write mode is currently creation-only. Re-run with --write --allow-create to create eligible missing robots/sitemap files.",
        options.json,
      );
      return;
    }

    if (!options.write && !options.dryRun) {
      writeModeError(
        "ShipReady fix requires an explicit mode. Re-run with --dry-run to preview proposed changes or --write --allow-create to create eligible missing robots/sitemap files.",
        options.json,
      );
      process.exitCode = 1;
      return;
    }

    const timeoutMs = Number(options.timeout);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeCommandError("fix", "Invalid timeout. Provide a positive number of milliseconds.", options.json, 1);
      return;
    }

    try {
      const runOptions = {
        timeoutMs,
        userAgent: options.userAgent,
        render: options.render,
      };

      if (options.write) {
        const result = await writeFix(path, options.url, runOptions);
        process.stdout.write(options.json ? formatWriteFixJsonReport(result) : formatWriteFixHumanReport(result));
        return;
      }

      const result = await dryRunFix(path, options.url, runOptions);
      process.stdout.write(options.json ? formatDryRunFixJsonReport(result) : formatDryRunFixHumanReport(result));
    } catch (error) {
      if (error instanceof WriteFixValidationError || error instanceof WriteFixExecutionError) {
        writeWriteFixError(error, options.json);
        return;
      }

      const message = error instanceof Error ? error.message : "Unexpected dry-run fix failure.";
      writeCommandError("fix", message, options.json, isInputError(message) ? 1 : 2);
    }
  });

program
  .command("plan-fixes")
  .argument("<path>", "Local repository path to inspect")
  .requiredOption("--url <url>", "Public page URL to audit and plan against")
  .option("--json", "Output structured JSON")
  .option("--timeout <ms>", "Network and render timeout in milliseconds", "15000")
  .option("--no-render", "Skip the Playwright rendered pass")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (path: string, options: PlanFixesCommandOptions) => {
    const timeoutMs = Number(options.timeout);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeCommandError("plan-fixes", "Invalid timeout. Provide a positive number of milliseconds.", options.json, 1);
      return;
    }

    try {
      const result = await planFixes(path, options.url, {
        timeoutMs,
        userAgent: options.userAgent,
        render: options.render,
      });
      process.stdout.write(
        options.json ? formatFixPlanJsonReport(result) : formatFixPlanHumanReport(result),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected fix planning failure.";
      writeCommandError("plan-fixes", message, options.json, isInputError(message) ? 1 : 2);
    }
  });

program
  .command("inspect-repo")
  .argument("<path>", "Local repository path to inspect")
  .option("--json", "Output structured JSON")
  .action((path: string, options: InspectRepoCommandOptions) => {
    try {
      const result = inspectRepo(path);
      process.stdout.write(
        options.json
          ? formatRepoInspectionJsonReport(result)
          : formatRepoInspectionHumanReport(result),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected repo inspection failure.";
      writeCommandError("inspect-repo", message, options.json, isInputError(message) ? 1 : 2);
    }
  });

program
  .command("ui-report")
  .argument("[path]", "Optional local repository path to inspect")
  .requiredOption("--url <url>", "Public page URL to audit and normalize for the UI")
  .option("--json", "Output structured JSON")
  .option("--timeout <ms>", "Network and render timeout in milliseconds", "15000")
  .option("--no-render", "Skip the Playwright rendered pass")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (path: string | undefined, options: UiReportCommandOptions) => {
    const timeoutMs = Number(options.timeout);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeCommandError("ui-report", "Invalid timeout. Provide a positive number of milliseconds.", options.json, 1);
      return;
    }

    try {
      const result = await createUiReport({
        url: options.url,
        repoPath: path,
        timeoutMs,
        userAgent: options.userAgent,
        render: options.render,
      });

      if (options.json) {
        process.stdout.write(formatUiReportJsonReport(result));
      } else {
        process.stdout.write("ShipReady UI report generated. Use --json for structured GUI data.\n");
      }

      if (result.errors.length > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected UI report failure.";
      writeCommandError("ui-report", message, options.json, isInputError(message) ? 1 : 2);
    }
  });

program
  .command("gui")
  .description("Start the local ShipReady UI.")
  .option("--host <host>", "Host address to bind", "127.0.0.1")
  .option("--port <port>", "Port to listen on", "4317")
  .action(async (options: GuiCommandOptions) => {
    const port = Number(options.port);

    if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
      writeCommandError("gui", "Invalid port. Provide a number between 1 and 65535.", false, 1);
      return;
    }

    try {
      const runningServer = await startGuiServer({
        host: options.host,
        port,
      });
      process.stdout.write(`ShipReady local UI running at ${runningServer.url}\n`);
      await new Promise<void>(() => {
        // Keep the local UI process alive until the user stops it.
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected GUI server failure.";
      writeCommandError("gui", message, false, 1);
    }
  });

program
  .command("html-report")
  .argument("[path]", "Optional local repository path to inspect")
  .requiredOption("--url <url>", "Public page URL to audit and render into a static HTML report")
  .option("--output <file>", "Target self-contained HTML report file")
  .option("--timeout <ms>", "Network and render timeout in milliseconds", "15000")
  .option("--no-render", "Skip the Playwright rendered pass")
  .option("--user-agent <ua>", "Override the default user agent")
  .action(async (path: string | undefined, options: HtmlReportCommandOptions) => {
    if (!options.output) {
      writeCommandError("html-report", "Missing --output. Provide a target HTML file path.", false, 1);
      return;
    }

    const timeoutMs = Number(options.timeout);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      writeCommandError("html-report", "Invalid timeout. Provide a positive number of milliseconds.", false, 1);
      return;
    }

    try {
      const result = await createUiReport({
        url: options.url,
        repoPath: path,
        timeoutMs,
        userAgent: options.userAgent,
        render: options.render,
      });
      const outputPath = await writeHtmlReport(result, options.output);
      process.stdout.write(`ShipReady HTML report written to ${outputPath}\n`);

      if (result.errors.length > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected HTML report failure.";
      writeCommandError("html-report", message, false, isInputError(message) ? 1 : 2);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected internal error.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 5;
});

type AuditCommandOptions = {
  json?: boolean;
  timeout: string;
  render: boolean;
  userAgent?: string;
};

type McpCommandOptions = {
  allowRoot: string[];
};

type StatusCommandOptions = {
  json?: boolean;
};

type DoctorCommandOptions = {
  json?: boolean;
};

type CrawlCommandOptions = {
  url: string;
  json?: boolean;
  maxPages?: string;
  maxDepth?: string;
  source?: string;
  render: boolean;
  mock?: string;
  timeout: string;
  userAgent?: string;
};

type RecheckCommandOptions = {
  url: string;
  json?: boolean;
  timeout: string;
  userAgent?: string;
};

type SocialPreviewCommandOptions = {
  url: string;
  json?: boolean;
  source?: string;
  checkAssets?: boolean;
  mock?: string;
  timeout: string;
  userAgent?: string;
};

type GeneratedSiteSmellsCommandOptions = {
  url?: string;
  json?: boolean;
  mock?: string;
  maxFiles?: string;
  maxBytes?: string;
  timeout: string;
  render: boolean;
  userAgent?: string;
};

type SearchConsoleStatusCommandOptions = {
  url: string;
  mock?: string;
  provider?: string;
  inspect?: boolean;
  json?: boolean;
};

type DnsStatusCommandOptions = {
  url: string;
  expectedCanonicalHost?: string;
  expectedWwwMode?: string;
  expectedSearchConsoleTxt?: string;
  checkHttp?: boolean;
  mock?: string;
  json?: boolean;
};

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveIntegerOption(value: string | undefined, name: string): number | undefined | Error {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return new Error(`Invalid ${name}. Provide a positive integer.`);
  }
  return parsed;
}

function parseNonnegativeIntegerOption(value: string | undefined, name: string): number | undefined | Error {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return new Error(`Invalid ${name}. Provide a non-negative integer.`);
  }
  return parsed;
}

type InspectRepoCommandOptions = {
  json?: boolean;
};

type PlanFixesCommandOptions = {
  url: string;
  json?: boolean;
  timeout: string;
  render: boolean;
  userAgent?: string;
};

type FixCommandOptions = {
  url: string;
  dryRun?: boolean;
  write?: boolean;
  allowCreate?: boolean;
  json?: boolean;
  timeout: string;
  render: boolean;
  userAgent?: string;
};

type UiReportCommandOptions = {
  url: string;
  json?: boolean;
  timeout: string;
  render: boolean;
  userAgent?: string;
};

type GuiCommandOptions = {
  host: string;
  port: string;
};

type HtmlReportCommandOptions = {
  url: string;
  output?: string;
  timeout: string;
  render: boolean;
  userAgent?: string;
};

function writeCommandError(
  command: string,
  message: string,
  asJson: boolean | undefined,
  exitCode: number,
): void {
  if (asJson) {
    process.stdout.write(formatCliErrorJson({
      code: classifyCommandError(message),
      message,
    }));
  } else {
    process.stderr.write(`ShipReady ${command} failed: ${message}\n`);
  }

  process.exitCode = exitCode;
}

function writeTypedCommandError(
  command: string,
  code: CliErrorCode,
  message: string,
  asJson: boolean | undefined,
  exitCode: number,
): void {
  if (asJson) {
    process.stdout.write(formatCliErrorJson({ code, message }));
  } else {
    process.stderr.write(`ShipReady ${command} failed: ${message}\n`);
  }
  process.exitCode = exitCode;
}

function writeModeError(message: string, asJson: boolean | undefined): void {
  if (asJson) {
    process.stdout.write(formatCliErrorJson({ code: "invalid_mode", message }));
  } else {
    process.stderr.write(`${message}\n`);
  }

  process.exitCode = 1;
}

function writeWriteFixError(
  error: WriteFixValidationError | WriteFixExecutionError,
  asJson: boolean | undefined,
): void {
  if (asJson) {
    process.stdout.write(formatCliErrorJson({
      code: error instanceof WriteFixValidationError
        ? "write_validation_failed"
        : "write_execution_failed",
      message: error.message,
      result: error.result,
    }));
  } else {
    process.stderr.write(formatWriteFixHumanReport(error.result));
  }

  process.exitCode = error instanceof WriteFixValidationError ? 1 : 2;
}

function classifyCommandError(message: string): CliErrorCode {
  if (message.startsWith("Invalid URL")) return "invalid_url";
  if (message.startsWith("Invalid timeout")) return "invalid_timeout";
  if (message.startsWith("Repository path")) return "invalid_repo_path";
  return "command_failed";
}

function isInputError(message: string): boolean {
  return (
    message.startsWith("Invalid URL") ||
    message.startsWith("Invalid timeout") ||
    message.startsWith("Repository path")
  );
}
