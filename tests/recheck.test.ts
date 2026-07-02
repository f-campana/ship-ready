import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRecheckResult, recheck } from "../src/recheck/recheck";
import { AuditResultSchema, type AuditResult } from "../src/types/audit";
import {
  RecheckJsonContractSchema,
  RepoInspectionJsonContractSchema,
} from "../src/types/contracts";
import { NetworkError } from "../src/utils/http";

const root = join(import.meta.dirname, "..");
const fixedAt = "2026-06-21T12:00:00.000Z";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("post-write recheck", () => {
  it("classifies URL-only present, missing, and unreachable live evidence conservatively", async () => {
    const ready = createRecheckResult({ url: "https://example.com/", checkedAt: fixedAt, audit: audit("ready") });
    const missing = createRecheckResult({ url: "https://example.com/", checkedAt: fixedAt, audit: audit("missing") });
    const unreachable = await recheck({ url: "https://example.com" }, {
      audit: async () => { throw new NetworkError("fixture unavailable"); },
      now: () => fixedAt,
    });

    expect(ready).toMatchObject({
      contract: "shipready.recheck.v1",
      mode: "url_only",
      deployment: { status: "not_checked" },
      verdict: { status: "ready" },
    });
    expect(missing).toMatchObject({ deployment: { status: "not_checked" }, verdict: { status: "needs_attention" } });
    expect(unreachable).toMatchObject({
      live: { robots: { status: "unreachable" }, sitemap: { status: "unreachable" } },
      verdict: { status: "unknown" },
    });
    expect(JSON.stringify(unreachable)).not.toContain("fixture unavailable");
  });

  it.each([
    ["ready", "appears_deployed", "ready"],
    ["missing", "appears_not_deployed", "needs_deploy"],
    ["partial", "partially_deployed", "needs_attention"],
  ] as const)("classifies repo-backed %s evidence", (liveState, deployment, verdict) => {
    const result = createRecheckResult({
      url: "https://example.com/",
      checkedAt: fixedAt,
      audit: audit(liveState),
      inspection: inspection(),
      expectedFiles: expectedFiles(true, true),
    });
    expect(result).toMatchObject({
      mode: "repo_backed",
      deployment: { status: deployment },
      verdict: { status: verdict },
    });
    expect(result.deployment.message.toLowerCase()).toContain("appear");
  });

  it("keeps absent local files and unsupported frameworks distinct from deployment conclusions", () => {
    const absent = createRecheckResult({
      url: "https://example.com/",
      checkedAt: fixedAt,
      audit: audit("missing"),
      inspection: inspection(),
      expectedFiles: expectedFiles(false, false),
    });
    const unsupportedInspection = {
      ...inspection(),
      framework: { id: "unknown" as const, name: "Unknown", confidence: "low" as const, evidence: [] },
    };
    const unsupported = createRecheckResult({
      url: "https://example.com/",
      checkedAt: fixedAt,
      audit: audit("missing"),
      inspection: unsupportedInspection,
      expectedFiles: [],
    });

    expect(absent).toMatchObject({ deployment: { status: "not_checked" }, verdict: { status: "needs_attention" } });
    expect(unsupported).toMatchObject({ deployment: { status: "unknown" }, verdict: { status: "unknown" } });
    expect(unsupported.nextActions[0]).toContain("manually");
  });

  it("uses actual repo inspection without mutating a repo-backed fixture", async () => {
    const repo = await mkdtemp(join(tmpdir(), "shipready-recheck-repo-"));
    temporaryDirectories.push(repo);
    await mkdir(join(repo, "public"));
    await mkdir(join(repo, "src"));
    await writeFile(join(repo, "package.json"), JSON.stringify({ dependencies: { vite: "1.0.0", react: "1.0.0" } }));
    await writeFile(join(repo, "vite.config.ts"), "export default {}\n");
    await writeFile(join(repo, "index.html"), "<main>fixture</main>\n");
    await writeFile(join(repo, "src", "main.tsx"), "export {};\n");
    await writeFile(join(repo, "public", "robots.txt"), "User-agent: *\nAllow: /\n");
    await writeFile(join(repo, "public", "sitemap.xml"), "<urlset></urlset>\n");
    const before = await snapshot(repo);

    const result = await recheck({ url: "https://example.com", repoPath: repo }, {
      audit: async () => audit("ready"),
      now: () => fixedAt,
    });

    expect(result.local).toMatchObject({
      framework: "Vite React",
      expectedFiles: [
        { path: "public/robots.txt", kind: "robots", exists: true },
        { path: "public/sitemap.xml", kind: "sitemap", exists: true },
      ],
    });
    expect(result.deployment.status).toBe("appears_deployed");
    expect(await snapshot(repo)).toEqual(before);
  });

  it("produces deterministic schema-valid output from the same mocked evidence", () => {
    const input = {
      url: "https://example.com/",
      checkedAt: fixedAt,
      audit: audit("ready"),
      inspection: inspection(),
      expectedFiles: expectedFiles(true, true),
    };
    const first = createRecheckResult(input);
    const second = createRecheckResult(input);
    expect(RecheckJsonContractSchema.parse(first)).toEqual(RecheckJsonContractSchema.parse(second));
  });
});

function audit(state: "ready" | "missing" | "partial"): AuditResult {
  const fixture = JSON.parse(readFileSyncFixture("audit.clean.json"));
  const parsed = AuditResultSchema.parse(fixture);
  const present = (path: string) => ({
    url: `https://example.com/${path}`,
    finalUrl: `https://example.com/${path}`,
    exists: true,
    ok: true,
    statusCode: 200,
  });
  const missing = (path: string) => ({
    url: `https://example.com/${path}`,
    finalUrl: `https://example.com/${path}`,
    exists: false,
    ok: false,
    statusCode: 404,
  });
  return {
    ...parsed,
    resources: {
      robotsTxt: state === "missing" ? missing("robots.txt") : present("robots.txt"),
      sitemapXml: state === "ready" ? present("sitemap.xml") : missing("sitemap.xml"),
    },
  };
}

function inspection() {
  return RepoInspectionJsonContractSchema.parse(
    JSON.parse(readFileSyncFixture("inspect-repo.next-app.json")),
  );
}

function expectedFiles(robots: boolean, sitemap: boolean) {
  return [
    { path: "src/app/robots.ts", kind: "robots" as const, exists: robots },
    { path: "src/app/sitemap.ts", kind: "sitemap" as const, exists: sitemap },
  ];
}

function readFileSyncFixture(name: string): string {
  return readFileSync(join(root, "validation", "contracts", name), "utf8");
}

async function snapshot(directory: string): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  async function walk(current: string, prefix = "") {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute, relative);
      else output[relative] = await readFile(absolute, "utf8");
    }
  }
  await walk(directory);
  return output;
}
