import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpStartupOptions } from "./config";
import { PathAuthorizer } from "./pathAuthorization";
import { createPreviewReceiptManager } from "./previewReceipts";
import { listPrompts, renderPrompt } from "./prompts";
import {
  FIXTURE_NAMES,
  listResources,
  readResource,
  resolvePackageRoot,
  validateCanonicalContent,
} from "./resources";
import { callTool, listTools, type McpToolContext } from "./tools";
import { DEFAULT_MCP_TIMEOUTS, withDeadline } from "./timeouts";

export async function createMcpServer(options: McpStartupOptions): Promise<Server> {
  const [authorizer, packageRoot] = await Promise.all([
    PathAuthorizer.create(options.allowRoots),
    resolvePackageRoot(),
  ]);
  await validateCanonicalContent(packageRoot);
  const context: McpToolContext = {
    authorizer,
    packageRoot,
    previewReceipts: createPreviewReceiptManager(),
  };

  const server = new Server(
    { name: "shipready", version: "0.1.0" },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: "ShipReady local stdio adapter. Tools are read-only except shipready.write_safe_crawl_files, which can create only current V1-eligible missing robots/sitemap files after a fresh signed preview receipt and exact confirmation phrase. shipready.export_patch and shipready.github_pr_draft are read-only review handoffs and write no MCP artifacts.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) =>
    callTool(context, request.params.name, request.params.arguments ?? {}, extra.signal));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listResources() }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [{
      uriTemplate: "shipready://validation/contracts/{fixtureName}",
      name: "ShipReady contract fixture",
      description: "One exact allowlisted, schema-validated JSON contract fixture.",
      mimeType: "application/json",
    }],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
    try {
      const resource = await withDeadline(DEFAULT_MCP_TIMEOUTS.canonical_read, extra.signal, () =>
        readResource(packageRoot, request.params.uri));
      return { contents: [{ uri: resource.uri, mimeType: resource.mediaType, text: resource.text }] };
    } catch {
      throw new McpError(ErrorCode.InvalidParams, "Requested ShipReady resource is not available.");
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: listPrompts() }));
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      return await renderPrompt(request.params.name, request.params.arguments, authorizer);
    } catch {
      throw new McpError(ErrorCode.InvalidParams, "Requested ShipReady prompt or arguments are not available.");
    }
  });

  return server;
}

export async function startMcpServer(options: McpStartupOptions): Promise<void> {
  const server = await createMcpServer(options);
  const transport = new StdioServerTransport();
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await Promise.race([
      server.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
  transport.onclose = () => void close();
  await server.connect(transport);
}

export const MCP_RESOURCE_TEMPLATE_FIXTURES = FIXTURE_NAMES;
