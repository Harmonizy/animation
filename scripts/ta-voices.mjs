/* global console, process, Buffer, setTimeout */
// Generates DON'T LOOK BACK's two voices with ElevenLabs (eleven_v3), and measures them for the
// subtitles.
//
//   npm run voices:ta                               every line that does not exist yet
//   npm run voices:ta -- --force --only=S08
//   npm run voices:ta -- --dry-run                  print the requests only
//
// The key: in a cloud session, the network proxy adds it to requests to api.elevenlabs.io. On your
// own machine, set ELEVENLABS_API_KEY. Never commit it.
//
// Two voices, from episode.json: the narrator, and the presence behind Ta. A line with a
// `performance` is generated in parts (so a single word, such as Ta's name, can be given its own
// weight) and joined with silence. Each line is trimmed, converted to 48 kHz and fitted to its
// window (sped up by at most 12%). The measured start and length of every line go to
// projects/ta-dont-look-back/timing.json, so the subtitles follow the speech. Run npm run build:ta
// afterwards to regenerate the SRT and VTT files.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { finishLine, MAX_SPEED_UP, seconds } from './narration-audio.mjs';

const EPISODE = 'projects/ta-dont-look-back/episode.json';
const TIMING = 'projects/ta-dont-look-back/timing.json';
const OUT = 'artifacts/ta-dont-look-back/voice';
const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_v3';
const RATE = 24000;

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
// In a cloud session the proxy replaces this header with the saved key.
const key = process.env.ELEVENLABS_API_KEY ?? 'proxy-injected';

const episode = JSON.parse(readFileSync(EPISODE, 'utf8'));

const lines = episode.shots.flatMap((shot) => {
  const line = shot.narration ?? shot.dialogue;
  return line ? [{ shot: shot.shotId, ...line, window: line.end - line.start }] : [];
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}

/** One request: returns raw 16-bit mono PCM at RATE. */
async function speak(text, voice) {
  const body = {
    text,
    model_id: MODEL,
    language_code: 'th',
    voice_settings: { stability: voice.stability },
  };
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=pcm_${RATE}`;
  for (let attempt = 1; ; attempt++) {
    const result = spawnSync(
      'curl',
      [
        '-sS',
        '-w',
        '\n%{http_code}',
        '-X',
        'POST',
        url,
        '-H',
        'Content-Type: application/json',
        '-H',
        `xi-api-key: ${key}`,
        '--data-binary',
        '@-',
      ],
      { input: Buffer.from(JSON.stringify(body)), maxBuffer: 128 * 1024 * 1024 },
    );
    const out = result.stdout;
    const cut = out.lastIndexOf(0x0a);
    const status = Number(out.subarray(cut + 1).toString());
    const data = out.subarray(0, cut);
    if (status === 200) return Buffer.from(data);
    if ((status === 429 || status >= 500) && attempt < 6) {
      console.log(`  busy (${status}), retrying in ${10 * attempt} s`);
      await sleep(10_000 * attempt);
      continue;
    }
    throw new Error(`HTTP ${status}: ${data.toString().slice(0, 400)}`);
  }
}

/** Generates a line, part by part, into one 48 kHz WAV (not yet fitted). */
async function perform(line, file) {
  const voice = episode.voices[line.voice].elevenlabs;
  const parts = line.performance ?? [{ text: line.text }];
  const inputs = [];
  const chain = [];
  for (const [i, part] of parts.entries()) {
    const raw = `${file}.${i}.raw`;
    const wav = `${file}.${i}.wav`;
    writeFileSync(raw, await speak(part.text, voice));
    finishLine(raw, RATE, wav, Infinity);
    rmSync(raw);
    inputs.push('-i', wav);
    const label = `p${i}`;
    let filter = `[${i}:a]volume=${part.gain ?? 1}`;
    if (part.pause) filter += `,apad=pad_dur=${part.pause}`;
    chain.push(`${filter}[${label}]`);
  }
  const join_ = parts.map((_, i) => `[p${i}]`).join('');
  ffmpeg([
    ...inputs,
    '-filter_complex',
    `${chain.join(';')};${join_}concat=n=${parts.length}:v=0:a=1[out]`,
    '-map',
    '[out]',
    '-ar',
    '48000',
    '-ac',
    '1',
    file,
  ]);
  parts.forEach((_, i) => rmSync(`${file}.${i}.wav`));
}

mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const line of lines) {
  if (only && !only.includes(line.shot)) continue;
  const voice = episode.voices[line.voice].elevenlabs;
  if (dryRun) {
    const parts = (line.performance ?? [{ text: line.text }]).map((p) => p.text).join(' | ');
    console.log(`${line.shot} [${line.voice} / ${voice.name}]: ${parts}`);
    continue;
  }
  const file = join(OUT, `${line.shot}.wav`);
  if (existsSync(file) && !force) {
    console.log(`${file}: kept`);
    continue;
  }
  let length = Infinity;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const joined = `${file}.joined.wav`;
    await perform(line, joined);
    length = finishLine(joined, 'wav', file, line.window);
    rmSync(joined);
    if (length <= line.window * 1.5) break;
    console.log(`  ${line.shot}: ${length.toFixed(1)} s is far too long, asking again`);
  }
  if (length > line.window) failed++;
  console.log(
    `${file}: ${length.toFixed(2)} s of ${line.window.toFixed(2)} s${length > line.window ? '  TOO LONG' : ''}`,
  );
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
