import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { CliErrorContractSchema, RecheckJsonContractSchema } from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const cli = join(root, "src", "cli", "index.ts");
const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("recheck CLI", () => {
  it("emits human and JSON URL-only reports from deterministic HTTP evidence", async () => {
    const url = await fixtureServer("ready");
    const human = await run(["recheck", "--url", url]);
    const json = await run(["recheck", "--url", url, "--json"]);
    const result = RecheckJsonContractSchema.parse(JSON.parse(json.stdout));

    expect(human.stderr).toBe("");
    expect(human.stdout).toContain("ShipReady post-write recheck");
    expect(human.stdout).toContain("robots.txt: present");
    expect(human.stdout).toContain("Deployment: not_checked");
    expect(result).toMatchObject({ mode: "url_only", verdict: { status: "ready" } });
  });

  it("reports missing and unreachable live evidence without overclaiming", async () => {
    const missingUrl = await fixtureServer("missing");
    const missing = RecheckJsonContractSchema.parse(JSON.parse((await run([
      "recheck", "--url", missingUrl, "--json",
    ])).stdout));

    const unreachableServer = createServer();
    await new Promise<void>((resolve) => unreachableServer.listen(0, "127.0.0.1", resolve));
    const address = unreachableServer.address();
    if (!address || typeof address === "string") throw new Error("No fixture address.");
    const unreachableUrl = `http://127.0.0.1:${address.port}/`;
    await new Promise<void>((resolve) => unreachableServer.close(() => resolve()));
    const unreachable = RecheckJsonContractSchema.parse(JSON.parse((await run([
      "recheck", "--url", unreachableUrl, "--json", "--timeout", "1000",
    ])).stdout));

    expect(missing).toMatchObject({
      live: { robots: { status: "missing" }, sitemap: { status: "missing" } },
      verdict: { status: "needs_attention" },
    });
    expect(unreachable).toMatchObject({
      live: { robots: { status: "unreachable" }, sitemap: { status: "unreachable" } },
      verdict: { status: "unknown" },
    });
    expect(unreachable.live.robots.message).toContain("could not be determined");
  });

  it("compares an actual disposable repo without mutating it", async () => {
    const url = await fixtureServer("ready");
    const repo = await mkdtemp(join(tmpdir(), "shipready-recheck-cli-"));
    temporaryDirectories.push(repo);
    await mkdir(join(repo, "public"));
    await mkdir(join(repo, "src"));
    await writeFile(join(repo, "package.json"), JSON.stringify({ dependencies: { vite: "1.0.0", react: "1.0.0" } }));
    await writeFile(join(repo, "vite.config.ts"), "export default {}\n");
    await writeFile(join(repo, "index.html"), "<main>fixture</main>\n");
    await writeFile(join(repo, "src", "main.tsx"), "export {};\n");
    await writeFile(join(repo, "public", "robots.txt"), "User-agent: *\nAllow: /\n");
    await writeFile(join(repo, "public", "sitemap.xml"), "<urlset></urlset>\n");
    const before = await snapshot(repo);

    const command = await run(["recheck", repo, "--url", url, "--json"]);
    const result = RecheckJsonContractSchema.parse(JSON.parse(command.stdout));

    expect(command.stderr).toBe("");
    expect(result).toMatchObject({
      mode: "repo_backed",
      deployment: { status: "appears_deployed" },
      verdict: { status: "ready" },
    });
    expect(await snapshot(repo)).toEqual(before);
  });

  it("returns shipready.error.v1 for invalid URL and repository input", async () => {
    const invalidUrl = await runFailure(["recheck", "--url", "not-a-url", "--json"]);
    const invalidPath = await runFailure([
      "recheck", "/path/that/does/not/exist", "--url", "https://example.com", "--json",
    ]);
    expect(CliErrorContractSchema.parse(JSON.parse(invalidUrl.stdout))).toMatchObject({ code: "invalid_url" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidPath.stdout))).toMatchObject({ code: "invalid_repo_path" });
    expect(invalidUrl.stderr).toBe("");
    expect(invalidPath.stderr).toBe("");
    expect(invalidPath.stdout).not.toContain("/path/that/does/not/exist");
  });
});

async function fixtureServer(mode: "ready" | "missing"): Promise<string> {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(mode === "ready" ? 200 : 404, { "content-type": "text/plain" });
      response.end(mode === "ready" ? "User-agent: *\nAllow: /\n" : "not found\n");
      return;
    }
    if (request.url === "/sitemap.xml") {
      response.writeHead(mode === "ready" ? 200 : 404, { "content-type": "application/xml" });
      response.end(mode === "ready"
        ? "<?xml version=\"1.0\"?><urlset><url><loc>http://fixture/</loc></url></urlset>"
        : "not found\n");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html lang=\"en\"><head><title>Fixture</title></head><body><h1>Fixture</h1></body></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture address.");
  return `http://127.0.0.1:${address.port}/`;
}

function run(args: string[]) {
  return execFileAsync(tsx, [cli, ...args], { cwd: root, timeout: 15_000 });
}

async function runFailure(args: string[]) {
  try {
    await run(args);
    throw new Error("Expected command failure.");
  } catch (error) {
    return error as { code: number; stdout: string; stderr: string };
  }
}

async function snapshot(directory: string): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  async function walk(current: string, prefix = "") {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute, relative);
      else output[relative] = await readFile(absolute, "utf8");
    }
  }
  await walk(directory);
  return output;
}
