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
