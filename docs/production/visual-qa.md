# Visual QA

A successful build does not imply a successful visual result. Visual claims need rendered evidence.

## Workflow

1. Run `npm run capture`.
2. Open `artifacts/screenshots/<setup>/contact-sheet.png`, then individual frames as needed. Each
   setup also has `workspace.png` and one image per timestamp.
3. Run the app with `npm run dev` and check motion, since stills cannot show it.
4. Record findings below. Separate technical, visual and animation defects from design ideas.

Captured setups: `landscape-16x9`, `landscape-1x1`, `landscape-9x16`, `portrait-9x16`, `portrait-16x9`,
plus `lab-<tab>-<landscape|portrait>` for each Timing Lab tab (`fps`, `exposure`, `spacing`, `timing`),
`style-<lab>-<16x9|1x1|9x16|silhouette|grayscale>` and `style-<lab>-palette-<name>` for each style lab,
and `style-articulated-walk`, which is consecutive poses of one walk cycle.

Studio timestamps: 0 s, 2 s (25%), 3.97 s (last frame before the cut), 4 s (50%, the cut), 6 s (75%),
7.97 s (final frame). Lab timestamps: 0, 0.75, 1.5, 2.25 and 2.96 s (0-100% of its 3 s pass).

## Automated coverage

| Check                                               | Where                         |
| --------------------------------------------------- | ----------------------------- |
| No console errors, page errors or failed loads      | `tests/e2e/studio.spec.ts`    |
| Colors at known points, layer order by pixel        | `tests/e2e/studio.spec.ts`    |
| Same frame however it was reached (byte-equal)      | `tests/e2e/studio.spec.ts`    |
| Camera reset restores the exact picture             | `tests/e2e/studio.spec.ts`    |
| Layout fits, no page overflow, all 6 combinations   | `tests/e2e/studio.spec.ts`    |
| Foreground shapes stay in frame, 161 samples        | `tests/unit/framing.test.ts`  |
| Tracks return to their start, for clean loops       | `tests/unit/evaluate.test.ts` |
| Stepped and played frames match direct (byte-equal) | `tests/e2e/timing.spec.ts`    |
| Exposure holds the picture for exactly its frames   | `tests/e2e/timing.spec.ts`    |
| Lab columns visible, layout fits, all tabs          | `tests/e2e/timing.spec.ts`    |

Byte-equal comparisons only hold within one machine and browser run. No baseline images are committed,
so there is **no regression comparison against an approved reference**. Output parity between preview
and final video cannot be checked until export exists (Phase 5).

## Review 2026-11-05: Cinematic Minimalist Silhouette labs

**Scope.** Same environments as below. Rendered output of all three labs was viewed at 0, 25, 50, 75 and
100%, in 16:9, 1:1 and 9:16, in silhouette and grayscale modes and in alternative palettes, plus a strip
of consecutive walk poses. The dev build was also played in the desktop browser pane.

**Reference.** None exists, so nothing is claimed to match a target. These are technical labs with
placeholder proportions and colors, and they are not finished artwork.

### Technical defects

| ID  | Finding                                                                         | Status                            |
| --- | ------------------------------------------------------------------------------- | --------------------------------- |
| T6  | Geometric lab: the closer shot clipped the leaning shape at 1:1 and 9:16        | Fixed. The clipping test found it |
| T7  | The Layers panel listed every post and pillar, pushing the parts sheet far down | Fixed by grouping them            |

No console errors, failed requests or asset errors were found. The labs load no external assets.

### Visual defects

| ID  | Finding                                                                                | Status                                                      |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| V10 | Neutral pose: arms and legs merged with the body, so the silhouette read as a column   | Fixed                                                       |
| V11 | The pelvis showed a sharp corner when crouching, then a slight bulge after a first fix | Fixed                                                       |
| V12 | Foreground pillars hid the figure almost fully at 75%, and for seconds at a time       | Fixed, with a test limiting coverage to under 12% of frames |
| V13 | In the `inverted` palette, foreground shapes were as bright as the figure              | Fixed with a `foreground` token                             |

