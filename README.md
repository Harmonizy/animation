# Cinematic Animation Studio

A foundation for Animation-as-Code: scenes are validated data, every frame is a pure function of
time, and rendering sits behind an interface.

**Status: Phase 1 foundation.** The only content is a neutral technical demo made of geometric
shapes. It is a systems test, not artwork. See [project status](docs/ai/PROJECT_STATUS.md).

## Setup

Requires Node 24 (see `.nvmrc`) and npm.

```bash
npm ci
npx playwright install chromium
npm run dev
```

Then open the URL Vite prints, normally `http://localhost:5173`.

## Commands

| Command                | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Development server                                           |
| `npm run build`        | Type check and production build into `dist/`                 |
| `npm run preview`      | Serve the production build                                   |
| `npm run typecheck`    | TypeScript strict check                                      |
| `npm run lint`         | ESLint, including the architecture import boundaries         |
| `npm run format:check` | Prettier check (`npm run format` writes the changes)         |
| `npm test`             | Unit tests (Vitest)                                          |
| `npm run test:e2e`     | Browser tests against the production build (Playwright)      |
| `npm run capture`      | Screenshots at review timestamps in `artifacts/screenshots/` |

## Studio URL parameters

| Parameter | Example        | Effect                                              |
| --------- | -------------- | --------------------------------------------------- |
| `t`       | `?t=2.5`       | Opens at a time in seconds                          |
| `aspect`  | `?aspect=9:16` | Opens with `16:9`, `9:16` or `1:1`                  |
| `debug`   | `?debug=1`     | Exposes `window.__studioDebug` for lifecycle checks |

## Documentation

- Architecture: [overview](docs/architecture/overview.md),
  [data contracts](docs/architecture/data-contracts.md)
- Production: [visual QA](docs/production/visual-qa.md),
  [assets and binaries](docs/production/assets-and-binaries.md),
  [GitHub Pages](docs/production/github-pages.md)
- AI collaboration: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md),
  [status](docs/ai/PROJECT_STATUS.md), [handoff](docs/ai/HANDOFF.md),
  [review checklist](docs/ai/REVIEW_CHECKLIST.md)
- Creative knowledge base: [docs/creative](docs/creative/character-design.md) and
  [references](docs/REFERENCES.md)
- Proposal awaiting approval:
  [Cinematic Minimalist Silhouette](docs/proposals/cinematic-minimalist-silhouette.md)

## Third-party licensing

GSAP is free to use but is not open source: it uses Webflow's
[standard license](https://gsap.com/standard-license/). See
[the note on GSAP](docs/architecture/overview.md#gsap) before distributing this project as a
product.
