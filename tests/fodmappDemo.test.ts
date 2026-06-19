import { describe, expect, it, vi } from "vitest";
import { createSrt, guardedCommand, narration, storyboard } from "../scripts/demo/fodmappDemo.js";
import { generateVoiceover } from "../scripts/demo/generateFodmappVoiceover.js";

describe("Fodmapp demo assets", () => {
  it("creates sequential, valid, readable SRT cues", () => {
    const srt = createSrt();
    expect(srt).toMatch(/^1\n00:00:00,000 --> 00:00:07,000/m);
    expect(srt.match(/--> /g)).toHaveLength(storyboard.length);
    expect(srt.split("\n").filter((line) => line.includes("-->"))).toHaveLength(8);
  });
  it("covers required beats and safety routing", () => {
    const beats = storyboard.map(({ beat }) => beat).join(" ");
    expect(beats).toContain("robots.ts");
    expect(beats).toContain("sitemap.ts");
    expect(beats).toContain("GUI does not write files");
    expect(storyboard.at(-1)?.end).toBeLessThanOrEqual(65);
    expect(guardedCommand).toContain("--write --allow-create");
  });
  it("uses natural length and excludes forbidden claims", () => {
    expect(narration.trim().split(/\s+/).length).toBeGreaterThanOrEqual(120);
    expect(narration.trim().split(/\s+/).length).toBeLessThanOrEqual(170);
    expect(narration.toLowerCase()).not.toMatch(/rank higher|seo boost|guaranteed indexing|fix everything/);
  });
  it("skips TTS cleanly without credentials or a request", async () => {
    const fetcher = vi.fn();
    await expect(generateVoiceover({}, fetcher as typeof fetch)).resolves.toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