### Animation review

- **Poses:** neutral, lean, reach and crouch read as distinct in black fill.
- **Walk:** contact and passing poses read in the strip of stills. Unit tests confirm a planted foot moves
  less than 25 world units across a stance, and at least one foot is on the ground in held poses.
- **Exposure:** on fours, a frame within a hold matches byte for byte.

**Not judged by eye:** live motion, including walk weight and timing. The desktop pane was hidden during
the playback check, and Playwright produces stills. Timing itself checked out: 2 s of play gave a playhead
of 1.997 s, with only 9 draws because the hidden pane throttled frames.

### Layout, proportion and color

- **Layering and clipping:** no subject clipping at any aspect ratio, by test across every other frame. Far
  limbs pass behind the body as intended.
- **Value structure:** the Atmospheric lab reads in grayscale, with the figure and foreground darkest and
  layers lightening with distance.
- **Reach pose:** the far arm merges with the body in black fill, leaving the raised arm to carry the read.
- **Composition:** 16:9 reads best. In 9:16 the Atmospheric lab has a large empty ground area, and the same
  camera is used for every aspect ratio.
- **Fog:** reads as flat layered bands, more like strata than soft mist.

### Open issues (not fixed)

- Per-aspect camera framing does not exist, which limits 9:16 composition.
- Very short windows still squeeze the preview.

### Design improvements (not done)

- Live, human review of the walk's weight and timing.
- A softer fog option, once banding has been checked.
- Show the safe area as an overlay.

## Review 2026-11-05: timing engine and Timing Lab

**Scope.** Same environments as below. Every Lab tab was viewed at landscape and portrait, and the
Studio was viewed again because the demo gained a background drift. Reviewed at 0, 25, 50, 75 and 100%.

**Reference.** None exists. The Lab is a technical instrument, not artwork, and nothing here claims
accuracy against a target. Pixel-level identity is only claimed where screenshots were compared byte for
byte within one run.

### Technical defects

| ID  | Finding                                                                                                                   | Status                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| T2  | Lab crashed on load: setting loop before its state existed                                                                | Fixed, covered by browser tests                                                                               |
| T3  | Renderer kept nodes that left the frame, so old lanes would stay after a tab change                                       | Fixed before release, tested                                                                                  |
| T4  | ESLint boundaries silently did not apply to `studio`, `labs` and `main`: later entries replaced earlier ones              | Fixed, confirmed by feeding forbidden imports to ESLint                                                       |
| T5  | A playback speed test failed once at a simulated 33 ms display. Cause: it read a stale value under load, not engine drift | Test fixed. It then passed 16 of 16 repeated runs. A separate test ruled out GSAP ticker sleep causing a jump |

No console errors, failed requests or asset errors were found. The Lab loads no external assets.

### Visual defects

| ID  | Finding                                                                     | Status                                    |
| --- | --------------------------------------------------------------------------- | ----------------------------------------- |
| V6  | The `Poses/s` column was cut off on three Lab tabs in landscape             | Fixed: wider panel, with an overflow test |
| V7  | On a phone, the speed control wrapped to its own row, shrinking the preview | Fixed: compact row, tested                |
| V8  | The `Background` label touched its select                                   | Fixed                                     |
| V9  | Screenshots showed the slider focus ring                                    | Fixed in the capture helper               |

### Animation review

No timing defects were found in the checked numbers: frames at 12, 24, 30 and 60 fps, poses on ones,
twos and threes, and hold boundaries all match tests and direct checks in the browser pane.

Spacing ticks visibly differ as intended: even on linear, widening on ease in, narrowing on ease out,
tight at both ends on ease in-out, and a single jump on step.

**Not judged by eye:** the smoothness of live motion. The desktop pane throttles animation frames, and
Playwright only produced stills. Playback measured 71-104 updates in 2 s across runs under software GL,
which says nothing about a real GPU. **Real 120 Hz and 144 Hz displays were not tested,** only simulated.

### Layout and color

