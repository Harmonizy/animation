import { toSrt, toVtt } from '../shared/subtitle-files';
import { spokenLine, TA_EPISODE, TA_TIMING, taSubtitleCues } from './episode';

/** The narration and dialogue scripts, for the voice step and for reference. */
export function voiceScripts() {
  const line = (voice: 'narrator' | 'presence') =>
    TA_EPISODE.shots.flatMap((shot) => {
      const spoken = spokenLine(shot);
      return spoken && spoken.voice === voice
        ? [{ shot: shot.shotId, text: spoken.text, start: spoken.start, end: spoken.end }]
        : [];
    });
  return {
    narration: { language: 'th-TH', voice: TA_EPISODE.voices['narrator'], lines: line('narrator') },
    dialogue: { language: 'th-TH', voice: TA_EPISODE.voices['presence'], lines: line('presence') },
  };
}

/** Every generated text file of the episode, by path. */
export function taTextFiles(): Record<string, string> {
  const cues = taSubtitleCues();
  const dir = 'projects/ta-dont-look-back';
  const scripts = voiceScripts();
  return {
    [`${dir}/subtitles.th.srt`]: toSrt(cues, 'th'),
    [`${dir}/subtitles.en.srt`]: toSrt(cues, 'en'),
    [`${dir}/subtitles.th.vtt`]: toVtt(cues, 'th'),
    [`${dir}/subtitles.en.vtt`]: toVtt(cues, 'en'),
    [`${dir}/narration.th.json`]: `${JSON.stringify(scripts.narration, null, 2)}\n`,
    [`${dir}/dialogue.th.json`]: `${JSON.stringify(scripts.dialogue, null, 2)}\n`,
  };
}

/** Whether the subtitle timing comes from real audio. */
export const timingIsMeasured = () => TA_TIMING.source === 'measured';
