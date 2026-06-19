# Fodmapp internal demo package

This 55.56-second demo shows ShipReady checking `https://fodmapp.fr` against the local repository at `/Users/fabiencampana/Documents/fodmapp/apps/marketing`, identifying launch-readiness issues, and previewing two safe crawl-file additions: `app/robots.ts` and `app/sitemap.ts`. It then copies a guarded CLI command without changing files.

## Safety boundaries

- The GUI is preview/copy-only and calls only `POST /api/ui-report`.
- `POST /api/fix` remains unavailable (404); no write endpoint exists.
- The demo does not overwrite files, edit metadata or content, commit to Git, or deploy.
- Copying the guarded command shows `Copied` and `No files were changed.`
- Local changes do not affect the live website until deployment.
- No product behavior or safety boundary was changed while preparing this package.

## What not to claim

Do not claim that ShipReady will rank a site higher, provide an SEO boost, guarantee indexing, or fix everything. The demo is about launch-readiness checks and a constrained preview of safe crawl-file creation.

## Package contents

- `final-demo.mp4`: H.264, 1280x720, silent, with baked-in captions
- `captions.srt`: sidecar captions
- `thumbnail.png`: 1280x720 safe-apply frame
- `SUMMARY.md`: review evidence and delivery status

## Reproduce

From `/Users/fabiencampana/Documents/ship-ready`:

```sh
mkdir -p validation/demo-fodmapp-share
cp validation/demo-fodmapp-recording-v2/final-demo.mp4 validation/demo-fodmapp-share/final-demo.mp4
cp validation/demo-fodmapp-recording-v2/captions.srt validation/demo-fodmapp-share/captions.srt
ffmpeg -ss 40 -i validation/demo-fodmapp-recording-v2/final-demo.mp4 -frames:v 1 validation/demo-fodmapp-share/thumbnail.png
ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height -of json validation/demo-fodmapp-share/final-demo.mp4
```