- **Clipping:** no marker or tick is clipped. Markers extend past the rail ends into the side margin, as intended.
- **Readability:** the 60 fps lane's ticks almost merge at phone width, and ease in's first ticks merge
  at all sizes. Both honestly show very small gaps.
- **Color:** lane colors match the table chips.
- **Workspace:** fits at 1280x720 and 390x844 without page overflow. On a phone the lane table needs
  scrolling within the panel.

### Open issues

- **Short windows:** at about 518x374 the preview shrinks to a thin strip, because the controls keep
  their size. This was seen in the desktop pane and is not fixed.

### Design improvements (not done)

- Letterbox space above and below the lanes could be used by taller lanes on tabs with few lanes.
- Mark the current pose's tick on each rail.
- Add a pose number on the marker itself.
- Keyboard shortcuts for stepping.

## Review 2026-11-05: geometric technical demo

**Scope.** Chromium 156 through Playwright with software GL (SwiftShader), at device scale 1, plus the
dev build in the Claude desktop browser pane at device scale 1.25. Only these environments were
checked. Real phones, Safari and Firefox were not tested.

**Reference.** None exists, so nothing here claims accuracy against a target. The demo is a systems
test, not artwork.

### Technical defects

| ID  | Finding                                                                                 | Status        |
| --- | --------------------------------------------------------------------------------------- | ------------- |
| T1  | Grid could end inside the frame at the widest camera setting (16:9, zoom 0.5, full pan) | Fixed, tested |

No console errors, failed requests or asset errors were found. The demo loads no external assets.

### Visual defects

| ID  | Finding                                                                                    | Status                                                                |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| V1  | At 25% and 75%, the circle almost covered the square, leaving stray orange corners         | Fixed: smaller circle sits fully inside the square                    |
| V2  | At 0 s and 8 s, the hub's orbit crossed the faded triangle, making both hard to read       | Fixed: triangle moved clear, minimum opacity raised from 0.25 to 0.45 |
| V3  | Hub, satellite and moon looked unrelated, hiding the hierarchy                             | Fixed: visible arms added                                             |
| V4  | The moon's arm drew over the satellite and the two discs overlapped (introduced by V3 fix) | Fixed: arm spans only the gap                                         |
| V5  | The preview edge blended into the empty stage                                              | Fixed: 1 px outline                                                   |

### Animation defects

| ID  | Finding                                                                                                     | Status                                |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | At the cut, the framing changes by only about 20%, so it reads closer to a jump than a deliberate new shot  | Open: acceptable for a technical test |
| A2  | The moon passes over the hub's core around the 50% mark. It is correct for the layering but briefly crowded | Open: minor                           |

Measured motion: over 2 s of playback, two Playwright runs recorded 78 and 88 frames (about 39-43 fps
under software GL), with timeline time staying within the 0.1 s test tolerance and never stepping backwards. In the desktop
pane, time drift was 1.5 ms over 3.4 s, but the pane delivered only 8 frames, so that run says nothing
about smoothness. **Frame rate on a real GPU was not measured.**

### Layout, proportion and color review (after fixes)

- **Layering:** correct in every reviewed frame, and confirmed by pixel test.
- **Clipping:** no foreground shape clipped in any aspect ratio.
- **Proportions:** the white core, the discs and the square read as distinct sizes at all sizes viewed.
  At the 390 px phone layout the moon and arms are small but visible.
- **Color:** flat colors match the scene data. Orange and blue separate strongly against the dark
  ground. The faded triangle is intentionally lower contrast.
- **Composition:** functional rather than designed. In wide frames the content occupies the central
  square, leaving the sides empty apart from the grid.
- **Workspace:** landscape and portrait both fit without page overflow. On a phone the panel scrolls,
  and the layer controls start below the fold.

### Design improvements (not defects, not done)

- Thin grid lines vary in apparent brightness when they fall between pixels.
- Add a safe-area overlay so framing can be judged directly.
- Add a camera rotation control. The data supports rotation, but the UI does not expose it.
- Give the phone layout a collapsible panel, which would allow a larger preview.
- Show a keyframe or shot-boundary marker on the seek bar.
