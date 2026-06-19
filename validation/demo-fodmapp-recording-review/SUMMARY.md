# Fodmapp demo recording review

## Status

Complete. The generated recording was visually reviewed, caption pacing and wording were refined, and a validated silent MP4 was produced for internal sharing. Captions are supplied as a sidecar because the installed FFmpeg has no `subtitles` filter.

## Artifacts

- `SUMMARY.md` — production and validation record
- `REVIEW_NOTES.md` — pacing, readability, alignment, safety, and readiness review
- `storyboard.json` — refined 94.4-second timeline
- `voiceover.txt` — later-TTS narration wording
- `captions.srt` — refined low-density sidecar captions
- `raw-browser-video.webm` — reviewed source recording
- `final-demo.mp4` — silent H.264 internal-sharing master
- `ffprobe.json` — complete stream and container evidence

No `voiceover.mp3` was produced. Both required ElevenLabs environment variables were not present; their values were never printed or stored.

## Final media evidence

- Duration: 94.400 seconds
- Dimensions: 1280×720
- Video: H.264 (`libx264`), High profile, `yuv420p`, 25 fps
- Container: MP4 with `+faststart`
- Audio: none (intentional silent master)
- Captions: `captions.srt` sidecar, covering 00:00:00.000–00:01:34.400

Caption burning was attempted but FFmpeg reported `No such filter: subtitles`. The documented fallback was used: `final-demo.mp4` plus the validated sidecar SRT.

## Refinements

- Extended caption coverage from 86.0 seconds to the actual 94.4-second duration.
- Aligned beats to opening, input/check, readiness, Safe apply, file review, guarded copy, and local-vs-live close.
- Reduced caption density and removed any possible ranking implication.
- Made write-free behavior and local-vs-live status explicit.
- Preserved the reviewed browser recording because its pacing and scroll positions were adequate.

## Commands and results

```sh
pnpm test
pnpm typecheck
pnpm build
/opt/homebrew/bin/ffmpeg -version
/opt/homebrew/bin/ffprobe -version
curl -X POST http://127.0.0.1:4317/api/fix
```

- Tests: 14 files passed, 142 tests passed.
- Typecheck: passed.
- Build: passed.
- FFmpeg: 8.1.2.
- ffprobe: 8.1.2.
- Live route check: `POST /api/fix` returned 404.
- Source inspection: the GUI's only fetch call targets `/api/ui-report`; the server exposes no write route.

## Safety and target-repository evidence

- ShipReady working-tree output showed only this new review directory.
- `/Users/fabiencampana/Documents/fodmapp` had an empty `git status --short` before and after this work.
- Searches for target `app/robots.ts` and `app/sitemap.ts` returned no files before and after this work; the guarded command was not run.
- No target file, product behavior, write endpoint, metadata/content/package/config file, Git state, deployment, auth, billing, or account behavior was changed.
- No Git command that mutates state was used.

## Limitations

- Captions are not burned in because this FFmpeg build lacks libass/subtitles support; the sidecar must be loaded by the player.
- The review used full-timeline representative-frame and transition inspection rather than real-time audio review; the master is silent.
- Synthetic voice quality remains untested because voiceover credentials were absent.

## Reproduction

From the ShipReady repository:

```sh
/opt/homebrew/bin/ffmpeg -y \
  -i validation/demo-fodmapp-recording-review/raw-browser-video.webm \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -vf scale=1280:720 -movflags +faststart -an \
  validation/demo-fodmapp-recording-review/final-demo.mp4

/opt/homebrew/bin/ffprobe -v error -show_format -show_streams -of json \
  validation/demo-fodmapp-recording-review/final-demo.mp4 \
  > validation/demo-fodmapp-recording-review/ffprobe.json
```

Recommended next task: visually review the final MP4 with `captions.srt` enabled in the intended internal-sharing player.
