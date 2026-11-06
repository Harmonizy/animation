# Production status: DON'T LOOK BACK

Last updated: 2026-11-06. Branch `integrate/timing-and-style-rjjke1`.

## Summary

The picture, sound design, subtitles and choices are done, and the video renders to a verified MP4.
**The two voices have not been generated**, so the video has sound effects only. Its subtitles run
on the _planned_ line windows, not on measured speech.

## Definition of done

| Requirement                                                         | State                                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 60.00 s, 1080 x 1920, 24 fps, 1440 frames                           | Done. Checked with `ffprobe -count_frames`                                 |
| 11 shots at the brief's times                                       | Done. Unit test checks every boundary                                      |
| Ta (CHR-002), faceless, rigged                                      | Done: 16-node rig, side and back views, leg IK. Unit test: no face parts   |
| One bedroom, consistent: bed left, window by the bed, door opposite | Done. One `ROOM` layout used by every room shot                            |
| An independent, morphing, faceless shadow                           | Done: one outline, keyed by shape tracks, from behind the camera           |
| Shadow enters gradually and stops before the voice                  | Done. Unit test: unchanged from 0.5 s before the voice to the end          |
| Ta never turns, never leaves, never touches the handle              | Done. Unit test checks the hand against the lever every 3 frames from S06  |
| Third-person narrator, separate voice behind Ta                     | Written, cast (Charon, Enceladus) and scripted. **Audio not generated**    |
| S07 has no narration and no subtitles                               | Done. Unit test                                                            |
| Thai 56 px semibold #E8E3D8, English 34 px Noto Sans #B7C5CF, below | Done. e2e test checks widths in the real fonts                             |
| Thai and English SRT and VTT                                        | Done, generated from `episode.json` and `timing.json`                      |
| Subtitles follow the real speech                                    | **Not yet**: `timing.json` is `planned`. Becomes `measured` with the voice |
| Equal choices A หันไปมอง / TURN AROUND, B ทำเป็นไม่สนใจ / IGNORE IT | Done. Same size, style and fade. Unit test                                 |
| Unresolved ending, black at exactly 60.00 s                         | Done                                                                       |
| Restrained sound design built on silence                            | Done: synthesised, seeded, no ordinary night sounds                        |
| QA frames at 00:00, 05, 12, 17, 23, 29, 34, 40, 46, 51, 58          | Done, from the MP4. See [visual QA](visual-qa.md)                          |
| Narrative QA                                                        | Done. See [visual QA](visual-qa.md#narrative-qa)                           |
| Watched at speed with sound by a person                             | **Not yet**                                                                |

## Why the voices are missing

`npm run voices:ta` is written and works against the API, but:

1. The free tier of `gemini-3.8-flash-tts` allows 10 requests a day, and that quota ran out during
   the first tests.
2. The first, longer role-play direction made the model invent and speak its own English sentence.
   The script now sends a one-sentence `Say in Thai, ...:` direction with the line in quotes, which
   worked in earlier tests, but it has not yet produced this film's 10 lines.

No placeholder or fake voice has been mixed in.

## To finish

1. When the quota resets (or with a paid key): `GEMINI_API_KEY=... npm run voices:ta`. Listen to
   every line; regenerate one with `-- --force --only=S08`.
   Or record the lines yourself, as the [README](../README.md#voices) describes.
2. `npm run build:ta`, then commit the measured `timing.json` and the regenerated subtitle files.
3. `npm run audio:ta && npm run render:episode -- --episode=ta-dont-look-back`.
4. Watch it at speed with sound.

## Known limitations

- Ta's walk (S05) is IK on twos with a simple stride. It has not been judged by eye at speed.
- Cloth moves with the bones; nothing simulates it.
- Only Chromium with software GL has rendered the film.
