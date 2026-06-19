export const DEFAULT_USER_AGENT =
  "ShipReady/0.1 metadata-readiness-audit";

export type FetchTextOptions = {
  timeoutMs: number;
  userAgent?: string;
  accept?: string;
};

export type FetchTextResult = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
};

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export async function fetchText(
  url: string,
  options: FetchTextOptions,
): Promise<FetchTextResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept:
          options.accept ??
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
      },
    });

    const headers = Object.fromEntries(response.headers.entries());
    const body = await response.text();

    return {
      requestedUrl: url,
      finalUrl: response.url || url,
      statusCode: response.status,
      ok: response.ok,
      headers,
      body,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Request timed out after ${options.timeoutMs}ms.`
        : error instanceof Error
          ? error.message
          : "Request failed.";
    throw new NetworkError(message);
  } finally {
    clearTimeout(timeout);
  }
}

