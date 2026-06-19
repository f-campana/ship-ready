import path from "node:path";

export const outputDir = path.resolve("validation/demo-fodmapp-recording");
export const demoUrl = "https://fodmapp.fr";
export const repoPath = "/Users/fabiencampana/Documents/fodmapp/apps/marketing";
export const guardedCommand = `pnpm shipready fix ${repoPath} --url https://fodmapp.fr/ --write --allow-create`;

export const storyboard = [
  { start: 0, end: 8, beat: "Generated sites can look ready but miss crawler launch-readiness files." },
  { start: 8, end: 18, beat: "Enter the live URL and local project folder." },
  { start: 18, end: 32, beat: "Check what crawlers and preview bots can see." },
  { start: 32, end: 48, beat: "Needs attention separates safe work from review-required changes." },
  { start: 48, end: 62, beat: "Preview the two safe crawl files: app/robots.ts and app/sitemap.ts." },
  { start: 62, end: 78, beat: "The GUI writes nothing; copy the guarded creation-only command. No overwrites, content edits, commits, or deploys." },
  { start: 78, end: 86, beat: "Review locally, deploy when ready, then re-check the live site." },
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
