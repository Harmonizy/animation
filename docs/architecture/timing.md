# Timing architecture

**Status: implemented,** except file encoding for export (Phase 5). The code is in
`src/core/timing.ts`, `src/core/evaluate.ts`, `src/core/exportSampling.ts` and
`src/playback/clock.ts`.

## Four separate concepts

| Concept         | What it is                          | Owner                   | Rule                                 |
| --------------- | ----------------------------------- | ----------------------- | ------------------------------------ |
| Display refresh | How often the browser can draw      | `requestAnimationFrame` | Never affects frame contents         |
| Playhead        | Current position, in seconds        | `src/playback/clock.ts` | Speed only changes how fast it moves |
| Pose exposure   | Which pose a track shows on a frame | `src/core/timing.ts`    | Pure function of frame and hold      |
| Export sampling | Output frame times                  | `src/core/timing.ts`    | Computed from the index, no clock    |

```text
Preview: Clock -> playhead -> project frame -> evaluateFrame -> Renderer
Export:  index -> index / exportFps -> evaluateScene -> frame state (encoding: Phase 5)
Track:   project frame -> pose frame (floor to hold) -> time -> keyframe interpolation
```

ESLint stops `src/core` importing `src/playback` or GSAP, so export sampling has no route to real time.

## Frames

- A timeline has `N = ceil(duration * fps)` frames, numbered from 0, covering `[0, duration)`.
- The end time is not a frame of its own, as it would be frame 0 of the next pass. Loops therefore
  never show a repeated picture. Keyframes at the end time still define the motion leading up to it.
- 8 seconds gives 96, 192, 200, 240 and 480 frames at 12, 24, 25, 30 and 60 fps.
- Keyframes are stored in seconds. Changing FPS keeps the duration and changes the frame count.
- The preview only shows frames on the project grid. 12 fps looks like 12 fps on any display, and a
  frame is only drawn when it changes, so a faster display adds no renders.
- Timecode is non-drop-frame `HH:MM:SS:FF`. All supported rates are whole numbers.

### Why there is a tolerance when converting time to a frame

`floor(time * fps)` is wrong for this purpose. Measured on this project:

- Float division alone gave the wrong frame for 6.5% of frames at 25 fps and 1.6% at 30 and 60 fps.
- GSAP rounds seek times, by up to 3.33e-8 s. A tolerance of 1e-6 frames was still wrong at 30 and 60
  fps.

`timeToFrame` adds a tolerance of 1e-3 frames, about 17 microseconds at 60 fps. Tests cover every frame
up to 100,000, and every frame through a real GSAP seek. While paused, `Clock` also keeps the exact time
itself instead of reading it back from GSAP.

## Exposure

- A hold is a whole number of **project** frames: Ones 1, Twos 2, Threes 3, Fours 4, or custom. 24 fps
  on twos is 12 poses per second, whatever the export rate.
- Resolution order: UI override for the group, then the track's `hold`, then the scene's `exposure`.
- Groups: `character`, `camera`, `background`, `secondary`. These are only labels for timing, with no
  story meaning.
- Node tracks count poses from the start of the scene. Camera tracks count from the start of their
  shot, so every shot opens on a fresh pose.
- Exposure quantizes the input time. Interpolation then runs as normal at the pose's time.
- A hold is per track, for its whole length. Changing hold part way through a track is not supported.

## Export rate and project rate

Exports sample at `index / exportFps`, then read the project frame showing at that time:

- Exporting at the project rate gives each project frame once.
- Exporting faster repeats frames. 24 to 60 fps gives 0, 0, 0, 1, 1, 2 and so on. There is no
  in-betweening, because the project rate defines the picture.
- Exporting slower skips frames.

## Playback controls

| Control | Behavior                                                                |
| ------- | ----------------------------------------------------------------------- |
| Play    | From the end, starts again at 0                                         |
| Seek    | Keeps playing, unless it reaches the end without loop                   |
| Step    | Pauses first. Stops at the ends, or wraps when loop is on               |
| Loop    | Can be toggled during playback                                          |
| Speed   | 0.25, 0.5, 1, 1.5 and 2. Never changes frame contents or export results |

GSAP stays as the transport because it handled all of this correctly in testing, including looping
across passes and changing speed with no jump. It computes no animation values. `lagSmoothing(0)` is
set so the playhead follows real elapsed time after a stall, which also means a long stall skips ahead.

## Not implemented

- Encoding images, video or audio (Phase 5).
- Drop-frame timecode and fractional rates such as 23.976 and 29.97.
- Reverse playback.
- Changing hold within a track.
