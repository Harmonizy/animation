# Visual QA

A successful build does not imply a successful visual result. Visual claims need rendered evidence.

## Workflow

1. Run `npm run capture`.
2. Open `artifacts/screenshots/<setup>/contact-sheet.png`, then individual frames as needed. Each
   setup also has `workspace.png` and one image per timestamp.
3. Run the app with `npm run dev` and check motion, since stills cannot show it.
4. Record findings below. Separate technical, visual and animation defects from design ideas.

Captured setups: `landscape-16x9`, `landscape-1x1`, `landscape-9x16`, `portrait-9x16`, `portrait-16x9`.

Timestamps: 0 s, 2 s (25%), 3.97 s (last frame before the cut), 4 s (50%, the cut), 6 s (75%), 8 s
(final frame).

## Automated coverage

| Check                                             | Where                         |
| ------------------------------------------------- | ----------------------------- |
| No console errors, page errors or failed loads    | `tests/e2e/studio.spec.ts`    |
| Colors at known points, layer order by pixel      | `tests/e2e/studio.spec.ts`    |
| Same frame however it was reached (byte-equal)    | `tests/e2e/studio.spec.ts`    |
| Camera reset restores the exact picture           | `tests/e2e/studio.spec.ts`    |
| Layout fits, no page overflow, all 6 combinations | `tests/e2e/studio.spec.ts`    |
| Foreground shapes stay in frame, 161 samples      | `tests/unit/framing.test.ts`  |
| First and last frames match                       | `tests/unit/evaluate.test.ts` |

Byte-equal comparisons only hold within one machine and browser run. No baseline images are committed,
so there is **no regression comparison against an approved reference**. Output parity between preview
and final video cannot be checked until export exists (Phase 5).

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
