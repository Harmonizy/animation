/* global console, process, Buffer, setTimeout */
// Generates the Thai narration, one WAV per shot, in artifacts/episode/narration/.
//
//   npm run narration:episode               uses Gemini when GEMINI_API_KEY is set,
//                                           otherwise Google Cloud TTS with GOOGLE_TTS_API_KEY
//   npm run narration:episode -- --dry-run  prints the requests, sends nothing
//   npm run narration:episode -- --force    remakes lines that already exist
//   npm run narration:episode -- --only=S04,S05 --force   remakes just those lines
//
// Gemini options: GEMINI_TTS_MODEL (default gemini-3.8-flash-tts),
//                 GEMINI_TTS_VOICE (default Charon, a calm and even voice).
// Cloud options:  GOOGLE_TTS_VOICE (default th-TH-Neural2-C), GOOGLE_TTS_RATE (default 0.92).
//
// Every line is trimmed of leading and trailing silence and converted to 48 kHz. A line longer than
// its window is sped up by at most 12%; if it still does not fit, the script says so and fails.
// Then run npm run audio:episode and npm run render:episode to mix the voice into the video.
//
// Keys are sent in a request header, never in the URL, and are never written anywhere.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { finishLine, MAX_SPEED_UP } from './narration-audio.mjs';

const SCRIPT = 'projects/harmonie/hollow-bell-crypt/narration.th.json';
const OUT = 'artifacts/episode/narration';

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice(7)
  .split(',');
const geminiKey = process.env.GEMINI_API_KEY;
const cloudKey = process.env.GOOGLE_TTS_API_KEY;
const provider = geminiKey || (dryRun && !cloudKey) ? 'gemini' : 'cloud';

if (!dryRun && !geminiKey && !cloudKey) {
  console.error(
    'No voice service key. Set GEMINI_API_KEY (Google AI Studio) or GOOGLE_TTS_API_KEY (Google Cloud) in the environment, then run this again.',
  );
  process.exit(1);
}

const script = JSON.parse(readFileSync(SCRIPT, 'utf8'));

/** Gemini speaks the line in the style the prompt asks for, without reading the instruction. */
function geminiRequest(text) {
  const style =
    'Read the following Thai narration as a calm, serious, mysterious storyteller: natural and ' +
    'unhurried, never shouting, not an announcer. Pause briefly at each "...". Speak only the Thai text.';
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_TTS_MODEL ?? 'gemini-3.8-flash-tts'}:generateContent`,
    headers: [`x-goog-api-key: ${geminiKey ?? '<GEMINI_API_KEY>'}`],
    body: {
      contents: [{ parts: [{ text: `${style}\n\n${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: process.env.GEMINI_TTS_VOICE ?? 'Charon' },
          },
        },
      },
    },
  };
}

function cloudRequest(text) {
  const ssml = `<speak>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\.\.\.\s*/g, '<break time="450ms"/>')}</speak>`;
  return {
    url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    headers: [`X-Goog-Api-Key: ${cloudKey ?? '<GOOGLE_TTS_API_KEY>'}`],
    body: {
      input: { ssml },
      voice: { languageCode: 'th-TH', name: process.env.GOOGLE_TTS_VOICE ?? 'th-TH-Neural2-C' },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 48000,
        speakingRate: Number(process.env.GOOGLE_TTS_RATE ?? '0.92'),
      },
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Posts with curl, which follows the system proxy settings. Retries when rate limited. */
async function post(request) {
  for (let attempt = 1; ; attempt++) {
    const result = spawnSync(
      'curl',
      [
        '-sS',
        '-w',
        '\n%{http_code}',
        '-X',
        'POST',
        request.url,
        '-H',
        'Content-Type: application/json',
        ...request.headers.flatMap((header) => ['-H', header]),
        '--data-binary',
        '@-',
      ],
      { input: JSON.stringify(request.body), encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
    );
    if (result.status !== 0) throw new Error(result.stderr || 'curl failed');
    const cut = result.stdout.lastIndexOf('\n');
    const status = Number(result.stdout.slice(cut + 1));
    const body = result.stdout.slice(0, cut);
    if (status === 200) return JSON.parse(body);
    if ((status === 429 || status >= 500) && attempt < 6) {
      const wait = 20_000 * attempt;
      console.log(`  service busy (${status}), retrying in ${wait / 1000} s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${status}: ${body.slice(0, 600)}`);
  }
}

mkdirSync(OUT, { recursive: true });
console.log(`Voice: ${provider === 'gemini' ? 'Gemini TTS' : 'Google Cloud TTS'}`);
let failed = 0;
for (const line of script.lines.filter((l) => !only || only.includes(l.shot))) {
  const request = provider === 'gemini' ? geminiRequest(line.text) : cloudRequest(line.text);
  if (dryRun) {
    console.log(`${line.shot}: POST ${request.url}\n  ${JSON.stringify(request.body)}`);
    continue;
  }
  const file = join(OUT, `${line.shot}.wav`);
  if (existsSync(file) && !force) {
    console.log(`${file}: kept (use --force to remake)`);
    continue;
  }
  let length = Infinity;
  // A speech model occasionally runs on past the text. Ask again when the audio is far too long.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await post(request);
    const raw = join(OUT, `${line.shot}.raw`);
    if (provider === 'gemini') {
      const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) throw new Error(`${line.shot}: no audio in the response`);
      writeFileSync(raw, Buffer.from(part.inlineData.data, 'base64'));
      // Newer models return a WAV file; preview models return raw 16-bit mono PCM at the rate
      // named in the MIME type.
      const mime = part.inlineData.mimeType ?? '';
      const format = mime.includes('wav') ? 'wav' : Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
      length = finishLine(raw, format, file, line.maxDuration);
    } else {
      writeFileSync(raw, Buffer.from(response.audioContent, 'base64'));
      length = finishLine(raw, 'wav', file, line.maxDuration);
    }
    rmSync(raw);
    if (length <= line.maxDuration * 1.5) break;
    console.log(
      `  ${line.shot}: ${length.toFixed(1)} s is far too long for this line, asking again`,
    );
    await sleep(7_000);
  }
  const fits = length <= line.maxDuration;
  if (!fits) failed++;
  console.log(
    `${file}: ${length.toFixed(2)} s of ${line.maxDuration} s${fits ? '' : '  TOO LONG'}`,
  );
  // Stay under the preview models' per-minute request limits.
  if (provider === 'gemini') await sleep(7_000);
}
if (failed > 0) {
  console.error(
    `${failed} line(s) do not fit their window even at ${MAX_SPEED_UP}x. Try another voice, then run with --force.`,
  );
  process.exit(2);
}
