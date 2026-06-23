import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";
import { ShipReadyMcpError } from "./errors";

export class PathAuthorizer {
  private constructor(readonly allowedRoots: readonly string[]) {}

  static async create(configuredRoots: readonly string[]): Promise<PathAuthorizer> {
    if (configuredRoots.length === 0) {
      throw new Error("ShipReady MCP requires at least one explicit --allow-root or SHIPREADY_MCP_ALLOWED_ROOTS value.");
    }

    const canonical: string[] = [];
    const home = await realpath(homedir()).catch(() => homedir());
    for (const input of configuredRoots) {
      if (!input || !isAbsolute(input)) {
        throw new Error("Every ShipReady MCP allowed root must be an absolute directory path.");
      }
      let root: string;
      try {
        root = await canonicalDirectory(input, "Allowed root");
      } catch {
        throw new Error("Every ShipReady MCP allowed root must be an existing accessible directory.");
      }
      if (root === parse(root).root || root === home) {
        throw new Error("ShipReady MCP allowed roots must be specific workspace directories, not a filesystem root or home directory.");
      }
      canonical.push(root);
    }

    const unique = Array.from(new Set(canonical)).sort((a, b) => a.length - b.length || a.localeCompare(b));
    const minimal = unique.filter((candidate, index) =>
      !unique.slice(0, index).some((root) => isContained(root, candidate)),
    );
    return new PathAuthorizer(minimal);
  }

  async authorizeRepoPath(input: string): Promise<string> {
    if (!input || !isAbsolute(input) || hasParentSegment(input)) {
      throw new ShipReadyMcpError(
        "invalid_repo_path",
        "Repository path must be an existing absolute directory without parent traversal segments.",
        { stage: "authorization", retryable: false },
      );
    }

    let canonical: string;
    try {
      canonical = await canonicalDirectory(input, "Repository path");
    } catch {
      throw new ShipReadyMcpError(
        "invalid_repo_path",
        "Repository path must be an existing accessible directory.",
        { stage: "authorization", retryable: false },
      );
    }

    if (!this.allowedRoots.some((root) => isContained(root, canonical))) {
      throw new ShipReadyMcpError(
        "path_not_authorized",
        "Repository path is outside the server's explicitly authorized roots.",
        { stage: "authorization", retryable: false },
      );
    }
    return canonical;
  }
}

async function canonicalDirectory(input: string, label: string): Promise<string> {
  const canonical = await realpath(resolve(input));
  const info = await stat(canonical);
  if (!info.isDirectory()) throw new Error(`${label} is not a directory.`);
  await access(canonical, constants.R_OK);
  return canonical;
}

function hasParentSegment(input: string): boolean {
  return input.split(/[\\/]+/).some((segment) => segment === "..");
}

function isContained(root: string, candidate: string): boolean {
  if (root === candidate) return true;
  const fromRoot = relative(root, candidate);
  return Boolean(fromRoot) && !isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`);
}
