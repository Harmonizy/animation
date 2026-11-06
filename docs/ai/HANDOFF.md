# Handoff

Written so that the next person or AI assistant needs no chat history. Rules are in
[AGENTS.md](../../AGENTS.md).

## Current state

- Repository: `Harmonizy/animation` (**public**). Local folder: `C:\Users\gotji\Music\animation`.
- `main` holds Phase 1, the timing engine and the style labs. PR #4 merged them, with CI passing.
- `integrate/timing-and-style-rjjke1` adds Harmonie (CHR-001), the episode The Hollow Bell Crypt,
  and the film DON'T LOOK BACK with Ta (CHR-002).
  It is pushed but has no PR yet.
- The older `phase-*` branches were merged as a stack and are no longer used for new work.
- Phase 1, the timing engine, the style labs and Harmonie are implemented and verified. See [status](PROJECT_STATUS.md).

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
- `src/characters/harmonie/`: Harmonie's palette, rig, geometry, poses, hand, preview and SVG sheet.
  Read [Harmonie](../creative/harmonie.md) first. Rebuild the SVG files with `npm run build:harmonie`.
- `projects/harmonie/hollow-bell-crypt/episode.json`: the episode's single source of timing, text,
  sound and prices. Art is in `src/episodes/hollow-bell-crypt/`. Read its
  [README](../../projects/harmonie/hollow-bell-crypt/README.md) for the render steps.
- `src/characters/ta/`: Ta's rig (side and back), geometry and poses with leg IK.
- `projects/ta-dont-look-back/episode.json`: DON'T LOOK BACK's shots, lines, subtitles and sound cues.
  Art is in `src/episodes/ta-dont-look-back/`; shared episode helpers in `src/episodes/shared/`.
  Read its [README](../../projects/ta-dont-look-back/README.md).

## Things that are easy to get wrong

- Do not use `floor(time * fps)`. Use `timeToFrame`, which handles float and GSAP rounding.
- The last frame is `N - 1`, not `duration`. The end time belongs to frame 0 of the next pass.
- Do not move animation values into GSAP. Evaluation has to stay pure for reproducibility.
- Exports must not touch `Clock`. ESLint rejects it in `src/core`.
- In ESLint flat config, a later `no-restricted-imports` entry **replaces** an earlier one for the same
  file. Each area must list everything it bans.
- Camera keyframes use shot-local time, and camera poses count from the shot start. Node keyframes and
  poses use the scene.
- `layer` only orders siblings, and children draw above their parent. `depth` reorders within a root,
  for rigs whose draw order differs from their hierarchy.
- Episode cuts must fall on whole frames at 24 fps, and every capture time in tests must too.
- JSON imports need `with { type: 'json' }`, or Playwright's loader rejects them.
- Text is drawn by the renderer, so pages with text must load Noto Sans Thai before the first frame.
- Shape-track keys must all have the same path commands in the same order, or validation fails.
- Scale a rig part uniformly. A non-uniform scale on a parent shears its rotated children.
- `mergePoses` replaces a node's whole value. Pass every field the node needs, not only the change.
- Ta's shadow must not change from 0.5 s before the voice. A unit test fails if it does.
- Don't run e2e tests during a render: both use `vite build` and `dist/`.
- Harmonie's left and right are her own. The side rig is her left profile and must not be mirrored.
- After changing Harmonie's geometry or poses, run `npm run build:harmonie`, look at the sheet, and
  commit the SVG files. A unit test fails if they are stale.
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

1. A Gemini API key as `GEMINI_API_KEY` (or a Google Cloud TTS key), for the episode's narration,
   and a TTS quota for DON'T LOOK BACK's 10 lines (`npm run voices:ta`), or recorded voices.
2. Watching the episode at speed with sound, and review of Harmonie's sheet and the labs.
3. Reading the GSAP license if the studio may be distributed as a tool.

## Suggested next steps

1. Have a person watch Harmonie's preview and the labs in motion, especially the walks.
2. Harmonie: a right profile, a stronger three-quarter turn, and a segmented cloak that can bend.
3. Test on a real high-refresh display, a phone and a GPU, then record the results in visual QA.
4. Add per-aspect camera framing, then fix the preview in very short windows.
