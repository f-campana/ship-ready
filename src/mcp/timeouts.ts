import { ShipReadyMcpError } from "./errors";

export const DEFAULT_MCP_TIMEOUTS = {
  audit_site: 30_000,
  crawl_site: 60_000,
  inspect_repo: 10_000,
  generated_site_smells: 45_000,
  plan_fixes: 45_000,
  preview_fixes: 45_000,
  write_safe_crawl_files: 45_000,
  get_ui_report: 45_000,
  canonical_read: 5_000,
} as const;

export type McpTimeouts = { [K in keyof typeof DEFAULT_MCP_TIMEOUTS]: number };

export async function withDeadline<T>(
  timeoutMs: number,
  clientSignal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T> | T,
): Promise<T> {
  if (clientSignal?.aborted) {
    throw cancelledError();
  }

  const controller = new AbortController();
  let outcome: "timeout" | "cancelled" | undefined;
  const onCancelled = () => {
    outcome = "cancelled";
    controller.abort(clientSignal?.reason);
  };
  clientSignal?.addEventListener("abort", onCancelled, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (!outcome) outcome = "timeout";
      controller.abort();
      reject(timeoutError(timeoutMs));
    }, timeoutMs);
  });

  const cancelled = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => {
      if (outcome === "cancelled") reject(cancelledError());
    }, { once: true });
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      deadline,
      cancelled,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    clientSignal?.removeEventListener("abort", onCancelled);
  }
}

function timeoutError(timeoutMs: number): ShipReadyMcpError {
  return new ShipReadyMcpError(
    "timeout",
    `ShipReady did not finish within ${timeoutMs}ms.`,
    { timeoutMs, retryable: true },
  );
}

function cancelledError(): ShipReadyMcpError {
  return new ShipReadyMcpError(
    "cancelled",
    "The ShipReady operation was cancelled.",
    { retryable: false },
  );
}
