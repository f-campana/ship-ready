export type McpStartupOptions = {
  allowRoots: string[];
};

export function resolveAllowedRoots(
  cliRoots: readonly string[],
  environmentValue = process.env.SHIPREADY_MCP_ALLOWED_ROOTS,
): string[] {
  if (cliRoots.length > 0) return [...cliRoots];
  if (!environmentValue) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(environmentValue);
  } catch {
    throw new Error("SHIPREADY_MCP_ALLOWED_ROOTS must be a JSON array of absolute directory paths.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((value) => typeof value !== "string" || !value)) {
    throw new Error("SHIPREADY_MCP_ALLOWED_ROOTS must be a non-empty JSON array of absolute directory paths.");
  }
  return parsed;
}
