import { expect, test } from '@playwright/test';
import { HARMONIE_PALETTE } from '../../src/characters/harmonie/harmonie-palette';
import {
  VIEWPORTS,
  canvasShot,
  currentFrame,
  expectColor,
  hexToRgb,
  openStudio,
  pixelAt,
  seekTo,
  trackProblems,
} from './helpers';

test.describe('Harmonie motion preview', () => {
  let problems: string[];

  test.beforeEach(({ page }) => {
    problems = trackProblems(page);
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('opens from the view menu at 24 fps on twos', async ({ page }) => {
    await openStudio(page);
    await page.locator('#view-select').selectOption('harmonie');
    await expect(page.locator('#preview')).toHaveAttribute('data-ready', 'true');
    await expect(page).toHaveURL(/view=harmonie/);
    await expect(page.locator('#preview')).toHaveAttribute('data-fps', '24');
    await expect(page.locator('#exposure-character')).toHaveValue('2');
    await expect(page.locator('#exposure-secondary')).toHaveValue('2');
  });

  test('draws on Warm Ivory with the scarf in Amber Gold', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.landscape);
    await openStudio(page, '?view=harmonie');
    const png = await canvasShot(page);
    expectColor(await pixelAt(page, png, 8, 8), hexToRgb(HARMONIE_PALETTE.warmIvory));
    // Count amber pixels across the figure: the scarf must be visible.
    const amber = await page.evaluate(
      async ({ data, target }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) return 0;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const close =
            Math.abs((pixels[i] ?? 0) - target.r) < 6 &&
            Math.abs((pixels[i + 1] ?? 0) - target.g) < 6 &&
            Math.abs((pixels[i + 2] ?? 0) - target.b) < 6;
          if (close) count++;
        }
        return count;
      },
      { data: png.toString('base64'), target: hexToRgb(HARMONIE_PALETTE.amberGold) },
    );
    expect(amber).toBeGreaterThan(400);
  });

  test('shows the same picture whenever the same time is shown', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.landscape);
    await openStudio(page, '?view=harmonie');
    await seekTo(page, 5.25);
    const first = await canvasShot(page);
    await seekTo(page, 12.5);
    await seekTo(page, 5.25);
    expect((await canvasShot(page)).equals(first)).toBe(true);
  });

  test('holds each walk drawing for two frames', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.landscape);
    await openStudio(page, '?view=harmonie');
    await seekTo(page, 100 / 24);
    expect(await currentFrame(page)).toBe(100);
    const held = await canvasShot(page);
    await page.locator('#step-forward').click();
    await expect.poll(() => currentFrame(page)).toBe(101);
    expect((await canvasShot(page)).equals(held)).toBe(true);
    await page.locator('#step-forward').click();
    await expect.poll(() => currentFrame(page)).toBe(102);
    expect((await canvasShot(page)).equals(held)).toBe(false);
  });

  test('keeps the raised hand of the reach in frame in every aspect ratio', async ({ page }) => {
    for (const [aspect, viewport] of [
      ['16:9', VIEWPORTS.landscape],
      ['1:1', VIEWPORTS.landscape],
      ['9:16', VIEWPORTS.portrait],
    ] as const) {
      await page.setViewportSize(viewport);
      await openStudio(page, `?view=harmonie&aspect=${aspect}&display=silhouette`);
      await seekTo(page, 10);
      const png = await canvasShot(page);
      const box = await page.locator('#preview canvas').boundingBox();
      if (!box) throw new Error('no canvas');
      // The top rows of the frame must be empty background, so nothing is cut off.
      const background = await pixelAt(page, png, box.width / 2, 2);
      for (const x of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        expectColor(await pixelAt(page, png, box.width * x, 2), background);
      }
    }
  });
});
