import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/mcp/pathAuthorization";
import { resolvePackageRoot } from "../src/mcp/resources";
import { callReadOnlyTool, listTools } from "../src/mcp/tools";
import { DnsStatusJsonContractSchema } from "../src/types/contracts";

describe("MCP DNS status", () => {
  it("is registered read-only, needs no repo input, and does not mutate files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shipready-mcp-dns-"));
    const sentinel = join(directory, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n", "utf8");
    try {
      const context = {
        authorizer: rejectingAuthorizer(),
        packageRoot: await resolvePackageRoot(),
      };
      const definition = listTools().find((tool) => tool.name === "shipready.dns_status");
      expect(definition?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });

      const result = await callReadOnlyTool(context, "shipready.dns_status", {
        url: "https://example.com",
        mock: "ready",
      });
      expect(DnsStatusJsonContractSchema.parse(result.structuredContent)).toMatchObject({
        contract: "shipready.dnsStatus.v1",
        mode: "mock",
        verdict: { status: "ready" },
      });
      expect(await readFile(sentinel, "utf8")).toBe("unchanged\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects credentials and unsupported scenarios without exposing values", async () => {
    const context = {
      authorizer: rejectingAuthorizer(),
      packageRoot: await resolvePackageRoot(),
    };
    const credential = await callReadOnlyTool(context, "shipready.dns_status", {
      url: "https://example.com",
      dnsApiToken: "secret-value",
    });
    const scenario = await callReadOnlyTool(context, "shipready.dns_status", {
      url: "https://example.com",
      mock: "cloudflare_write",
    });
    const txt = await callReadOnlyTool(context, "shipready.dns_status", {
      url: "https://example.com",
      mock: "txt-found",
      expectedSearchConsoleVerificationTxt: "redacted-example-token",
    });

    expect(credential).toMatchObject({ isError: true, structuredContent: { code: "unsupported_command" } });
    expect(scenario).toMatchObject({ isError: true, structuredContent: { code: "invalid_mode" } });
    expect(DnsStatusJsonContractSchema.parse(txt.structuredContent).verification?.searchConsoleTxt?.status).toBe("found");
    expect(JSON.stringify([credential, scenario, txt])).not.toContain("secret-value");
    expect(JSON.stringify(txt)).not.toContain("redacted-example-token");
  });
});

function rejectingAuthorizer(): PathAuthorizer {
  return {
    authorizeRepoPath: async () => {
      throw new Error("DNS status must not authorize a repository path.");
    },
  } as unknown as PathAuthorizer;
}
