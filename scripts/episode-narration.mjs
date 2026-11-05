/* global console, process, Buffer */
// Generates the Thai narration with Google Cloud Text-to-Speech, one WAV per shot.
//
//   GOOGLE_TTS_API_KEY=... npm run narration:episode        writes artifacts/episode/narration/S01.wav ...
//   npm run narration:episode -- --dry-run                   prints the requests, sends nothing
//
// Optional: GOOGLE_TTS_VOICE (default th-TH-Neural2-C), GOOGLE_TTS_RATE (default 0.92).
// Then run npm run audio:episode and npm run render:episode to mix the voice into the video.
//
// The key is sent in a request header, never in the URL, and is never written anywhere.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = 'projects/harmonie/hollow-bell-crypt/narration.th.json';
const OUT = 'artifacts/episode/narration';
const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const dryRun = process.argv.includes('--dry-run');
const key = process.env.GOOGLE_TTS_API_KEY;
const voice = process.env.GOOGLE_TTS_VOICE ?? 'th-TH-Neural2-C';
const rate = Number(process.env.GOOGLE_TTS_RATE ?? '0.92');

if (!dryRun && !key) {
  console.error(
    'GOOGLE_TTS_API_KEY is not set. Add a Google Cloud API key with Text-to-Speech enabled to the environment, then run this again.',
  );
  process.exit(1);
}

/** The request for one line. Ellipses become short pauses, as the script directs. */
export function requestFor(text) {
  const ssml = `<speak>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\.\.\.\s*/g, '<break time="450ms"/>')}</speak>`;
  return {
    input: { ssml },
    voice: { languageCode: 'th-TH', name: voice },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 48000, speakingRate: rate },
  };
}

function wavSeconds(buffer) {
  // LINEAR16 responses are WAV files: read the byte rate and data size from the header.
  const byteRate = buffer.readUInt32LE(28);
  let offset = 12;
  while (offset < buffer.length - 8) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'data') return size / byteRate;
    offset += 8 + size;
  }
  return NaN;
}

const script = JSON.parse(readFileSync(SCRIPT, 'utf8'));
mkdirSync(OUT, { recursive: true });
let tooLong = 0;
for (const line of script.lines) {
  const body = JSON.stringify(requestFor(line.text));
  if (dryRun) {
    console.log(`${line.shot}: ${body}`);
    continue;
  }
  const result = spawnSync(
    'curl',
    [
      '-sS',
      '--fail-with-body',
      '-X',
      'POST',
      ENDPOINT,
      '-H',
      'Content-Type: application/json',
      '-H',
      `X-Goog-Api-Key: ${key}`,
      '--data-binary',
      '@-',
    ],
    { input: body, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    console.error(`${line.shot}: request failed\n${result.stdout || result.stderr}`);
    process.exit(1);
  }
  const audio = Buffer.from(JSON.parse(result.stdout).audioContent, 'base64');
  const file = join(OUT, `${line.shot}.wav`);
  writeFileSync(file, audio);
  const seconds = wavSeconds(audio);
  const fits = seconds <= line.maxDuration;
  if (!fits) tooLong++;
  console.log(
    `${file}: ${seconds.toFixed(2)} s of ${line.maxDuration} s${fits ? '' : '  TOO LONG'}`,
  );
}
if (tooLong > 0) {
  console.error(
    `${tooLong} line(s) are longer than their window. Raise GOOGLE_TTS_RATE, then run again.`,
  );
  process.exit(2);
}
