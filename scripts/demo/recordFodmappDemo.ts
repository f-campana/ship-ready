import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { demoUrl, outputDir, repoPath } from "./fodmappDemo.js";

const serverUrl = process.env.SHIPREADY_GUI_URL || "http://127.0.0.1:4317";
await mkdir(outputDir, { recursive: true });
const tempDir = path.join(outputDir, ".playwright-video");
await rm(tempDir, { recursive: true, force: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tempDir, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
const pause = (ms: number) => page.waitForTimeout(ms);

try {
  await page.goto(serverUrl, { waitUntil: "networkidle" });
  await pause(8_000);
  await page.locator('input[name="url"]').fill(demoUrl);
  await page.locator('input[name="repoPath"]').fill(repoPath);
  await pause(10_000);
  await page.getByRole("button", { name: "Check site", exact: true }).click();
  await page.getByRole("heading", { name: "Needs attention before launch", exact: true }).first().waitFor({ timeout: 60_000 });
  await page.locator("[data-report]").scrollIntoViewIfNeeded();
  await pause(14_000);
  await page.getByText("Safe crawl files ready to create").scrollIntoViewIfNeeded();
  await pause(16_000);
  await page.getByText("app/robots.ts", { exact: true }).first().scrollIntoViewIfNeeded();
  await pause(7_000);
  await page.getByText("app/sitemap.ts", { exact: true }).first().scrollIntoViewIfNeeded();
  await pause(7_000);
  await page.getByRole("button", { name: "Copy command", exact: true }).click();
  await page.getByText("Copied", { exact: true }).waitFor();
  await pause(16_000);
  await page.getByText(/live site/i).last().scrollIntoViewIfNeeded().catch(() => undefined);
  await pause(8_000);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) throw new Error("Playwright did not create a video.");
  await rename(await video.path(), path.join(outputDir, "raw-browser-video.webm"));
  await rm(tempDir, { recursive: true, force: true });
}
console.log(`Recorded ${path.join(outputDir, "raw-browser-video.webm")}`);
