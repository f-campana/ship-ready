import { z } from "zod";
import { auditUrl } from "../audit/auditUrl";
import { dryRunFix } from "../fix/dryRunFix";
import { writeFixFromDryRun } from "../fix/writeFix";
import { planFixes } from "../plan/planFixes";
import { inspectRepo } from "../repo/inspectRepo";
import { formatDryRunFixJsonReport } from "../report/formatDryRunFixJsonReport";
import { formatFixPlanJsonReport } from "../report/formatFixPlanJsonReport";
import { formatJsonReport } from "../report/formatJsonReport";
import { formatRepoInspectionJsonReport } from "../report/formatRepoInspectionJsonReport";
import { formatUiReportJsonReport } from "../report/formatUiReportJsonReport";
import { formatWriteFixJsonReport } from "../report/formatWriteFixJsonReport";
import {
  AuditJsonContractSchema,
  DryRunFixJsonContractSchema,
  FixPlanJsonContractSchema,
  RepoInspectionJsonContractSchema,
  UiReportJsonContractSchema,
  WriteFixJsonContractSchema,
} from "../types/contracts";
import type { DryRunFixResult } from "../types/dryRunFix";
import { createUiReport } from "../ui/createUiReport";
import { normalizeAuditUrl } from "../utils/url";
import { ShipReadyMcpError, toolErrorResult } from "./errors";
import type { PathAuthorizer } from "./pathAuthorization";
import {
  createPreviewReceiptManager,
  McpPreviewReceiptSchema,
  type PreviewReceiptManager,
} from "./previewReceipts";
import {
  FIXTURE_NAMES,
  POLICY_DOCS,
  readContractFixture,
  readPolicyDoc,
} from "./resources";
import { DEFAULT_MCP_TIMEOUTS, type McpTimeouts, withDeadline } from "./timeouts";
import { TOOL_NAMES, type ToolName } from "./toolNames";

const MAX_TOOL_RESULT_BYTES = 4 * 1024 * 1024;
export const WRITE_SAFE_CRAWL_FILES_CONFIRMATION = "CREATE_SAFE_CRAWL_FILES_ONLY" as const;

export { TOOL_NAMES } from "./toolNames";

const UrlInputSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  rendered: z.boolean().optional().default(true),
}).strict();
const RepoInputSchema = z.object({ repoPath: z.string().trim().min(1).max(4096) }).strict();
const UrlRepoInputSchema = UrlInputSchema.extend({ repoPath: z.string().trim().min(1).max(4096) }).strict();
const WriteSafeCrawlFilesInputSchema = UrlRepoInputSchema.extend({
  previewReceipt: McpPreviewReceiptSchema,
  confirmation: z.string(),
}).strict();
const UiReportInputSchema = UrlInputSchema.extend({ repoPath: z.string().trim().min(1).max(4096).optional() }).strict();
const FixtureInputSchema = z.object({ fixtureName: z.enum(FIXTURE_NAMES) }).strict();
const PolicyInputSchema = z.object({ name: z.enum(Object.keys(POLICY_DOCS) as [keyof typeof POLICY_DOCS, ...(keyof typeof POLICY_DOCS)[]]) }).strict();

export type McpOperations = {
  auditSite: typeof auditUrl;
  inspectRepo: typeof inspectRepo;
  planFixes: typeof planFixes;
  previewFixes: typeof dryRunFix;
  writeSafeCrawlFiles: typeof writeFixFromDryRun;
  getUiReport: typeof createUiReport;
};

export type McpToolContext = {
  authorizer: PathAuthorizer;
  packageRoot: string;
  timeouts?: McpTimeouts;
  operations?: Partial<McpOperations>;
  previewReceipts?: PreviewReceiptManager;
};

const DEFAULT_OPERATIONS: McpOperations = {
  auditSite: auditUrl,
  inspectRepo,
  planFixes,
  previewFixes: dryRunFix,
  writeSafeCrawlFiles: writeFixFromDryRun,
  getUiReport: createUiReport,
};

const FALLBACK_PREVIEW_RECEIPTS = createPreviewReceiptManager();

