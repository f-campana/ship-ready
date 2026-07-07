import { createUiReport, type CreateUiReportInput } from "../ui/createUiReport";
import type { UiError, UiReport } from "../types/uiReport";
import {
  createGuiReview,
  validateGuiRepoPath,
  type GuiReviewInclude,
  type GuiReview,
  type GuiReviewOperations,
  type GuiReviewRequestOptions,
} from "./guiReview";

export type GuiReportCreator = (input: CreateUiReportInput) => Promise<UiReport>;

export type GuiApiOptions = {
  createReport?: GuiReportCreator;
  reviewOperations?: Partial<GuiReviewOperations>;
  timeoutMs?: number;
  render?: boolean;
  userAgent?: string;
};

export type GuiApiErrorBody = {
  ok: false;
  error: {
    message: string;
    stage: string;
    details?: unknown;
  };
};

export type GuiApiResult = {
  statusCode: number;
  body:
    | {
        ok: true;
        report: UiReport;
      }
    | GuiApiErrorBody;
};

export type GuiReviewApiResult = {
  statusCode: number;
  body:
    | {
        ok: true;
        review: GuiReview;
      }
    | GuiApiErrorBody;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export async function createReviewApiResult(
  payload: unknown,
  options: GuiApiOptions = {},
): Promise<GuiReviewApiResult> {
  if (!isRecord(payload)) {
    return apiError("Request body must be a JSON object.", "parse", 400);
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const repoPath = typeof payload.repoPath === "string" ? payload.repoPath.trim() : "";

  if (!url) {
    return apiError("Enter a website URL before running the check.", "audit", 400);
  }

  let validatedRepoPath: string | undefined;
  try {
    validatedRepoPath = repoPath ? validateGuiRepoPath(repoPath) : undefined;
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Local repo path could not be inspected.",
      "repo_inspection",
      400,
    );
  }

  try {
    const review = await createGuiReview({
      url,
      repoPath: validatedRepoPath,
      include: readInclude(payload.include),
      options: readReviewOptions(payload.options),
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      userAgent: options.userAgent,
    }, reviewOperationsFor(options));
    const firstError = review.uiReport?.errors[0];

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
        review,
      },
    };
  } catch (error) {
    const invalidUrl = error instanceof Error && error.message.startsWith("Invalid URL");
    return apiError(
      error instanceof Error ? error.message : "ShipReady could not generate the review.",
      invalidUrl ? "audit" : "command",
      invalidUrl ? 400 : 500,
      invalidUrl ? undefined : error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    );
  }
}

function reviewOperationsFor(options: GuiApiOptions): Partial<GuiReviewOperations> {
  return {
    ...(options.createReport ? { createReport: options.createReport } : {}),
    ...options.reviewOperations,
  };
}

function readInclude(value: unknown): GuiReviewInclude | undefined {
  if (!isRecord(value)) return undefined;
  return {
    uiReport: optionalBoolean(value.uiReport),
    audit: optionalBoolean(value.audit),
    repo: optionalBoolean(value.repo),
    fixPlan: optionalBoolean(value.fixPlan),
    dryRun: optionalBoolean(value.dryRun),
    socialPreview: optionalBoolean(value.socialPreview),
    crawl: optionalBoolean(value.crawl),
    smells: optionalBoolean(value.smells),
    dns: optionalBoolean(value.dns),
    searchConsole: optionalBoolean(value.searchConsole),
    recheck: optionalBoolean(value.recheck),
  };
}

function readReviewOptions(value: unknown): GuiReviewRequestOptions | undefined {
  if (!isRecord(value)) return undefined;
  return {
    crawlMaxPages: optionalNumber(value.crawlMaxPages),
    crawlMaxDepth: optionalNumber(value.crawlMaxDepth),
    socialPreviewSource:
      value.socialPreviewSource === "raw" ||
      value.socialPreviewSource === "rendered" ||
      value.socialPreviewSource === "both"
        ? value.socialPreviewSource
        : undefined,
    rendered: optionalBoolean(value.rendered),
  };
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

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

function apiError(
  message: string,
  stage: string,
  statusCode: number,
  details?: unknown,
): { statusCode: number; body: GuiApiErrorBody } {
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
