import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readContractFixture,
  readResource,
  resolvePackageRoot,
  resolvePackageRootFrom,
} from "../src/mcp/resources";

const root = join(import.meta.dirname, "..");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("ShipReady package-root lookup", () => {
  it("resolves the current checkout and keeps canonical MCP resources allowlisted", async () => {
    expect(await resolvePackageRoot()).toBe(root);

    const commands = await readResource(root, "shipready://docs/commands");
    expect(commands.text).toContain("# Commands");
    await expect(readResource(root, "shipready://docs/../../package.json")).rejects.toMatchObject({
      code: "doc_not_found",
    });

    const status = await readContractFixture(root, "status.default.json");
    expect(status.contract).toBe("shipready.status.v1");
  });

  it.each(["shipready", "@shipready/cli", "@f-campana/shipready"])(
    "accepts the approved package identity %s with required runtime markers",
    async (name) => {
      const packageRoot = await createSimulatedPackage(name);
      expect(await resolvePackageRootFrom(join(packageRoot, "dist"))).toBe(packageRoot);
    },
  );

  it("fails closed for unrelated package names or incomplete ShipReady packages", async () => {
    const unrelated = await createSimulatedPackage("unrelated-package");
    await expect(resolvePackageRootFrom(join(unrelated, "dist"))).rejects.toThrow(
      "could not locate its installed canonical content root",
    );

    const incomplete = await createSimulatedPackage("@shipready/cli");
    await rm(join(incomplete, "docs", "COMMANDS.md"));
    await expect(resolvePackageRootFrom(join(incomplete, "dist"))).rejects.toThrow(
      "could not locate its installed canonical content root",
    );
  });
});

async function createSimulatedPackage(name: string): Promise<string> {
  const packageRoot = await mkdtemp(join(tmpdir(), "shipready-package-root-"));
  temporaryDirectories.push(packageRoot);
  await mkdir(join(packageRoot, "docs"), { recursive: true });
  await mkdir(join(packageRoot, "validation", "contracts"), { recursive: true });
  await mkdir(join(packageRoot, "dist"), { recursive: true });
  await writeFile(join(packageRoot, "package.json"), JSON.stringify({
    name,
    bin: { shipready: "./dist/index.js" },
  }));
  await writeFile(join(packageRoot, "docs", "COMMANDS.md"), "# Commands\n");
  await writeFile(join(packageRoot, "validation", "contracts", "status.default.json"), "{}\n");
  await writeFile(join(packageRoot, "dist", "index.js"), "#!/usr/bin/env node\n");
  return packageRoot;
}
