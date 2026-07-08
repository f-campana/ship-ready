import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const cli = join(root, "src", "cli", "index.ts");
const fixtureRepo = join(root, "tests", "fixtures", "repos", "static-html");

let server: { url: string; close: () => Promise<void> } | undefined;

beforeEach(async () => {
  server = await auditServer();
});

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("terminal output polish", () => {
  it("puts dry-run verdict, target, next action, and safety labels first", async () => {
    const { stdout, stderr } = await run([
      "fix",
      fixtureRepo,
      "--url",
      server!.url,
      "--dry-run",
      "--no-render",
    ]);

    expect(stderr).toBe("");
    expect(stdout).toContain("ShipReady dry-run fix preview");
    expect(stdout).toContain(`Target: ${server!.url}`);
    expect(stdout).toContain("Repo: tests/fixtures/repos/static-html");
    expect(stdout).toContain("Status:");
    expect(stdout).toContain("Next: Review the preview; no files were changed by this dry-run.");
    expect(stdout).toContain("Top changes");
    expect(stdout).toContain("Safe write is limited to eligible missing robots/sitemap file creation under WRITE_POLICY_V1.");
    expect(stdout).toContain("Review-required previews are not write authorization.");
    expect(stdout).toContain("More: Run with --json for full contract output.");
  });

  it("gives ui-report a readable human terminal summary", async () => {
    const { stdout, stderr } = await run([
      "ui-report",
      fixtureRepo,
      "--url",
      server!.url,
      "--no-render",
    ]);

    expect(stderr).toBe("");
    expect(stdout).toContain("ShipReady UI report");
    expect(stdout).toContain(`Target: ${server!.url}`);
    expect(stdout).toContain("Status:");
    expect(stdout).toContain("Next:");
    expect(stdout).toContain("Top findings");
    expect(stdout).toContain("Read-only UI data. No files were modified");
    expect(stdout).toContain("More: Run with --json for full contract output.");
  });

  it("does not leak ANSI formatting into JSON output", async () => {
    const { stdout, stderr } = await execFileAsync(tsx, [cli, "status", "--json"], {
      cwd: root,
      env: { ...process.env, NO_COLOR: "1" },
      timeout: 10_000,
    });

    expect(stderr).toBe("");
    expect(stdout).not.toMatch(/\x1B\[[0-9;]*m/);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });
});

function run(args: string[]) {
  return execFileAsync(tsx, [cli, ...args], {
    cwd: root,
    timeout: 20_000,
  });
}

async function auditServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const testServer = createServer((request, response) => {
    if (request.url === "/robots.txt" || request.url === "/sitemap.xml") {
      response.statusCode = 404;
      response.setHeader("content-type", "text/plain");
      response.end("not found");
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end("<!doctype html><html lang=\"en\"><head><title>Terminal output test</title></head><body><h1>Terminal output test</h1></body></html>");
  });
  await listen(testServer);
  const address = testServer.address();
  if (!address || typeof address === "string") throw new Error("No test server address.");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => testServer.close((error) => error ? reject(error) : resolve())),
  };
}

function listen(testServer: Server): Promise<void> {
  return new Promise((resolve) => testServer.listen(0, "127.0.0.1", resolve));
}
