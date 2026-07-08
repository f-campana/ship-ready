import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { resolvePackageRoot } from "../src/mcp/resources";
import { callReadOnlyTool, listTools } from "../src/mcp/tools";
import { MCP_READ_ONLY_TOOL_NAMES, MCP_WRITE_TOOL_NAMES } from "../src/mcp/toolNames";
import { GithubPrDraftJsonContractSchema } from "../src/types/contracts";

const root = join(import.meta.dirname, "..");
const fixtureRoot = join(root, "tests", "fixtures", "repos");
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("MCP GitHub PR draft", () => {
  it("is registered read-only and preserves the sole write registry", async () => {
    const definition = listTools().find((tool) => tool.name === "shipready.github_pr_draft");

    expect(definition?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(MCP_READ_ONLY_TOOL_NAMES).toContain("shipready.github_pr_draft");
    expect(MCP_WRITE_TOOL_NAMES).toEqual(["shipready.write_safe_crawl_files"]);
    expect(listTools().filter((tool) => tool.annotations.readOnlyHint === false).map((tool) => tool.name))
      .toEqual(["shipready.write_safe_crawl_files"]);
  });

  it("returns an inline PR draft contract and writes no artifacts", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-mcp-pr-draft-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const context = {
        authorizer: await PathAuthorizer.create([tempRoot]),
        packageRoot: await resolvePackageRoot(),
      };
      const before = await treeDigest(repoPath);

      const result = await callReadOnlyTool(context, "shipready.github_pr_draft", {
        url: server.url,
        repoPath,
        githubRepo: "f-campana/ship-ready",
        includeGhCommand: true,
        rendered: false,
      });
      const contract = GithubPrDraftJsonContractSchema.parse(result.structuredContent);

      expect("isError" in result ? result.isError : false).toBe(false);
      expect(contract).toMatchObject({
        contract: "shipready.githubPrDraft.v1",
        output: {
          kind: "inline",
          wroteArtifact: false,
          bytesWritten: 0,
        },
        safety: {
          createdPullRequest: false,
          ranGitCommands: false,
          calledGitHubApi: false,
          mutatedTargetRepo: false,
        },
      });
      expect(contract.commands.gh).toContain("gh pr create");
      expect(contract.draft.body).toContain("ShipReady did not create this PR");
      expect(await treeDigest(repoPath)).toBe(before);
      expect(await readdir(tempRoot)).toEqual(["repo"]);
    } finally {
      await server.close();
    }
  });

  it("requires allowed-root authorization and rejects unsupported fields", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-mcp-pr-draft-auth-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const outsideRoot = await temp("shipready-mcp-pr-draft-outside-");
      const outsideRepo = await copyRepo("vite-react", outsideRoot);
      const context = {
        authorizer: await PathAuthorizer.create([tempRoot]),
        packageRoot: await resolvePackageRoot(),
      };

      const outside = await callReadOnlyTool(context, "shipready.github_pr_draft", {
        url: server.url,
        repoPath: outsideRepo,
        rendered: false,
      });
      const secret = await callReadOnlyTool(context, "shipready.github_pr_draft", {
        url: server.url,
        repoPath,
        token: "secret-value",
        rendered: false,
      });
      const invalidGithubRepo = await callReadOnlyTool(context, "shipready.github_pr_draft", {
        url: server.url,
        repoPath,
        githubRepo: "not-owner-repo",
        rendered: false,
      });

      expect(outside).toMatchObject({ isError: true, structuredContent: { code: "path_not_authorized" } });
      expect(secret).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
      expect(invalidGithubRepo).toMatchObject({ isError: true, structuredContent: { code: "invalid_github_repo" } });
      expect(JSON.stringify([outside, secret, invalidGithubRepo])).not.toContain("secret-value");
    } finally {
      await server.close();
    }
  });
});

async function crawlServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt" || request.url === "/sitemap.xml") {
      response.statusCode = 404;
      response.setHeader("content-type", "text/plain");
      response.end("not found");
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end("<!doctype html><html lang=\"en\"><head><title>MCP PR draft test</title><meta name=\"description\" content=\"MCP PR draft test page.\"></head><body><h1>MCP PR draft test</h1></body></html>");
  });
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address.");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

async function temp(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  cleanup.push(path);
  return path;
}

async function copyRepo(name: string, parent: string): Promise<string> {
  const repoPath = join(parent, "repo");
  await cp(join(fixtureRoot, name), repoPath, { recursive: true });
  return repoPath;
}

async function treeDigest(directory: string): Promise<string> {
  const records: string[] = [];
  async function walk(current: string, relative = "") {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        records.push(`d ${name}`);
        await walk(path, name);
      } else {
        const content = await readFile(path);
        records.push(`f ${name} ${createHash("sha256").update(content).digest("hex")}`);
      }
    }
  }
  await walk(directory);
  return createHash("sha256").update(records.join("\n")).digest("hex");
}
