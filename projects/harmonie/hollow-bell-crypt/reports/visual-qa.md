# Visual and narrative QA

Reviewed 2026-11-05, from frames taken out of the encoded MP4 itself (not from the preview), at the 14
timestamps in the brief, plus stills of every shot during the build. Chromium with software GL, Linux.
Re-create the frames with:

```bash
for t in 0 4 9 14 19 24 28 33 38 43 48 53 57 59; do
  ffmpeg -ss $t -i artifacts/episode/hollow-bell-crypt.mp4 -frames:v 1 artifacts/episode/qa/t$t.png
done
```

## Technical checks

| Check                           | Result                                                                                                       | How                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Runtime, frames, size, rate     | 60.000 s, 1440 frames, 1080 x 1920, 24 fps, yuv420p                                                          | `ffprobe -count_frames`   |
| Video and audio codecs          | H.264 and AAC, 48 kHz stereo, 60.000 s                                                                       | `ffprobe`                 |
| Shot timing                     | 12 shots on the storyboard's cut times, every cut on a whole frame                                           | unit test on episode.json |
| Only one shot visible at a time | Checked at the middle of every shot                                                                          | unit test                 |
| Same frame, same picture        | Evaluation and the rendered canvas                                                                           | unit and e2e tests        |
| Prices                          | 1, 1, 4, 2, 3, 5, 2 SP, total 18, budget 10, spelled from one table                                          | unit test                 |
| Subtitle widths                 | Every Thai and English line under 900 px in the real typeface                                                | e2e test                  |
| Thai rendering                  | Noto Sans Thai loads; tone marks and vowels stack correctly in every frame viewed                            | e2e test, viewed          |
| Hand never touches an item      | Checked on every frame from 53 s to the end, and within 60 px of the cards                                   | unit test                 |
| Sound sync                      | Coin 2.75 s, bells 10.3 s and 58.4 s, torch 29.0 s, decoy 45.9 s: each a 10 to 18 dB rise exactly at its cue | level analysis of the WAV |
| Loudness                        | About -16 dB RMS, peaks at -1 dBFS                                                                           | analysis of the WAV       |

## Checklist from the brief

| Item                                  | Result                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Harmonie's proportions                | Pass. The approved rig, unchanged, in side, back and close-up                                    |
| No facial features                    | Pass. The face is the one dark shape, and a hand needs none                                      |
| Costume and scarf color               | Pass. Her five colors only, scarf always Amber Gold                                              |
| Real 9:16 composition                 | Pass. Every shot is composed for the tall frame, not cropped from a wide one                     |
| Readable architecture                 | Pass. Stair, portal with a carved bell, vaulted corridor, bell shaft, broken bridge              |
| Recognisable items                    | Pass. Torch, chalk, rope, wax, bandage, hand bell, bundle and flask read at a third of the width |
| Correct prices                        | Pass. Tagged where each item appears, and in the final grid                                      |
| Subtitle placement                    | Pass. A fixed band at 66 to 79% of the height, clear of the lower interface                      |
| English smaller than Thai, below it   | Pass. 34 px under 56 px                                                                          |
| No cropped text                       | Pass in every frame viewed                                                                       |
| No broken geometry or loose rig parts | Pass in every frame viewed                                                                       |
| Camera                                | Slow, eased moves; no spins; one match cut each in S07 and S08                                   |
| Final choice unanswered               | Pass. The hand stops short; no item is highlighted or chosen                                     |
| Legible at a third of the width       | Pass for prices and Thai names; English item names are the smallest text (30 px) and still read  |

## Defects found and fixed

1. S01: the light beam was drawn over the hand and washed it grey; the coin sat on the fingers. The beam
   now sits behind the glove, which reads as a clean silhouette, and the coin rests in the palm.
2. S01: the coin landed under the subtitles. It now falls to the left, clear of the text.
3. S02: the reward text overlapped Harmonie during the dolly. It is now written on the contract.
4. S04: every arch's dark interior covered the arches beyond, hiding the corridor and the watcher.
   Arches are now open frames.
5. S04: the torch slid out of frame during the push. It was moved in.
6. S05: wall lines cut through the whole frame. Removed.
7. S12: the hand stayed at the bottom of the frame, nowhere near the items. It now reaches to just short
   of them, and a test holds it there.
8. Item cards: English names were too small at a third of the width. Enlarged.
9. Four capture times were not on the 24 fps grid, so those frames could never be shown. Fixed.

## Open issues

- **No narration yet.** The voice needs a Google Cloud key (see the README). Until then the video has
  music and effects only, and the subtitles carry the words.
- **Nobody has watched it at full speed and listened.** I checked frames, levels and timings, not the
  feel of the motion or the sound, which I cannot hear.
- The watchers are deliberately vague, but they are simple silhouettes. A designer could give them a
  more unsettling shape.
- S03 reads as a diagram more than a place. It is clear, but less atmospheric than the other shots.
- The bandage shot uses a simple dark forearm, not Harmonie's own arm.
- Camera moves are smooth on twos for the character and on ones for the camera, but there is no motion
  blur.

## Narrative check

| Question                                      | Answer                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Is the 1 GP problem clear at once?            | Yes: one coin, the words "1 GP", and the narration in the first four seconds                      |
| Is her motivation clear?                      | Yes: the contract with the seal and "REWARD: 30 GP"                                               |
| Does the crypt feel dangerous and particular? | Mostly: the bell motif, the scale of the portal and the watcher carry it. S03 is the weakest      |
| Are the three rules clear?                    | Yes: shifting paths (S03, S07, S11), watchers (S04, S10), whispers (S05, S09)                     |
| Do the items answer the dangers?              | Yes: each item's shot shows the danger it helps with                                              |
| Are the trade-offs meaningful?                | Yes: light draws watchers, chalk cannot stop the shift, wax blocks warnings, the bell reveals her |
| Is 1 GP = 10 SP understandable?               | Yes: the gold coin becomes ten silver, with the equation on screen                                |
| Does the choice need thought?                 | Yes: 18 SP of goods against 10, with several reasonable mixes                                     |
| Open without feeling unfinished?              | Yes: the hand stops, the bell tolls, the question and the budget rule stay up                     |
| Enough to discuss a strategy?                 | Yes: all seven prices and the budget stay on screen for the last seven seconds                    |
