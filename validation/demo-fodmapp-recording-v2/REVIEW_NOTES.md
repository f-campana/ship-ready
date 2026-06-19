# Fodmapp demo V2 review notes

- Runtime: 55.56 seconds (target 50–65; hard maximum 75).
- Video: H.264, 1280×720, 25 fps, no audio stream.
- Captions: injected by Playwright as a fixed browser overlay and therefore baked into the captured pixels. A matching `captions.srt` is included.
- Pacing: inputs and launch happen immediately; decision/readiness, fix plan, safe files, guarded command, copy confirmation, trust notes, and local-vs-live close each receive a short distinct beat.
- Copy: recording-only Chromium context grants clipboard permission and installs a deterministic `navigator.clipboard.writeText` stub. The normal GUI clipboard implementation and fallback are unchanged. The take shows `Copied` and `Guarded command copied. No files were changed.`
- Ending: closes on `Local changes do not affect the live website until you deploy.` with the caption `Deploy when ready, then re-check the live site.`
- Visual QA: representative timestamped frames from 2 through 54 seconds were inspected. Captions, safe files, command, copy success, trust notes, and closing warning are readable.
- Safety: the GUI remains display/copy-only. No write request, Git operation, or deployment occurred.

Ready for human review.
