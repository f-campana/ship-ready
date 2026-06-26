import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { robotsTxtForUrl, sitemapXmlForUrl } from "../src/fix/generatedCrawlFiles";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { createPreviewReceiptManager, McpPreviewReceiptSchema } from "../src/mcp/previewReceipts";
import {
  callTool,
  WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
  type McpToolContext,
} from "../src/mcp/tools";
import { resolvePackageRoot } from "../src/mcp/resources";
import { WriteFixJsonContractSchema } from "../src/types/contracts";

const root = join(import.meta.dirname, "..");
const fixtureRoot = join(root, "tests", "fixtures", "repos");
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("MCP write_safe_crawl_files", () => {
  it("creates only eligible missing crawl files and returns shipready.writeFix.v1", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-mcp-write-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const context = await contextFor(tempRoot);
      const indexBefore = await readFile(join(repoPath, "index.html"), "utf8");
      const packageBefore = await readFile(join(repoPath, "package.json"), "utf8");

      const receipt = await previewReceipt(context, server.url, repoPath);
      const result = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        previewReceipt: receipt,
        confirmation: WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
        rendered: false,
      });

      expect("isError" in result ? result.isError : false).toBe(false);
      const contract = WriteFixJsonContractSchema.parse(result.structuredContent);
      expect(contract).toMatchObject({
        contract: "shipready.writeFix.v1",
        mode: "write",
        wroteFiles: true,
        policy: "creation_only_robots_sitemap_v1",
      });
      expect(contract.createdFiles.map((file) => file.path).sort()).toEqual([
        "public/robots.txt",
        "public/sitemap.xml",
      ]);
      expect(await readFile(join(repoPath, "public", "robots.txt"), "utf8")).toBe(robotsTxtForUrl(server.url));
      expect(await readFile(join(repoPath, "public", "sitemap.xml"), "utf8")).toBe(sitemapXmlForUrl(server.url));
      expect(await readFile(join(repoPath, "index.html"), "utf8")).toBe(indexBefore);
      expect(await readFile(join(repoPath, "package.json"), "utf8")).toBe(packageBefore);
      expect(await listFiles(repoPath)).not.toContain("package-lock.json");
      expect(await listFiles(repoPath)).not.toContain(".git/index");
    } finally {
      await server.close();
    }
  });

  it("requires the exact confirmation phrase and a well-formed receipt", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-mcp-confirmation-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const context = await contextFor(tempRoot);
      const before = await treeDigest(repoPath);
      const receipt = await previewReceipt(context, server.url, repoPath);

      const missingReceipt = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        confirmation: WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
        rendered: false,
      });
      const wrongConfirmation = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        previewReceipt: receipt,
        confirmation: "YES",
        rendered: false,
      });
      const extraPathList = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        previewReceipt: receipt,
        confirmation: WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
        eligiblePaths: ["public/robots.txt"],
        rendered: false,
      });

      expect(missingReceipt).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });
      expect(wrongConfirmation).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });
      expect(extraPathList).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
      expect(await treeDigest(repoPath)).toBe(before);
    } finally {
      await server.close();
    }
  });

  it("re-authorizes repoPath on write and rejects outside roots and symlink escapes", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-mcp-authorization-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const outsideRoot = await temp("shipready-mcp-outside-");
      const outsideRepo = await copyRepo("vite-react", outsideRoot);
      const context = await contextFor(tempRoot);
      const receipt = await previewReceipt(context, server.url, repoPath);

      const outside = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath: outsideRepo,
        previewReceipt: receipt,
        confirmation: WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
        rendered: false,
      });
      expect(outside).toMatchObject({ isError: true, structuredContent: { code: "path_not_authorized" } });

      const linkPath = join(tempRoot, "escape-link");
      try {
        await symlink(outsideRepo, linkPath, "dir");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") return;
        throw error;
      }
      const symlinkEscape = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath: linkPath,
        previewReceipt: receipt,
        confirmation: WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
        rendered: false,
      });
      expect(symlinkEscape).toMatchObject({ isError: true, structuredContent: { code: "path_not_authorized" } });
      expect(await listFiles(outsideRepo)).not.toContain("public/robots.txt");
    } finally {
      await server.close();
    }
  });

  it("recomputes current candidates and writes nothing when the reviewed preview is stale", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-mcp-stale-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const context = await contextFor(tempRoot);
      const receipt = await previewReceipt(context, server.url, repoPath);
      const beforePackage = await readFile(join(repoPath, "package.json"), "utf8");

      await writeRepoFile(repoPath, "public/robots.txt", "existing\n");
      const result = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        previewReceipt: receipt,
        confirmation: WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
        rendered: false,
      });

      expect(result).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });
      expect(await readFile(join(repoPath, "public", "robots.txt"), "utf8")).toBe("existing\n");
      expect(await listFiles(repoPath)).not.toContain("public/sitemap.xml");
      expect(await readFile(join(repoPath, "package.json"), "utf8")).toBe(beforePackage);
    } finally {
      await server.close();
    }
  });

  it("does not trust client-mutated receipt paths as write authority", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-mcp-mutated-receipt-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const context = await contextFor(tempRoot);
      const before = await treeDigest(repoPath);
      const receipt = await previewReceipt(context, server.url, repoPath);

      const result = await callTool(context, "shipready.write_safe_crawl_files", {
        url: server.url,
        repoPath,
        previewReceipt: {
          ...receipt,
          eligiblePaths: ["index.html"],
        },
        confirmation: WRITE_SAFE_CRAWL_FILES_CONFIRMATION,
        rendered: false,
      });

      expect(result).toMatchObject({ isError: true, structuredContent: { code: "write_forbidden" } });
      expect(await treeDigest(repoPath)).toBe(before);
    } finally {
      await server.close();
    }
  });
});

async function previewReceipt(context: McpToolContext, url: string, repoPath: string) {
  const preview = await callTool(context, "shipready.preview_fixes", {
    url,
    repoPath,
    rendered: false,
  });
  expect("isError" in preview ? preview.isError : false).toBe(false);
  const structured = preview.structuredContent as Record<string, unknown>;
  return McpPreviewReceiptSchema.parse(structured.previewReceipt);
}

async function contextFor(allowedRoot: string): Promise<McpToolContext> {
  return {
    authorizer: await PathAuthorizer.create([allowedRoot]),
    packageRoot: await resolvePackageRoot(),
    previewReceipts: createPreviewReceiptManager(),
  };
}

async function copyRepo(name: string, parent: string): Promise<string> {
  const repoPath = join(parent, "repo");
  await cp(join(fixtureRoot, name), repoPath, { recursive: true });
  return repoPath;
}

async function temp(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  cleanup.push(path);
  return path;
}

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
    response.end("<!doctype html><html lang=\"en\"><head><title>Write test</title><meta name=\"description\" content=\"Write test page.\"></head><body><h1>Write test</h1></body></html>");
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

async function writeRepoFile(repoPath: string, relativePath: string, content: string): Promise<void> {
  const absolutePath = join(repoPath, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
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
