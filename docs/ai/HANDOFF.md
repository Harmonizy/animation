# Handoff

Written so that the next person or AI assistant needs no chat history. Rules are in
[AGENTS.md](../../AGENTS.md).

## Current state

- Repository: `Harmonizy/animation` (**public**). Local folder: `C:\Users\gotji\Music\animation`.
- `main` holds only the initial commit. All work is on `phase-1/foundation`, **not pushed**.
- Phase 1 is implemented and verified locally. See [status](PROJECT_STATUS.md).

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
`contact-sheet.png` first.

## Code map

Start with `src/main.ts`, then:

- `src/core/schema.ts`: the data model.
- `src/core/evaluate.ts`: time to frame, the heart of the system.
- `src/core/framing.ts`: world to viewport, aspect ratios and bounds.
- `src/playback/clock.ts`: the transport.
- `src/render/pixi/pixiRenderer.ts`: frame to pixels.
- `src/studio/studio.ts`: UI wiring.
- `src/demos/geometricDemo.ts`: the demo as data.

## Things that are easy to get wrong

- Do not move animation values into GSAP. `evaluateScene` has to stay pure for reproducibility.
- Camera keyframes use shot-local time, while node keyframes use scene time.
- `layer` only orders siblings, and children draw above their parent.
- A test's seek must be drawn before a screenshot is taken. `seekTo` in `tests/e2e/helpers.ts` waits.
- The seek slider snaps to frames, so `fill()` can fail for off-grid values. Use `seekTo`.
- The desktop browser pane can throttle animation frames, so measure timing with Playwright.
- The demo must stay inside the frame. `tests/unit/framing.test.ts` fails if edits push a shape out.

## Waiting on the owner

1. Permission to push `phase-1/foundation` and open a pull request. CI cannot run until then.
2. Approval, or changes, for the
   [Cinematic Minimalist Silhouette proposal](../proposals/cinematic-minimalist-silhouette.md).
3. Reading the GSAP license if the studio may be distributed as a tool.

## Suggested next steps

1. Push and confirm CI on Linux, since it has only run locally on Windows.
2. Test the Studio on a real phone and on a GPU, then record the results in visual QA.
3. Start the approved Phase 2/3 work.
