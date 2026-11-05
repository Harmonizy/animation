# Handoff

Written so that the next person or AI assistant needs no chat history. Rules are in
[AGENTS.md](../../AGENTS.md).

## Current state

- Repository: `Harmonizy/animation` (**public**). Local folder: `C:\Users\gotji\Music\animation`.
- `main` holds Phase 1, the timing engine and the style labs. PR #4 merged them, with CI passing.
  Start new work from `main`.
- The older `phase-*` branches were merged as a stack and are no longer used for new work.
- Phase 1, the timing engine and the style labs are implemented and verified locally. See [status](PROJECT_STATUS.md).

## Run and verify

```bash
npm ci
npx playwright install chromium
npm run dev
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run capture
```

Screenshots go to `artifacts/screenshots/<setup>/`, and that folder is git-ignored. Open
`contact-sheet.png` first. Labs open with `?view=timing`, `geometric`, `articulated` or `atmospheric`.

Stop the dev server before `npm ci` on Windows, because it locks a native file in `node_modules`.

## Code map

Start with `src/main.ts`, then:

- `src/core/schema.ts`: the data model.
- `src/core/timing.ts`: frames, exposure, timecode and export times. Read
  [timing architecture](../architecture/timing.md) first.
- `src/core/evaluate.ts`: frame to picture description, the heart of the system.
- `src/core/exportSampling.ts`: output frames, sampled by index.
- `src/core/framing.ts`: world to viewport, aspect ratios and bounds.
- `src/playback/clock.ts`: the transport.
- `src/render/pixi/pixiRenderer.ts`: frame to pixels.
- `src/studio/`: UI. `transport.ts` is shared with the labs.
- `src/labs/timing/`: the Timing Lab. `model.ts` is pure.
- `src/core/svgPath.ts`: the supported SVG path subset, shared by bounds and rendering.
- `src/style/cinematicMinimalist.ts`: palette tokens.
- `src/labs/silhouette/`: the mannequin and style labs. Read [visual style](../creative/visual-style.md).
- `src/demos/geometricDemo.ts`: the demo as data.

## Things that are easy to get wrong

- Do not use `floor(time * fps)`. Use `timeToFrame`, which handles float and GSAP rounding.
- The last frame is `N - 1`, not `duration`. The end time belongs to frame 0 of the next pass.
- Do not move animation values into GSAP. Evaluation has to stay pure for reproducibility.
- Exports must not touch `Clock`. ESLint rejects it in `src/core`.
- In ESLint flat config, a later `no-restricted-imports` entry **replaces** an earlier one for the same
  file. Each area must list everything it bans.
- Camera keyframes use shot-local time, and camera poses count from the shot start. Node keyframes and
  poses use the scene.
- `layer` only orders siblings, and children draw above their parent.
- A seek made during playback does not hold still. `seekTo` in `tests/e2e/helpers.ts` is for paused use.
- For timing tests, read the playhead when it changes, or you may read a stale value under load.
- The desktop browser pane can throttle animation frames, so measure timing with Playwright.
- Parallax is baked into world matrices, so `worldMatrix` includes the plane offset for that camera.
- Foreground shapes use the `foreground` token. `subject` is only for the subject.
- Fonts differ between machines, so do not rely on text widths for layout. CI on Linux wraps differently
  from Windows.
- When merging stacked PRs, check where each one lands. Their bases do not move to `main` by themselves.
- The demo must stay inside the frame. `tests/unit/framing.test.ts` fails if edits push a shape out.

## Waiting on the owner

1. Review of the labs, and any real palette or proportions to replace the placeholders.
2. Reading the GSAP license if the studio may be distributed as a tool.

## Suggested next steps

1. Have a person watch the labs in motion, especially the walk.
2. Test on a real high-refresh display, a phone and a GPU, then record the results in visual QA.
3. Add per-aspect camera framing, then fix the preview in very short windows.
