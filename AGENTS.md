# Agent guide

For any AI assistant or person working in this repository. Read this, then
[docs/ai/PROJECT_STATUS.md](docs/ai/PROJECT_STATUS.md) and
[docs/ai/HANDOFF.md](docs/ai/HANDOFF.md). No previous chat history is needed.

## Project

`cinematic-animation-studio` is a reusable Animation-as-Code foundation. The GitHub repository is
named `animation`. The owner communicates in Thai; code, identifiers and docs are in English.

## Authorization limits

- **Authorized:** Phase 0, Phase 1, the timing engine and Timing Lab, the Cinematic Minimalist
  Silhouette foundation and its neutral labs, and the character design and rig of **Harmonie
  (CHR-001)**. See [docs/creative/harmonie.md](docs/creative/harmonie.md).
- **Not authorized:** stories, scripts, other named characters, Harmonie's backstory, relationships,
  powers or plot, world lore, 3D, or later phases, until the owner approves them.
- **Ask first:** pushing commits, opening pull requests, changing repository visibility or name, and
  publishing to GitHub Pages. The repository is public, so a push is a publication.
- **Proposals are not approvals:** check the status at the top of each file in `docs/proposals/`.

## Architecture rules

Data flows one way. ESLint enforces the import boundaries.

```text
project data -> Zod schema -> evaluateScene(scene, t) -> FrameState -> Renderer -> pixels
                                       ^
                               Clock and UI only supply t and viewing overrides
```

- `src/core`, `src/demos` and `src/characters` import no renderer, GSAP, DOM or UI code.
- Only `src/render/pixi` imports `pixi.js`. Only `src/playback` imports `gsap`.
- `evaluateFrame` and `evaluateScene` stay pure: no clock, randomness or retained state.
- Display refresh, playhead, exposure and export sampling stay separate. See
  [timing architecture](docs/architecture/timing.md).
- Exports are sampled by index. Never derive them from real-time accumulation.
- Scene content is data. Technical demos stay in `src/demos` and use `kind: 'technical-demo'`.

## Working rules

- Work in small increments and run the relevant checks after each one.
- Do not claim a feature works unless it was run. A passing build says nothing about visual quality.
- For visual changes, run `npm run capture` and look at the images.
- No decorative controls, empty modules or fake functionality. Unbuilt features belong in docs,
  marked **Planned**.
- Update `PROJECT_STATUS.md` and `HANDOFF.md` whenever reality changes.

## Git conventions

- Do not commit directly to `main`. Branches: `phase-N/topic`, `fix/topic`, `docs/topic`.
- Commit style: `feat:`, `fix:`, `docs:`, `test:`, `chore:` with an imperative summary.
- Never commit secrets, renders or archives. See
  [assets and binaries](docs/production/assets-and-binaries.md).

## Before handing off

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run capture
```
