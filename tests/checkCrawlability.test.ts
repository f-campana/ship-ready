import { describe, expect, it } from "vitest";
import { isSitemapXmlContent } from "../src/audit/checkCrawlability";

describe("isSitemapXmlContent", () => {
  it("accepts urlset sitemap XML", () => {
    expect(
      isSitemapXmlContent(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
</urlset>`),
    ).toBe(true);
  });

  it("accepts sitemap index XML", () => {
    expect(
      isSitemapXmlContent(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`),
    ).toBe(true);
  });

  it("rejects SPA HTML fallback responses", () => {
    expect(
      isSitemapXmlContent(`<!doctype html>
<html lang="en">
  <head><title>App shell</title></head>
  <body><div id="root"></div></body>
</html>`),
    ).toBe(false);
  });
});
