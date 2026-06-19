import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { outputDir } from "./fodmappDemo.js";

const raw = path.join(outputDir, "raw-browser-video.webm");
const captions = path.join(outputDir, "captions.srt");
const voice = path.join(outputDir, "voiceover.mp3");
const output = path.join(outputDir, "final-demo.mp4");
await Promise.all([access(raw), access(captions)]);
const ffmpeg = "/opt/homebrew/bin/ffmpeg";
const hasFfmpeg = spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status === 0;
if (!hasFfmpeg) {
  console.log("Composition skipped: ffmpeg is unavailable. Raw WebM and SRT remain usable.");
  process.exit(0);
}
const hasVoice = await access(voice).then(() => true, () => false);
const args = ["-y", "-i", raw];
if (hasVoice) args.push("-i", voice);
if (hasVoice) args.push("-map", "0:v:0", "-map", "1:a:0", "-shortest");
args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
if (hasVoice) args.push("-c:a", "aac", "-b:a", "160k");
args.push(output);
const result = spawnSync(ffmpeg, args, { stdio: "inherit" });
if (result.status !== 0) throw new Error(`ffmpeg failed with status ${result.status}.`);
console.log(`Created ${output}${hasVoice ? " with voiceover" : " as a silent captioned demo"}.`);
