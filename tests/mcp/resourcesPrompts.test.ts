import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PathAuthorizer } from "../../src/mcp/pathAuthorization";
import { listPrompts, renderPrompt } from "../../src/mcp/prompts";
import {
  FIXTURE_NAMES,
  listResources,
  readResource,
  resolvePackageRoot,
} from "../../src/mcp/resources";

const root = join(import.meta.dirname, "..", "..");
const fixtureRoot = join(root, "tests", "fixtures", "repos");

describe("MCP canonical resources and prompts", () => {
  it("lists and reads every canonical documentation resource", async () => {
    const packageRoot = await resolvePackageRoot();
    const uris = listResources().map((resource) => resource.uri);
    for (const uri of [
      "shipready://docs/readme",
      "shipready://docs/agent-runbook",
      "shipready://docs/commands",
      "shipready://docs/contracts",
      "shipready://docs/write-policy-v1",
      "shipready://docs/claims-policy",
      "shipready://docs/status",
      "shipready://docs/roadmap",
      "shipready://docs/mcp-plan",
      "shipready://docs/search-console-readiness-spec",
    ]) {
      expect(uris).toContain(uri);
      const resource = await readResource(packageRoot, uri);
      expect(resource.mediaType).toBe("text/markdown");
      expect(resource.text).toMatch(/^# /);
    }
    expect(uris.filter((uri) => uri.startsWith("shipready://validation/contracts/"))).toHaveLength(FIXTURE_NAMES.length);
    await expect(readResource(packageRoot, "shipready://docs/../../package.json")).rejects.toMatchObject({ code: "doc_not_found" });
  });

  it("implements all five safe prompt templates", async () => {
    const authorizer = await PathAuthorizer.create([fixtureRoot]);
    expect(listPrompts().map((prompt) => prompt.name)).toEqual([
      "review_launch_readiness",
      "prepare_safe_crawl_files",
      "explain_review_required_changes",
      "post_deploy_recheck",
      "write_policy_summary",
    ]);
    const repoPath = join(fixtureRoot, "vite-react");
    const prepared = await renderPrompt("prepare_safe_crawl_files", {
      url: "https://example.com",
      repoPath,
      rendered: "false",
    }, authorizer);
    const text = prepared.messages[0]!.content.text;
    expect(text).toContain("previewReceipt");
    expect(text).toContain("CREATE_SAFE_CRAWL_FILES_ONLY");
    expect(text).toContain("shipready.write_safe_crawl_files");
    expect(text).toContain("Do not write metadata, content, JSON-LD");

    await expect(renderPrompt("review_launch_readiness", { url: "https://example.com" }, authorizer)).resolves.toBeDefined();
    await expect(renderPrompt("explain_review_required_changes", { url: "https://example.com", repoPath }, authorizer)).resolves.toBeDefined();
    await expect(renderPrompt("post_deploy_recheck", { url: "https://example.com" }, authorizer)).resolves.toBeDefined();
    await expect(renderPrompt("write_policy_summary", {}, authorizer)).resolves.toBeDefined();
  });
});
