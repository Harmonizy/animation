import { expect, test, type Page } from '@playwright/test';
import { evaluateScene } from '../../src/core/evaluate';
import {
  ASPECT_RATIOS,
  nodeBounds,
  viewTransform,
  type AspectRatioName,
  type Size,
} from '../../src/core/framing';
import { applyToPoint, type Point } from '../../src/core/matrix';
import { parseProject, type Scene } from '../../src/core/schema';
import { geometricDemo } from '../../src/demos/geometricDemo';
import {
  VIEWPORTS,
  canvasShot,
  currentTime,
  expectColor,
  hexToRgb,
  openStudio,
  pixelAt,
  seekTo,
} from './helpers';

const scene = parseProject(geometricDemo).scenes[0] as Scene;

/** Where a world point should appear on the canvas for the given time and size. */
function canvasPoint(world: Point, time: number, size: Size): Point {
  const frame = evaluateScene(scene, time);
  return applyToPoint(viewTransform(frame.camera, frame.safeArea, size), world);
}

async function canvasSize(page: Page): Promise<Size> {
  const box = await page.locator('#preview canvas').boundingBox();
  if (!box) throw new Error('Canvas is not visible');
  return { width: box.width, height: box.height };
}

test.describe('studio', () => {
  let problems: string[];

  test.beforeEach(({ page }) => {
    problems = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' || /webgl context/i.test(message.text())) {
        problems.push(`console: ${message.text()}`);
      }
    });
    page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()}`));
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(`http ${response.status()}: ${response.url()}`);
    });
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('renders the demo with the scene colors', async ({ page }) => {
    await openStudio(page, '?t=0');
    const size = await canvasSize(page);
    expect(size.width).toBeGreaterThan(100);
    const png = await canvasShot(page);

    const empty = canvasPoint({ x: -125, y: -125 }, 0, size);
    expectColor(await pixelAt(page, png, empty.x, empty.y), hexToRgb(scene.background));

    const square = canvasPoint({ x: -280, y: 200 }, 0, size);
    expectColor(await pixelAt(page, png, square.x, square.y), hexToRgb('#f0653a'));
  });

  test('play advances time and pause holds it', async ({ page }) => {
    await openStudio(page);
    const play = page.locator('#play');
    await expect(play).toHaveText('Play');
    expect(await currentTime(page)).toBe(0);

    await play.click();
    await expect(play).toHaveText('Pause');
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.2);

    await play.click();
    await expect(play).toHaveText('Play');
    const pausedAt = await currentTime(page);
    await page.waitForTimeout(300);
    expect(await currentTime(page)).toBe(pausedAt);
  });

  test('playback keeps pace with real time and never steps backwards', async ({ page }) => {
    await openStudio(page);
    const result = await page.evaluate(async () => {
      const preview = document.querySelector<HTMLElement>('#preview');
      const play = document.querySelector<HTMLButtonElement>('#play');
      if (!preview || !play) throw new Error('Studio is missing');
      const read = () => Number(preview.dataset['time']);
      const samples: { wall: number; time: number }[] = [];
      play.click();
      await new Promise<void>((resolve) => {
        const tick = () => {
          samples.push({ wall: performance.now(), time: read() });
          if (read() < 2) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      play.click();
      return samples;
    });

    const first = result[0];
    const last = result.at(-1);
    if (!first || !last) throw new Error('No samples');
    const wallSeconds = (last.wall - first.wall) / 1000;
    console.log(`playback: ${result.length} frames in ${wallSeconds.toFixed(2)}s`);
    expect(Math.abs(last.time - first.time - wallSeconds)).toBeLessThan(0.1);
    result.slice(1).forEach((sample, i) => {
      expect(sample.time).toBeGreaterThanOrEqual(result[i]?.time ?? 0);
    });
  });

  test('the grid still fills the frame at the widest camera setting', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.landscape);
    await openStudio(page, '?t=6');
    await page.locator('#camera-zoom').fill('0.5');
    await page.locator('#camera-x').fill('400');
    const size = await canvasSize(page);
    const frame = evaluateScene(scene, 6, { zoomFactor: 0.5, cameraOffset: { x: 400, y: 0 } });
    const view = viewTransform(frame.camera, frame.safeArea, size);
    const grid = frame.nodes.filter((node) => node.id.startsWith('grid-'));
    const reach = grid.map((node) => nodeBounds(node, view)).filter((bounds) => bounds !== null);
    expect(Math.min(...reach.map((b) => b.minX))).toBeLessThanOrEqual(0);
    expect(Math.max(...reach.map((b) => b.maxX))).toBeGreaterThanOrEqual(size.width);
  });

  test('seek moves the picture to the requested time', async ({ page }) => {
    await openStudio(page);
    const before = await canvasShot(page);
    await seekTo(page, 2.5);
    await expect(page.locator('#timecode')).toHaveText('00:00:02:15');
    await expect(page.locator('#frame-counter')).toHaveText('frame 75 / 240');
    expect((await canvasShot(page)).equals(before)).toBe(false);
  });

  test('restart returns to the first frame', async ({ page }) => {
    await openStudio(page);
    const first = await canvasShot(page);
    await seekTo(page, 5);
    await page.locator('#restart').click();
    await expect.poll(() => currentTime(page)).toBe(0);
    expect((await canvasShot(page)).equals(first)).toBe(true);
  });

  test('playback stops at the end and can play again', async ({ page }) => {
    await openStudio(page, '?t=7.8');
    const play = page.locator('#play');
    await play.click();
    await expect(play).toHaveText('Play', { timeout: 5000 });
    expect(await currentTime(page)).toBeCloseTo(239 / 30);
    await play.click();
    await expect(play).toHaveText('Pause');
    expect(await currentTime(page)).toBeLessThan(1);
    await play.click();
  });

  test('a frame is identical however it was reached', async ({ page }) => {
    await openStudio(page, '?t=2.5');
    const direct = await canvasShot(page);

    await openStudio(page);
    await page.locator('#play').click();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.3);
    await page.locator('#play').click();
    await seekTo(page, 6);
    await seekTo(page, 2.5);
    expect((await canvasShot(page)).equals(direct)).toBe(true);
  });

  test('layer order changes what is drawn on top and can be reset', async ({ page }) => {
    // At t=2 the square has moved under the circle, so both cover this point.
    await openStudio(page, '?t=2');
    const point = canvasPoint({ x: 0, y: 200 }, 2, await canvasSize(page));
    const blue = hexToRgb('#3f8cff');
    const orange = hexToRgb('#f0653a');
    expectColor(await pixelAt(page, await canvasShot(page), point.x, point.y), blue);

    await page.locator('[data-layer="circle"] [data-move="down"]').click();
    await expect(page.locator('#layers li span').nth(2)).toHaveText('square');
    expectColor(await pixelAt(page, await canvasShot(page), point.x, point.y), orange);

    await page.locator('#layers-reset').click();
    expectColor(await pixelAt(page, await canvasShot(page), point.x, point.y), blue);
  });

  test('camera controls change the view and reset restores it', async ({ page }) => {
    await openStudio(page, '?t=1');
    const baseline = await canvasShot(page);

    for (const [id, value] of [
      ['camera-x', '100'],
      ['camera-y', '-100'],
      ['camera-zoom', '1.5'],
    ] as const) {
      await page.locator(`#${id}`).fill(value);
      expect((await canvasShot(page)).equals(baseline), id).toBe(false);
      await page.locator('#camera-reset').click();
      expect((await canvasShot(page)).equals(baseline), `${id} reset`).toBe(true);
    }
  });

  test('camera pan moves the world the expected way', async ({ page }) => {
    await openStudio(page, '?t=0');
    const size = await canvasSize(page);
    const square = canvasPoint({ x: -280, y: 200 }, 0, size);
    await page.locator('#camera-x').fill('300');
    // Panning right moves the world left, so the square's old spot is now empty or grid.
    const shot = await canvasShot(page);
    const moved = canvasPoint({ x: -580, y: 200 }, 0, size);
    expectColor(await pixelAt(page, shot, moved.x, moved.y), hexToRgb('#f0653a'));
    const old = await pixelAt(page, shot, square.x, square.y);
    expect(old.r).toBeLessThan(0xf0 - 40);
  });

  test('the renderer survives repeated destroy and recreate', async ({ page }) => {
    await openStudio(page, '?debug=1&t=1');
    const baseline = await canvasShot(page);
    await page.evaluate(async () => {
      const debug = window.__studioDebug;
      if (!debug) throw new Error('debug hook missing');
      for (let i = 0; i < 24; i++) await debug.remountRenderer();
    });
    await expect(page.locator('#preview canvas')).toHaveCount(1);
    expect((await canvasShot(page)).equals(baseline)).toBe(true);
  });

  test('the debug hook is absent by default', async ({ page }) => {
    await openStudio(page);
    expect(await page.evaluate(() => window.__studioDebug === undefined)).toBe(true);
  });

  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    for (const aspect of Object.keys(ASPECT_RATIOS) as AspectRatioName[]) {
      test(`${viewportName} layout holds a ${aspect} preview`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openStudio(page, `?t=2&aspect=${aspect}`);
        await expect(page.locator(`[data-aspect="${aspect}"]`)).toHaveAttribute(
          'aria-pressed',
          'true',
        );

        const size = await canvasSize(page);
        expect(size.width / size.height).toBeCloseTo(ASPECT_RATIOS[aspect], 1);
        expect(size.width).toBeGreaterThan(120);
        expect(size.height).toBeGreaterThan(120);

        const overflow = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }));
        expect(overflow).toEqual({ x: 0, y: 0 });

        for (const selector of [
          '#preview canvas',
          '#play',
          '#restart',
          '#step-back',
          '#step-forward',
          '#loop',
          '#speed',
          '#seek',
          '#timecode',
          '#frame-counter',
        ]) {
          const box = await page.locator(selector).boundingBox();
          expect(box, selector).not.toBeNull();
          if (!box) continue;
          expect(box.x, selector).toBeGreaterThanOrEqual(0);
          expect(box.y, selector).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, selector).toBeLessThanOrEqual(viewport.width + 0.5);
          expect(box.y + box.height, selector).toBeLessThanOrEqual(viewport.height + 0.5);
        }
      });
    }
  }

  test('every panel control can be scrolled into reach on a phone', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.portrait);
    await openStudio(page);
    const last = page.locator('#layers-reset');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport({ ratio: 1 });
    await last.click();
  });

  test('switching aspect ratio resizes the live preview', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.landscape);
    await openStudio(page);
    await page.locator('[data-aspect="9:16"]').click();
    const portrait = await canvasSize(page);
    expect(portrait.width / portrait.height).toBeCloseTo(9 / 16, 1);
    await page.locator('[data-aspect="1:1"]').click();
    const square = await canvasSize(page);
    expect(square.width / square.height).toBeCloseTo(1, 1);
  });

  test('resizing the window refits the preview', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.landscape);
    await openStudio(page);
    const large = await canvasSize(page);
    await page.setViewportSize({ width: 1000, height: 560 });
    await expect.poll(async () => (await canvasSize(page)).width).toBeLessThan(large.width);
  });
});
