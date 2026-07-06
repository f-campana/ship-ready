import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { listTools } from "../src/mcp/tools";
import { StatusJsonContractSchema } from "../src/types/contracts";
import { createStatus, formatStatusHuman } from "../src/status/status";
import { WRITE_POLICY_V1 } from "../src/types/writeFix";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("status", () => {
  it("formats concise human output", () => {
    const output = formatStatusHuman();
    expect(output).toContain("ShipReady status (v0.1.0)");
    expect(output).toContain("CLI first -> MCP second -> GUI third");
    expect(output).toContain("shipready.write_safe_crawl_files");
    expect(output).toContain("no write endpoint");
    expect(output).toContain("pnpm shipready doctor");
    expect(output).toContain("mock prototype available, live integration not implemented");
    expect(output).toContain("DNS readiness: read-only status checks implemented");
    expect(output).toContain("Post-write recheck: implemented read-only");
    expect(output).toContain("Social preview simulator: implemented read-only");
    expect(output).toContain("Generated-site implementation smell detector: implemented read-only");
    expect(output).toContain("Deployment automation and deploy provider integrations: not implemented");
  });

  it("emits the stable JSON capability and safety contract", async () => {
    const { stdout, stderr } = await execFileAsync(tsx, [join(root, "src/cli/index.ts"), "status", "--json"], {
      cwd: root,
      timeout: 10_000,
    });
    const status = StatusJsonContractSchema.parse(JSON.parse(stdout));
    expect(stderr).toBe("");
    expect(status.mode).toEqual({ cliFirst: true, mcpSecond: true, guiThird: true });
    expect(status.capabilities.mcp).toMatchObject({ stdio: true, remoteTransport: false });
    expect(status.capabilities.mcp.writeTools).toEqual(["shipready.write_safe_crawl_files"]);
    expect(status.capabilities.gui).toEqual({ local: true, writeEndpoint: false });
    expect(status.integrations).toEqual({
      generatedSiteSmells: "read_only_detector",
      aiAuthorshipDetection: "not_implemented",
      smellDetectorAutoFixes: "not_implemented",
      socialPreview: "read_only_simulator",
      socialPlatformApis: "not_implemented",
      exactSocialRenderingGuarantee: false,
      searchConsole: "mock_prototype",
      dns: "read_only_status",
      dnsProviderWrites: "not_implemented",
      dnsProviderIntegrations: "not_implemented",
      github: "not_implemented",
      deployment: "not_implemented",
      postWriteRecheck: "read_only",
      deploymentAutomation: "not_implemented",
      deployProviderIntegrations: "not_implemented",
    });
    expect(status.writePolicy.id).toBe(WRITE_POLICY_V1);
  });

  it("stays synchronized with the MCP registry", () => {
    const status = createStatus();
    const registered = listTools().map((tool) => tool.name);
    expect([
      ...status.capabilities.mcp.readOnlyTools,
      ...status.capabilities.mcp.writeTools,
    ].sort()).toEqual([...registered].sort());
    expect(status.capabilities.mcp.writeTools).toHaveLength(1);
  });

  it("stays synchronized with the package version", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { version: string };
    expect(createStatus().version).toBe(packageJson.version);
  });

  it("does not inspect or mutate the current working directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-status-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, "sentinel.txt"), "unchanged\n");
    const before = await directorySnapshot(directory);
    await execFileAsync(tsx, [join(root, "src/cli/index.ts"), "status"], {
      cwd: directory,
      timeout: 10_000,
    });
    expect(await directorySnapshot(directory)).toEqual(before);
  });
});

async function directorySnapshot(directory: string): Promise<Record<string, string>> {
  const names = (await readdir(directory)).sort();
  return Object.fromEntries(await Promise.all(names.map(async (name) => [
    name,
    await readFile(join(directory, name), "utf8"),
  ])));
}
