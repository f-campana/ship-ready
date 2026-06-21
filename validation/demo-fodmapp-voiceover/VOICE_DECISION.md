# Fodmapp voiceover decision

## Decision

- **Decision status:** `approved_voice_a`
- **Canonical demo:** Candidate A is approved as the optional enhanced voiceover. `validation/demo-fodmapp-share/final-demo.mp4`, the silent/captioned V2, remains the canonical fallback.
- **Candidate A:** `validation/demo-fodmapp-voiceover/final-demo-with-voice-a.mp4` is approved for the final internal share package.

Explicit human approval was provided on 2026-06-21: “Voiceover is good enough for now.” This closes the tone and pronunciation gate for current internal use. The approval is provisional in wording, so the silent/captioned V2 remains available as the canonical fallback.

## Rationale and evidence coverage

| Check | Covered by existing evidence | Result |
| --- | --- | --- |
| MP3 and composed MP4 existence | Yes | `voiceover-a.mp3` and `final-demo-with-voice-a.mp4` both exist. Fresh `ffprobe` inspection measured the MP3 at 52.709297 seconds and the composed MP4 at 55.560000 seconds. |
| No clipping | Yes | A fresh decoded `volumedetect` check measured a −3.7 dB maximum and −18.7 dB mean. `VOICE_REVIEW.md` records −3.70 dB peak and −18.74 dB RMS, with no clipping indication. |
| AAC audio | Yes | Fresh `ffprobe` inspection found AAC, 44.1 kHz, mono audio in the composed MP4, alongside H.264 1280x720 video. |
| Timing and closing dwell | Yes | The MP3 container is 52.709 seconds and the composed video is 55.560 seconds. The recorded transcript timing places the last speech near 52.48 seconds, leaving about 3.08 seconds of clean closing dwell. Nothing is cut off. |
| Transcription | Yes, as a recorded review result | `VOICE_REVIEW.md` records a complete automated transcription with 0.931 English-language probability. There is no separate transcript output artifact; the review record is the retained evidence. |
| Recognized technical terms | Yes | The review records recognition of ShipReady (rendered as “Ship Ready”), crawlers, preview bots, `robots.ts`, `sitemap.ts`, GUI, guarded command, overwrites, metadata, Git, and deploys. Fodmapp is not spoken in the final script. Recognition supports intelligibility but does not prove natural pronunciation. |
| Absence of forbidden claims | Yes | The narration and captions contain no ranking, SEO-boost, guaranteed-indexing, fix-everything, or equivalent promise. |

The narration broadly aligns with the safe-apply, file, guarded-command, and deployment-warning visuals. It accurately describes creation-only behavior and does not imply that the GUI writes files.

## Human judgment outcome

A human accepted Candidate A as good enough for now, covering whether:

- the tone is trustworthy;
- it is not too salesy;
- it is not too robotic;
- pronunciation is acceptable, especially ShipReady, `robots.ts`, `sitemap.ts`, crawlers, and preview bots;
- the voice improves the caption-only demo.

These are subjective checks. Technical validation did not replace human taste judgment; the explicit human decision closes them for current internal use.

## Involved files

Canonical share package:

- `validation/demo-fodmapp-share/final-demo.mp4`
- `validation/demo-fodmapp-share/captions.srt`
- `validation/demo-fodmapp-share/thumbnail.png`
- `validation/demo-fodmapp-share/README.md`
- `validation/demo-fodmapp-share/SUMMARY.md`

Voiceover review artifacts:

- `validation/demo-fodmapp-voiceover/voiceover-final.txt`
- `validation/demo-fodmapp-voiceover/voiceover-a.mp3`
- `validation/demo-fodmapp-voiceover/final-demo-with-voice-a.mp4`
- `validation/demo-fodmapp-voiceover/ffprobe-a.json`
- `validation/demo-fodmapp-voiceover/VOICE_REVIEW.md`
- `validation/demo-fodmapp-voiceover/SUMMARY.md`
- `validation/demo-fodmapp-voiceover/VOICE_DECISION.md`

Final approved package:

- `validation/demo-fodmapp-voiceover-final/final-demo-with-voice.mp4`
- `validation/demo-fodmapp-voiceover-final/final-demo-silent.mp4`
- `validation/demo-fodmapp-voiceover-final/captions.srt`
- `validation/demo-fodmapp-voiceover-final/thumbnail.png`
- `validation/demo-fodmapp-voiceover-final/README.md`
- `validation/demo-fodmapp-voiceover-final/SUMMARY.md`

## Safety confirmation

- `POST /api/fix` remains unavailable: current server source exposes only `POST /api/ui-report` and returns 404 for unmatched routes; the existing verified V2 baseline also records `POST /api/fix` as 404.
- The GUI client calls only `/api/ui-report`.
- No GUI write endpoint exists.
- Safe apply remains preview/copy-only in the GUI; the guarded command must be run separately and intentionally.
- The guarded ShipReady fix command was not executed during this pass.
- `/Users/fabiencampana/Documents/fodmapp/apps/marketing` has no tracked changes or untracked files in that scoped path. Its repository remains at commit `62f1c5b05a1f342fee3aaee4d67d0f3a6239528d`, tree `9197edb4cafa04ffe85c6a0ea979e29fbe4add8c`. The wider Fodmapp worktree has an unrelated untracked `etl/products/__pycache__/` outside the marketing target.
- No Git mutation occurred. Git use in this pass was read-only inspection only.
- No deployment occurred.
- This pass changes documentation only; it changes no product, CLI, GUI, or other source code.

## Recommended next action

Use Candidate A as the optional enhanced internal demo and retain the silent/captioned V2 as the canonical fallback. Revisit the voice only if later feedback identifies a concrete tone, pronunciation, or pacing issue.

The next roadmap pass is **Agent-first documentation consolidation**.
