# Visual QA: DON'T LOOK BACK

Reviewed 2026-11-06 from frames extracted from the final MP4
(`artifacts/ta-dont-look-back/ta-dont-look-back.mp4`, git-ignored), not from the preview. Regenerate:

```bash
cd artifacts/ta-dont-look-back/qa
for t in 00 05 12 17 23 29 34 40 46 51 58; do ffmpeg -v error -y -ss 00:00:$t.02 -i ../ta-dont-look-back.mp4 -frames:v 1 t$t.png; done
```

The file: H.264 1080 x 1920 yuv420p, 1440 frames, AAC 48 kHz stereo, 60.000 s, and it decodes
without errors.

## Frames

| Time  | Shot | What is seen                                                                                        | Result |
| ----- | ---- | --------------------------------------------------------------------------------------------------- | ------ |
| 00:00 | S01  | Ta asleep on the left bed, window above, moonlight. No subtitle yet (line starts at 0.3 s)          | Pass   |
| 00:05 | S02  | The window: empty street, still trees. Two-line Thai subtitle with English below                    | Pass   |
| 00:12 | S03  | Insert: Ta's hand and a dark phone screen                                                           | Pass   |
| 00:17 | S04  | Ta sitting up on the bed with the phone, the charging cable on the floor                            | Pass   |
| 00:23 | S05  | Ta walking from the bed towards the door, on the same floor line                                    | Pass   |
| 00:29 | S06  | Ta at the door, from behind. His hand stops beside the lever, not on it                             | Pass   |
| 00:34 | S07  | No narration, no subtitle. The shadow is starting to rise from the bottom of the frame              | Pass   |
| 00:40 | S08  | The shadow fills the empty wall, taller than Ta, one arm towards the door. The line in quotes       | Pass   |
| 00:46 | S09  | Close on Ta's back. He has not turned                                                               | Pass   |
| 00:51 | S10  | Insert: the trembling hand held short of the lever                                                  | Pass   |
| 00:58 | S11  | Wide: Ta, the door, the still shadow. Choices A and B at the same size and style above the subtitle | Pass   |

The cut to black falls on frame 1440, exactly 60.00 s.

## Narrative QA

| Question                                                          | Answer                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Is the room the same room in every wide shot?                     | Yes. Bed and window left, door right, empty wall between them               |
| Does Ta's shadow differ from the presence's shadow?               | Yes. His falls to the right, small; the presence's comes from behind camera |
| Does the presence have a face or a visible source?                | No                                                                          |
| Does the shadow stop moving before the voice speaks?              | Yes, 0.5 s before (unit test)                                               |
| Does Ta ever turn around, leave, or touch the handle?             | No (unit tests on the rig and on the hand's position against the lever)     |
| Is S07 silent of words?                                           | Yes: no narration, no subtitle                                              |
| Are the two choices equal?                                        | Yes: same box, size, weight and fade                                        |
| Is the ending unresolved?                                         | Yes. The question stays on screen until black                               |
| Does anything ordinary of night appear in sound (crickets, cars)? | No                                                                          |

## Open issues

- **No voices yet**, so the film's words exist only as subtitles. The subtitles use planned windows.
- The reach hand at S07–S11 is small and low in contrast against the door. It reads as a hand held
  short of the lever in stills; judge it at speed.
- Nobody has watched the film at speed with sound.
