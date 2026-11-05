# Project status

Last updated: 2026-11-05. Branch: `integrate/timing-and-style-rjjke1`, not yet merged into `main`.

`main` holds Phase 1, the timing engine and the style labs (PR #4). This branch adds the first
approved character, **Harmonie (CHR-001)**: character sheet, rig, poses and a motion preview. See
[Harmonie](../creative/harmonie.md).

## Overall plan

| Work                                   | State                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| Phase 0: architecture and planning     | Done                                                       |
| Phase 1: minimal working studio        | Done, verified locally                                     |
| Visual QA review of the demo           | Done, see [visual QA](../production/visual-qa.md)          |
| Timing engine and Timing Lab (Phase 2) | Done, verified locally                                     |
| Visual QA review of the Lab            | Done, with one open issue                                  |
| Cinematic Minimalist Silhouette        | Approved. Foundation and three labs done, verified locally |
| Visual QA review of the style labs     | Done, with open issues                                     |
| Harmonie (CHR-001) design and rig      | Done, verified in Chromium. Not yet watched by a person    |
| Other Phase 2 work and later phases    | Not authorized                                             |

## Implemented

- Zod-validated project data (schema v3, upgrades v1 and v2), with a pure deterministic evaluator.
- Keyframes, step/linear/ease in/ease out/ease in-out, hierarchy, pivots, opacity and layer order.
- Shots with independent camera tracks, and cuts.
- Project and export FPS: 12, 24, 25, 30, 60.
- Exposure: ones, twos, threes, fours and custom, per group and per track.
- GSAP-based transport: play, pause, seek, step, loop, speed, restart.
- Frame counter and non-drop timecode.
- Export frame sampling, which selects frames and does **not** write files.
- PixiJS WebGL renderer behind a neutral interface, drawing only when a frame changes.
- Studio: preview, transport, timing, camera offset, layers, aspect ratio, responsive layout.
- Animation Timing Lab: FPS, exposure, spacing and timing comparisons.
- Palette tokens, SVG path parts, depth planes with parallax, poses and pose tracks.
- Silhouette and grayscale review modes.
- Test mannequin with reusable parts, and three neutral labs. See
  [visual style](../creative/visual-style.md).
- Vitest, Playwright, screenshot capture, ESLint with import boundaries, Prettier and a CI workflow.
- Node `depth`: draw order within a root, separate from the hierarchy.
- Harmonie (CHR-001): four-view turnaround, 21-node rig, leg IK, seven poses, a 2560x1800 SVG sheet,
  a rig SVG, and a 24 fps preview on twos (`?view=harmonie`). See [Harmonie](../creative/harmonie.md).

## Verification

Run after a clean `npm ci`, on Windows 11, Node 24.14.1, Chromium 156 with software GL.

| Check                  | Result                                           |
| ---------------------- | ------------------------------------------------ |
| `npm ci`               | Pass                                             |
| `npm run format:check` | Pass                                             |
| `npm run typecheck`    | Pass                                             |
| `npm run lint`         | Pass                                             |
| `npm test`             | Pass, 262 tests                                  |
| `npm run build`        | Pass                                             |
| `npm run test:e2e`     | Pass, 83 tests                                   |
| `npm run capture`      | Pass, 38 setups                                  |
| `npm audit --omit=dev` | 0 vulnerabilities                                |
| Dev server             | Started, and used in the desktop browser pane    |
| Screenshots viewed     | Yes. See [visual QA](../production/visual-qa.md) |

## Known limitations

- GitHub Actions runs on Linux for each PR and each push to `main`. Its first run found a phone layout
  problem caused by Linux fonts. PR #4 fixed it with a font-independent test, and CI passed.
- Tested in Chromium only, on one Windows machine, using software GL. Real GPUs, phones, Safari and
  Firefox are untested.
- **High refresh rates are simulated, not tested on real displays.** Real-GPU frame rate is unmeasured.
- The smoothness of live motion has not been judged by eye.
- Export selects frames only. Images, video and audio cannot be written yet (Phase 5).
- No drop-frame timecode, fractional rates (23.976, 29.97) or reverse playback.
- A hold applies to a whole track, and cannot change part way through it.
- Very short windows, around 518x374, squeeze the preview to a thin strip.
- No committed visual baselines, so no regression comparison against an approved image.
- Children draw above their parent, or behind it with a negative layer. Only those two placements exist.
- Style lab proportions, palettes and the walk are placeholders, with no per-aspect camera framing and no
  external `.svg` import. See [visual style](../creative/visual-style.md).
- Technical demos only. They are not artwork, and make no claim of visual fidelity.
- Harmonie: only the side view is animated, the walk is in place, cloth moves as rigid pieces, and no
  person has watched the motion. See [her open issues](../creative/harmonie.md#visual-qa-version-1).
- `npm audit` (including dev tools) reports 10 moderate findings from `minimatch` through ESLint
  tooling. They do not reach the app bundle, and npm's suggested fix is a breaking downgrade.
- TypeScript stays at 6.0.3 because `typescript-eslint` 8.72.1 requires `<6.1.0`.
- GSAP's license has an unresolved question for distributing a visual tool. See
  [the note](../architecture/overview.md#gsap).

## Plan differences

- GSAP: the owner first chose to leave it out, then the Phase 1 brief asked for it. It lives only in
  `src/playback`.
- `scripts/capture.ts` became a Playwright project, `tests/capture`, which needs no extra tooling.
- The clipping check runs as a unit test across 161 timestamps, not in the browser.
