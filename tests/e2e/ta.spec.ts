import { expect, test } from '@playwright/test';
import { TA_EPISODE, taSubtitleCues } from '../../src/episodes/ta-dont-look-back/episode';
import { CHOICE, TA_SUBTITLE } from '../../src/episodes/ta-dont-look-back/overlay';
import { trackProblems } from './helpers';

test.describe("DON'T LOOK BACK", () => {
  let problems: string[];
  test.beforeEach(({ page }) => {
    problems = trackProblems(page);
  });
  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('opens in the studio at 24 fps with 1440 frames', async ({ page }) => {
    await page.goto('/?view=ta-dont-look-back');
    await expect(page.locator('#preview')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#preview')).toHaveAttribute('data-fps', '24');
    await expect(page.locator('#seek')).toHaveAttribute('max', '1439');
  });

  test('subtitles and choices fit in the real typefaces, Thai in Noto Sans Thai and English in Noto Sans', async ({
    page,
  }) => {
    await page.goto('/?render=ta-dont-look-back');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const entries = [
      ...taSubtitleCues().flatMap((cue) => [
        ...cue.th.map((text) => ({
          text,
          font: `600 ${TA_SUBTITLE.thaiSize}px "Noto Sans Thai"`,
          max: TA_SUBTITLE.maxWidth,
        })),
        ...cue.en.map((text) => ({
          text,
          font: `400 ${TA_SUBTITLE.englishSize}px "Noto Sans"`,
          max: TA_SUBTITLE.maxWidth,
        })),
      ]),
      ...TA_EPISODE.choices.flatMap((choice) => [
        { text: choice.th, font: '600 50px "Noto Sans Thai"', max: CHOICE.width - 40 },
        { text: choice.en, font: '400 30px "Noto Sans"', max: CHOICE.width - 40 },
      ]),
    ];
    const widths = await page.evaluate((list) => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('No 2D context');
      return list.map((entry) => {
        context.font = entry.font;
        return context.measureText(entry.text).width;
      });
    }, entries);
    entries.forEach((entry, i) =>
      expect(widths[i] ?? Infinity, entry.text).toBeLessThanOrEqual(entry.max),
    );
    expect(await page.evaluate(() => document.fonts.check('400 34px "Noto Sans"', 'Ta'))).toBe(
      true,
    );
    expect(
      await page.evaluate(() => document.fonts.check('600 56px "Noto Sans Thai"', 'ต้า')),
    ).toBe(true);
  });

  test('renders the same frame identically twice', async ({ page }) => {
    await page.setViewportSize({ width: 540, height: 960 });
    await page.goto('/?render=ta-dont-look-back');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const shot = async (frame: number) => {
      await page.evaluate((n) => window.__episode?.render(n), frame);
      return page.locator('canvas').screenshot();
    };
    const first = await shot(880);
    await shot(10);
    expect((await shot(880)).equals(first)).toBe(true);
  });
});
