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
  // A later entry replaces an earlier one for the same file, so each area lists everything it bans.
  restrict(
    ['src/render/**/*.ts'],
    ['gsap', 'gsap/*', '**/studio/**', '**/playback/**', '**/labs/**'],
    'Renderers only draw frames.',
  ),
  restrict(
    ['src/playback/**/*.ts'],
    ['pixi.js', 'pixi.js/*', '**/render/**', '**/studio/**', '**/labs/**'],
    'Playback only knows about time.',
  ),
  restrict(
    ['src/studio/**/*.ts', 'src/labs/**/*.ts', 'src/main.ts'],
    ['pixi.js', 'pixi.js/*', 'gsap', 'gsap/*'],
    'Only src/render/pixi may import pixi.js, and only src/playback may import gsap.',
  ),
  restrict(
    [
      'src/core/**/*.ts',
      'src/demos/**/*.ts',
      'src/labs/**/model.ts',
      'src/characters/**/*.ts',
      'src/episodes/**/*.ts',
    ],
    ['pixi.js', 'pixi.js/*', 'gsap', 'gsap/*', '**/render/**', '**/studio/**', '**/playback/**'],
    'Core logic stays pure: no renderer, GSAP, UI or clock, so exports cannot depend on real time.',
  ),
  prettier,
);
