import { createHash } from "node:crypto";
import { cp, lstat, mkdtemp, readFile, readdir, readlink, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PathAuthorizer } from "../../src/mcp/pathAuthorization";
import { resolvePackageRoot } from "../../src/mcp/resources";
import { callReadOnlyTool, listTools, type McpToolContext } from "../../src/mcp/tools";
import { NetworkError } from "../../src/utils/http";
import {
  AuditJsonContractSchema,
  DryRunFixJsonContractSchema,
  FixPlanJsonContractSchema,
  RepoInspectionJsonContractSchema,
  UiReportJsonContractSchema,
} from "../../src/types/contracts";

const root = join(import.meta.dirname, "..", "..");
const fixtureRoot = join(root, "tests", "fixtures", "repos");
let url: string;
let closeServer: () => Promise<void>;
let context: McpToolContext;

beforeAll(async () => {
  const running = await staticServer();
  url = running.url;
  closeServer = running.close;
  context = {
    authorizer: await PathAuthorizer.create([fixtureRoot]),
    packageRoot: await resolvePackageRoot(),
  };
});
afterAll(async () => closeServer());

describe("read-only MCP tools", () => {
  it("registers exactly seven tools and no write tool", () => {
    const names = listTools().map((tool) => tool.name);
    expect(names).toEqual([
      "shipready.audit_site", "shipready.inspect_repo", "shipready.plan_fixes",
      "shipready.preview_fixes", "shipready.get_ui_report",
      "shipready.get_contract_fixture", "shipready.get_policy_doc",
    ]);
    expect(names).not.toContain("shipready.write_safe_crawl_files");
  });

  it("returns the existing audit contract from a deterministic local server", async () => {
    const result = await callReadOnlyTool(context, "shipready.audit_site", { url, rendered: false });
    expect("isError" in result ? result.isError : false).toBe(false);
    expect(() => AuditJsonContractSchema.parse(result.structuredContent)).not.toThrow();
    expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);
  });

  it("returns inspection, plan, dry-run, and UI report contracts", async () => {
    const repoPath = join(fixtureRoot, "next-app-router-dry-run");
    const inspect = await callReadOnlyTool(context, "shipready.inspect_repo", { repoPath });
    const plan = await callReadOnlyTool(context, "shipready.plan_fixes", { url, repoPath, rendered: false });
    const preview = await callReadOnlyTool(context, "shipready.preview_fixes", { url, repoPath, rendered: false });
    const report = await callReadOnlyTool(context, "shipready.get_ui_report", { url, repoPath, rendered: false });

    expect(() => RepoInspectionJsonContractSchema.parse(inspect.structuredContent)).not.toThrow();
    expect(() => FixPlanJsonContractSchema.parse(plan.structuredContent)).not.toThrow();
    expect(DryRunFixJsonContractSchema.parse(preview.structuredContent)).toMatchObject({ mode: "dry_run", wroteFiles: false });
    expect(() => UiReportJsonContractSchema.parse(report.structuredContent)).not.toThrow();
  });

  it("does not mutate the target tree during dry-run preview", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "shipready-mcp-preview-"));
    const repoPath = join(tempRoot, "repo");
    await cp(join(fixtureRoot, "next-app-router-dry-run"), repoPath, { recursive: true });
    try {
      const isolated = { ...context, authorizer: await PathAuthorizer.create([tempRoot]) };
      const before = await treeDigest(repoPath);
      const result = await callReadOnlyTool(isolated, "shipready.preview_fixes", { url, repoPath, rendered: false });
      const after = await treeDigest(repoPath);
      expect("isError" in result ? result.isError : false).toBe(false);
      expect(after).toBe(before);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("reads only allowlisted contract fixtures and policy docs", async () => {
    const fixture = await callReadOnlyTool(context, "shipready.get_contract_fixture", { fixtureName: "audit.clean.json" });
    const doc = await callReadOnlyTool(context, "shipready.get_policy_doc", { name: "mcp-plan" });
    expect(fixture.structuredContent).toMatchObject({ contract: "shipready.audit.v1" });
    expect(doc.structuredContent).toMatchObject({ uri: "shipready://docs/mcp-plan", mediaType: "text/markdown" });

    for (const fixtureName of ["../audit.clean.json", "/tmp/audit.clean.json", "audit.clean.txt", "missing.json"]) {
      const rejected = await callReadOnlyTool(context, "shipready.get_contract_fixture", { fixtureName });
      expect(rejected).toMatchObject({ isError: true, structuredContent: { code: "fixture_not_found" } });
    }
    const rejectedDoc = await callReadOnlyTool(context, "shipready.get_policy_doc", { name: "../README.md" });
    expect(rejectedDoc).toMatchObject({ isError: true, structuredContent: { code: "doc_not_found" } });
  });

  it("normalizes invalid input, unknown fields, authorization, and timeouts", async () => {
    const invalid = await callReadOnlyTool(context, "shipready.audit_site", { url: "not-a-url" });
    const unknown = await callReadOnlyTool(context, "shipready.audit_site", { url, extra: true });
    const outside = await callReadOnlyTool(context, "shipready.inspect_repo", { repoPath: tmpdir() });
    const timeoutContext: McpToolContext = {
      ...context,
      timeouts: { audit_site: 20, inspect_repo: 10_000, plan_fixes: 45_000, preview_fixes: 45_000, get_ui_report: 45_000, canonical_read: 5_000 },
      operations: { auditSite: async () => new Promise(() => undefined) },
    };
    const timedOut = await callReadOnlyTool(timeoutContext, "shipready.audit_site", { url, rendered: false });
    expect(invalid).toMatchObject({ isError: true, structuredContent: { contract: "shipready.error.v1", code: "invalid_url" } });
    expect(unknown).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
    expect(outside).toMatchObject({ isError: true, structuredContent: { code: "path_not_authorized" } });
    expect(timedOut).toMatchObject({ isError: true, structuredContent: { code: "timeout", retryable: true, details: { timeoutMs: 20 } } });
  });

  it("normalizes cancellation, network, render, and contract failures", async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    const cancelledResult = await callReadOnlyTool(context, "shipready.audit_site", { url, rendered: false }, cancelled.signal);
    const networkResult = await callReadOnlyTool({
      ...context,
      operations: { auditSite: async () => { throw new NetworkError("secret upstream detail"); } },
    }, "shipready.audit_site", { url, rendered: false });
    const renderResult = await callReadOnlyTool({
      ...context,
      operations: { auditSite: async () => { throw new Error("playwright browser failed at /private/path"); } },
    }, "shipready.audit_site", { url, rendered: false });
    const contractResult = await callReadOnlyTool({
      ...context,
      operations: { auditSite: async () => ({}) as never },
    }, "shipready.audit_site", { url, rendered: false });

    expect(cancelledResult).toMatchObject({ isError: true, structuredContent: { code: "cancelled" } });
    expect(networkResult).toMatchObject({ isError: true, structuredContent: { code: "network_error" } });
    expect(renderResult).toMatchObject({ isError: true, structuredContent: { code: "render_error" } });
    expect(contractResult).toMatchObject({ isError: true, structuredContent: { code: "contract_error" } });
    expect(JSON.stringify([networkResult, renderResult])).not.toContain("secret upstream detail");
    expect(JSON.stringify(renderResult)).not.toContain("/private/path");
  });
});

