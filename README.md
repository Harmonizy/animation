# Cinematic Animation Studio

A foundation for Animation-as-Code: scenes are validated data, every frame is a pure function of
time, and rendering sits behind an interface.

**Status: Phase 1 foundation, timing engine and visual style foundation.** The only content is neutral technical demos and labs, with geometric
shapes and an anonymous test mannequin. It is a systems test, not artwork. See [project status](docs/ai/PROJECT_STATUS.md).

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

| Parameter | Example               | Effect                                              |
| --------- | --------------------- | --------------------------------------------------- |
| `t`       | `?t=2.5`              | Opens at a time in seconds                          |
| `frame`   | `?frame=75`           | Opens at a frame number, counted from 0             |
| `view`    | `?view=timing`        | `timing`, `geometric`, `articulated`, `atmospheric` |
| `display` | `?display=silhouette` | `normal`, `silhouette` or `grayscale`               |
| `palette` | `?palette=cool`       | In style labs: `warm`, `cool` or `inverted`         |
| `tab`     | `?tab=spacing`        | Lab tab: `fps`, `exposure`, `spacing` or `timing`   |
| `aspect`  | `?aspect=9:16`        | Opens with `16:9`, `9:16` or `1:1`                  |
| `debug`   | `?debug=1`            | Exposes `window.__studioDebug` for lifecycle checks |

## Documentation

- Architecture: [overview](docs/architecture/overview.md), [timing](docs/architecture/timing.md),
  [data contracts](docs/architecture/data-contracts.md)
- Production: [visual QA](docs/production/visual-qa.md),
  [assets and binaries](docs/production/assets-and-binaries.md),
  [GitHub Pages](docs/production/github-pages.md)
- AI collaboration: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md),
  [status](docs/ai/PROJECT_STATUS.md), [handoff](docs/ai/HANDOFF.md),
  [review checklist](docs/ai/REVIEW_CHECKLIST.md)
- Visual style: [Cinematic Minimalist Silhouette](docs/creative/visual-style.md)
- Creative knowledge base: [docs/creative](docs/creative/character-design.md) and
  [references](docs/REFERENCES.md)

## Third-party licensing

GSAP is free to use but is not open source: it uses Webflow's
[standard license](https://gsap.com/standard-license/). See
[the note on GSAP](docs/architecture/overview.md#gsap) before distributing this project as a
product.
