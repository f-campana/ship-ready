import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { formatDoctorHuman, runDoctor } from "../src/doctor/doctor";
import { DoctorJsonContractSchema } from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("doctor", () => {
  it("formats scan-friendly human output", async () => {
    const report = await runDoctor();
    const output = formatDoctorHuman(report);
    expect(output).toContain("ShipReady doctor");
    expect(output).toContain("[PASS] Node.js");
    expect(output).toContain("Summary:");
    expect(output).toContain("Ready:");
  });

  it("emits a stable JSON contract whose summary matches its checks", async () => {
    const result = await execFileAsync(tsx, [join(root, "src/cli/index.ts"), "doctor", "--json"], {
      cwd: root,
      timeout: 10_000,
    }).catch((error: unknown) => {
      const failure = error as { stdout?: string; stderr?: string };
      return { stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
    });
    const report = DoctorJsonContractSchema.parse(JSON.parse(result.stdout));
    expect(result.stderr).toBe("");
    expect(report.checks.length).toBeGreaterThan(8);
    expect(report.checks.some((check) => check.status === "pass")).toBe(true);
    expect(report.checks.every((check) => ["pass", "warn", "fail", "skip"].includes(check.status))).toBe(true);
    expect(Object.values(report.summary).reduce((total, count) => total + count, 0)).toBe(report.checks.length);
    expect(report.checks.find((check) => check.id === "search-console-prototype")).toMatchObject({
      status: "pass",
      details: { liveIntegration: false, oauthRequired: false, fixtures: 7 },
    });
    expect(report.checks.find((check) => check.id === "dns-readiness")).toMatchObject({
      status: "pass",
      details: {
        readOnly: true,
        providerWrites: false,
        providerIntegrations: false,
        fixtures: 11,
        nodeDnsApisAvailable: true,
      },
    });
    expect(report.checks.find((check) => check.id === "post-write-recheck")).toMatchObject({
      status: "pass",
      details: {
        readOnly: true,
        networkRequired: false,
        deploymentCredentialsRequired: false,
        fixtures: 6,
        skillReferencesRecheck: true,
      },
    });
    expect(report.checks.find((check) => check.id === "social-preview-simulator")).toMatchObject({
      status: "pass",
      details: {
        readOnly: true,
        socialPlatformApis: false,
        exactRenderingGuarantee: false,
        networkRequired: false,
        fixtures: 9,
        skillReferencesSocialPreview: true,
      },
    });
    expect(report.checks.find((check) => check.id === "generated-site-smells")).toMatchObject({
      status: "pass",
      details: {
        readOnly: true,
        autoFixes: false,
        authorshipIdentification: false,
        networkRequired: false,
        fixtures: 7,
        docsReferenceLimitations: true,
      },
    });
    expect(report.checks.find((check) => check.id === "bounded-crawl")).toMatchObject({
      status: "pass",
      details: {
        readOnly: true,
        networkRequired: false,
        fullSiteCrawler: false,
        monitoring: false,
        fixtures: 7,
        docsReferenceLimitations: true,
      },
    });
    expect(report.checks.find((check) => check.id === "patch-export")).toMatchObject({
      status: "pass",
      details: {
        reviewOnly: true,
        writesArtifacts: false,
        appliesPatches: false,
        gitOrDeploy: false,
        fixtures: 5,
        docsReferenceLimitations: true,
      },
    });
  });

  it("reports a missing optional FFmpeg tool as a warning", async () => {
    const report = await runDoctor({
      commandVersion: (command) => command === "ffmpeg" ? undefined : "10.28.2",
    });
    expect(report.checks.find((check) => check.id === "ffmpeg")).toMatchObject({
      status: "warn",
      message: expect.stringContaining("optional"),
    });
  });

  it("fails canonical content checks actionably without crashing", async () => {
    const report = await runDoctor({
      pathExists: (path) => path.endsWith("docs/WRITE_POLICY_V1.md") ? false : true,
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "write-policy")).toMatchObject({
      status: "fail",
      message: expect.stringContaining("restore docs/WRITE_POLICY_V1.md"),
    });
    expect(report.checks.find((check) => check.id === "canonical-docs")?.status).toBe("fail");
  });

  it("finishes without starting a server and does not mutate the current working directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-doctor-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, "sentinel.txt"), "unchanged\n");
    const before = await directorySnapshot(directory);
    await execFileAsync(tsx, [join(root, "src/cli/index.ts"), "doctor"], {
      cwd: directory,
      timeout: 10_000,
    }).catch((error: unknown) => {
      const failure = error as { code?: number };
      if (failure.code !== 1) throw error;
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
