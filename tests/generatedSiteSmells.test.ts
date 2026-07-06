import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatGeneratedSiteSmellsHuman, formatGeneratedSiteSmellsJson } from "../src/report/formatGeneratedSiteSmellsReport";
import { getGeneratedSiteSmells } from "../src/smells/generatedSiteSmells";
import { GeneratedSiteSmellsJsonContractSchema } from "../src/types/contracts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("generated-site implementation smell detector", () => {
  it("classifies a clean bounded Vite repo as clean", async () => {
    const repoPath = await createRepo("clean", {
      indexHtml: fullHeadHtml(),
      appTsx: "export function App() { return <main>Ready site</main>; }\n",
      robots: true,
      sitemap: true,
      assets: ["og-image.png", "favicon.svg"],
    });

    const result = await getGeneratedSiteSmells({ repoPath, checkedAt: "2026-07-06T12:00:00.000Z" });

    expect(GeneratedSiteSmellsJsonContractSchema.parse(result)).toMatchObject({
      contract: "shipready.generatedSiteSmells.v1",
      mode: "repo_only",
      summary: { status: "clean", findingCount: 0 },
    });
  });

  it("detects Vite client-only metadata and weak SPA raw HTML", async () => {
    const repoPath = await createRepo("client-only", {
      indexHtml: "<!doctype html><html><head><title>Vite + React</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>",
      appTsx: "export function App() { document.title = 'Acme Launch'; return <main>Acme</main>; }\n",
    });

    const result = await getGeneratedSiteSmells({ repoPath });

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "metadata.client_only_metadata", severity: "high" }),
      expect.objectContaining({ id: "routing.spa_weak_raw_html", category: "routing" }),
    ]));
  });

  it("detects placeholder content, starter boilerplate, missing assets, and local URLs", async () => {
    const repoPath = await createRepo("multi-smell", {
      indexHtml: [
        "<!doctype html><html><head>",
        "<title>Acme public launch</title>",
        "<meta name=\"description\" content=\"A complete launch page for Acme customers.\">",
        "<meta property=\"og:title\" content=\"Acme public launch\">",
        "<meta property=\"og:image\" content=\"/missing-og.png\">",
        "<link rel=\"icon\" href=\"/missing-favicon.svg\">",
        "</head><body><div id=\"root\"></div></body></html>",
      ].join(""),
      appTsx: "export function App() { return <main><h1>Vite + React</h1><p>Lorem ipsum TODO change me</p></main>; }\n",
      siteConfig: "export const siteUrl = 'http://localhost:5173/private?token=secret-value';\n",
      robots: true,
      sitemap: true,
    });

    const before = await treeDigest(repoPath);
    const result = await getGeneratedSiteSmells({ repoPath, maxFiles: 50, maxBytes: 64 * 1024 });
    const after = await treeDigest(repoPath);

    expect(after).toBe(before);
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "content.placeholder_copy" }),
      expect.objectContaining({ id: "generated_boilerplate.default_starter" }),
      expect.objectContaining({ id: "assets.missing_social_image" }),
      expect.objectContaining({ id: "assets.missing_favicon" }),
      expect.objectContaining({ id: "configuration.placeholder_or_local_url" }),
    ]));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("?token=");
    for (const finding of result.findings) {
      for (const evidence of finding.evidence) {
        expect(evidence.valuePreview?.length ?? 0).toBeLessThanOrEqual(140);
      }
    }
  });

  it("returns manual review instead of failing for unsupported framework shapes", async () => {
    const repoPath = await createUnknownRepo();
    const result = await getGeneratedSiteSmells({ repoPath });

    expect(result.framework.kind).toBe("unknown");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "framework.unsupported_shape", status: "manual_review" }),
    ]));
  });

  it("uses local URL evidence to flag rendered-only metadata without remote network", async () => {
    const repoPath = await createRepo("url-mode", {
      indexHtml: fullHeadHtml(),
      robots: true,
      sitemap: true,
      assets: ["og-image.png", "favicon.svg"],
    });
    const server = await renderedMetadataServer();
    try {
      const result = await getGeneratedSiteSmells({
        repoPath,
        url: `${server.url}/?token=secret-value`,
        timeoutMs: 10_000,
      });

      expect(result.mode).toBe("repo_plus_url");
      expect(result.url).toBe(`${server.url}/`);
      expect(result.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "metadata.rendered_only_metadata" }),
      ]));
      expect(JSON.stringify(result)).not.toContain("secret-value");
    } finally {
      await server.close();
    }
  });

  it("emits deterministic mock scenarios and human sections", async () => {
    const repoPath = await createRepo("mock", { indexHtml: fullHeadHtml(), robots: true, sitemap: true, assets: ["og-image.png", "favicon.svg"] });
    const clean = await getGeneratedSiteSmells({ repoPath, mock: "clean" });
    const renderedOnly = await getGeneratedSiteSmells({ repoPath, url: "https://example.com/?token=secret-value", mock: "repo-plus-url-rendered-only" });

    expect(clean.summary.status).toBe("clean");
    expect(renderedOnly.mode).toBe("mock");
    expect(renderedOnly.url).toBe("https://example.com/");
    expect(renderedOnly.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "metadata.rendered_only_metadata" }),
    ]));

    const human = formatGeneratedSiteSmellsHuman(renderedOnly);
    expect(human).toContain("Generated-site implementation smells");
    expect(human).toContain("Metadata / preview risks");
    expect(human).toContain("not proof");
    expect(formatGeneratedSiteSmellsJson(renderedOnly)).toContain("shipready.generatedSiteSmells.v1");
  });
});