export function listTools() {
  const readOnly = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  };
  return [
    tool("shipready.audit_site", "Audit one public HTTP(S) page without local writes.", schema({
      url: stringSchema(2048), rendered: { type: "boolean", default: true },
    }, ["url"]), { ...readOnly, openWorldHint: true }),
    tool("shipready.inspect_repo", "Inspect one explicitly authorized repository without writes.", schema({
      repoPath: stringSchema(4096),
    }, ["repoPath"]), { ...readOnly, openWorldHint: false }),
    tool("shipready.plan_fixes", "Create the existing read-only fix plan contract.", urlRepoJsonSchema(), { ...readOnly, openWorldHint: true }),
    tool("shipready.preview_fixes", "Create the existing dry-run preview; never writes files.", urlRepoJsonSchema(), { ...readOnly, openWorldHint: true }),
    tool("shipready.write_safe_crawl_files", "Create only current V1-eligible missing robots/sitemap files after a fresh MCP preview receipt and exact confirmation.", schema({
      url: stringSchema(2048),
      repoPath: stringSchema(4096),
      previewReceipt: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind", "policy", "url", "repoRealPath", "dryRunContract", "eligiblePaths",
          "dryRunDigest", "eligibleDigest", "issuedAt", "expiresAt", "nonce", "signature",
        ],
        properties: {
          kind: { type: "string", const: "shipready.mcp.previewReceipt.v1" },
          policy: { type: "string", const: "creation_only_robots_sitemap_v1" },
          url: { type: "string" },
          repoRealPath: { type: "string" },
          dryRunContract: { type: "string", const: "shipready.dryRunFix.v1" },
          eligiblePaths: { type: "array", items: { type: "string" }, minItems: 1 },
          dryRunDigest: { type: "string" },
          eligibleDigest: { type: "string" },
          issuedAt: { type: "string" },
          expiresAt: { type: "string" },
          nonce: { type: "string" },
          signature: { type: "string" },
        },
      },
      confirmation: { type: "string", const: WRITE_SAFE_CRAWL_FILES_CONFIRMATION },
      rendered: { type: "boolean", default: true },
    }, ["url", "repoPath", "previewReceipt", "confirmation"]), {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    }),
    tool("shipready.get_ui_report", "Build the existing UI report contract without starting the GUI.", schema({
      url: stringSchema(2048), repoPath: stringSchema(4096), rendered: { type: "boolean", default: true },
    }, ["url"]), { ...readOnly, openWorldHint: true }),
    tool("shipready.get_contract_fixture", "Read one allowlisted, schema-validated contract fixture.", schema({
      fixtureName: { type: "string", enum: [...FIXTURE_NAMES] },
    }, ["fixtureName"]), { ...readOnly, openWorldHint: false }),
    tool("shipready.get_policy_doc", "Read one explicitly allowlisted canonical ShipReady document.", schema({
      name: { type: "string", enum: Object.keys(POLICY_DOCS) },
    }, ["name"]), { ...readOnly, openWorldHint: false }),
  ];
}

export async function callReadOnlyTool(
  context: McpToolContext,
  name: string,
  args: unknown,
  clientSignal?: AbortSignal,
) {
  if (name === "shipready.write_safe_crawl_files") {
    return toolErrorResult(new ShipReadyMcpError(
      "write_forbidden",
      "Requested MCP tool is not read-only.",
      { stage: "input", retryable: false },
    ), name);
  }
  return callTool(context, name, args, clientSignal);
}

export async function callTool(
  context: McpToolContext,
  name: string,
  args: unknown,
  clientSignal?: AbortSignal,
) {
  if (!(TOOL_NAMES as readonly string[]).includes(name)) {
    return toolErrorResult(new ShipReadyMcpError(
      "unsupported_command",
      "Requested MCP tool is not available.",
      { stage: "input", retryable: false },
    ), name);
  }

  const toolName = name as ToolName;
  const timeoutMs = timeoutFor(toolName, context.timeouts ?? DEFAULT_MCP_TIMEOUTS);
  try {
    return await withDeadline(timeoutMs, clientSignal, async (signal) => {
      const result = await executeTool(context, toolName, args, signal, timeoutMs);
      assertResultSize(result);
      return result;
    });
  } catch (error) {
    return toolErrorResult(error, toolName);
  }
}

