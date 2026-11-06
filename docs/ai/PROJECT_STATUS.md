# Project status

Last updated: 2026-11-06. Branch: `integrate/timing-and-style-rjjke1`, not yet merged into `main`.

`main` holds Phase 1, the timing engine and the style labs (PR #4). This branch adds the first
approved character, **Harmonie (CHR-001)**, and her first episode, **The Hollow Bell Crypt**: a 60 s
vertical short rendered to MP4. See [Harmonie](../creative/harmonie.md) and
[the episode](../../projects/harmonie/hollow-bell-crypt/README.md). It also adds a second film,
**DON'T LOOK BACK (อย่าหันกลับไป)**, with a new character, **Ta (CHR-002)**. See
[its README](../../projects/ta-dont-look-back/README.md) and
[status](../../projects/ta-dont-look-back/reports/production-status.md).

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
| Episode: The Hollow Bell Crypt         | Video done without narration. Voice needs an API key       |
| Ta (CHR-002) rig, side and back views  | Done, verified in Chromium                                 |
| Film: DON'T LOOK BACK                  | Video done with sound effects. Voices not yet generated    |
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
- Text and gradient shapes, and skipping invisible nodes when drawing.
- The Hollow Bell Crypt: 12 shots from `episode.json`, bilingual burned-in subtitles, SRT and VTT,
  a synthesised soundtrack, and `npm run render:episode` to a verified H.264/AAC MP4.
- Harmonie (CHR-001): four-view turnaround, 21-node rig, leg IK, seven poses, a 2560x1800 SVG sheet,
  a rig SVG, and a 24 fps preview on twos (`?view=harmonie`). See [Harmonie](../creative/harmonie.md).
- Shape tracks: path morphing between keyed outlines with the same command structure.
- A `latin` text font (Noto Sans) next to Noto Sans Thai.
- Shared episode code in `src/episodes/shared/`, and `render:episode -- --episode=<id>`.
- DON'T LOOK BACK: 11 shots, Ta (CHR-002), one bedroom, a morphing shadow, bilingual subtitles,
  SRT/VTT, equal choices, synthesised sound, and a Gemini TTS script for two voices (`voices:ta`).

## Verification

Harmonie branch, run on Linux, Node 22.23.4, Chromium (Playwright 1.64.1) with software GL, after a
clean `npm ci`. Earlier phases were also verified on Windows 11, Node 24.14.1.

| Check                    | Result                                                     |
| ------------------------ | ---------------------------------------------------------- |
| `npm run format:check`   | Pass                                                       |
| `npm run typecheck`      | Pass                                                       |
| `npm run lint`           | Pass                                                       |
| `npm test`               | Pass, 332 tests                                            |
| `npm run build`          | Pass                                                       |
| `npm run test:e2e`       | Pass, 94 tests                                             |
| `npm run capture`        | Pass, 45 setups                                            |
| `npm run build:harmonie` | Committed SVG files match the generated output (unit test) |
| Screenshots viewed       | Yes. See [visual QA](../production/visual-qa.md)           |

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
- The episode has no narration until a Gemini (or Google Cloud TTS) key is provided, and nobody has
  watched it at speed with sound. See [its status](../../projects/harmonie/hollow-bell-crypt/reports/production-status.md).
- DON'T LOOK BACK has no voices yet (Gemini free-tier quota), so its subtitles use planned windows.
  See [its status](../../projects/ta-dont-look-back/reports/production-status.md).
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
