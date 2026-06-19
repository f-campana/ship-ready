import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSrt, narration, outputDir, storyboard } from "./fodmappDemo.js";

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "storyboard.json"), JSON.stringify(storyboard, null, 2) + "\n"),
  writeFile(path.join(outputDir, "voiceover.txt"), narration + "\n"),
  writeFile(path.join(outputDir, "captions.srt"), createSrt()),
]);
console.log(`Created storyboard, narration, and captions in ${outputDir}`);
