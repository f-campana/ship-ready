import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlSite } from "../src/crawl/crawl";
import { CrawlJsonContractSchema } from "../src/types/contracts";

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const host = request.headers.host ?? "127.0.0.1";
    const currentOrigin = `http://${host}`;
    const path = request.url?.split("?", 1)[0] ?? "/";
    if (path === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /\n");
      return;
    }
    if (path === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end(`<?xml version="1.0"?><urlset>
        <url><loc>${currentOrigin}/</loc></url>
        <url><loc>${currentOrigin}/about</loc></url>
        <url><loc>${currentOrigin}/level-1</loc></url>
        <url><loc>https://outside.example/sitemap-page</loc></url>
      </urlset>`);
      return;
    }
    if (path === "/logo.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end("not really an image");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(pageHtml(currentOrigin, path));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No server address");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("bounded crawl", () => {
  it("returns ready for the deterministic clean mock", async () => {
    const result = await crawlSite({
      url: "https://example.com/",
      mock: "clean-small-site",
    });

    expect(CrawlJsonContractSchema.parse(result)).toMatchObject({
      contract: "shipready.crawl.v1",
      mode: "mock",
      summary: { status: "ready" },
    });
    expect(result.pages).toHaveLength(3);
    expect(result.repeatedFindings).toEqual([]);
  });

  it("reports repeated and consistency mock findings", async () => {
    const missingDescriptions = await crawlSite({
      url: "https://example.com/",
      mock: "missing-descriptions",
    });
    const canonical = await crawlSite({
      url: "https://example.com/",
      mock: "canonical-inconsistent",
    });
    const socialImages = await crawlSite({
      url: "https://example.com/",
      mock: "social-images-missing",
    });

    expect(missingDescriptions.repeatedFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "metadata.description.missing", count: 4 }),
    ]));
    expect(canonical.consistency.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "metadata.canonical.host_inconsistent" }),
    ]));
    expect(socialImages.repeatedFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "social.og.image_missing", count: 3 }),
    ]));
  });

  it("handles unreachable starts as unknown instead of throwing", async () => {
    const result = await crawlSite({
      url: "https://example.com/",
      mock: "start-unreachable",
    });

    expect(result.summary.status).toBe("unknown");
    expect(result.pages[0]).toMatchObject({
      status: "unknown",
      topIssues: [expect.objectContaining({ id: "crawl.page.unreachable" })],
    });
  });

  it("enforces max pages, max depth, same-origin filtering, duplicates, query policy, and asset skipping", async () => {
    const result = await crawlSite({
      url: `${origin}/?token=secret-value`,
      maxPages: 2,
      maxDepth: 1,
      source: "links",
      rendered: false,
    });

    expect(result.startUrl).toBe(`${origin}/`);
    expect(result.options).toMatchObject({ maxPages: 2, maxDepth: 1, source: "links", rendered: false });
    expect(result.pages).toHaveLength(2);
    expect(result.pages.every((page) => page.depth <= 1)).toBe(true);
    expect(result.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "outside_origin" }),
      expect.objectContaining({ reason: "unsupported_protocol" }),
      expect.objectContaining({ reason: "asset" }),
      expect.objectContaining({ reason: "duplicate" }),
      expect.objectContaining({ reason: "query_skipped" }),
      expect.objectContaining({ reason: "limit_reached" }),
    ]));
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(JSON.stringify(result)).not.toMatch(/<html|<!doctype/i);
  });

  it("caps max pages and depth in the effective options", async () => {
    const result = await crawlSite({
      url: "https://example.com/",
      mock: "limit-reached",
      maxPages: 999,
      maxDepth: 99,
    });

    expect(result.options.maxPages).toBe(25);
    expect(result.options.maxDepth).toBe(2);
    expect(result.pages).toHaveLength(25);
    expect(result.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "limit_reached" }),
    ]));
  });
});

function pageHtml(originUrl: string, path: string): string {
  const links = path === "/"
    ? `
      <a href="/about">About</a>
      <a href="/about#team">About duplicate fragment</a>
      <a href="/about?token=secret-value">About query</a>
      <a href="/logo.png">Logo</a>
      <a href="mailto:test@example.com">Email</a>
      <a href="https://outside.example/page">Outside</a>
      <a href="/level-1">Level 1</a>
    `
    : path === "/level-1"
      ? `<a href="/level-2">Level 2</a>`
      : "";
  const title = path === "/" ? "Local Home" : path.replace("/", "Local ");
  return `<!doctype html>
    <html lang="en">
      <head>
        <title>${title}</title>
        <meta name="description" content="A deterministic bounded crawl test page with enough metadata.">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="A deterministic bounded crawl test page with enough metadata.">
        <meta property="og:image" content="${originUrl}/share.png">
        <meta property="og:url" content="${originUrl}${path}">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="A deterministic bounded crawl test page with enough metadata.">
        <meta name="twitter:image" content="${originUrl}/share.png">
        <link rel="canonical" href="${originUrl}${path}">
      </head>
      <body><h1>${title}</h1>${links}</body>
    </html>`;
}
