import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { resolvePackageRoot } from "../src/mcp/resources";
import { callReadOnlyTool, listTools } from "../src/mcp/tools";
import { MCP_READ_ONLY_TOOL_NAMES, MCP_WRITE_TOOL_NAMES } from "../src/mcp/toolNames";
import { CrawlJsonContractSchema } from "../src/types/contracts";

describe("MCP bounded crawl", () => {
  it("is registered read-only, needs no repo authorization, and preserves the sole write registry", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-mcp-crawl-"));
    const sentinel = join(directory, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n", "utf8");
    try {
      const context = {
        authorizer: rejectingAuthorizer(),
        packageRoot: await resolvePackageRoot(),
      };
      const definition = listTools().find((tool) => tool.name === "shipready.crawl_site");
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
      expect(MCP_READ_ONLY_TOOL_NAMES).toContain("shipready.crawl_site");
      expect(MCP_WRITE_TOOL_NAMES).toEqual(["shipready.write_safe_crawl_files"]);

      const result = await callReadOnlyTool(context, "shipready.crawl_site", {
        url: "https://example.com",
        mock: "clean-small-site",
      });

      expect(CrawlJsonContractSchema.parse(result.structuredContent)).toMatchObject({
        contract: "shipready.crawl.v1",
        mode: "mock",
        summary: { status: "ready" },
      });
      expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
      expect(listTools().filter((tool) => tool.annotations.readOnlyHint === false).map((tool) => tool.name))
        .toEqual(["shipready.write_safe_crawl_files"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("enforces max limits in the returned contract", async () => {
    const result = await callReadOnlyTool({
      authorizer: rejectingAuthorizer(),
      packageRoot: await resolvePackageRoot(),
    }, "shipready.crawl_site", {
      url: "https://example.com",
      mock: "limit-reached",
      maxPages: 999,
      maxDepth: 99,
    });

    expect(CrawlJsonContractSchema.parse(result.structuredContent)).toMatchObject({
      options: { maxPages: 25, maxDepth: 2 },
    });
  });

  it("rejects unsupported source, mock, unknown fields, and credentials without leaking values", async () => {
    const context = {
      authorizer: rejectingAuthorizer(),
      packageRoot: await resolvePackageRoot(),
    };
    const invalidSource = await callReadOnlyTool(context, "shipready.crawl_site", {
      url: "https://example.com",
      source: "everywhere",
    });
    const invalidMock = await callReadOnlyTool(context, "shipready.crawl_site", {
      url: "https://example.com",
      mock: "full-site",
    });
    const secret = await callReadOnlyTool(context, "shipready.crawl_site", {
      url: "https://example.com",
      accessToken: "secret-value",
    });
    const credentials = await callReadOnlyTool(context, "shipready.crawl_site", {
      url: "https://user:secret@example.com",
    });

    expect(invalidSource).toMatchObject({ isError: true, structuredContent: { code: "invalid_mode" } });
    expect(invalidMock).toMatchObject({ isError: true, structuredContent: { code: "invalid_mode" } });
    expect(secret).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
    expect(credentials).toMatchObject({ isError: true, structuredContent: { code: "invalid_url" } });
    expect(JSON.stringify([invalidSource, invalidMock, secret, credentials])).not.toContain("secret-value");
  });
});

function rejectingAuthorizer(): PathAuthorizer {
  return {
    authorizeRepoPath: async () => {
      throw new Error("Bounded crawl must not authorize a repository path.");
    },
  } as unknown as PathAuthorizer;
}
