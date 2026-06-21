# Fodmapp final voiceover package

Candidate A received explicit human approval on 2026-06-21 as good enough for current internal use. The voiced demo is the optional enhanced version; the silent/captioned V2 remains the canonical fallback.

## Package contents

- `final-demo-with-voice.mp4` — approved optional enhanced demo with synthetic voiceover, H.264 video, AAC audio, and baked captions.
- `final-demo-silent.mp4` — canonical silent/captioned fallback with baked captions.
- `captions.srt` — sidecar captions.
- `thumbnail.png` — 1280x720 safe-apply frame.
- `SUMMARY.md` — decision, provenance, and safety summary.

## Safety boundary

- The voiceover is synthetic.
- This package changes no product, CLI, GUI, or write behavior.
- The GUI remains preview/copy-only and calls only `POST /api/ui-report`.
- No GUI write endpoint exists; `POST /api/fix` remains unavailable.
- Packaging did not execute the guarded command, write to the Fodmapp target repository, perform a Git mutation, or deploy anything.