async function createRepo(name: string, options: {
  indexHtml: string;
  appTsx?: string;
  siteConfig?: string;
  robots?: boolean;
  sitemap?: boolean;
  assets?: string[];
}): Promise<string> {
  const repoPath = await mkdtemp(join(tmpdir(), `shipready-smells-${name}-`));
  temporaryDirectories.push(repoPath);
  await mkdir(join(repoPath, "src"), { recursive: true });
  await mkdir(join(repoPath, "public"), { recursive: true });
  await writeFile(join(repoPath, "package.json"), JSON.stringify({
    dependencies: { "@vitejs/plugin-react": "^latest", react: "^latest", vite: "^latest" },
    devDependencies: {},
  }, null, 2));
  await writeFile(join(repoPath, "vite.config.ts"), "import react from '@vitejs/plugin-react';\nexport default { plugins: [react()] };\n");
  await writeFile(join(repoPath, "index.html"), options.indexHtml);
  await writeFile(join(repoPath, "src/main.tsx"), "import { App } from './App';\n");
  await writeFile(join(repoPath, "src/App.tsx"), options.appTsx ?? "export function App() { return <main>Ready</main>; }\n");
  if (options.siteConfig) await writeFile(join(repoPath, "src/siteConfig.ts"), options.siteConfig);
  if (options.robots) await writeFile(join(repoPath, "public/robots.txt"), "User-agent: *\nAllow: /\n");
  if (options.sitemap) await writeFile(join(repoPath, "public/sitemap.xml"), "<urlset></urlset>\n");
  for (const asset of options.assets ?? []) {
    await writeFile(join(repoPath, "public", asset), "asset\n");
  }
  return repoPath;
}

async function createUnknownRepo(): Promise<string> {
  const repoPath = await mkdtemp(join(tmpdir(), "shipready-smells-unknown-"));
  temporaryDirectories.push(repoPath);
  await mkdir(join(repoPath, "src"), { recursive: true });
  await writeFile(join(repoPath, "package.json"), JSON.stringify({ dependencies: { lodash: "^latest" } }, null, 2));
  await writeFile(join(repoPath, "src/index.ts"), "export const value = 1;\n");
  return repoPath;
}

function fullHeadHtml(): string {
  return [
    "<!doctype html><html lang=\"en\"><head>",
    "<title>Acme launch readiness platform</title>",
    "<meta name=\"description\" content=\"A complete launch-readiness page for Acme customers and partners.\">",
    "<meta property=\"og:title\" content=\"Acme launch readiness platform\">",
    "<meta property=\"og:description\" content=\"A complete launch-readiness page for Acme customers and partners.\">",
    "<meta property=\"og:image\" content=\"/og-image.png\">",
    "<link rel=\"icon\" href=\"/favicon.svg\">",
    "</head><body><div id=\"root\"></div></body></html>",
  ].join("");
}

async function renderedMetadataServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    if (request.url === "/robots.txt") {
      response.setHeader("content-type", "text/plain");
      response.end("User-agent: *\nAllow: /\n");
      return;
    }
    if (request.url === "/sitemap.xml") {
      response.setHeader("content-type", "application/xml");
      response.end("<urlset></urlset>");
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end([
      "<!doctype html><html><head><title>React App</title>",
      "<script>",
      "document.addEventListener('DOMContentLoaded', () => {",
      "document.title = 'Rendered Acme launch page';",
      "const meta = document.createElement('meta'); meta.setAttribute('name', 'description'); meta.setAttribute('content', 'Rendered description only.'); document.head.appendChild(meta);",
      "const og = document.createElement('meta'); og.setAttribute('property', 'og:title'); og.setAttribute('content', 'Rendered Open Graph title'); document.head.appendChild(og);",
      "});",
      "</script></head><body><h1>Acme</h1></body></html>",
    ].join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address.");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function treeDigest(directory: string): Promise<string> {
  const records: string[] = [];
  async function walk(current: string, relative = "") {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const stats = await lstat(path);
      if (entry.isDirectory()) {
        records.push(`d ${name} ${stats.mode}`);
        await walk(path, name);
      } else if (entry.isSymbolicLink()) {
        records.push(`l ${name} ${await readlink(path)}`);
      } else {
        const content = await readFile(path);
        records.push(`f ${name} ${stats.mode} ${content.length} ${createHash("sha256").update(content).digest("hex")}`);
      }
    }
  }
  await walk(directory);
  return createHash("sha256").update(records.join("\n")).digest("hex");
}
