import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { ShipReadyMcpError } from "../src/mcp/errors";
import { resolvePackageRoot } from "../src/mcp/resources";
import { callReadOnlyTool, listTools } from "../src/mcp/tools";
import { MCP_READ_ONLY_TOOL_NAMES, MCP_WRITE_TOOL_NAMES } from "../src/mcp/toolNames";
import { RecheckJsonContractSchema, type RecheckJsonContract } from "../src/types/contracts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("MCP post-write recheck", () => {
  it("registers shipready.recheck as read-only and preserves the sole write registry", () => {
    const definition = listTools().find((tool) => tool.name === "shipready.recheck");
    expect(definition?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(definition?.inputSchema).toMatchObject({ required: ["url"], additionalProperties: false });
    expect(MCP_READ_ONLY_TOOL_NAMES).toContain("shipready.recheck");
    expect(MCP_WRITE_TOOL_NAMES).toEqual(["shipready.write_safe_crawl_files"]);
    expect(listTools().filter((tool) => tool.annotations.readOnlyHint === false).map((tool) => tool.name))
      .toEqual(["shipready.write_safe_crawl_files"]);
  });

  it("returns the URL-only contract without repository authorization or mutation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-mcp-recheck-url-"));
    temporaryDirectories.push(directory);
    const sentinel = join(directory, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n");
    let received: unknown;
    const result = await callReadOnlyTool({
      authorizer: rejectingAuthorizer(),
      packageRoot: await resolvePackageRoot(),
      operations: {
        recheck: async (input) => {
          received = input;
          return fixture("recheck.url-only-ready.json");
        },
      },
    }, "shipready.recheck", { url: "https://example.com" });

    expect(RecheckJsonContractSchema.parse(result.structuredContent)).toMatchObject({
      contract: "shipready.recheck.v1",
      mode: "url_only",
      verdict: { status: "ready" },
    });
    expect(received).toMatchObject({ url: "https://example.com/", repoPath: undefined });
    expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
  });

  it("authorizes repo-backed paths and rejects paths outside the allowed root", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "shipready-mcp-recheck-allowed-"));
    const deniedRoot = await mkdtemp(join(tmpdir(), "shipready-mcp-recheck-denied-"));
    temporaryDirectories.push(allowedRoot, deniedRoot);
    const repo = join(allowedRoot, "repo");
    await mkdir(repo);
    const authorizer = await PathAuthorizer.create([allowedRoot]);
    let receivedRepo: string | undefined;
    const context = {
      authorizer,
      packageRoot: await resolvePackageRoot(),
      operations: {
        recheck: async (input: { repoPath?: string }) => {
          receivedRepo = input.repoPath;
          return fixture("recheck.repo-backed-appears-deployed.json");
        },
      },
    };

    const allowed = await callReadOnlyTool(context, "shipready.recheck", {
      url: "https://example.com",
      repoPath: repo,
    });
    const denied = await callReadOnlyTool(context, "shipready.recheck", {
      url: "https://example.com",
      repoPath: deniedRoot,
    });

    expect(RecheckJsonContractSchema.parse(allowed.structuredContent).mode).toBe("repo_backed");
    expect(receivedRepo).toBe(await realpath(repo));
    expect(denied).toMatchObject({
      isError: true,
      structuredContent: { contract: "shipready.error.v1", code: "path_not_authorized" },
    });
    expect(JSON.stringify(denied)).not.toContain(deniedRoot);
  });

  it("rejects invalid URLs, invalid paths, and unsupported secret fields without leaking input", async () => {
    const context = {
      authorizer: rejectingAuthorizer(),
      packageRoot: await resolvePackageRoot(),
      operations: { recheck: async () => fixture("recheck.url-only-ready.json") },
    };
    const invalidUrl = await callReadOnlyTool(context, "shipready.recheck", { url: "not-a-url" });
    const invalidPath = await callReadOnlyTool(context, "shipready.recheck", { url: "https://example.com", repoPath: "relative" });
    const secret = await callReadOnlyTool(context, "shipready.recheck", { url: "https://example.com", providerToken: "secret-value" });

    expect(invalidUrl).toMatchObject({ isError: true, structuredContent: { code: "invalid_url" } });
    expect(invalidPath).toMatchObject({ isError: true, structuredContent: { code: "invalid_repo_path" } });
    expect(secret).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
    expect(JSON.stringify([invalidUrl, invalidPath, secret])).not.toContain("secret-value");
  });
});

async function fixture(name: string): Promise<RecheckJsonContract> {
  const text = await readFile(join(import.meta.dirname, "..", "validation", "contracts", name), "utf8");
  return RecheckJsonContractSchema.parse(JSON.parse(text));
}

function rejectingAuthorizer(): PathAuthorizer {
  return {
    authorizeRepoPath: async () => {
      throw new ShipReadyMcpError(
        "invalid_repo_path",
        "Repository path must be an existing absolute directory without parent traversal segments.",
        { stage: "authorization", retryable: false },
      );
    },
  } as unknown as PathAuthorizer;
}
