/* global console, process, window */
// Renders an episode frame by frame and encodes it.
//
//   npm run render:episode                    every frame, to an H.264 MP4 (and muxes audio if present)
//   npm run render:episode -- --episode=ta-dont-look-back   another episode (default hollow-bell-crypt)
//   npm run render:episode -- --stills=0,96   only these frames, as PNG files
//
// Frames are drawn by the same renderer as the browser preview, one exact frame index at a time,
// so the video does not depend on how fast this machine is. Output goes to artifacts/episode/ for
// the first episode and artifacts/<episode>/ for the others, all git-ignored.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

const EPISODE = args.episode ?? 'hollow-bell-crypt';
/** The first episode keeps its original folder; others get their own. */
const OUT = EPISODE === 'hollow-bell-crypt' ? 'artifacts/episode' : `artifacts/${EPISODE}`;
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 24;
const PORT = 4175;

mkdirSync(OUT, { recursive: true });
await build({ logLevel: 'warn' });
const server = await preview({ preview: { port: PORT, strictPort: true, host: '127.0.0.1' } });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
const problems = [];
page.on('pageerror', (error) => problems.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text());
});
await page.goto(`http://127.0.0.1:${PORT}/?render=${EPISODE}`);
await page.waitForSelector('#app[data-ready="true"]', { timeout: 60_000 });
const frames = await page.evaluate(() => window.__episode?.frames ?? 0);
const canvas = page.locator('canvas');

async function shoot(frame) {
  await page.evaluate((n) => window.__episode?.render(n), frame);
  return canvas.screenshot({ type: 'png' });
}

try {
  if (args.stills) {
    const list = args.stills === 'true' ? [] : args.stills.split(',').map(Number);
    mkdirSync(join(OUT, 'stills'), { recursive: true });
    for (const frame of list) {
      const file = join(OUT, 'stills', `frame-${String(frame).padStart(4, '0')}.png`);
      writeFileSync(file, await shoot(frame));
      console.log(`Wrote ${file}`);
    }
  } else {
    const silent = join(OUT, 'video-only.mp4');
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        String(FPS),
        '-c:v',
        'png',
        '-i',
        '-',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(FPS),
        '-movflags',
        '+faststart',
        silent,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const done = new Promise((resolve, reject) => {
      ffmpeg.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
      );
    });
    const started = Date.now();
    for (let frame = 0; frame < frames; frame++) {
      const png = await shoot(frame);
      if (!ffmpeg.stdin.write(png))
        await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
      if (frame % 120 === 0)
        console.log(`frame ${frame}/${frames} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    }
    ffmpeg.stdin.end();
    await done;
    console.log(`Wrote ${silent}`);

    const audio = join(OUT, 'audio.wav');
    const final = join(OUT, `${EPISODE}.mp4`);
    if (existsSync(audio)) {
      const mux = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-loglevel',
          'error',
          '-i',
          silent,
          '-i',
          audio,
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-t',
          '60',
          '-movflags',
          '+faststart',
          final,
        ],
        { stdio: 'inherit' },
      );
      if (mux.status !== 0) throw new Error('Muxing audio failed');
      console.log(`Wrote ${final}`);
    } else {
      console.log(`No ${audio}: run npm run audio:episode first for a video with sound.`);
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
