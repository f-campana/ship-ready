import { createUiReport, type CreateUiReportInput } from "../ui/createUiReport";
import type { UiError, UiReport } from "../types/uiReport";

export type GuiReportCreator = (input: CreateUiReportInput) => Promise<UiReport>;

export type GuiApiOptions = {
  createReport?: GuiReportCreator;
  timeoutMs?: number;
  render?: boolean;
  userAgent?: string;
};

export type GuiApiResult = {
  statusCode: number;
  body:
    | {
        ok: true;
        report: UiReport;
      }
    | {
        ok: false;
        error: {
          message: string;
          stage: string;
          details?: unknown;
        };
      };
};

const DEFAULT_TIMEOUT_MS = 15_000;

export async function createUiReportApiResult(
  payload: unknown,
  options: GuiApiOptions = {},
): Promise<GuiApiResult> {
  if (!isRecord(payload)) {
    return apiError("Request body must be a JSON object.", "parse", 400);
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const repoPath = typeof payload.repoPath === "string" ? payload.repoPath.trim() : "";

  if (!url) {
    return apiError("Enter a website URL before running the check.", "audit", 400);
  }

  try {
    const report = await (options.createReport ?? createUiReport)({
      url,
      repoPath: repoPath || undefined,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      render: options.render ?? true,
      userAgent: options.userAgent,
    });
    const firstError = report.errors[0];

    if (firstError) {
      return apiError(
        firstError.message,
        firstError.stage,
        statusCodeForUiError(firstError),
        firstError.developerDetails,
      );
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        report,
      },
    };
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "ShipReady could not generate the UI report.",
      "command",
      500,
      error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    );
  }
}

export function invalidJsonApiResult(details?: unknown): GuiApiResult {
  return apiError("Request body must be valid JSON.", "parse", 400, details);
}

function apiError(message: string, stage: string, statusCode: number, details?: unknown): GuiApiResult {
  return {
    statusCode,
    body: {
      ok: false,
      error: {
        message,
        stage,
        ...(details === undefined ? {} : { details }),
      },
    },
  };
}

function statusCodeForUiError(error: UiError): number {
  if (error.code === "invalid_url" || error.code === "invalid_repo_path") return 400;
  if (error.code === "timeout") return 504;
  if (error.code === "network_error") return 502;
  return 500;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
