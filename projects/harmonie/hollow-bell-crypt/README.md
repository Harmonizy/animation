# The Hollow Bell Crypt: Harmonie's Last Gold

A 60-second vertical short (1080 x 1920, 24 fps, 1440 frames) for YouTube Shorts, TikTok and Reels.
Harmonie (CHR-001) has one gold piece and must choose what to buy before entering the crypt. The film
ends on the open question, and never shows what she buys.

## Files

| File                                   | What it is                                                                         | Edited by hand?     |
| -------------------------------------- | ---------------------------------------------------------------------------------- | ------------------- |
| `episode.json`                         | Shot list and storyboard: times, camera, narration, subtitles, sounds, item prices | **Yes: the source** |
| `subtitles.th.srt`, `subtitles.en.srt` | Subtitles, Thai and English                                                        | No, generated       |
| `subtitles.th.vtt`, `subtitles.en.vtt` | The same as WebVTT                                                                 | No, generated       |
| `narration.th.json`                    | The narration script with each line's time window, for the voice step              | No, generated       |
| `reports/production-status.md`         | What is done, what is not, and why                                                 | Yes                 |
| `reports/visual-qa.md`                 | Screenshot review against the brief                                                | Yes                 |

The artwork is code in `src/episodes/hollow-bell-crypt/`, and Harmonie comes unchanged from the
character library in `src/characters/harmonie/`. Nothing here duplicates the engine.

`episode.json` and the stored prices drive everything: the shot builders read their times from it,
the price tags and the final grid are spelled from its item table, the subtitle files are generated
from it, and the audio script reads its sound cues. A unit test fails if a price, the shot timing or a
generated file drifts.

## Make the video

```bash
npm run build:episode        # subtitles and narration script, after editing episode.json
npm run narration:episode    # Thai voice: needs GOOGLE_TTS_API_KEY (see below)
npm run audio:episode        # music and effects, with the voice if it exists
npm run render:episode       # all 1440 frames to artifacts/episode/hollow-bell-crypt.mp4
npm run render:episode -- --stills=0,96,216   # single frames, as PNG, for review
```

`render:episode` draws each frame by its exact index in headless Chromium, using the same renderer as
the browser preview, and pipes the PNGs to ffmpeg (H.264, yuv420p, CRF 18). It then muxes
`artifacts/episode/audio.wav` as AAC at 48 kHz. Videos and frames stay in `artifacts/`, which is not
committed. Watch frame by frame in the studio at `?view=hollow-bell-crypt`.

**Requirements:** Node, Python 3 with NumPy, and ffmpeg built with libx264 and AAC.

## Narration

The voice comes from **Gemini TTS** (`gemini-2.5-flash-preview-tts`, voice `Charon`) when
`GEMINI_API_KEY` is set, a key from Google AI Studio. Otherwise it uses Google Cloud Text-to-Speech
with `GOOGLE_TTS_API_KEY`. Run the three commands above in order.

Each line is trimmed of silence, converted to 48 kHz and, if needed, sped up by at most 12% to fit
its window; a line that still does not fit fails the run. Existing lines are kept, so a rerun only
asks for what is missing (`--force` remakes them). `GEMINI_TTS_VOICE` and `GEMINI_TTS_MODEL` change
the voice and model. Listen before publishing: a synthetic voice may need another voice to sound calm.

Until a key is set, the video has music and sound effects but **no voice**.

## Sound

All music and effects are synthesised by `scripts/episode-audio.py` from noise and sine partials.
They are original, need no licence, and are the same on every run.
