# Optional ElevenLabs voiceover validation

## Status

One configured ElevenLabs voice was available and Candidate A was generated successfully. `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` were loaded from `.env`; optional A/B/C voice variables were absent. Credential values were never printed, logged, copied into commands, or stored in validation artifacts.

The approved `validation/demo-fodmapp-share/final-demo.mp4` remains canonical pending explicit human voice-quality approval.

## Files

- `voiceover-final.txt` — 114-word narration fitted to the approved sequence.
- `voiceover-a.mp3` — 52.709-second ElevenLabs candidate, MP3, 44.1 kHz mono.
- `final-demo-with-voice-a.mp4` — 55.560-second composition, H.264 1280x720 video plus AAC 44.1 kHz mono audio.
- `ffprobe-a.json` — full stream and format evidence.
- `VOICE_REVIEW.md` — candidate assessment and publication decision.

## Reproduction

The ElevenLabs request submits the exact UTF-8 contents of `voiceover-final.txt` with model `eleven_multilingual_v2` and voice settings: stability 0.65, similarity boost 0.75, style 0.15, speaker boost enabled. The API key and voice ID are read from environment variables and must never be written into a script or artifact.

```sh
/opt/homebrew/bin/ffmpeg -i validation/demo-fodmapp-share/final-demo.mp4 -i validation/demo-fodmapp-voiceover/voiceover-a.mp3 -filter_complex "[1:a]apad=pad_dur=60[a]" -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 192k -t 55.560 validation/demo-fodmapp-voiceover/final-demo-with-voice-a.mp4
/opt/homebrew/bin/ffprobe -v error -show_format -show_streams -of json validation/demo-fodmapp-voiceover/final-demo-with-voice-a.mp4 > validation/demo-fodmapp-voiceover/ffprobe-a.json
```

`apad` supplies 2.851 seconds of trailing silence at the container level so both streams end at 55.560 seconds. The source video stream is copied, preserving H.264, 1280x720 pixels, baked captions, and the complete ending.

## Evidence and assessment

- `/opt/homebrew/bin/ffmpeg -version`: 8.1.2.
- `/opt/homebrew/bin/ffprobe -version`: 8.1.2.
- Source: 55.560 seconds, H.264, 1280x720, silent.
- Candidate MP3: 52.709 seconds, MP3, 44.1 kHz mono, 844,321 bytes.
- Composed MP4: 55.560 seconds; H.264 1280x720 video and AAC 44.1 kHz mono audio; 1,956,788 bytes.
- Signal: peak −3.70 dB, RMS −18.74 dB; no clipping indication.
- Automated direct decode/transcription reproduced the complete script with 0.931 English-language probability and recognized the required technical vocabulary.
- Safety narration spans roughly 28–43 seconds, inside the broad safe-apply/file/guarded-command sequence. The final deployment warning ends around 52.48 seconds, leaving 3.08 seconds of closing dwell.
- Human-perceived tone and natural pronunciation cannot be established from metadata/transcription. Candidate A is not recommended for publication until a person watches and listens to the complete output.

## Safety boundary

- Source inspection confirms the GUI calls only `/api/ui-report` and the server exposes no write endpoint.
- The verified V2 baseline records `POST /api/fix` as 404.
- The guarded command was not executed. No overwrite, metadata/content/JSON-LD/package/config edit, Git action, or deployment occurred.
- `/Users/fabiencampana/Documents/fodmapp/apps/marketing` remains unchanged.
- Only validation artifacts changed. Product tests were not rerun; the existing verified baseline remains 142 tests plus passing typecheck and build.

## Recommendation and next task

Keep the silent/captioned V2 canonical. Candidate A is the only and technically best voiced candidate, but publication depends on human approval of tone and pronunciation. Next: watch and listen to `final-demo-with-voice-a.mp4`. If it passes, select Candidate A and produce one final voiced share package; if it sounds weak, rushed, robotic, salesy, or mispronounced, keep the approved silent/captioned V2.