async function executeTool(
  context: McpToolContext,
  name: ToolName,
  args: unknown,
  _signal: AbortSignal,
  timeoutMs: number,
) {
  const operations = { ...DEFAULT_OPERATIONS, ...context.operations };
  if (name === "shipready.audit_site") {
    const input = parseInput(UrlInputSchema, args, "invalid_url");
    const url = normalizeAuditUrl(input.url);
    const result = await operations.auditSite(url, { timeoutMs, render: input.rendered });
    return contractResult(formatJsonReport(result), AuditJsonContractSchema);
  }
  if (name === "shipready.inspect_repo") {
    const input = parseInput(RepoInputSchema, args, "invalid_repo_path");
    const repoPath = await context.authorizer.authorizeRepoPath(input.repoPath);
    const result = await Promise.resolve(operations.inspectRepo(repoPath));
    return contractResult(formatRepoInspectionJsonReport(result), RepoInspectionJsonContractSchema);
  }
  if (name === "shipready.plan_fixes") {
    const input = parseInput(UrlRepoInputSchema, args, "invalid_url");
    const url = normalizeAuditUrl(input.url);
    const repoPath = await context.authorizer.authorizeRepoPath(input.repoPath);
    const result = await operations.planFixes(repoPath, url, { timeoutMs, render: input.rendered });
    return contractResult(formatFixPlanJsonReport(result), FixPlanJsonContractSchema);
  }
  if (name === "shipready.preview_fixes") {
    const input = parseInput(UrlRepoInputSchema, args, "invalid_url");
    const url = normalizeAuditUrl(input.url);
    const repoPath = await context.authorizer.authorizeRepoPath(input.repoPath);
    const result = await operations.previewFixes(repoPath, url, { timeoutMs, render: input.rendered });
    if (result.mode !== "dry_run" || result.wroteFiles !== false) {
      throw new ShipReadyMcpError("contract_error", "Dry-run safety invariants were not preserved.", {
        stage: "contract", retryable: false,
      });
    }
    const structuredContent = contractJson(formatDryRunFixJsonReport(result), DryRunFixJsonContractSchema);
    const previewReceipt = (context.previewReceipts ?? FALLBACK_PREVIEW_RECEIPTS).issue({
      url,
      repoRealPath: repoPath,
      dryRunContract: structuredContent,
      dryRunResult: result,
    });
    return jsonResult(previewReceipt ? { ...structuredContent, previewReceipt } : structuredContent);
  }
  if (name === "shipready.write_safe_crawl_files") {
    const input = parseWriteInput(args);
    if (input.confirmation !== WRITE_SAFE_CRAWL_FILES_CONFIRMATION) {
      throw new ShipReadyMcpError("write_forbidden", "Exact confirmation phrase is required before MCP safe write.", {
        stage: "input", retryable: false,
      });
    }
    const url = normalizeAuditUrl(input.url);
    const repoPath = await context.authorizer.authorizeRepoPath(input.repoPath);
    const currentDryRun = await operations.previewFixes(repoPath, url, { timeoutMs, render: input.rendered });
    assertDryRunSafety(currentDryRun);
    const currentDryRunContract = contractJson(formatDryRunFixJsonReport(currentDryRun), DryRunFixJsonContractSchema);
    const receiptValidation = (context.previewReceipts ?? FALLBACK_PREVIEW_RECEIPTS).validate(input.previewReceipt, {
      url,
      repoRealPath: repoPath,
      dryRunContract: currentDryRunContract,
      dryRunResult: currentDryRun,
    });
    if (!receiptValidation.ok) {
      throw new ShipReadyMcpError("write_forbidden", receiptValidation.message, {
        stage: "input", retryable: false,
      });
    }
    const result = operations.writeSafeCrawlFiles(currentDryRun, repoPath);
    return contractResult(formatWriteFixJsonReport(result), WriteFixJsonContractSchema);
  }
  if (name === "shipready.get_ui_report") {
    const input = parseInput(UiReportInputSchema, args, "invalid_url");
    const url = normalizeAuditUrl(input.url);
    const repoPath = input.repoPath
      ? await context.authorizer.authorizeRepoPath(input.repoPath)
      : undefined;
    const result = await operations.getUiReport({
      url, repoPath, timeoutMs, render: input.rendered,
    });
    return contractResult(formatUiReportJsonReport(result), UiReportJsonContractSchema);
  }
  if (name === "shipready.get_contract_fixture") {
    const input = parseInput(FixtureInputSchema, args, "fixture_not_found");
    return jsonResult(await readContractFixture(context.packageRoot, input.fixtureName));
  }
  const input = parseInput(PolicyInputSchema, args, "doc_not_found");
  const doc = await readPolicyDoc(context.packageRoot, input.name);
  return {
    structuredContent: doc,
    content: [{ type: "text" as const, text: doc.text }],
  };
}

