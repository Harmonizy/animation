// Post-processing for narration lines: trim, resample, and fit each line to its window.
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/** The most a line may be sped up to fit its window before it counts as too long. */
export const MAX_SPEED_UP = 1.12;

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}

function seconds(file) {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' },
  );
  return Number(result.stdout.trim());
}

/**
 * Turns the service's audio into a 48 kHz mono WAV with the silence trimmed from both ends, and
 * speeds it up slightly if that is what it takes to fit the line's window.
 */
export function finishLine(raw, rawFormat, file, maxDuration) {
  const input =
    rawFormat === 'wav'
      ? ['-i', raw]
      : ['-f', 's16le', '-ar', String(rawFormat), '-ac', '1', '-i', raw];
  const trim =
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,' +
    'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse';
  ffmpeg([...input, '-af', trim, '-ar', '48000', '-ac', '1', file]);
  let length = seconds(file);
  if (length > maxDuration) {
    const tempo = length / (maxDuration - 0.05);
    if (tempo <= MAX_SPEED_UP) {
      const tmp = `${file}.tmp.wav`;
      ffmpeg(['-i', file, '-af', `atempo=${tempo.toFixed(4)}`, '-ar', '48000', tmp]);
      ffmpeg(['-i', tmp, file]);
      rmSync(tmp);
      length = seconds(file);
    }
  }
  return length;
}

export { seconds };
