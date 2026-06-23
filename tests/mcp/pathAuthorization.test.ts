import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, parse } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PathAuthorizer } from "../../src/mcp/pathAuthorization";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("MCP path authorization", () => {
  it("requires explicit allowed roots", async () => {
    await expect(PathAuthorizer.create([])).rejects.toThrow("requires at least one explicit");
    await expect(PathAuthorizer.create(["relative"])).rejects.toThrow("absolute directory");
    await expect(PathAuthorizer.create([join(tmpdir(), "missing-shipready-root")])).rejects.toThrow("existing accessible");
    await expect(PathAuthorizer.create([homedir()])).rejects.toThrow("specific workspace");
    await expect(PathAuthorizer.create([parse(homedir()).root])).rejects.toThrow("specific workspace");
  });

  it("canonicalizes, deduplicates, and authorizes exact roots and children", async () => {
    const root = await temp("shipready-mcp-root-");
    const child = join(root, "repo");
    await mkdir(child);
    const authorizer = await PathAuthorizer.create([root, root, child]);

    expect(authorizer.allowedRoots).toEqual([await real(root)]);
    await expect(authorizer.authorizeRepoPath(root)).resolves.toBe(await real(root));
    await expect(authorizer.authorizeRepoPath(child)).resolves.toBe(await real(child));
  });

  it("rejects traversal, missing paths, files, and outside sibling-prefix paths", async () => {
    const parent = await temp("shipready-mcp-parent-");
    const root = join(parent, "allowed");
    const sibling = join(parent, "allowed-other");
    await mkdir(root);
    await mkdir(sibling);
    const file = join(root, "file.txt");
    await writeFile(file, "x");
    const authorizer = await PathAuthorizer.create([root]);

    await expect(authorizer.authorizeRepoPath(`${root}/../allowed`)).rejects.toMatchObject({ code: "invalid_repo_path" });
    await expect(authorizer.authorizeRepoPath(join(root, "missing"))).rejects.toMatchObject({ code: "invalid_repo_path" });
    await expect(authorizer.authorizeRepoPath(file)).rejects.toMatchObject({ code: "invalid_repo_path" });
    await expect(authorizer.authorizeRepoPath(sibling)).rejects.toMatchObject({ code: "path_not_authorized" });
  });

  it("rejects a repository symlink that escapes an allowed root", async () => {
    const parent = await temp("shipready-mcp-symlink-");
    const root = join(parent, "allowed");
    const outside = join(parent, "outside");
    await mkdir(root);
    await mkdir(outside);
    const link = join(root, "escape");
    try {
      await symlink(outside, link, "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const authorizer = await PathAuthorizer.create([root]);
    await expect(authorizer.authorizeRepoPath(link)).rejects.toMatchObject({ code: "path_not_authorized" });
  });
});

async function temp(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  cleanup.push(path);
  return path;
}

async function real(path: string): Promise<string> {
  return (await import("node:fs/promises")).realpath(path);
}
