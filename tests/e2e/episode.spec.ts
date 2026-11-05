import { expect, test } from '@playwright/test';
import { EPISODE, priceLabel, subtitleCues } from '../../src/episodes/hollow-bell-crypt/episode';
import { SUBTITLE } from '../../src/episodes/hollow-bell-crypt/overlay';
import { trackProblems } from './helpers';

test.describe('The Hollow Bell Crypt', () => {
  let problems: string[];

  test.beforeEach(({ page }) => {
    problems = trackProblems(page);
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('opens in the studio at 9:16 and 24 fps', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?view=hollow-bell-crypt');
    await expect(page.locator('#preview')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#preview')).toHaveAttribute('data-fps', '24');
    await expect(page.locator('#seek')).toHaveAttribute('max', '1439');
  });

  test('every subtitle line fits the safe width in the real typeface', async ({ page }) => {
    await page.goto('/?render=hollow-bell-crypt');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const lines = subtitleCues().flatMap((cue) => [
      ...cue.th.map((text) => ({ text, size: SUBTITLE.thaiSize, weight: 600 })),
      ...cue.en.map((text) => ({ text, size: SUBTITLE.englishSize, weight: 400 })),
    ]);
    const labels = EPISODE.items.map((item) => ({ text: priceLabel(item), size: 36, weight: 700 }));
    const widths = await page.evaluate(
      (entries) => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('No 2D context');
        return entries.map((entry) => {
          context.font = `${entry.weight} ${entry.size}px "Noto Sans Thai"`;
          return { text: entry.text, width: context.measureText(entry.text).width };
        });
      },
      [...lines, ...labels],
    );
    for (const { text, width } of widths.slice(0, lines.length)) {
      expect(width, text).toBeLessThanOrEqual(SUBTITLE.maxWidth);
    }
    // Price tags are sized from their text, so they never clip it.
    for (const { text, width } of widths.slice(lines.length)) {
      expect(width, text).toBeLessThan(text.length * 21 + 70 - 40);
    }
    // The Thai typeface really loaded: Thai text is not drawn with a fallback.
    const loaded = await page.evaluate(() =>
      document.fonts.check('600 56px "Noto Sans Thai"', 'ฮาร์โมนี'),
    );
    expect(loaded).toBe(true);
  });

  test('renders the same frame identically twice', async ({ page }) => {
    await page.setViewportSize({ width: 540, height: 960 });
    await page.goto('/?render=hollow-bell-crypt');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const shot = async (frame: number) => {
      await page.evaluate((n) => window.__episode?.render(n), frame);
      return page.locator('canvas').screenshot();
    };
    const first = await shot(700);
    await shot(66);
    expect((await shot(700)).equals(first)).toBe(true);
  });
});
