import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import {
  createPreviewReceiptManager,
  McpPreviewReceiptSchema,
  PREVIEW_RECEIPT_KIND,
} from "../src/mcp/previewReceipts";
import { callTool, type McpToolContext } from "../src/mcp/tools";
import { resolvePackageRoot } from "../src/mcp/resources";
import { DryRunFixJsonContractSchema } from "../src/types/contracts";
import { WRITE_POLICY_V1 } from "../src/types/writeFix";

const root = join(import.meta.dirname, "..");
const fixtureRoot = join(root, "tests", "fixtures", "repos");
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("MCP preview receipts", () => {
  it("adds a signed short-lived receipt for eligible V1 safe crawl-file creations", async () => {
    const server = await crawlServer({ resourcesExist: false });
    try {
      const tempRoot = await temp("shipready-mcp-receipt-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const signingKey = Buffer.from("shipready-test-signing-key");
      const context = await contextFor(tempRoot, createPreviewReceiptManager({ signingKey }));

      const result = await callTool(context, "shipready.preview_fixes", {
        url: server.url,
        repoPath,
        rendered: false,
      });

      expect("isError" in result ? result.isError : false).toBe(false);
      expect(() => DryRunFixJsonContractSchema.parse(result.structuredContent)).not.toThrow();
      const structured = result.structuredContent as Record<string, unknown>;
      const receipt = McpPreviewReceiptSchema.parse(structured.previewReceipt);
      expect(receipt).toMatchObject({
        kind: PREVIEW_RECEIPT_KIND,
        policy: WRITE_POLICY_V1,
        url: server.url,
        repoRealPath: await realpath(repoPath),
        dryRunContract: "shipready.dryRunFix.v1",
        eligiblePaths: ["public/robots.txt", "public/sitemap.xml"],
      });
      expect(Date.parse(receipt.expiresAt)).toBeGreaterThan(Date.parse(receipt.issuedAt));
      expect(receipt.dryRunDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.eligibleDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.signature).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(result)).not.toContain(signingKey.toString("utf8"));
      expect(JSON.stringify(result)).not.toContain(signingKey.toString("hex"));
    } finally {
      await server.close();
    }
  });

  it("omits the receipt when no eligible crawl-file creation candidates exist", async () => {
    const server = await crawlServer({ resourcesExist: true });
    try {
      const tempRoot = await temp("shipready-mcp-no-receipt-");
      const repoPath = await copyRepo("static-html", tempRoot);
      const context = await contextFor(tempRoot);

      const result = await callTool(context, "shipready.preview_fixes", {
        url: server.url,
        repoPath,
        rendered: false,
      });

      expect("isError" in result ? result.isError : false).toBe(false);
      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured.previewReceipt).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it("rejects tampered, expired, URL-mismatched, and repo-mismatched receipts without writing", async () => {
    let now = Date.parse("2026-06-25T12:00:00.000Z");
    const receipts = createPreviewReceiptManager({
      signingKey: Buffer.from("shipready-test-tamper-key"),
      ttlMs: 1_000,
      now: () => now,
    });
    const server = await crawlServer({ resourcesExist: false });
    try {
      const tempRoot = await temp("shipready-mcp-receipt-reject-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const otherRepoPath = await copyRepo("vite-react", tempRoot, "other");
      const context = await contextFor(tempRoot, receipts);

      const preview = await callTool(context, "shipready.preview_fixes", {
        url: server.url,
        repoPath,
        rendered: false,
      });
      const structured = preview.structuredContent as Record<string, unknown>;
      const receipt = McpPreviewReceiptSchema.parse(structured.previewReceipt);

      const tampered = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        previewReceipt: { ...receipt, eligiblePaths: ["public/sitemap.xml"] },
        confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY",
        rendered: false,
      });
      expect(tampered).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });

      const mismatchedUrl = await callTool(context, "shipready.write_safe_crawl_files", {
        url: `${server.url}different`,
        repoPath,
        previewReceipt: receipt,
        confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY",
        rendered: false,
      });
      expect(mismatchedUrl).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });

      const mismatchedRepo = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath: otherRepoPath,
        previewReceipt: receipt,
        confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY",
        rendered: false,
      });
      expect(mismatchedRepo).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });

      now += 1_001;
      const expired = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        previewReceipt: receipt,
        confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY",
        rendered: false,
      });
      expect(expired).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });
      expect(await listFiles(repoPath)).not.toContain("public/robots.txt");
      expect(await listFiles(repoPath)).not.toContain("public/sitemap.xml");
      expect(await listFiles(otherRepoPath)).not.toContain("public/robots.txt");
    } finally {
      await server.close();
    }
  });
});

async function contextFor(
  allowedRoot: string,
  previewReceipts = createPreviewReceiptManager(),
): Promise<McpToolContext> {
  return {
    authorizer: await PathAuthorizer.create([allowedRoot]),
    packageRoot: await resolvePackageRoot(),
    previewReceipts,
  };
}

async function copyRepo(name: string, parent: string, targetName = "repo"): Promise<string> {
  const repoPath = join(parent, targetName);
  await cp(join(fixtureRoot, name), repoPath, { recursive: true });
  return repoPath;
}

async function temp(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  cleanup.push(path);
  return path;
}

async function crawlServer(options: { resourcesExist: boolean }): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.statusCode = options.resourcesExist ? 200 : 404;
      response.setHeader("content-type", "text/plain");
      response.end(options.resourcesExist ? "User-agent: *\nAllow: /\n" : "not found");
      return;
    }

    if (request.url === "/sitemap.xml") {
      response.statusCode = options.resourcesExist ? 200 : 404;
      response.setHeader("content-type", "application/xml");
      response.end(options.resourcesExist
        ? "<?xml version=\"1.0\"?><urlset><url><loc>http://127.0.0.1/</loc></url></urlset>"
        : "not found");
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end("<!doctype html><html lang=\"en\"><head><title>Receipt test</title><meta name=\"description\" content=\"Receipt test page.\"><link rel=\"canonical\" href=\"http://127.0.0.1/\"></head><body><h1>Receipt test</h1></body></html>");
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

async function listFiles(directory: string): Promise<string[]> {
  const records: string[] = [];
  async function walk(current: string, relative = "") {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path, name);
      } else {
        records.push(name);
      }
    }
  }
  await walk(directory);
  return records.sort();
}

async function treeDigest(directory: string): Promise<string> {
  const files = await listFiles(directory);
  const records = await Promise.all(files.map(async (file) =>
    `${file}:${createHash("sha256").update(await readFile(join(directory, file))).digest("hex")}`));
  return createHash("sha256").update(records.join("\n")).digest("hex");
}
