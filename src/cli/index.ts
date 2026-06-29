#!/usr/bin/env node
import { Command } from "commander";
import { auditUrl } from "../audit/auditUrl";
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
import { SHIPREADY_VERSION } from "../version";

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

program
  .command("mcp")
  .description("Start the local ShipReady MCP stdio server (eight read-only tools, one guarded V1 write tool).")
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

type SearchConsoleStatusCommandOptions = {
  url: string;
  mock?: string;
  provider?: string;
  inspect?: boolean;
  json?: boolean;
};

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
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
