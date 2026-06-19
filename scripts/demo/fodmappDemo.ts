import path from "node:path";

export const outputDir = path.resolve("validation/demo-fodmapp-recording-v2");
export const demoUrl = "https://fodmapp.fr";
export const repoPath = "/Users/fabiencampana/Documents/fodmapp/apps/marketing";
export const guardedCommand = `pnpm shipready fix ${repoPath} --url https://fodmapp.fr/ --write --allow-create`;

export const storyboard = [
  { start: 0, end: 7, beat: "AI-generated sites can look ready, but still miss launch-readiness details." },
  { start: 7, end: 14, beat: "ShipReady checks what crawlers and preview bots can see." },
  { start: 14, end: 21, beat: "This page needs attention before launch." },
  { start: 21, end: 29, beat: "ShipReady separates safe crawl files from changes that need review." },
  { start: 29, end: 36, beat: "Two safe files are ready: robots.ts and sitemap.ts." },
  { start: 36, end: 44, beat: "The GUI does not write files. It gives a guarded command." },
  { start: 44, end: 52, beat: "No overwrites. No content edits. No Git commits. No deploys." },
  { start: 52, end: 60, beat: "Deploy when ready, then re-check the live site." },
] as const;

export const narration = `Generated sites can look ready in a browser while still missing launch-readiness details for crawlers and preview bots. Here, ShipReady checks the live Fodmapp URL alongside its local project folder. The result needs attention, and the report separates narrow safe work from changes that require review. For this project, safe apply contains exactly two missing crawl files: app/robots.ts and app/sitemap.ts. Their contents can be inspected before taking action. The GUI writes nothing. It only copies a guarded command that the developer may run intentionally. That command is creation-only: it does not overwrite files, edit metadata or content, change packages or configuration, commit code, or deploy. After running it, the developer reviews the two local files and uses the team’s normal deployment process. Because local changes do not affect the live site until deployment, the final step is to deploy when ready and run the live check again.`;

export function toSrtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const hh = Math.floor(ms / 3_600_000);
  const mm = Math.floor((ms % 3_600_000) / 60_000);
  const ss = Math.floor((ms % 60_000) / 1000);
  const mmm = ms % 1000;
  return [hh, mm, ss].map((value) => String(value).padStart(2, "0")).join(":") + "," + String(mmm).padStart(3, "0");
}

export function createSrt(): string {
  return storyboard.map((item, index) => `${index + 1}\n${toSrtTime(item.start)} --> ${toSrtTime(item.end)}\n${item.beat}\n`).join("\n");
}
