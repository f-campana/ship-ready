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
  GithubPrDraftJsonContractSchema,
} from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const fixtureRoot = join(import.meta.dirname, "fixtures", "repos");
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("github-pr-draft CLI", () => {
  it("writes only the requested PR draft artifact and leaves the target repo unchanged", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-pr-draft-file-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const outputPath = join(tempRoot, "shipready-pr.md");
      const patchPath = join(tempRoot, "shipready.patch");
      await execFileAsync("pnpm", [
        "--silent",
        "shipready",
        "patch-export",
        repoPath,
        "--url",
        server.url,
        "--output",
        patchPath,
        "--no-render",
      ], { cwd: root, timeout: 20_000 });
      const beforeRepo = await treeDigest(repoPath);

      const { stdout, stderr } = await execFileAsync("pnpm", [
        "--silent",
        "shipready",
        "github-pr-draft",
        repoPath,
        "--url",
        server.url,
        "--patch",
        patchPath,
        "--output",
        outputPath,
        "--github-repo",
        "f-campana/ship-ready",
        "--include-gh-command",
        "--json",
        "--no-render",
      ], { cwd: root, timeout: 20_000 });

      const result = GithubPrDraftJsonContractSchema.parse(JSON.parse(stdout));
      const markdown = await readFile(outputPath, "utf8");

      expect(stderr).toBe("");
      expect(result.output).toMatchObject({
        kind: "file",
        path: outputPath,
        wroteArtifact: true,
        bytesWritten: Buffer.byteLength(markdown, "utf8"),
      });
      expect(result.source).toMatchObject({
        patchPath,
        patchSource: "existing_file",
      });
      expect(result.commands.gh).toContain("gh pr create");
      expect(result.draft.body).toContain("ShipReady did not create this PR");
      expect(markdown).toContain("# ShipReady GitHub PR Draft");
      expect(markdown).toContain("Not executed by ShipReady");
      expect(await treeDigest(repoPath)).toBe(beforeRepo);
      expect(await fileNames(tempRoot)).toEqual(["repo", "shipready-pr.md", "shipready.patch"]);
    } finally {
      await server.close();
    }
  }, 20_000);

  it("prints markdown to stdout and writes no artifact in stdout mode", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-pr-draft-stdout-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const beforeRepo = await treeDigest(repoPath);
      const beforeRoot = await fileNames(tempRoot);

      const { stdout, stderr } = await execFileAsync("pnpm", [
        "--silent",
        "shipready",
        "github-pr-draft",
        repoPath,
        "--url",
        server.url,
        "--stdout",
        "--no-render",
      ], { cwd: root, timeout: 20_000 });

      expect(stderr).toBe("");
      expect(stdout).toContain("# ShipReady GitHub PR Draft");
      expect(stdout).toContain("ShipReady did not create a live pull request");
      expect(stdout).toContain("git checkout -b shipready/launch-readiness");
      expect(await treeDigest(repoPath)).toBe(beforeRepo);
      expect(await fileNames(tempRoot)).toEqual(beforeRoot);
    } finally {
      await server.close();
    }
  }, 20_000);

  it("rejects output paths inside the inspected target repo", async () => {
    const server = await crawlServer();
    try {
      const tempRoot = await temp("shipready-pr-draft-inside-");
      const repoPath = await copyRepo("vite-react", tempRoot);
      const outputPath = join(repoPath, "shipready-pr.md");
      const beforeRepo = await treeDigest(repoPath);

      const failure = await expectCommandFailure([
        "--silent",
        "shipready",
        "github-pr-draft",
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
  }, 20_000);

  it("emits JSON errors for invalid input", async () => {
    const missingOutput = await expectCommandFailure([
      "--silent",
      "shipready",
      "github-pr-draft",
      ".",
      "--url",
      "https://example.com",
      "--json",
    ]);
    const invalidUrl = await expectCommandFailure([
      "--silent",
      "shipready",
      "github-pr-draft",
      ".",
      "--url",
      "not-a-url",
      "--stdout",
      "--json",
    ]);
    const invalidRepo = await expectCommandFailure([
      "--silent",
      "shipready",
      "github-pr-draft",
      ".",
      "--url",
      "https://example.com",
      "--stdout",
      "--github-repo",
      "not-owner-repo",
      "--json",
    ]);

    expect(CliErrorContractSchema.parse(JSON.parse(missingOutput.stdout ?? ""))).toMatchObject({
      code: "invalid_output_path",
    });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidUrl.stdout ?? ""))).toMatchObject({
      code: "invalid_url",
    });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidRepo.stdout ?? ""))).toMatchObject({
      code: "invalid_github_repo",
    });
  }, 20_000);
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
    response.end("<!doctype html><html lang=\"en\"><head><title>PR draft test</title><meta name=\"description\" content=\"PR draft test page.\"></head><body><h1>PR draft test</h1></body></html>");
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
