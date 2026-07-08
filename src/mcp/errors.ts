import { z } from "zod";
import { GithubPrDraftError } from "../githubPrDraft/githubPrDraft";
import {
  CliErrorContractSchema,
  CONTRACT_NAMES,
  type CliErrorCode,
  type CliErrorContract,
  type WriteFixJsonContract,
} from "../types/contracts";
import { WriteFixExecutionError, WriteFixValidationError } from "../fix/writeFix";
import { toWriteFixJsonContract } from "../report/formatWriteFixJsonReport";
import { NetworkError } from "../utils/http";

export type McpErrorStage = NonNullable<CliErrorContract["details"]>["stage"];

export class ShipReadyMcpError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
    readonly options: {
      retryable?: boolean;
      stage?: McpErrorStage;
      timeoutMs?: number;
      result?: WriteFixJsonContract;
    } = {},
  ) {
    super(message);
    this.name = "ShipReadyMcpError";
  }
}

export function normalizeMcpError(error: unknown, tool: string): CliErrorContract {
  const normalized = classifyError(error);
  const details = normalized.options.stage || normalized.options.timeoutMs
    ? {
        tool,
        stage: normalized.options.stage,
        timeoutMs: normalized.options.timeoutMs,
      }
    : undefined;

  return CliErrorContractSchema.parse({
    contract: CONTRACT_NAMES.error,
    ok: false,
    code: normalized.code,
    message: normalized.message,
    error: normalized.message,
    retryable: normalized.options.retryable,
    details,
    result: normalized.options.result,
  });
}

function classifyError(error: unknown): ShipReadyMcpError {
  if (error instanceof ShipReadyMcpError) return error;

  if (error instanceof z.ZodError) {
    return new ShipReadyMcpError(
      "contract_error",
      "ShipReady produced data that did not match its published contract.",
      { stage: "contract", retryable: false },
    );
  }

  if (error instanceof NetworkError) {
    return new ShipReadyMcpError(
      "network_error",
      "ShipReady could not read the requested network resource.",
      { stage: "network", retryable: true },
    );
  }

  if (error instanceof GithubPrDraftError) {
    return new ShipReadyMcpError(error.code, error.message, {
      stage: error.code === "contract_error" ? "contract" : "input",
      retryable: false,
    });
  }

  if (error instanceof WriteFixValidationError) {
    return new ShipReadyMcpError(
      "write_forbidden",
      "ShipReady write policy blocked the requested MCP write. No files were written.",
      { stage: "contract", retryable: false, result: toWriteFixJsonContract(error.result) },
    );
  }

  if (error instanceof WriteFixExecutionError) {
    return new ShipReadyMcpError(
      "write_execution_failed",
      "ShipReady write mode failed after creation started. Rollback was attempted.",
      { stage: "cleanup", retryable: false, result: toWriteFixJsonContract(error.result) },
    );
  }

  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Invalid URL")) {
    return new ShipReadyMcpError("invalid_url", message, { stage: "input", retryable: false });
  }
  if (/playwright|browser|page\.goto|chromium/i.test(message)) {
    return new ShipReadyMcpError(
      "render_error",
      "ShipReady could not render the requested page.",
      { stage: "render", retryable: true },
    );
  }

  return new ShipReadyMcpError(
    "internal_error",
    "ShipReady encountered an unexpected internal error.",
    { retryable: false },
  );
}

export function toolErrorResult(error: unknown, tool: string) {
  const structuredContent = normalizeMcpError(error, tool);
  return {
    isError: true as const,
    structuredContent,
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
  };
}
