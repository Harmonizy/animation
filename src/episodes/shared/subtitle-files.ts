/** SRT and WebVTT files from bilingual cues, shared by every episode. */

export interface SubtitleCue {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly th: readonly string[];
  readonly en: readonly string[];
}

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
