import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { resolvePackageRoot } from "../src/mcp/resources";
import { callReadOnlyTool, listTools } from "../src/mcp/tools";
import { SearchConsoleStatusJsonContractSchema } from "../src/types/contracts";

describe("MCP Search Console status", () => {
  it("is registered read-only, needs no repo input, and does not mutate files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-mcp-search-console-"));
    const sentinel = join(directory, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n", "utf8");
    try {
      const context = {
        authorizer: rejectingAuthorizer(),
        packageRoot: await resolvePackageRoot(),
      };
      const definition = listTools().find((tool) => tool.name === "shipready.search_console_status");
      expect(definition?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });

      const result = await callReadOnlyTool(context, "shipready.search_console_status", {
        url: "https://example.com",
        mock: "inspection_canonical_mismatch",
        inspect: true,
      });
      expect(SearchConsoleStatusJsonContractSchema.parse(result.structuredContent)).toMatchObject({
        contract: "shipready.searchConsoleStatus.v1",
        mode: "mock",
        inspection: { requested: true, status: "available" },
      });
      expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects credentials and unsupported scenarios without exposing values", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-mcp-search-console-errors-"));
    try {
      const context = {
        authorizer: rejectingAuthorizer(),
        packageRoot: await resolvePackageRoot(),
      };
      const credential = await callReadOnlyTool(context, "shipready.search_console_status", {
        url: "https://example.com",
        accessToken: "secret-value",
      });
      const scenario = await callReadOnlyTool(context, "shipready.search_console_status", {
        url: "https://example.com",
        mock: "live_google",
      });
      expect(credential).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
      expect(scenario).toMatchObject({ isError: true, structuredContent: { code: "invalid_mode" } });
      expect(JSON.stringify([credential, scenario])).not.toContain("secret-value");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function rejectingAuthorizer(): PathAuthorizer {
  return {
    authorizeRepoPath: async () => {
      throw new Error("Search Console status must not authorize a repository path.");
    },
  } as unknown as PathAuthorizer;
}
