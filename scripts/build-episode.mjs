/* global console */
// Regenerates the episode's subtitle and narration files from episode.json.
// Run: npm run build:episode
import { writeFileSync } from 'node:fs';
import { runnerImport } from 'vite';

const { module } = await runnerImport('/src/episodes/hollow-bell-crypt/subtitles.ts');
for (const [path, content] of Object.entries(module.episodeTextFiles())) {
  writeFileSync(path, content);
  console.log(`Wrote ${path}`);
}
