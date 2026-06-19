import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { narration, outputDir } from "./fodmappDemo.js";

export async function generateVoiceover(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): Promise<"created" | "skipped"> {
  const apiKey = env.ELEVENLABS_API_KEY;
  const voiceId = env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    console.log("Voiceover skipped: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are both required.");
    return "skipped";
  }
  const response = await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/mpeg", "xi-api-key": apiKey },
    body: JSON.stringify({ text: narration, model_id: "eleven_multilingual_v2" }),
  });
  if (!response.ok) throw new Error(`Voiceover request failed with status ${response.status}.`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "voiceover.mp3"), Buffer.from(await response.arrayBuffer()));
  console.log("Created voiceover.mp3.");
  return "created";
}

if (process.argv[1]?.endsWith("generateFodmappVoiceover.ts")) await generateVoiceover();
