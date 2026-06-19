import { chromium } from "playwright";

export type RenderHtmlResult = {
  finalUrl: string;
  statusCode?: number;
  html: string;
};

export async function renderHtml(
  url: string,
  options: { timeoutMs: number; userAgent?: string },
): Promise<RenderHtmlResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      acceptDownloads: false,
      userAgent: options.userAgent,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs);
    page.setDefaultNavigationTimeout(options.timeoutMs);

    await page.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
        await route.abort();
        return;
      }

      await route.continue();
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs,
    });

    await page
      .waitForLoadState("networkidle", {
        timeout: Math.min(5000, options.timeoutMs),
      })
      .catch(() => undefined);

    return {
      finalUrl: page.url(),
      statusCode: response?.status(),
      html: await page.content(),
    };
  } finally {
    await browser.close();
  }
}

