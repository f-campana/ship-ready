import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  CliErrorContractSchema,
  SocialPreviewJsonContractSchema,
} from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const cli = join(root, "src", "cli", "index.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("social-preview CLI", () => {
  it("emits the readable human sections for a deterministic mock", async () => {
    const { stdout, stderr } = await run([
      "social-preview", "--url", "https://example.com", "--mock", "complete",
    ]);

    expect(stderr).toBe("");
    for (const section of [
      "ShipReady social preview",
      "Target: https://example.com/",
      "Status: Ready",
      "Next:",
      "Top findings",
      "Google-style search preview",
      "Generic social preview",
      "X/Twitter preview",
      "Slack/Discord preview",
      "LinkedIn preview",
      "Raw vs rendered differences",
      "Limitations",
      "Next actions",
    ]) {
      expect(stdout).toContain(section);
    }
    expect(stdout).toContain("Approximation from observed metadata. Platforms may differ.");
    expect(stdout).toContain("No social platform APIs");
    expect(stdout).toContain("More: Run with --json for full contract output.");
  });

  it("emits stable JSON for mock, source, and warning scenarios", async () => {
    const complete = await run([
      "social-preview", "--url", "https://example.com", "--mock", "complete", "--source", "raw", "--json",
    ]);
    const missingImage = await run([
      "social-preview", "--url", "https://example.com", "--mock", "missing-image", "--json",
    ]);
    const renderedOnly = await run([
      "social-preview", "--url", "https://example.com", "--mock", "rendered-only-metadata", "--source", "both", "--json",
    ]);

    expect(SocialPreviewJsonContractSchema.parse(JSON.parse(complete.stdout))).toMatchObject({
      contract: "shipready.socialPreview.v1",
      sourceMode: "raw",
      verdict: { status: "ready" },
    });
    expect(SocialPreviewJsonContractSchema.parse(JSON.parse(missingImage.stdout)).verdict.status).toBe("needs_attention");
    expect(SocialPreviewJsonContractSchema.parse(JSON.parse(renderedOnly.stdout)).warnings.join("\n")).toContain("only after rendering");
  });

  it("returns shipready.error.v1 for invalid URL, source, and mock inputs", async () => {
    const invalidUrl = await runFailure([
      "social-preview", "--url", "not-a-url", "--mock", "complete", "--json",
    ]);
    const invalidSource = await runFailure([
      "social-preview", "--url", "https://example.com", "--source", "hydrated", "--mock", "complete", "--json",
    ]);
    const invalidMock = await runFailure([
      "social-preview", "--url", "https://example.com", "--mock", "missing-fixture", "--json",
    ]);

    expect(CliErrorContractSchema.parse(JSON.parse(invalidUrl.stdout))).toMatchObject({ code: "invalid_url" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidSource.stdout))).toMatchObject({ code: "invalid_mode" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidMock.stdout))).toMatchObject({ code: "invalid_mode" });
    expect(invalidUrl.stderr).toBe("");
    expect(invalidSource.stderr).toBe("");
    expect(invalidMock.stderr).toBe("");
  });

  it("does not require or mutate a local repository", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-social-preview-cli-"));
    temporaryDirectories.push(directory);
    const sentinel = join(directory, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n");

    await run([
      "social-preview", "--url", "https://example.com", "--mock", "complete", "--json",
    ], directory);

    expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
  });
});

function run(args: string[], cwd = root) {
  return execFileAsync(tsx, [cli, ...args], {
    cwd,
    timeout: 15_000,
  });
}

async function runFailure(args: string[]) {
  try {
    await run(args);
    throw new Error("Expected command failure.");
  } catch (error) {
    return error as { code: number; stdout: string; stderr: string };
  }
}
