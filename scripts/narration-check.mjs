/* global console, process, setTimeout */
// Checks the generated narration by having Gemini transcribe each line back to Thai text and
// comparing it with the script. A text-to-speech model can add words, read its instructions aloud
// or skip a phrase; this catches that without anyone needing to listen first.
//
//   GEMINI_API_KEY=... npm run narration:check
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY is not set.');
  process.exit(1);
}
const model = process.env.GEMINI_CHECK_MODEL ?? 'gemini-flash-latest';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const script = JSON.parse(
  readFileSync('projects/harmonie/hollow-bell-crypt/narration.th.json', 'utf8'),
);

/** Letters only: punctuation, spaces and the ellipsis do not change what is said. */
const letters = (text) => text.replace(/[^฀-๿a-zA-Z0-9]/g, '');

/** Similarity from 0 to 1, from the edit distance between two strings. */
function similarity(a, b) {
  const m = a.length;
  const n = b.length;
  let previous = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const current = [i];
    for (let j = 1; j <= n; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return 1 - previous[n] / Math.max(m, n, 1);
}

let bad = 0;
for (const line of script.lines) {
  const audio = readFileSync(`artifacts/episode/narration/${line.shot}.wav`).toString('base64');
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: audio } },
          {
            text: 'Transcribe this Thai speech exactly, word for word, in Thai script. Output only the transcription.',
          },
        ],
      },
    ],
  };
  let response;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const result = spawnSync(
      'curl',
      [
        '-sS',
        '-X',
        'POST',
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        '-H',
        'Content-Type: application/json',
        '-H',
        `x-goog-api-key: ${key}`,
        '--data-binary',
        '@-',
      ],
      { input: JSON.stringify(body), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    response = JSON.parse(result.stdout);
    const code = response.error?.code;
    if (code !== 429 && code !== 503) break;
    await sleep(15_000 * attempt);
  }
  const heard =
    response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim() ?? `(error: ${response.error?.message})`;
  const score = similarity(letters(line.text), letters(heard));
  const ok = score >= 0.85;
  if (!ok) bad++;
  console.log(
    `${line.shot} ${ok ? 'ok ' : 'BAD'} ${(score * 100).toFixed(0)}%  script: ${line.text}\n              heard:  ${heard}`,
  );
}
process.exit(bad > 0 ? 2 : 0);
