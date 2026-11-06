/* global console */
// Regenerates DON'T LOOK BACK's subtitle files from episode.json and timing.json.
// Run: npm run build:ta
import { writeFileSync } from 'node:fs';
import { runnerImport } from 'vite';

const { module } = await runnerImport('/src/episodes/ta-dont-look-back/files.ts');
for (const [path, content] of Object.entries(module.taTextFiles())) {
  writeFileSync(path, content);
  console.log(`Wrote ${path}`);
}
