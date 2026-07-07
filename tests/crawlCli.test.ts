import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  CliErrorContractSchema,
  CrawlJsonContractSchema,
} from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const cli = join(root, "src", "cli", "index.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("crawl CLI", () => {
  it("emits the requested human sections for a deterministic mock", async () => {
    const { stdout, stderr } = await run([
      "crawl", "--url", "https://example.com", "--mock", "clean-small-site",
    ]);

    expect(stderr).toBe("");
    for (const section of [
      "Bounded crawl",
      "Summary",
      "Pages checked",
      "Repeated findings",
      "Metadata consistency",
      "Skipped URLs / limits",
      "Limitations",
      "Next actions",
    ]) {
      expect(stdout).toContain(section);
    }
  });

  it("emits stable JSON for mock scenarios and caps max flags", async () => {
    const clean = await run([
      "crawl", "--url", "https://example.com", "--mock", "clean-small-site", "--json",
    ]);
    const missing = await run([
      "crawl", "--url", "https://example.com", "--mock", "missing-descriptions", "--json",
    ]);
    const capped = await run([
      "crawl", "--url", "https://example.com", "--mock", "limit-reached", "--max-pages", "999", "--max-depth", "99", "--json",
    ]);

    expect(CrawlJsonContractSchema.parse(JSON.parse(clean.stdout))).toMatchObject({
      contract: "shipready.crawl.v1",
      mode: "mock",
      summary: { status: "ready" },
    });
    expect(CrawlJsonContractSchema.parse(JSON.parse(missing.stdout)).repeatedFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "metadata.description.missing" }),
    ]));
    expect(CrawlJsonContractSchema.parse(JSON.parse(capped.stdout)).options).toMatchObject({
      maxPages: 25,
      maxDepth: 2,
    });
  });

  it("returns shipready.error.v1 for invalid URL, source, mock, and limits", async () => {
    const invalidUrl = await runFailure([
      "crawl", "--url", "not-a-url", "--json",
    ]);
    const invalidSource = await runFailure([
      "crawl", "--url", "https://example.com", "--source", "everything", "--mock", "clean-small-site", "--json",
    ]);
    const invalidMock = await runFailure([
      "crawl", "--url", "https://example.com", "--mock", "missing-fixture", "--json",
    ]);
    const invalidPages = await runFailure([
      "crawl", "--url", "https://example.com", "--max-pages", "0", "--mock", "clean-small-site", "--json",
    ]);

    expect(CliErrorContractSchema.parse(JSON.parse(invalidUrl.stdout))).toMatchObject({ code: "invalid_url" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidSource.stdout))).toMatchObject({ code: "invalid_mode" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidMock.stdout))).toMatchObject({ code: "invalid_mode" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidPages.stdout))).toMatchObject({ code: "invalid_mode" });
    expect(invalidUrl.stderr).toBe("");
    expect(invalidSource.stderr).toBe("");
    expect(invalidMock.stderr).toBe("");
    expect(invalidPages.stderr).toBe("");
  });

  it("does not require or mutate a local repository in mock mode", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-crawl-cli-"));
    temporaryDirectories.push(directory);
    const sentinel = join(directory, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n");

    await run([
      "crawl", "--url", "https://example.com", "--mock", "clean-small-site", "--json",
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
