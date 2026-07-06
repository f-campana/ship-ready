import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  CliErrorContractSchema,
  GeneratedSiteSmellsJsonContractSchema,
} from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const cli = join(root, "src", "cli", "index.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("smells CLI", () => {
  it("emits human output for a local repo", async () => {
    const repoPath = await createRepo();
    const { stdout, stderr } = await run(["smells", repoPath]);

    expect(stderr).toBe("");
    for (const section of [
      "Generated-site implementation smells",
      "Summary",
      "Top findings",
      "Metadata / preview risks",
      "Crawlability risks",
      "Placeholder / boilerplate signals",
      "Asset risks",
      "Framework/configuration ambiguity",
      "Limitations",
      "Next actions",
    ]) {
      expect(stdout).toContain(section);
    }
    expect(stdout).toContain("not proof");
  });

  it("emits JSON for repo-only, URL-plus-mock, and clean mock modes without writing files", async () => {
    const repoPath = await createRepo();
    const sentinel = join(repoPath, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n");

    const repoOnly = await run(["smells", repoPath, "--json"]);
    const mockWithUrl = await run(["smells", repoPath, "--url", "https://example.com/?token=secret-value", "--mock", "placeholder-content", "--json"]);
    const cleanMock = await run(["smells", repoPath, "--mock", "clean", "--json"]);

    expect(GeneratedSiteSmellsJsonContractSchema.parse(JSON.parse(repoOnly.stdout))).toMatchObject({
      contract: "shipready.generatedSiteSmells.v1",
      mode: "repo_only",
    });
    const mocked = GeneratedSiteSmellsJsonContractSchema.parse(JSON.parse(mockWithUrl.stdout));
    expect(mocked).toMatchObject({ mode: "mock", url: "https://example.com/" });
    expect(JSON.stringify(mocked)).not.toContain("token=secret-value");
    expect(GeneratedSiteSmellsJsonContractSchema.parse(JSON.parse(cleanMock.stdout)).summary.status).toBe("clean");
    expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
  });

  it("returns shipready.error.v1 for invalid path, invalid URL, and unsupported mock", async () => {
    const repoPath = await createRepo();
    const invalidPath = await runFailure(["smells", join(repoPath, "missing"), "--json"]);
    const invalidUrl = await runFailure(["smells", repoPath, "--url", "not-a-url", "--json"]);
    const invalidMock = await runFailure(["smells", repoPath, "--mock", "official-generator-detection", "--json"]);

    expect(CliErrorContractSchema.parse(JSON.parse(invalidPath.stdout))).toMatchObject({ code: "invalid_repo_path" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidUrl.stdout))).toMatchObject({ code: "invalid_url" });
    expect(CliErrorContractSchema.parse(JSON.parse(invalidMock.stdout))).toMatchObject({ code: "invalid_mode" });
    expect(invalidPath.stderr).toBe("");
    expect(invalidUrl.stderr).toBe("");
    expect(invalidMock.stderr).toBe("");
  });
});

function run(args: string[]) {
  return execFileAsync(tsx, [cli, ...args], {
    cwd: root,
    timeout: 20_000,
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

async function createRepo(): Promise<string> {
  const repoPath = await mkdtemp(join(tmpdir(), "shipready-smells-cli-"));
  temporaryDirectories.push(repoPath);
  await mkdir(join(repoPath, "src"), { recursive: true });
  await mkdir(join(repoPath, "public"), { recursive: true });
  await writeFile(join(repoPath, "package.json"), JSON.stringify({
    dependencies: { "@vitejs/plugin-react": "^latest", react: "^latest", vite: "^latest" },
  }, null, 2));
  await writeFile(join(repoPath, "vite.config.ts"), "export default {};\n");
  await writeFile(join(repoPath, "index.html"), "<!doctype html><html><head><title>Vite + React</title></head><body><div id=\"root\"></div></body></html>");
  await writeFile(join(repoPath, "src/main.tsx"), "import './App';\n");
  await writeFile(join(repoPath, "src/App.tsx"), "document.title = 'Acme';\nexport const copy = 'TODO change me';\n");
  return repoPath;
}
