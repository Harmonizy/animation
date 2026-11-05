import { expect, test, type Page } from '@playwright/test';
import {
  VIEWPORTS,
  canvasShot,
  currentFrame,
  currentTime,
  openStudio,
  seekTo,
  trackProblems,
} from './helpers';

const GROUPS = ['character', 'camera', 'background', 'secondary'] as const;

async function setAllExposures(page: Page, value: string) {
  for (const group of GROUPS) await page.locator(`#exposure-${group}`).selectOption(value);
}

test.describe('timeline', () => {
  let problems: string[];

  test.beforeEach(({ page }) => {
    problems = trackProblems(page);
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('frame counter and timecode follow stepping', async ({ page }) => {
    await openStudio(page);
    await expect(page.locator('#frame-counter')).toHaveText('frame 0 / 240');
    await expect(page.locator('#timecode')).toHaveText('00:00:00:00');

    await page.locator('#step-forward').click();
    await page.locator('#step-forward').click();
    await expect(page.locator('#frame-counter')).toHaveText('frame 2 / 240');
    await expect(page.locator('#timecode')).toHaveText('00:00:00:02');

    await page.locator('#step-back').click();
    await expect(page.locator('#frame-counter')).toHaveText('frame 1 / 240');
  });

  test('stepping stops at both ends without loop', async ({ page }) => {
    await openStudio(page, '?frame=239');
    await page.locator('#step-forward').click();
    expect(await currentFrame(page)).toBe(239);
    await seekTo(page, 0);
    await page.locator('#step-back').click();
    expect(await currentFrame(page)).toBe(0);
  });

  test('a stepped frame is identical to opening that frame directly', async ({ page }) => {
    await openStudio(page, '?frame=7');
    const direct = await canvasShot(page);

    await openStudio(page);
    for (let i = 0; i < 7; i++) await page.locator('#step-forward').click();
    expect(await currentFrame(page)).toBe(7);
    expect((await canvasShot(page)).equals(direct)).toBe(true);
  });

  test('a frame reached after playing is identical to opening it directly', async ({ page }) => {
    await openStudio(page, '?frame=75');
    const direct = await canvasShot(page);

    await openStudio(page);
    await page.locator('#play').click();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.3);
    await page.locator('#step-forward').click();
    await seekTo(page, 2.5);
    expect((await canvasShot(page)).equals(direct)).toBe(true);
  });

  test('loop keeps playing past the end, and off stops at the end', async ({ page }) => {
    await openStudio(page, '?t=7.8');
    await page.locator('#loop').click();
    await expect(page.locator('#loop')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#play').click();
    await expect.poll(() => currentFrame(page), { timeout: 5000 }).toBeLessThan(60);
    await expect(page.locator('#play')).toHaveText('Pause');

    await page.locator('#loop').click();
    // Still playing, so the playhead moves straight on from here to the end.
    await page.locator('#seek').fill('234');
    await expect(page.locator('#play')).toHaveText('Play', { timeout: 5000 });
    expect(await currentFrame(page)).toBe(239);
  });

  test('playback speed changes the rate, not the frames', async ({ page }) => {
    await openStudio(page, '?frame=60');
    const direct = await canvasShot(page);
    await seekTo(page, 0);

    await page.locator('#speed').selectOption('2');
    const rate = await page.evaluate(async () => {
      const preview = document.querySelector<HTMLElement>('#preview');
      const play = document.querySelector<HTMLButtonElement>('#play');
      if (!preview || !play) throw new Error('Studio is missing');
      play.click();
      const start = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const elapsed = (performance.now() - start) / 1000;
      const playhead = Number(preview.dataset['playhead']);
      play.click();
      return playhead / elapsed;
    });
    expect(rate).toBeGreaterThan(1.8);
    expect(rate).toBeLessThan(2.2);

    await seekTo(page, 2);
    expect((await canvasShot(page)).equals(direct)).toBe(true);
  });

  for (const [name, intervalMs] of [
    ['fast', 4],
    ['slow', 33],
  ] as const) {
    test(`a ${name} display keeps the same speed and draws no extra frames`, async ({ page }) => {
      await page.addInitScript((ms) => {
        window.requestAnimationFrame = (callback) =>
          window.setTimeout(() => callback(performance.now()), ms);
        window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
      }, intervalMs);
      await openStudio(page);

      const result = await page.evaluate(async () => {
        const preview = document.querySelector<HTMLElement>('#preview');
        const play = document.querySelector<HTMLButtonElement>('#play');
        if (!preview || !play) throw new Error('Studio is missing');
        // Reads the playhead and the wall clock together, the moment the playhead changes.
        const nextSample = () =>
          new Promise<{ wall: number; playhead: number }>((resolve) => {
            const observer = new MutationObserver(() => {
              observer.disconnect();
              resolve({ wall: performance.now(), playhead: Number(preview.dataset['playhead']) });
            });
            observer.observe(preview, { attributes: true, attributeFilter: ['data-playhead'] });
          });
        const renders = () => Number(preview.dataset['renders']);
        const startRenders = renders();
        play.click();
        const first = await nextSample();
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const last = await nextSample();
        const frame = Number(preview.dataset['frame']);
        const drawn = renders() - startRenders;
        play.click();
        return {
          elapsed: (last.wall - first.wall) / 1000,
          moved: last.playhead - first.playhead,
          frame,
          drawn,
        };
      });

      expect(Math.abs(result.moved - result.elapsed)).toBeLessThan(0.05);
      // One draw for each project frame at most, however often the display updates.
      expect(result.drawn).toBeLessThanOrEqual(result.frame + 2);
    });
  }

  test('playing after a long idle starts where it was, with no jump', async ({ page }) => {
    await openStudio(page, '?frame=30');
    // Long enough for GSAP's ticker to go to sleep.
    await page.waitForTimeout(6000);

    const firstMove = await page.evaluate(async () => {
      const preview = document.querySelector<HTMLElement>('#preview');
      const play = document.querySelector<HTMLButtonElement>('#play');
      if (!preview || !play) throw new Error('Studio is missing');
      play.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const playhead = Number(preview.dataset['playhead']);
      play.click();
      return playhead;
    });
    expect(firstMove).toBeGreaterThanOrEqual(1);
    expect(firstMove).toBeLessThan(1.5);
  });

  test('resuming after a long pause continues from the same place', async ({ page }) => {
    await openStudio(page);
    await page.locator('#play').click();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.3);
    await page.locator('#play').click();
    const pausedAt = await currentTime(page);
    await page.waitForTimeout(6000);
    expect(await currentTime(page)).toBe(pausedAt);

    const resumed = await page.evaluate(async () => {
      const preview = document.querySelector<HTMLElement>('#preview');
      const play = document.querySelector<HTMLButtonElement>('#play');
      if (!preview || !play) throw new Error('Studio is missing');
      play.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const playhead = Number(preview.dataset['playhead']);
      play.click();
      return playhead;
    });
    expect(resumed).toBeLessThan(pausedAt + 0.6);
  });

  test('project frame rate changes the frame count, not the duration', async ({ page }) => {
    await openStudio(page, '?t=2');
    await expect(page.locator('#frame-counter')).toHaveText('frame 60 / 240');

    await page.locator('#project-fps').selectOption('12');
    await expect(page.locator('#frame-counter')).toHaveText('frame 24 / 96');
    await expect(page.locator('#timecode')).toHaveText('00:00:02:00');

    await page.locator('#project-fps').selectOption('60');
    await expect(page.locator('#frame-counter')).toHaveText('frame 120 / 480');
    await expect(page.locator('#timecode')).toHaveText('00:00:02:00');
  });

  test('stepping at 12 fps moves to a new picture', async ({ page }) => {
    await openStudio(page);
    await page.locator('#project-fps').selectOption('12');
    const first = await canvasShot(page);
    await page.locator('#step-forward').click();
    expect((await canvasShot(page)).equals(first)).toBe(false);
  });

  test('exposure holds the picture for the chosen number of frames', async ({ page }) => {
    await openStudio(page);
    await setAllExposures(page, '2');
    const pose0 = await canvasShot(page);
    await page.locator('#step-forward').click();
    await expect(page.locator('#pose-character')).toHaveText('pose 0');
    expect((await canvasShot(page)).equals(pose0)).toBe(true);

    await page.locator('#step-forward').click();
    await expect(page.locator('#pose-character')).toHaveText('pose 1');
    expect((await canvasShot(page)).equals(pose0)).toBe(false);
  });

  test('custom hold frames work, and invalid values are refused', async ({ page }) => {
    await openStudio(page);
    await setAllExposures(page, 'custom');
    for (const group of GROUPS) await page.locator(`#hold-${group}`).fill('5');
    const pose0 = await canvasShot(page);
    await seekTo(page, 4 / 30);
    expect((await canvasShot(page)).equals(pose0)).toBe(true);
    await page.locator('#step-forward').click();
    await expect(page.locator('#pose-secondary')).toHaveText('pose 1');
    expect((await canvasShot(page)).equals(pose0)).toBe(false);

    await page.locator('#hold-character').fill('0');
    await expect(page.locator('#hold-character')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#pose-character')).toHaveText('pose 1');
  });

  test('each group holds independently', async ({ page }) => {
    await openStudio(page, '?frame=7');
    await page.locator('#exposure-character').selectOption('3');
    await page.locator('#exposure-background').selectOption('4');
    await expect(page.locator('#pose-character')).toHaveText('pose 2');
    await expect(page.locator('#pose-background')).toHaveText('pose 1');
    await expect(page.locator('#pose-secondary')).toHaveText('pose 7');
  });

  test('export frame rate reports the output frame count and leaves the preview alone', async ({
    page,
  }) => {
    await openStudio(page, '?t=2');
    const before = await canvasShot(page);
    await expect(page.locator('#export-count')).toHaveText('240 frames');

    for (const [fps, count] of [
      ['12', '96'],
      ['24', '192'],
      ['25', '200'],
      ['60', '480'],
    ] as const) {
      await page.locator('#export-fps').selectOption(fps);
      await expect(page.locator('#export-count')).toHaveText(`${count} frames`);
    }
    expect((await canvasShot(page)).equals(before)).toBe(true);
  });

  test('reset timing restores the original picture', async ({ page }) => {
    await openStudio(page, '?frame=7');
    const original = await canvasShot(page);
    await page.locator('#project-fps').selectOption('12');
    await setAllExposures(page, '4');
    expect((await canvasShot(page)).equals(original)).toBe(false);

    await page.locator('#timing-reset').click();
    await expect(page.locator('#frame-counter')).toHaveText('frame 7 / 240');
    expect((await canvasShot(page)).equals(original)).toBe(true);
  });
});

test.describe('timing lab', () => {
  let problems: string[];

  const cell = (page: Page, lane: string, name: 'frame' | 'pose') =>
    page.locator(`[data-lane="${lane}"] [data-cell="${name}"]`);

  test.beforeEach(({ page }) => {
    problems = trackProblems(page);
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('is reachable from the studio and back', async ({ page }) => {
    await openStudio(page);
    await page.locator('#view-link').click();
    await expect(page.locator('h1')).toHaveText('Animation Timing Lab');
    await page.locator('#view-link').click();
    await expect(page.locator('h1')).toHaveText('Cinematic Animation Studio');
  });

  test('compares frame numbers across frame rates', async ({ page }) => {
    await openStudio(page, '?view=timing&tab=fps&t=1');
    await expect(cell(page, 'fps-12', 'frame')).toHaveText('12');
    await expect(cell(page, 'fps-24', 'frame')).toHaveText('24');
    await expect(cell(page, 'fps-30', 'frame')).toHaveText('30');
    await expect(cell(page, 'fps-60', 'frame')).toHaveText('60');
  });

  test('compares pose numbers across exposures, at a chosen frame rate', async ({ page }) => {
    await openStudio(page, '?view=timing&tab=exposure&t=1');
    await expect(cell(page, 'exposure-ones', 'pose')).toHaveText('24');
    await expect(cell(page, 'exposure-twos', 'pose')).toHaveText('12');
    await expect(cell(page, 'exposure-threes', 'pose')).toHaveText('8');

    await page.locator('#lab-fps').selectOption('60');
    await expect(cell(page, 'exposure-ones', 'pose')).toHaveText('60');
    await expect(cell(page, 'exposure-threes', 'pose')).toHaveText('20');
  });

  test('only shows the lane rate control on the exposure tab', async ({ page }) => {
    await openStudio(page, '?view=timing&tab=fps');
    await expect(page.locator('#lab-fps')).toBeHidden();
    await page.locator('[data-tab="exposure"]').click();
    await expect(page.locator('#lab-fps')).toBeVisible();
  });

  test('switching tabs replaces everything drawn', async ({ page }) => {
    await openStudio(page, '?view=timing&tab=fps&t=1');
    const fpsPicture = await canvasShot(page);
    await page.locator('[data-tab="timing"]').click();
    await expect(page.locator('[data-lane]')).toHaveCount(3);
    expect((await canvasShot(page)).equals(fpsPicture)).toBe(false);
    await page.locator('[data-tab="fps"]').click();
    expect((await canvasShot(page)).equals(fpsPicture)).toBe(true);
  });

  test('play, step, seek, loop and speed all drive the lanes', async ({ page }) => {
    await openStudio(page, '?view=timing&tab=fps');
    await page.locator('#step-forward').click();
    await expect(cell(page, 'fps-24', 'frame')).toHaveText('1');
    await expect(cell(page, 'fps-12', 'frame')).toHaveText('0');

    await page.locator('#lab-step-fps').selectOption('12');
    await page.locator('#step-forward').click();
    await expect(cell(page, 'fps-12', 'frame')).toHaveText('1');
    await expect(cell(page, 'fps-60', 'frame')).toHaveText('5');

    await expect(page.locator('#loop')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#speed').selectOption('2');
    await page.locator('#play').click();
    await expect(page.locator('#play')).toHaveText('Pause');
    await expect.poll(() => currentTime(page)).toBeGreaterThan(1);
    await page.locator('#play').click();
  });

  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    for (const tab of ['fps', 'exposure', 'spacing', 'timing']) {
      test(`${tab} tab fits a ${viewportName} window`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openStudio(page, `?view=timing&tab=${tab}&t=1`);

        const overflow = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }));
        expect(overflow).toEqual({ x: 0, y: 0 });

        const box = await page.locator('#preview canvas').boundingBox();
        expect(box?.width).toBeGreaterThan(200);
        expect(box?.height).toBeGreaterThan(80);

        // Every column must be readable without sideways scrolling.
        const hidden = await page
          .locator('.table-scroll')
          .evaluate((element) => element.scrollWidth - element.clientWidth);
        expect(hidden).toBeLessThanOrEqual(0);

        const playBox = await page.locator('#play').boundingBox();
        const speedBox = await page.locator('#speed').boundingBox();
        expect(speedBox?.y).toBeCloseTo(playBox?.y ?? 0, -1);

        const table = page.locator('#lane-table');
        await table.scrollIntoViewIfNeeded();
        await expect(table).toBeInViewport();
      });
    }
  }
});
