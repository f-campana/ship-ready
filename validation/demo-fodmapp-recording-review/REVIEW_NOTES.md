# Fodmapp demo review notes

## Review result

The 94.4-second 1280×720 WebM was reviewed using representative frames across the full timeline and additional transition sampling. It is suitable for internal sharing with the accompanying `captions.srt`.

## Pacing

- The opening holds long enough to read ShipReady, the live Fodmapp URL, and the local repository path.
- The Check site interaction is visible; the loading interval is brief and sensible.
- “Needs attention before launch” has an adequate pause. The next action remains visible, while the score is a small supporting field and is not presented as a ranking.
- Scrolling is smooth and the Safe apply section remains on screen long enough to inspect.
- The two file-plan sections, guarded command, copy confirmation, safety notes, and closing local-vs-live warning receive adequate dwell time.
- No re-record was needed. The original caption track ended 8.4 seconds early; the refined track now covers the full visual timeline.

## Caption readability and alignment

- Seven low-density captions align to the visible sections and remain on screen for 8–16 seconds each.
- Wording uses launch readiness, crawlers and preview bots, safe crawl files, preview, and guarded creation-only command.
- Captions avoid ranking promises and the phrases “rank higher,” “SEO boost,” “guaranteed indexing,” and “fix everything.”
- The final caption explicitly states that local changes do not affect the live site until deployment.
- FFmpeg 8.1.2 in this environment lacks the `subtitles`/libass filter. Caption burning was therefore unreliable. `final-demo.mp4` is paired with the required `captions.srt` sidecar.

## Safe-apply clarity

The recording visibly limits Safe apply to `app/robots.ts` and `app/sitemap.ts`, previews the files, displays a guarded command, and confirms copying without executing it. Trust notes state no overwrites, metadata/content edits, Git commits, or deploys. No write action occurs in the recording.

## Local-vs-live clarity

The yellow warning, “Local changes do not affect the live website until you deploy,” is visible near the close. The final caption restates the same boundary.

## Internal-sharing readiness

Ready for internal sharing as a silent H.264 MP4 with sidecar captions. Players must load `captions.srt` separately. A burned-caption export remains an optional follow-up on an FFmpeg build compiled with libass.
