import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build also works from a GitHub Pages project subpath.
  base: './',
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
