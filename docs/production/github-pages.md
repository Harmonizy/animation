# GitHub Pages deployment

**Status: Planned. Not enabled.** Publishing needs the owner's explicit approval.

The production build is static, and `vite.config.ts` uses `base: './'`, so it should work from a
project subpath such as `https://harmonizy.github.io/animation/`. This has not been tested on Pages.

## When approved

1. In the repository settings, set **Pages > Source** to **GitHub Actions**.
2. Add a workflow that runs `npm ci` and `npm run build`, then uses `actions/upload-pages-artifact`
   and `actions/deploy-pages`, with `pages: write` and `id-token: write` permissions on that job only.
3. Open the deployed site and repeat the checks in [visual QA](visual-qa.md).

Everything in the build becomes public, including the demo content and the GSAP-based transport.
