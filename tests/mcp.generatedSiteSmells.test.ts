import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { resolvePackageRoot } from "../src/mcp/resources";
import { callReadOnlyTool, listTools } from "../src/mcp/tools";
import { MCP_READ_ONLY_TOOL_NAMES, MCP_WRITE_TOOL_NAMES } from "../src/mcp/toolNames";
import {
  GeneratedSiteSmellsJsonContractSchema,
  RepoInspectionJsonContractSchema,
} from "../src/types/contracts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("MCP generated-site smells", () => {
  it("is registered as read-only and keeps the sole write registry unchanged", async () => {
    const definition = listTools().find((tool) => tool.name === "shipready.generated_site_smells");

    expect(definition?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(MCP_READ_ONLY_TOOL_NAMES).toContain("shipready.generated_site_smells");
    expect(MCP_WRITE_TOOL_NAMES).toEqual(["shipready.write_safe_crawl_files"]);
    expect(listTools().filter((tool) => tool.annotations.readOnlyHint === false).map((tool) => tool.name))
      .toEqual(["shipready.write_safe_crawl_files"]);
  });

  it("returns the generated-site smell contract for an authorized repo without mutation", async () => {
    const repoPath = await createRepo();
    const sentinel = join(repoPath, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n");
    const context = {
      authorizer: await PathAuthorizer.create([repoPath]),
      packageRoot: await resolvePackageRoot(),
    };

    const result = await callReadOnlyTool(context, "shipready.generated_site_smells", {
      repoPath,
      mock: "missing-social-assets",
    });

    expect(GeneratedSiteSmellsJsonContractSchema.parse(result.structuredContent)).toMatchObject({
      contract: "shipready.generatedSiteSmells.v1",
      mode: "mock",
    });
    expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
  });

  it("requires allowed-root authorization and rejects unsupported or secret fields", async () => {
    const repoPath = await createRepo();
    const allowedChild = join(repoPath, "allowed-child");
    await mkdir(allowedChild);
    const context = {
      authorizer: await PathAuthorizer.create([allowedChild]),
      packageRoot: await resolvePackageRoot(),
    };
    const unauthorized = await callReadOnlyTool(context, "shipready.generated_site_smells", { repoPath });
    const invalidMock = await callReadOnlyTool({
      authorizer: await PathAuthorizer.create([repoPath]),
      packageRoot: await resolvePackageRoot(),
    }, "shipready.generated_site_smells", { repoPath, mock: "detects-ai" });
    const secret = await callReadOnlyTool({
      authorizer: await PathAuthorizer.create([repoPath]),
      packageRoot: await resolvePackageRoot(),
    }, "shipready.generated_site_smells", { repoPath, accessToken: "secret-value" });

    expect(unauthorized).toMatchObject({ isError: true, structuredContent: { code: "path_not_authorized" } });
    expect(invalidMock).toMatchObject({ isError: true, structuredContent: { code: "invalid_mode" } });
    expect(secret).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
    expect(JSON.stringify([unauthorized, invalidMock, secret])).not.toContain("secret-value");
  });

  it("does not disturb existing read-only tools", async () => {
    const repoPath = await createRepo();
    const context = {
      authorizer: await PathAuthorizer.create([repoPath]),
      packageRoot: await resolvePackageRoot(),
    };
    const inspect = await callReadOnlyTool(context, "shipready.inspect_repo", { repoPath });

    expect(RepoInspectionJsonContractSchema.parse(inspect.structuredContent)).toMatchObject({
      contract: "shipready.repoInspection.v1",
      framework: { id: "vite_react" },
    });
  });
});

async function createRepo(): Promise<string> {
  const repoPath = await mkdtemp(join(tmpdir(), "shipready-mcp-smells-"));
  temporaryDirectories.push(repoPath);
  await mkdir(join(repoPath, "src"), { recursive: true });
  await mkdir(join(repoPath, "public"), { recursive: true });
  await writeFile(join(repoPath, "package.json"), JSON.stringify({
    dependencies: { "@vitejs/plugin-react": "^latest", react: "^latest", vite: "^latest" },
  }, null, 2));
  await writeFile(join(repoPath, "vite.config.ts"), "export default {};\n");
  await writeFile(join(repoPath, "index.html"), "<!doctype html><html><head><title>Vite + React</title><meta property=\"og:image\" content=\"/missing.png\"></head><body><div id=\"root\"></div></body></html>");
  await writeFile(join(repoPath, "src/main.tsx"), "import './App';\n");
  await writeFile(join(repoPath, "src/App.tsx"), "export function App() { return <main>TODO</main>; }\n");
  return repoPath;
}
