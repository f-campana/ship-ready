import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { promisify } from "node:util";
import { resolveAllowedRoots } from "../../src/mcp/config";

const root = join(import.meta.dirname, "..", "..");
const fixtureRoot = join(root, "tests", "fixtures", "repos");
const execFileAsync = promisify(execFile);

describe("MCP startup and stdio transport", () => {
  it("uses repeated CLI roots in preference to the JSON environment fallback", () => {
    expect(resolveAllowedRoots(["/cli"], '["/env"]')).toEqual(["/cli"]);
    expect(resolveAllowedRoots([], '["/one","/two"]')).toEqual(["/one", "/two"]);
    expect(() => resolveAllowedRoots([], "not-json")).toThrow("JSON array");
  });

  it("initializes and lists tools, resources, templates, and prompts over protocol-clean stdio", async () => {
    const transport = new StdioClientTransport({
      command: "pnpm",
      args: ["--silent", "shipready", "mcp", "--allow-root", fixtureRoot],
      cwd: root,
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    const client = new Client({ name: "shipready-test", version: "1.0.0" });

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      const resources = await client.listResources();
      const templates = await client.listResourceTemplates();
      const prompts = await client.listPrompts();
      expect(tools.tools).toHaveLength(10);
      expect(tools.tools.map((tool) => tool.name).filter((name) => name.includes("write"))).toEqual([
        "shipready.write_safe_crawl_files",
      ]);
      expect(resources.resources.map((resource) => resource.uri)).toContain("shipready://docs/mcp-plan");
      expect(templates.resourceTemplates).toEqual([
        expect.objectContaining({ uriTemplate: "shipready://validation/contracts/{fixtureName}" }),
      ]);
      expect(prompts.prompts).toHaveLength(5);

      const fixture = await client.callTool({
        name: "shipready.get_contract_fixture",
        arguments: { fixtureName: "audit.clean.json" },
      });
      expect(fixture.structuredContent).toMatchObject({ contract: "shipready.audit.v1" });
      const searchConsole = await client.callTool({
        name: "shipready.search_console_status",
        arguments: { url: "https://example.com", mock: "ready_sitemap_ok" },
      });
      expect(searchConsole.structuredContent).toMatchObject({
        contract: "shipready.searchConsoleStatus.v1",
        mode: "mock",
        sitemaps: { status: "available" },
      });
      const dns = await client.callTool({
        name: "shipready.dns_status",
        arguments: { url: "https://example.com", mock: "ready" },
      });
      expect(dns.structuredContent).toMatchObject({
        contract: "shipready.dnsStatus.v1",
        mode: "mock",
        verdict: { status: "ready" },
      });
      const resource = await client.readResource({ uri: "shipready://docs/contracts" });
      expect(resource.contents[0]).toMatchObject({ mimeType: "text/markdown" });
      const prompt = await client.getPrompt({ name: "write_policy_summary" });
      expect(prompt.messages).toHaveLength(1);
      expect(stderr).toBe("");
    } finally {
      await client.close();
    }
  }, 20_000);

  it("fails startup without allowed roots before writing protocol bytes to stdout", async () => {
    try {
      await execFileAsync("pnpm", ["--silent", "shipready", "mcp"], { cwd: root, timeout: 10_000 });
      throw new Error("Expected MCP startup to fail.");
    } catch (error) {
      const result = error as { code?: number; stdout?: string; stderr?: string };
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("requires at least one explicit");
    }
  });

  it("keeps MCP transport stdio-only", async () => {
    const source = await readFile(join(root, "src", "mcp", "server.ts"), "utf8");

    expect(source).toContain("StdioServerTransport");
    expect(source).not.toMatch(/\b(?:SSE|StreamableHTTP|HttpServer|createServer)\b/);
  });
});
