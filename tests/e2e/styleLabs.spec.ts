import { expect, test, type Page } from '@playwright/test';
import { evaluateFrame } from '../../src/core/evaluate';
import { nodeBounds, viewTransform, type Size } from '../../src/core/framing';
import { applyToPoint, multiply } from '../../src/core/matrix';
import { parseProject, type Scene } from '../../src/core/schema';
import { STYLE_LABS, type StyleLabId } from '../../src/labs/silhouette/labs';
import { MANNEQUIN_PARTS } from '../../src/labs/silhouette/mannequin';
import { STYLE_PALETTES } from '../../src/style/cinematicMinimalist';
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

const LAB_IDS = Object.keys(STYLE_LABS) as StyleLabId[];
const sceneOf = (id: StyleLabId) => parseProject(STYLE_LABS[id].build()).scenes[0] as Scene;

async function canvasSize(page: Page): Promise<Size> {
  const box = await page.locator('#preview canvas').boundingBox();
  if (!box) throw new Error('Canvas is not visible');
  return { width: box.width, height: box.height };
}

test.describe('style labs', () => {
  let problems: string[];

  test.beforeEach(({ page }) => {
    problems = trackProblems(page);
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  for (const id of LAB_IDS) {
    test.describe(id, () => {
      test('opens from the view selector and scrubs', async ({ page }) => {
        await openStudio(page);
        await page.locator('#view-select').selectOption(id);
        await expect(page.locator('#project-label')).toContainText(STYLE_LABS[id].label);
        await expect(page.locator('#preview')).toHaveAttribute('data-ready', 'true');

        const start = await canvasShot(page);
        await seekTo(page, 4);
        expect(await currentFrame(page)).toBe(96);
        expect((await canvasShot(page)).equals(start)).toBe(false);
        await page.locator('#restart').click();
        expect((await canvasShot(page)).equals(start)).toBe(true);
      });

      test('a stepped frame matches opening it directly', async ({ page }) => {
        await openStudio(page, `?view=${id}&frame=5`);
        const direct = await canvasShot(page);
        await openStudio(page, `?view=${id}`);
        for (let i = 0; i < 5; i++) await page.locator('#step-forward').click();
        expect((await canvasShot(page)).equals(direct)).toBe(true);
      });

      test('silhouette mode shows the subject in black on white', async ({ page }) => {
        await openStudio(page, `?view=${id}&display=silhouette`);
        const size = await canvasSize(page);
        const scene = sceneOf(id);
        const state = evaluateFrame(scene, 0, { display: 'silhouette' });
        const view = viewTransform(state.camera, state.safeArea, size);
        const part = state.nodes.find((node) => node.fill !== null);
        if (!part) throw new Error('no subject part');
        const bounds = nodeBounds(part, view);
        if (!bounds) throw new Error('no bounds');

        const shot = await canvasShot(page);
        const center = applyToPoint(multiply(view, part.worldMatrix), { x: 0, y: -8 });
        expectColor(await pixelAt(page, shot, center.x, center.y), hexToRgb('#000000'), 8);
        expectColor(await pixelAt(page, shot, 2, 2), hexToRgb('#ffffff'), 2);
      });

      test('grayscale mode has no color in it', async ({ page }) => {
        await openStudio(page, `?view=${id}&t=2`);
        await page.locator('#display').selectOption('grayscale');
        const shot = await canvasShot(page);
        const size = await canvasSize(page);
        for (const [x, y] of [
          [0.1, 0.1],
          [0.5, 0.5],
          [0.8, 0.3],
          [0.3, 0.9],
        ] as const) {
          const { r, g, b } = await pixelAt(page, shot, size.width * x, size.height * y);
          expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
          expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
        }
      });

      test('palettes recolor the scene and can be cleared', async ({ page }) => {
        await openStudio(page, `?view=${id}&t=2`);
        const original = await canvasShot(page);
        await page.locator('#palette').selectOption('inverted');
        const inverted = await canvasShot(page);
        expect(inverted.equals(original)).toBe(false);
        expectColor(await pixelAt(page, inverted, 2, 2), hexToRgb(STYLE_PALETTES.inverted.sky), 40);
        await page.locator('#palette').selectOption('');
        expect((await canvasShot(page)).equals(original)).toBe(true);
      });

      test('exposure holds the figure while the camera keeps moving', async ({ page }) => {
        await openStudio(page, `?view=${id}`);
        for (const group of ['character', 'camera', 'background', 'secondary']) {
          await page.locator(`#exposure-${group}`).selectOption('4');
        }
        await seekTo(page, 2);
        const held = await canvasShot(page);
        await page.locator('#step-forward').click();
        expect((await canvasShot(page)).equals(held)).toBe(true);
      });

      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        test(`fits a ${viewportName} window`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await openStudio(page, `?view=${id}&t=4`);
          const overflow = await page.evaluate(() => ({
            x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          }));
          expect(overflow).toEqual({ x: 0, y: 0 });
          for (const selector of ['#preview canvas', '#view-select', '#play', '#seek']) {
            await expect(page.locator(selector)).toBeInViewport({ ratio: 1 });
          }
        });
      }
    });
  }

  test('the articulated lab shows every part as real SVG', async ({ page }) => {
    await openStudio(page, '?view=articulated');
    const names = Object.keys(MANNEQUIN_PARTS);
    await expect(page.locator('#part-sheet svg')).toHaveCount(names.length);
    const last = page.locator('#part-sheet figure').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();
    const sizes = await page
      .locator('#part-sheet path')
      .evaluateAll((paths) =>
        paths
          .map((path) => (path as SVGPathElement).getBBox())
          .map((box) => box.width * box.height),
      );
    for (const size of sizes) expect(size).toBeGreaterThan(0);
  });

  test('other views have no part sheet', async ({ page }) => {
    await openStudio(page, '?view=geometric');
    await expect(page.locator('#part-sheet')).toHaveCount(0);
  });

  test('the farthest plane stays put when the camera pans, and nearer planes do not', async ({
    page,
  }) => {
    await openStudio(page, '?view=atmospheric&t=4');
    const scene = sceneOf('atmospheric');
    const size = await canvasSize(page);
    const screenX = (id: string, x: number) => {
      const state = evaluateFrame(scene, 96, { cameraOffset: { x, y: 0 } });
      const node = state.nodes.find((candidate) => candidate.id === id);
      if (!node) throw new Error(`missing ${id}`);
      const view = viewTransform(state.camera, state.safeArea, size);
      return applyToPoint(multiply(view, node.worldMatrix), { x: 0, y: 0 });
    };
    expect(screenX('light-source', 100).x).toBeCloseTo(screenX('light-source', 0).x);
    expect(screenX('mid-ridge', 100).x).not.toBeCloseTo(screenX('mid-ridge', 0).x);

    // The light source is still drawn in the same place after a real pan through the UI.
    const point = screenX('light-source', 0);
    const before = await pixelAt(page, await canvasShot(page), point.x, point.y);
    await page.locator('#camera-x').fill('60');
    const after = await pixelAt(page, await canvasShot(page), point.x, point.y);
    expect(after).toEqual(before);
    expectColor(after, hexToRgb(STYLE_PALETTES.warm.atmosphere));
  });
});
