# Project status

Last updated: 2026-11-05. Branch: `phase-1/foundation`. **Not pushed.**

## Phase

- Phase 0: done.
- Phase 1: implementation done. See the checklist below for evidence.
- Later phases: not authorized.
  [Cinematic Minimalist Silhouette](../proposals/cinematic-minimalist-silhouette.md) awaits approval.

## Implemented

- Zod-validated project data, with a pure deterministic evaluator.
- Keyframes, five easings, node hierarchy, pivots, opacity and layer order.
- Shots with independent camera tracks, and cuts.
- GSAP-based transport: play, pause, seek, restart.
- PixiJS WebGL renderer behind a neutral interface, with cleanup verified by repeated remounting.
- Studio: preview, transport, camera offset and zoom, layer order, aspect ratio, responsive layout.
- Geometric technical demo (8 s, shapes only).
- Vitest, Playwright, screenshot capture, ESLint with import boundaries, Prettier and a CI workflow.

## Definition of Done

Run on Windows 11, Node 24.14.1, in Chromium 156 with software GL. See the handoff for how to repeat.

| Requirement                    | Result                                                  |
| ------------------------------ | ------------------------------------------------------- |
| `npm install` / `npm ci`       | Pass                                                    |
| Development server starts      | Pass, opened in the desktop browser pane                |
| Production build               | Pass                                                    |
| Type checking                  | Pass                                                    |
| Linting and format check       | Pass                                                    |
| Unit tests                     | Pass, 60 tests                                          |
| Studio preview renders         | Pass, confirmed with pixel checks and by viewing images |
| Play, Pause, Seek, Restart     | Pass, browser tests                                     |
| Neutral animation reproducible | Pass, byte-equal screenshots within a run               |
| Landscape and portrait         | Pass, browser tests and viewed screenshots              |
| Browser tests                  | Pass, 22 tests                                          |
| Screenshot evidence reviewed   | Done, see [visual QA](../production/visual-qa.md)       |
| README matches reality         | Checked by following its commands                       |
| Status and handoff are current | This file and [HANDOFF.md](HANDOFF.md)                  |

## Known limitations

- **GitHub Actions has never run,** because nothing has been pushed. The workflow is untested.
- Tested in Chromium only, on one Windows machine, using software GL. Real GPUs, phones, Safari and
  Firefox are untested, and real-GPU frame rate is unmeasured.
- No committed visual baselines, so no regression comparison against an approved image.
- Children always draw above their parent. Rigs will need more.
- The demo is a systems test, not artwork. It has no reference and no claim of visual fidelity.
- `npm audit` reports 10 moderate findings, all from `minimatch` through ESLint tooling. They do not
  reach the app bundle. npm's suggested fix is a breaking downgrade, so it was not applied.
- TypeScript stays at 6.0.3 because `typescript-eslint` 8.72.1 requires `<6.1.0`.
- Pixi emits unused renderer chunks in `dist` (WebGPU, Canvas), which only load if needed.
- GSAP's license has an unresolved question for distributing a visual tool. See
  [the note](../architecture/overview.md#gsap).
- Reverse, playback speed and camera rotation UI do not exist. Rotation exists in data only.

## Plan differences

- The first plan left GSAP out, following the owner's choice. The later Phase 1 brief explicitly asked
  for it, so it was added to `src/playback` only.
- `scripts/capture.ts` became a Playwright project, `tests/capture`, which needs no extra tooling.
- The clipping check runs as a unit test across 161 timestamps, not in the browser.
