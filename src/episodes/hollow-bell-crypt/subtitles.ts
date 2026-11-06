import { toSrt, toVtt } from '../shared/subtitle-files';
import { EPISODE, subtitleCues, type Episode } from './episode';

/** SRT and WebVTT files, generated from the same cues that are burned into the picture. */

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
