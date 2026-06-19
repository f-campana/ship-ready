export function previewSitemapPathForUrl(finalUrl: string): string {
  return new URL("/sitemap.xml", finalUrl).toString();
}

export function robotsTxtForUrl(finalUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${previewSitemapPathForUrl(finalUrl)}\n`;
}

export function sitemapXmlForUrl(finalUrl: string): string {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    "  <url>",
    `    <loc>${escapeXmlText(finalUrl)}</loc>`,
    "  </url>",
    "</urlset>",
    "",
  ].join("\n");
}

export function nextRobotsTsForUrl(finalUrl: string): string {
  return [
    "import type { MetadataRoute } from \"next\";",
    "",
    "export default function robots(): MetadataRoute.Robots {",
    "  return {",
    "    rules: {",
    "      userAgent: \"*\",",
    "      allow: \"/\",",
    "    },",
    `    sitemap: ${quoteTsString(previewSitemapPathForUrl(finalUrl))},`,
    "  };",
    "}",
    "",
  ].join("\n");
}

export function nextSitemapTsForUrl(finalUrl: string): string {
  return [
    "import type { MetadataRoute } from \"next\";",
    "",
    "export default function sitemap(): MetadataRoute.Sitemap {",
    "  return [",
    "    {",
    `      url: ${quoteTsString(finalUrl)},`,
    "      changeFrequency: \"weekly\",",
    "      priority: 1,",
    "    },",
    "  ];",
    "}",
    "",
  ].join("\n");
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function quoteTsString(value: string): string {
  return JSON.stringify(value);
}
