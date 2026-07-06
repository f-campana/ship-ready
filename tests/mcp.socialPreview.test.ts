import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { resolvePackageRoot } from "../src/mcp/resources";
import { callReadOnlyTool, listTools } from "../src/mcp/tools";
import { MCP_READ_ONLY_TOOL_NAMES, MCP_WRITE_TOOL_NAMES } from "../src/mcp/toolNames";
import { SocialPreviewJsonContractSchema } from "../src/types/contracts";

describe("MCP social preview", () => {
  it("is registered read-only, needs no repo authorization, and preserves the sole write registry", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-mcp-social-preview-"));
    const sentinel = join(directory, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n", "utf8");
    try {
      const context = {
        authorizer: rejectingAuthorizer(),
        packageRoot: await resolvePackageRoot(),
      };
      const definition = listTools().find((tool) => tool.name === "shipready.social_preview");
      expect(definition?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
      expect(MCP_READ_ONLY_TOOL_NAMES).toContain("shipready.social_preview");
      expect(MCP_WRITE_TOOL_NAMES).toEqual(["shipready.write_safe_crawl_files"]);

      const result = await callReadOnlyTool(context, "shipready.social_preview", {
        url: "https://example.com",
        mock: "complete",
      });

      expect(SocialPreviewJsonContractSchema.parse(result.structuredContent)).toMatchObject({
        contract: "shipready.socialPreview.v1",
        mode: "mock",
        verdict: { status: "ready" },
      });
      expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
      expect(listTools().filter((tool) => tool.annotations.readOnlyHint === false).map((tool) => tool.name))
        .toEqual(["shipready.write_safe_crawl_files"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects unsupported source, mock, and secret fields without leaking values", async () => {
    const context = {
      authorizer: rejectingAuthorizer(),
      packageRoot: await resolvePackageRoot(),
    };
    const invalidSource = await callReadOnlyTool(context, "shipready.social_preview", {
      url: "https://example.com",
      source: "hydrated",
    });
    const invalidMock = await callReadOnlyTool(context, "shipready.social_preview", {
      url: "https://example.com",
      mock: "official_linkedin",
    });
    const secret = await callReadOnlyTool(context, "shipready.social_preview", {
      url: "https://example.com",
      accessToken: "secret-value",
    });

    expect(invalidSource).toMatchObject({ isError: true, structuredContent: { code: "invalid_mode" } });
    expect(invalidMock).toMatchObject({ isError: true, structuredContent: { code: "invalid_mode" } });
    expect(secret).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
    expect(JSON.stringify([invalidSource, invalidMock, secret])).not.toContain("secret-value");
  });
});

function rejectingAuthorizer(): PathAuthorizer {
  return {
    authorizeRepoPath: async () => {
      throw new Error("Social preview must not authorize a repository path.");
    },
  } as unknown as PathAuthorizer;
}
