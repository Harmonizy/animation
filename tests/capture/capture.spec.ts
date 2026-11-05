import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import { openStudio, seekTo, VIEWPORTS } from '../e2e/helpers';

const OUTPUT = 'artifacts/screenshots';
const DURATION = 8;

/** Start, 25%, the last frame before the cut, the cut (50%), 75%, final frame. */
const TIMES = [0, DURATION * 0.25, 119 / 30, DURATION * 0.5, DURATION * 0.75, 239 / 30];

/** Start, 25%, 50%, 75%, final frame at the lab's default 24 fps stepping. */
const LAB_TIMES = [0, 0.75, 1.5, 2.25, 71 / 24];
const LAB_TABS = ['fps', 'exposure', 'spacing', 'timing'] as const;

const SETUPS = [
  { name: 'landscape-16x9', viewport: VIEWPORTS.landscape, aspect: '16:9' },
  { name: 'landscape-1x1', viewport: VIEWPORTS.landscape, aspect: '1:1' },
  { name: 'landscape-9x16', viewport: VIEWPORTS.landscape, aspect: '9:16' },
  { name: 'portrait-9x16', viewport: VIEWPORTS.portrait, aspect: '9:16' },
  { name: 'portrait-16x9', viewport: VIEWPORTS.portrait, aspect: '16:9' },
] as const;

const fileName = (time: number) => `t-${time.toFixed(2).padStart(5, '0')}.png`;

/** A contact sheet so a whole sequence can be reviewed at once. */
async function contactSheet(page: Page, directory: string, times: readonly number[]) {
  const images = times
    .map((time) => {
      const data = readFileSync(join(directory, fileName(time))).toString('base64');
      return `<figure><img src="data:image/png;base64,${data}"><figcaption>t=${time.toFixed(2)}s</figcaption></figure>`;
    })
    .join('');
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.setContent(`<!doctype html><style>
    body{margin:0;padding:12px;background:#333;color:#fff;font:14px sans-serif}
    main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    figure{margin:0}img{display:block;max-width:100%;max-height:440px}
  </style><main>${images}</main>`);
  await page.locator('main').screenshot({ path: join(directory, 'contact-sheet.png') });
}

for (const setup of SETUPS) {
  test(`capture ${setup.name}`, async ({ page }) => {
    const directory = join(OUTPUT, setup.name);
    mkdirSync(directory, { recursive: true });
    await page.setViewportSize(setup.viewport);
    await openStudio(page, `?aspect=${setup.aspect}`);

    for (const time of TIMES) {
      await seekTo(page, time);
      await page.locator('#preview canvas').screenshot({ path: join(directory, fileName(time)) });
    }
    await page.screenshot({ path: join(directory, 'workspace.png') });

    await contactSheet(page, directory, TIMES);
    writeFileSync(join(directory, 'times.json'), JSON.stringify(TIMES));
  });
}

for (const tab of LAB_TABS) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test(`capture timing lab ${tab} ${viewportName}`, async ({ page }) => {
      const directory = join(OUTPUT, `lab-${tab}-${viewportName}`);
      mkdirSync(directory, { recursive: true });
      await page.setViewportSize(viewport);
      await openStudio(page, `?view=timing&tab=${tab}`);

      for (const time of LAB_TIMES) {
        await seekTo(page, time);
        await page.locator('#preview canvas').screenshot({ path: join(directory, fileName(time)) });
        if (time === 1.5) await page.screenshot({ path: join(directory, 'workspace.png') });
      }
      await contactSheet(page, directory, LAB_TIMES);
    });
  }
}

/** 0, 25, 50, 75 and 100% of the 8 s labs, on the 24 fps grid, plus the frame after a cut. */
const STYLE_LAB_TIMES = [0, 2, 4, 6, 191 / 24];
const STYLE_LABS = ['geometric', 'articulated', 'atmospheric'] as const;
const STYLE_SETUPS = [
  { name: '16x9', viewport: VIEWPORTS.landscape, aspect: '16:9', display: 'normal' },
  { name: '1x1', viewport: VIEWPORTS.landscape, aspect: '1:1', display: 'normal' },
  { name: '9x16', viewport: VIEWPORTS.portrait, aspect: '9:16', display: 'normal' },
  { name: 'silhouette', viewport: VIEWPORTS.landscape, aspect: '16:9', display: 'silhouette' },
  { name: 'grayscale', viewport: VIEWPORTS.landscape, aspect: '16:9', display: 'grayscale' },
] as const;

