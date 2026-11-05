// Regenerates Harmonie's SVG files from the TypeScript geometry. Run: npm run build:harmonie
/* global console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { runnerImport } from 'vite';

const OUTPUT = 'assets/characters/harmonie';

const { module } = await runnerImport('/src/characters/harmonie/harmonie-sheet.ts');
mkdirSync(OUTPUT, { recursive: true });
writeFileSync(`${OUTPUT}/harmonie-character-sheet.svg`, module.buildCharacterSheet());
writeFileSync(`${OUTPUT}/harmonie-rig.svg`, module.buildRigSvg());
console.log(`Wrote ${OUTPUT}/harmonie-character-sheet.svg and ${OUTPUT}/harmonie-rig.svg`);
