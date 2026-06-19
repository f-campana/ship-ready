# Fodmapp automated demo recording

## Status

The deterministic GUI-only recording pipeline completed. `raw-browser-video.webm` is the silent 1280×720 browser recording and `captions.srt` is its low-density caption track. The scripted timeline is 86 seconds, excluding variable live-check latency. `ffmpeg` and `ffprobe` were unavailable in this environment, so `final-demo.mp4` could not be composed here. The WebM and SRT remain the reliable artifacts.

Synthetic voiceover was skipped cleanly because `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` were absent. No secret was logged or stored. Voice quality is unvalidated; do not publish a generated voice track without review.

## Reproduce

From the ShipReady repository:

```sh
pnpm shipready gui --host 127.0.0.1 --port 4317
pnpm demo:fodmapp:captions
pnpm demo:fodmapp:record
pnpm demo:fodmapp:voice
pnpm demo:fodmapp:compose
```

The voice step is optional. It creates `voiceover.mp3` only when both ElevenLabs environment variables are present. The compose step burns captions into `final-demo.mp4` and adds the voice track when available; otherwise it creates a silent captioned MP4. It exits successfully with a clear message when ffmpeg is missing.

## Safety boundary

The automation visits only the local GUI, enters `https://fodmapp.fr` and `/Users/fabiencampana/Documents/fodmapp/apps/marketing`, submits **Check site**, scrolls through the report, and clicks **Copy command**. It never executes the guarded write command. The GUI calls only `POST /api/ui-report`; `POST /api/fix` remains unavailable. Safe apply remains display/copy-only and exactly `app/robots.ts` plus `app/sitemap.ts`. No product behavior, write endpoint, metadata/content edit, overwrite, commit, Git operation, deployment, auth, billing, or account behavior is introduced.

## Validation

- Tests: `pnpm test`
- Types: `pnpm typecheck`
- Build: `pnpm build`
- Route check: `POST http://127.0.0.1:4317/api/fix` returns 404
- Target checkout: Git status and the safe-file diff were checked before and after recording; the target repo remained unchanged
- TTS skip and storyboard/SRT/safety wording are covered by focused tests

## Limitation and next task

Install ffmpeg to produce `final-demo.mp4`, then run `pnpm demo:fodmapp:compose`. Recommended next task: review the generated video and refine pacing/captions. If a voice track is generated, validate its quality before publishing it.