function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
  code: "invalid_url" | "invalid_repo_path" | "fixture_not_found" | "doc_not_found",
): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const unknownField = parsed.error.issues.some((issue) => issue.code === "unrecognized_keys");
  const invalidRepoPath = parsed.error.issues.some((issue) => issue.path[0] === "repoPath");
  throw new ShipReadyMcpError(
    unknownField ? "unsupported_command" : invalidRepoPath ? "invalid_repo_path" : code,
    unknownField ? "Tool input contains unsupported fields." : "Tool input is missing or invalid.",
    { stage: "input", retryable: false },
  );
}

function parseWriteInput(input: unknown): z.infer<typeof WriteSafeCrawlFilesInputSchema> {
  const parsed = WriteSafeCrawlFilesInputSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  const unknownField = parsed.error.issues.some((issue) => issue.code === "unrecognized_keys");
  if (unknownField) {
    throw new ShipReadyMcpError("unsupported_command", "Tool input contains unsupported fields.", {
      stage: "input", retryable: false,
    });
  }

  if (parsed.error.issues.some((issue) => issue.path[0] === "repoPath")) {
    throw new ShipReadyMcpError("invalid_repo_path", "Tool input is missing or invalid.", {
      stage: "input", retryable: false,
    });
  }

  if (parsed.error.issues.some((issue) => issue.path[0] === "url")) {
    throw new ShipReadyMcpError("invalid_url", "Tool input is missing or invalid.", {
      stage: "input", retryable: false,
    });
  }

  throw new ShipReadyMcpError("write_forbidden", "A valid preview receipt and exact confirmation phrase are required.", {
    stage: "input", retryable: false,
  });
}

function contractResult(text: string, contractSchema: z.ZodType) {
  return jsonResult(contractJson(text, contractSchema) as Record<string, unknown>);
}

function contractJson<T extends z.ZodType>(text: string, contractSchema: T): z.infer<T> {
  return contractSchema.parse(JSON.parse(text));
}

function jsonResult(structuredContent: Record<string, unknown>) {
  return {
    structuredContent,
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
  };
}

function assertResultSize(result: unknown): void {
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_TOOL_RESULT_BYTES) {
    throw new ShipReadyMcpError("contract_error", "Tool result exceeds the MCP response limit.", {
      stage: "contract", retryable: false,
    });
  }
}

function timeoutFor(name: ToolName, timeouts: McpTimeouts): number {
  if (name === "shipready.audit_site") return timeouts.audit_site;
  if (name === "shipready.inspect_repo") return timeouts.inspect_repo;
  if (name === "shipready.plan_fixes") return timeouts.plan_fixes;
  if (name === "shipready.preview_fixes") return timeouts.preview_fixes;
  if (name === "shipready.write_safe_crawl_files") return timeouts.write_safe_crawl_files;
  if (name === "shipready.get_ui_report") return timeouts.get_ui_report;
  return timeouts.canonical_read;
}

function assertDryRunSafety(result: DryRunFixResult): void {
  if (result.mode !== "dry_run" || result.wroteFiles !== false) {
    throw new ShipReadyMcpError("contract_error", "Dry-run safety invariants were not preserved.", {
      stage: "contract", retryable: false,
    });
  }
}

function tool(name: ToolName, description: string, inputSchema: Record<string, unknown>, annotations: Record<string, boolean>) {
  return { name, description, inputSchema, annotations };
}

function schema(properties: Record<string, unknown>, required: string[]) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object" as const,
    additionalProperties: false,
    required,
    properties,
  };
}

function stringSchema(maxLength: number) {
  return { type: "string", minLength: 1, maxLength };
}

function urlRepoJsonSchema() {
  return schema({
    url: stringSchema(2048), repoPath: stringSchema(4096), rendered: { type: "boolean", default: true },
  }, ["url", "repoPath"]);
}