async function staticServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    response.statusCode = 200;
    if (request.url === "/robots.txt") {
      response.setHeader("content-type", "text/plain");
      response.end("User-agent: *\nAllow: /\n");
    } else if (request.url === "/sitemap.xml") {
      response.setHeader("content-type", "application/xml");
      response.end(`<urlset><url><loc>http://127.0.0.1/</loc></url></urlset>`);
    } else {
      response.setHeader("content-type", "text/html");
      response.end("<!doctype html><html lang=\"en\"><head><title>Local test page</title><meta name=\"description\" content=\"Deterministic ShipReady MCP test page.\"></head><body><h1>Test</h1></body></html>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function treeDigest(directory: string): Promise<string> {
  const records: string[] = [];
  async function walk(current: string, relative = "") {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const stats = await lstat(path);
      if (entry.isDirectory()) {
        records.push(`d ${name} ${stats.mode}`);
        await walk(path, name);
      } else if (entry.isSymbolicLink()) {
        records.push(`l ${name} ${await readlink(path)}`);
      } else {
        const content = await readFile(path);
        records.push(`f ${name} ${stats.mode} ${content.length} ${createHash("sha256").update(content).digest("hex")}`);
      }
    }
  }
  await walk(directory);
  return createHash("sha256").update(records.join("\n")).digest("hex");
}
