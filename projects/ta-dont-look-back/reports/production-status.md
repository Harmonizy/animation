# Production status: DON'T LOOK BACK

Last updated: 2026-11-06. Branch `integrate/timing-and-style-rjjke1`.

## Summary

The picture, both voices, sound design, subtitles and choices are done, and the video renders to a
verified MP4. The subtitles follow the measured speech. **Nobody has listened to the voices yet**:
they are English ElevenLabs voices speaking Thai, and a transcription check heard some words
differently.

## Definition of done

| Requirement                                                         | State                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 60.00 s, 1080 x 1920, 24 fps, 1440 frames                           | Done. Checked with `ffprobe -count_frames`                               |
| 11 shots at the brief's times                                       | Done. Unit test checks every boundary                                    |
| Ta (CHR-002), faceless, rigged                                      | Done: 16-node rig, side and back views, leg IK. Unit test: no face parts |
| One bedroom, consistent: bed left, window by the bed, door opposite | Done. One `ROOM` layout used by every room shot                          |
| An independent, morphing, faceless shadow                           | Done: one outline, keyed by shape tracks, from behind the camera         |
| Shadow enters gradually and stops before the voice                  | Done. Unit test: unchanged from 0.5 s before the voice to the end        |
| Ta never turns, never leaves, never touches the handle              | Done. Unit test checks the hand against the lever every 3 frames         |
| Third-person narrator, separate voice behind Ta                     | Done: ElevenLabs Brian (narrator), Callum (presence). **Not yet heard**  |
| S07 has no narration and no subtitles                               | Done. Unit test                                                          |
| Thai 56 px semibold #E8E3D8, English 34 px Noto Sans #B7C5CF, below | Done. e2e test checks widths in the real fonts                           |
| Thai and English SRT and VTT                                        | Done, generated from `episode.json` and `timing.json`                    |
| Subtitles follow the real speech                                    | Done: `timing.json` is `measured` from the voice files                   |
| Equal choices A หันไปมอง / TURN AROUND, B ทำเป็นไม่สนใจ / IGNORE IT | Done. Same size, style and fade. Unit test                               |
| Unresolved ending, black at exactly 60.00 s                         | Done                                                                     |
| Restrained sound design built on silence                            | Done: synthesised, seeded, no ordinary night sounds                      |
| QA frames at 00:00, 05, 12, 17, 23, 29, 34, 40, 46, 51, 58          | Done, from the MP4. See [visual QA](visual-qa.md)                        |
| Narrative QA                                                        | Done. See [visual QA](visual-qa.md#narrative-qa)                         |
| Watched at speed with sound by a person                             | **Not yet**                                                              |

## Changes from the brief, at the owner's request

- The presence's line is **"ต้า... อย่าออกไปจากห้องนี้"** ("Ta... don't leave this room."): it says
  his name first, with weight. The brief's line was "อย่าออกไปจากห้องนี้".
- The presence is meant to sound haunting, not ordinary: a husky voice with a lower double under it.
- Both voices come from ElevenLabs. Gemini TTS was planned but its free daily quota ran out.
- S01's line runs 0.15 to 3.95 s (it was 0.3 to 3.85) so that it fits.

## Pronunciation check

Each line was transcribed back with `gemini-3.6-flash` until its free daily quota (20 requests) ran
out. This is a hint, not a verdict: the same take was transcribed differently on two runs.

| Line | Heard as                                            | Concern                  |
| ---- | --------------------------------------------------- | ------------------------ |
| S01  | ตีสองกว่า **ก็**ลืมตาขึ้น โดยไม่รู้ว่าตื่นเพราะอะไร | "ต้า" may be unclear     |
| S02  | คืนนี้เงียบ**สงัด** ไม่มีแม้เสียงจิ้งหรีด ...       | "สนิท" heard as "สงัด"   |
| S03  | Exact                                               |                          |
| S04  | **คม**เป็นสาย**ชาติ**เก่าอีกแล้ว เขาคิด             | "คง", "ชาร์จ" may be off |
| S06  | แต่ก่อนมือจะทัน**แต่**ลูกบิด                        | "แตะ" tone               |
| Rest | Not checked (quota)                                 | Listen                   |

To redo one line: `npm run voices:ta -- --force --only=S04`, then `npm run build:ta`,
`npm run audio:ta` and the render. Changing a line's `text` or splitting it with `performance` in
`episode.json` often helps.

## Known limitations

- Ta's walk (S05) is IK on twos with a simple stride. It has not been judged by eye at speed.
- Cloth moves with the bones; nothing simulates it.
- Only Chromium with software GL has rendered the film.
