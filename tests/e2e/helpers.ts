import { expect, type Page } from '@playwright/test';

export const VIEWPORTS = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 390, height: 844 },
} as const;

export async function openStudio(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('#preview')).toHaveAttribute('data-ready', 'true');
}

export function currentTime(page: Page): Promise<number> {
  return page
    .locator('#preview')
    .getAttribute('data-time')
    .then((value) => Number(value));
}

export function canvasShot(page: Page): Promise<Buffer> {
  return page.locator('#preview canvas').screenshot();
}

/** Seeks through the real slider, then waits until that exact time has been drawn. */
export async function seekTo(page: Page, time: number): Promise<void> {
  const fps = Number(await page.locator('#preview').getAttribute('data-fps'));
  await page.locator('#seek').fill(String(Math.round(time * fps)));
  await expect.poll(() => currentTime(page)).toBeCloseTo(time, 2);
}

export function currentFrame(page: Page): Promise<number> {
  return page
    .locator('#preview')
    .getAttribute('data-frame')
    .then((value) => Number(value));
}

/** Collects anything that should never happen during a test. */
export function trackProblems(page: Page): string[] {
  const problems: string[] = [];
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
  return problems;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Reads one pixel out of a PNG by decoding it in the page. */
export function pixelAt(page: Page, png: Buffer, x: number, y: number): Promise<Rgb> {
  return page.evaluate(
    async ({ data, x, y }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No 2D context');
      context.drawImage(image, 0, 0);
      const [r = 0, g = 0, b = 0] = context.getImageData(x, y, 1, 1).data;
      return { r, g, b };
    },
    { data: png.toString('base64'), x: Math.round(x), y: Math.round(y) },
  );
}

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}

export function expectColor(actual: Rgb, expected: Rgb, tolerance = 4): void {
  const close = (a: number, b: number) => Math.abs(a - b) <= tolerance;
  expect(
    close(actual.r, expected.r) && close(actual.g, expected.g) && close(actual.b, expected.b),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  ).toBe(true);
}
