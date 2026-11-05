import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const restrict = (files, patterns, message) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
  },
});

export default tseslint.config(
  { ignores: ['dist/', 'artifacts/', 'node_modules/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  // Architecture boundaries: see docs/architecture/overview.md.
  restrict(
    ['src/core/**/*.ts', 'src/demos/**/*.ts'],
    ['pixi.js', 'pixi.js/*', 'gsap', 'gsap/*', '**/render/**', '**/studio/**', '**/playback/**'],
    'core and demos stay pure data and logic: no renderer, GSAP, UI or playback imports.',
  ),
  restrict(
    ['src/render/**/*.ts', 'src/studio/**/*.ts', 'src/main.ts'],
    ['gsap', 'gsap/*'],
    'Only src/playback may import gsap.',
  ),
  restrict(
    ['src/playback/**/*.ts'],
    ['pixi.js', 'pixi.js/*', '**/render/**', '**/studio/**'],
    'playback only knows about time.',
  ),
  restrict(
    ['src/studio/**/*.ts', 'src/main.ts'],
    ['pixi.js', 'pixi.js/*'],
    'Only src/render/pixi may import pixi.js.',
  ),
  prettier,
);