for (const lab of STYLE_LABS) {
  for (const setup of STYLE_SETUPS) {
    test(`capture style lab ${lab} ${setup.name}`, async ({ page }) => {
      const directory = join(OUTPUT, `style-${lab}-${setup.name}`);
      mkdirSync(directory, { recursive: true });
      await page.setViewportSize(setup.viewport);
      await openStudio(page, `?view=${lab}&aspect=${setup.aspect}&display=${setup.display}`);

      for (const time of STYLE_LAB_TIMES) {
        await seekTo(page, time);
        await page.locator('#preview canvas').screenshot({ path: join(directory, fileName(time)) });
        if (time === 4) await page.screenshot({ path: join(directory, 'workspace.png') });
      }
      await contactSheet(page, directory, STYLE_LAB_TIMES);
    });
  }
}

test('capture walk cycle strip', async ({ page }) => {
  // Consecutive poses of one full cycle, on ones, to judge the walk without live motion.
  const directory = join(OUTPUT, 'style-articulated-walk');
  mkdirSync(directory, { recursive: true });
  await page.setViewportSize(VIEWPORTS.landscape);
  await openStudio(page, '?view=articulated&display=silhouette');
  await page.locator('#exposure-character').selectOption('1');
  const times = Array.from({ length: 9 }, (_, index) => (126 + index * 3) / 24);
  for (const time of times) {
    await seekTo(page, time);
    await page.locator('#preview canvas').screenshot({ path: join(directory, fileName(time)) });
  }
  await contactSheet(page, directory, times);
});

for (const lab of STYLE_LABS) {
  for (const palette of ['cool', 'inverted', 'warm'] as const) {
    test(`capture style lab ${lab} palette ${palette}`, async ({ page }) => {
      const directory = join(OUTPUT, `style-${lab}-palette-${palette}`);
      mkdirSync(directory, { recursive: true });
      await page.setViewportSize(VIEWPORTS.landscape);
      await openStudio(page, `?view=${lab}&palette=${palette}&t=3`);
      await page.locator('#preview canvas').screenshot({ path: join(directory, 't-03.00.png') });
    });
  }
}

/* Harmonie (CHR-001): the generated SVG files, opened in the browser, and the motion preview. */

for (const file of ['harmonie-character-sheet', 'harmonie-rig'] as const) {
  test(`capture ${file}`, async ({ page }) => {
    const directory = join(OUTPUT, 'harmonie');
    mkdirSync(directory, { recursive: true });
    const svg = readFileSync(`assets/characters/harmonie/${file}.svg`, 'utf8');
    const size = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    await page.setViewportSize({ width: Number(size?.[1]), height: Number(size?.[2]) });
    await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
    await page
      .locator('svg')
      .first()
      .screenshot({ path: join(directory, `${file}.png`) });
  });
}

/** Idle, walk keys, reach and the cloth test. Every time is a whole frame at 24 fps. */
const HARMONIE_TIMES = [0, 2, 4, 4.25, 4.5, 4.75, 9.5, 10, 12.25, 12.5, 12.75, 13.875];
const HARMONIE_SETUPS = [
  { name: '16x9', viewport: VIEWPORTS.landscape, aspect: '16:9', display: 'normal' },
  { name: '1x1', viewport: VIEWPORTS.landscape, aspect: '1:1', display: 'normal' },
  { name: '9x16', viewport: VIEWPORTS.portrait, aspect: '9:16', display: 'normal' },
  { name: 'silhouette', viewport: VIEWPORTS.landscape, aspect: '16:9', display: 'silhouette' },
] as const;

for (const setup of HARMONIE_SETUPS) {
  test(`capture harmonie preview ${setup.name}`, async ({ page }) => {
    const directory = join(OUTPUT, `harmonie-preview-${setup.name}`);
    mkdirSync(directory, { recursive: true });
    await page.setViewportSize(setup.viewport);
    await openStudio(page, `?view=harmonie&aspect=${setup.aspect}&display=${setup.display}`);
    for (const time of HARMONIE_TIMES) {
      await seekTo(page, time);
      await page.locator('#preview canvas').screenshot({ path: join(directory, fileName(time)) });
      if (time === 4.5) await page.screenshot({ path: join(directory, 'workspace.png') });
    }
    await contactSheet(page, directory, HARMONIE_TIMES);
  });
}

test('capture harmonie walk cycle strip', async ({ page }) => {
  // Every drawing of one cycle on twos: twelve drawings in 24 frames.
  const directory = join(OUTPUT, 'harmonie-walk-strip');
  mkdirSync(directory, { recursive: true });
  await page.setViewportSize(VIEWPORTS.landscape);
  await openStudio(page, '?view=harmonie');
  const times = Array.from({ length: 12 }, (_, index) => (96 + index * 2) / 24);
  for (const time of times) {
    await seekTo(page, time);
    await page.locator('#preview canvas').screenshot({ path: join(directory, fileName(time)) });
  }
  await contactSheet(page, directory, times);
});
