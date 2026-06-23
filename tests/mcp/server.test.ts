import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAllowedRoots } from "../../src/mcp/config";

const root = join(import.meta.dirname, "..", "..");
const fixtureRoot = join(root, "tests", "fixtures", "repos");

describe("MCP startup and stdio transport", () => {
  it("uses repeated CLI roots in preference to the JSON environment fallback", () => {
    expect(resolveAllowedRoots(["/cli"], '["/env"]')).toEqual(["/cli"]);
    expect(resolveAllowedRoots([], '["/one","/two"]')).toEqual(["/one", "/two"]);
    expect(() => resolveAllowedRoots([], "not-json")).toThrow("JSON array");
  });

  it("initializes and lists tools, resources, templates, and prompts over protocol-clean stdio", async () => {
    const transport = new StdioClientTransport({
      command: "pnpm",
      args: ["shipready", "mcp", "--allow-root", fixtureRoot],
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
      expect(tools.tools).toHaveLength(7);
      expect(tools.tools.map((tool) => tool.name)).not.toContain("shipready.write_safe_crawl_files");
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
      const resource = await client.readResource({ uri: "shipready://docs/contracts" });
      expect(resource.contents[0]).toMatchObject({ mimeType: "text/markdown" });
      const prompt = await client.getPrompt({ name: "write_policy_summary" });
      expect(prompt.messages).toHaveLength(1);
      expect(stderr).toBe("");
    } finally {
      await client.close();
    }
  }, 20_000);
});
