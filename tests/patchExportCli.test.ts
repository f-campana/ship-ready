import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  CliErrorContractSchema,
  PatchExportJsonContractSchema,
} from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const fixtureRoot = join(import.meta.dirname, "fixtures", "repos");
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("patch-export CLI", () => {
  it("writes only the requested output artifact and leaves the target repo unchanged", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-patch-export-file-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const outputPath = join(tempRoot, "shipready.patch");
      const beforeRepo = await treeDigest(repoPath);

      const { stdout, stderr } = await execFileAsync("pnpm", [
        "--silent",
        "shipready",
        "patch-export",
        repoPath,
        "--url",
        server.url,
        "--output",
        outputPath,
        "--json",
        "--no-render",
      ], { cwd: root, timeout: 20_000 });

      const result = PatchExportJsonContractSchema.parse(JSON.parse(stdout));
      const patch = await readFile(outputPath, "utf8");

      expect(stderr).toBe("");
      expect(result.output).toMatchObject({
        kind: "file",
        path: outputPath,
        wroteArtifact: true,
        bytesWritten: Buffer.byteLength(patch, "utf8"),
      });
      expect(result.output).not.toHaveProperty("content");
      expect(patch).toContain("diff --git a/public/robots.txt b/public/robots.txt");
      expect(patch).toContain("review-only artifact; not applied");
      expect(await treeDigest(repoPath)).toBe(beforeRepo);
      expect(await fileNames(tempRoot)).toEqual(["repo", "shipready.patch"]);
    } finally {
      await server.close();
    }
  });

  it("prints a patch to stdout and writes no artifact in stdout mode", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-patch-export-stdout-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const beforeRepo = await treeDigest(repoPath);
      const beforeRoot = await fileNames(tempRoot);

      const { stdout, stderr } = await execFileAsync("pnpm", [
        "--silent",
        "shipready",
        "patch-export",
        repoPath,
        "--url",
        server.url,
        "--stdout",
        "--no-render",
      ], { cwd: root, timeout: 20_000 });

      expect(stderr).toBe("");
      expect(stdout).toContain("# ShipReady patch export manifest");
      expect(stdout).toContain("diff --git a/public/sitemap.xml b/public/sitemap.xml");
      expect(await treeDigest(repoPath)).toBe(beforeRepo);
      expect(await fileNames(tempRoot)).toEqual(beforeRoot);
    } finally {
      await server.close();
    }
  });

  it("rejects output paths inside the inspected target repo", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-patch-export-inside-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const outputPath = join(repoPath, "shipready.patch");
      const beforeRepo = await treeDigest(repoPath);

      const failure = await expectCommandFailure([
        "--silent",
        "shipready",
        "patch-export",
        repoPath,
        "--url",
        server.url,
        "--output",
        outputPath,
        "--json",
        "--no-render",
      ], 20_000);

      expect(failure.code).toBe(1);
      expect(failure.stderr).toBe("");
      expect(CliErrorContractSchema.parse(JSON.parse(failure.stdout ?? ""))).toMatchObject({
        code: "invalid_output_path",
      });
      await expect(lstat(outputPath)).rejects.toThrow();
      expect(await treeDigest(repoPath)).toBe(beforeRepo);
    } finally {
      await server.close();
    }
  });

  it("emits JSON errors for invalid input", async () => {
    const missingOutput = await expectCommandFailure([
      "--silent",
      "shipready",
      "patch-export",
      ".",
      "--url",
      "https://example.com",
      "--json",
    ]);
    const invalidUrl = await expectCommandFailure([
      "--silent",
      "shipready",
      "patch-export",
      ".",
      "--url",
      "not-a-url",
      "--stdout",
      "--json",
    ]);

    expect(CliErrorContractSchema.parse(JSON.parse(missingOutput.stdout ?? ""))).toMatchObject({
      code: "invalid_output_path",
    });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidUrl.stdout ?? ""))).toMatchObject({
      code: "invalid_url",
    });
  });
});

async function expectCommandFailure(
  args: string[],
  timeout = 10_000,
): Promise<{ code?: number; stdout?: string; stderr?: string }> {
  try {
    await execFileAsync("pnpm", args, { cwd: root, timeout });
  } catch (error) {
    return error as { code?: number; stdout?: string; stderr?: string };
  }
  throw new Error("Expected command to fail.");
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
    response.end("<!doctype html><html lang=\"en\"><head><title>Patch export test</title><meta name=\"description\" content=\"Patch export test page.\"></head><body><h1>Patch export test</h1></body></html>");
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

async function fileNames(directory: string): Promise<string[]> {
  return (await readdir(directory)).sort();
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
