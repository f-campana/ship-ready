import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { demoUrl, guardedCommand, outputDir, repoPath } from "./fodmappDemo.js";

const serverUrl = process.env.SHIPREADY_GUI_URL || "http://127.0.0.1:4317";
await mkdir(outputDir, { recursive: true });
const tempDir = path.join(outputDir, ".playwright-video");
await rm(tempDir, { recursive: true, force: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tempDir, size: { width: 1280, height: 720 } }, permissions: ["clipboard-read", "clipboard-write"] });
await context.addInitScript(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => undefined } });
});
const page = await context.newPage();
const pause = (ms: number) => page.waitForTimeout(ms);
const caption = async (text: string) => page.evaluate((value) => {
  let node = document.querySelector<HTMLElement>("[data-demo-caption]");
  if (!node) {
    node = document.createElement("div");
    node.dataset.demoCaption = "true";
    Object.assign(node.style, { position: "fixed", left: "50%", bottom: "18px", transform: "translateX(-50%)", zIndex: "2147483647", width: "min(900px, calc(100vw - 80px))", padding: "10px 18px", borderRadius: "10px", background: "rgba(10, 18, 28, .88)", color: "#fff", font: "600 22px/1.3 system-ui, sans-serif", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,.28)", pointerEvents: "none" });
    document.body.appendChild(node);
  }
  node.textContent = value;
}, text);

try {
  await page.goto(serverUrl, { waitUntil: "networkidle" });
  await caption("AI-generated sites can look ready, but still miss launch-readiness details.");
  await pause(3_000);
  await page.locator('input[name="url"]').fill(demoUrl);
  await page.locator('input[name="repoPath"]').fill(repoPath);
  await pause(4_000);
  await caption("ShipReady checks what crawlers and preview bots can see.");
  await page.getByRole("button", { name: "Check site", exact: true }).click();
  await page.getByRole("heading", { name: "Needs attention before launch", exact: true }).first().waitFor({ timeout: 60_000 });
  await caption("This page needs attention before launch.");
  await page.locator("[data-report]").scrollIntoViewIfNeeded();
  await pause(7_000);
  await caption("ShipReady separates safe crawl files from changes that need review.");
  await pause(6_000);
  await page.getByText("Safe crawl files ready to create").scrollIntoViewIfNeeded();
  await pause(3_000);
  await caption("Two safe files are ready: robots.ts and sitemap.ts.");
  await page.getByText("app/robots.ts", { exact: true }).first().scrollIntoViewIfNeeded();
  await pause(4_000);
  await page.getByText("app/sitemap.ts", { exact: true }).first().scrollIntoViewIfNeeded();
  await pause(4_000);
  await caption("The GUI does not write files. It gives a guarded command.");
  await page.getByText(guardedCommand, { exact: true }).scrollIntoViewIfNeeded();
  await pause(7_000);
  await page.getByRole("button", { name: "Copy command", exact: true }).click();
  await page.getByText("Guarded command copied. No files were changed.", { exact: true }).waitFor();
  await caption("No overwrites. No content edits. No Git commits. No deploys.");
  await pause(7_000);
  await page.getByText("Local changes do not affect the live website until you deploy.", { exact: true }).scrollIntoViewIfNeeded();
  await caption("Deploy when ready, then re-check the live site.");
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
