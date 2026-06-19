export function normalizeAuditUrl(input: string): string {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid URL. Provide an absolute http:// or https:// URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid URL. Only http:// and https:// URLs are supported.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Invalid URL. URLs with embedded credentials are not supported.");
  }

  parsed.hash = "";
  return parsed.toString();
}

export function originResourceUrl(input: string, pathname: string): string {
  const url = new URL(input);
  return new URL(pathname, url.origin).toString();
}

export function resolveMaybeUrl(value: string | undefined, baseUrl: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

export function withoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

