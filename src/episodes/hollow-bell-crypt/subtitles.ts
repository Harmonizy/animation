import { EPISODE, subtitleCues, type Episode, type SubtitleCue } from './episode';

/** SRT and WebVTT files, generated from the same cues that are burned into the picture. */

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

function clock(seconds: number, separator: ',' | '.'): string {
  const millis = Math.round(seconds * 1000);
  const h = Math.floor(millis / 3_600_000);
  const m = Math.floor(millis / 60_000) % 60;
  const s = Math.floor(millis / 1000) % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(millis % 1000, 3)}`;
}

export type Language = 'th' | 'en';

const lines = (cue: SubtitleCue, language: Language) => cue[language].join('\n');

export function toSrt(cues: readonly SubtitleCue[], language: Language): string {
  return cues
    .map(
      (cue) =>
        `${cue.index}\n${clock(cue.start, ',')} --> ${clock(cue.end, ',')}\n${lines(cue, language)}\n`,
    )
    .join('\n');
}

export function toVtt(cues: readonly SubtitleCue[], language: Language): string {
  const body = cues
    .map(
      (cue) =>
        `${cue.index}\n${clock(cue.start, '.')} --> ${clock(cue.end, '.')}\n${lines(cue, language)}\n`,
    )
    .join('\n');
  return `WEBVTT\nKind: captions\nLanguage: ${language}\n\n${body}`;
}

/** Narration lines with their windows, for the voice script. */
export function narrationScript(episode: Episode = EPISODE) {
  return {
    language: 'th-TH',
    perspective: 'third person',
    direction:
      'Calm, serious, mysterious. Natural storytelling, moderate pace, brief pauses at the ellipses. No shouting, no announcer delivery.',
    lines: episode.shots.map((shot) => ({
      shot: shot.id,
      text: shot.narration.th,
      start: shot.narration.start,
      end: shot.narration.end,
      maxDuration: Math.round((shot.narration.end - shot.narration.start) * 1000) / 1000,
    })),
  };
}

/** Every generated text file of the episode, by path. */
export function episodeTextFiles(): Record<string, string> {
  const cues = subtitleCues();
  const dir = 'projects/harmonie/hollow-bell-crypt';
  return {
    [`${dir}/subtitles.th.srt`]: toSrt(cues, 'th'),
    [`${dir}/subtitles.en.srt`]: toSrt(cues, 'en'),
    [`${dir}/subtitles.th.vtt`]: toVtt(cues, 'th'),
    [`${dir}/subtitles.en.vtt`]: toVtt(cues, 'en'),
    [`${dir}/narration.th.json`]: `${JSON.stringify(narrationScript(), null, 2)}\n`,
  };
}
