/* global console, process, Buffer, setTimeout */
// Generates DON'T LOOK BACK's two voices with Gemini TTS, and measures them for the subtitles.
//
//   GEMINI_API_KEY=... npm run voices:ta            every line that does not exist yet
//   GEMINI_API_KEY=... npm run voices:ta -- --force --only=S08
//   npm run voices:ta -- --dry-run                  print the requests only
//
// Two voices, from episode.json: the narrator, and the presence behind Ta, which speaks one line.
// Each line is trimmed of silence, converted to 48 kHz, and fitted to its window (sped up by at
// most 12%). Lines that run far past their text are requested again. The measured start and length
// of every line are written to projects/ta-dont-look-back/timing.json, so the subtitles follow the
// speech. Run npm run build:ta afterwards to regenerate the SRT and VTT files.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { finishLine, MAX_SPEED_UP, seconds } from './narration-audio.mjs';

const EPISODE = 'projects/ta-dont-look-back/episode.json';
const TIMING = 'projects/ta-dont-look-back/timing.json';
const OUT = 'artifacts/ta-dont-look-back/voice';
const MODEL = process.env.GEMINI_TTS_MODEL ?? 'gemini-3.8-flash-tts';

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const key = process.env.GEMINI_API_KEY;
if (!dryRun && !key) {
  console.error('GEMINI_API_KEY is not set.');
  process.exit(1);
}

const episode = JSON.parse(readFileSync(EPISODE, 'utf8'));

/**
 * How each voice is directed, in the short "Say ...:" form. Longer role-play directions ("You are
 * the narrator of a film") made the model invent and speak its own English sentence instead of
 * reading the line, so the direction stays one sentence and the line is quoted.
 */
const DIRECTION = {
  narrator:
    'Say in Thai, in a low, calm, restrained and close voice, pausing briefly at each "...":',
  presence:
    'Say in Thai, in a calm, flat, quiet and completely ordinary voice, very close, with no emotion:',
};

const lines = episode.shots.flatMap((shot) => {
  const line = shot.narration ?? shot.dialogue;
  return line ? [{ shot: shot.shotId, ...line, window: line.end - line.start }] : [];
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function speak(line) {
  const body = {
    contents: [{ parts: [{ text: `${DIRECTION[line.voice]} "${line.text}"` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: episode.voices[line.voice].gemini } },
      },
    },
  };
  for (let attempt = 1; ; attempt++) {
    const result = spawnSync(
      'curl',
      [
        '-sS',
        '-w',
        '\n%{http_code}',
        '-X',
        'POST',
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        '-H',
        'Content-Type: application/json',
        '-H',
        `x-goog-api-key: ${key}`,
        '--data-binary',
        '@-',
      ],
      { input: JSON.stringify(body), encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
    );
    const cut = result.stdout.lastIndexOf('\n');
    const status = Number(result.stdout.slice(cut + 1));
    const text = result.stdout.slice(0, cut);
    if (status === 200) {
      const part = JSON.parse(text).candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) throw new Error(`${line.shot}: no audio in the response`);
      return part.inlineData;
    }
    if ((status === 429 || status >= 500) && attempt < 6) {
      console.log(`  busy (${status}), retrying in ${20 * attempt} s`);
      await sleep(20_000 * attempt);
      continue;
    }
    throw new Error(`${line.shot}: HTTP ${status}: ${text.slice(0, 400)}`);
  }
}

mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const line of lines) {
  if (only && !only.includes(line.shot)) continue;
  if (dryRun) {
    console.log(
      `${line.shot} [${line.voice} / ${episode.voices[line.voice].gemini}]: ${line.text}`,
    );
    continue;
  }
  const file = join(OUT, `${line.shot}.wav`);
  if (existsSync(file) && !force) {
    console.log(`${file}: kept`);
    continue;
  }
  let length = Infinity;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const audio = await speak(line);
    const raw = join(OUT, `${line.shot}.raw`);
    writeFileSync(raw, Buffer.from(audio.data, 'base64'));
    const format = (audio.mimeType ?? '').includes('wav')
      ? 'wav'
      : Number(/rate=(\d+)/.exec(audio.mimeType ?? '')?.[1] ?? 24000);
    length = finishLine(raw, format, file, line.window);
    rmSync(raw);
    if (length <= line.window * 1.5) break;
    console.log(`  ${line.shot}: ${length.toFixed(1)} s is far too long, asking again`);
    await sleep(7000);
  }
  if (length > line.window) failed++;
  console.log(
    `${file}: ${length.toFixed(2)} s of ${line.window.toFixed(2)} s${length > line.window ? '  TOO LONG' : ''}`,
  );
  await sleep(7000);
}

if (!dryRun) {
  // Record where the speech really is: it starts at the line's cue, and lasts as long as measured.
  const measured = lines
    .filter((line) => existsSync(join(OUT, `${line.shot}.wav`)))
    .map((line) => ({
      shotId: line.shot,
      voice: line.voice,
      start: line.start,
      duration: Math.round(seconds(join(OUT, `${line.shot}.wav`)) * 1000) / 1000,
    }));
  if (measured.length === lines.length) {
    writeFileSync(TIMING, `${JSON.stringify({ source: 'measured', lines: measured }, null, 2)}\n`);
    console.log(`Wrote ${TIMING} from the audio. Now run npm run build:ta.`);
  }
}
if (failed > 0) {
  console.error(`${failed} line(s) do not fit even at ${MAX_SPEED_UP}x.`);
  process.exit(2);
}
