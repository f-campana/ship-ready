import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");

describe("publish preflight workflow", () => {
  it("runs the readiness matrix with read-only permissions and no release capability", async () => {
    const workflow = await readFile(join(root, ".github", "workflows", "publish-preflight.yml"), "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("pnpm package:smoke");
    expect(workflow).toContain("pnpm publish:preflight");
    expect(workflow).not.toMatch(
      /(?:^|\s)npm (?:publish|login)|gh release|git tag|upload-artifact|id-token:\s*write|NPM_TOKEN|NODE_AUTH_TOKEN/i,
    );
  });

  it("enforces current package identity, private mode, workflow stop gates, and no tarballs", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      name?: string;
      private?: boolean;
      scripts?: Record<string, string>;
    };
    expect(packageJson.name).toBe("@ship-ready/cli");
    expect(packageJson.private).toBe(true);
    expect(packageJson.scripts?.["publish:preflight"]).toBe("node scripts/publish-preflight.mjs");

    const result = await execFileAsync(process.execPath, [join(root, "scripts", "publish-preflight.mjs")], {
      cwd: root,
      timeout: 10_000,
    });
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("publication remains disabled");
  });
});
