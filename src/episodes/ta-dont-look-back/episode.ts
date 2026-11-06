import { z } from 'zod';
import data from '../../../projects/ta-dont-look-back/episode.json' with { type: 'json' };
import timingData from '../../../projects/ta-dont-look-back/timing.json' with { type: 'json' };
import type { SubtitleCue } from '../shared/subtitle-files';

/**
 * DON'T LOOK BACK: the episode's data, validated on load. episode.json is the storyboard and the
 * plan. timing.json records where each spoken line really is, measured from the generated audio;
 * subtitles follow it, so they match the speech and not just the shot.
 */

const T = z.number().min(0);
const Key = z.strictObject({
  time: T,
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
  easing: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'step']).optional(),
});
const Line = z.strictObject({
  voice: z.enum(['narrator', 'presence']),
  /** The words as spoken, for the scripts. */
  text: z.string().min(1),
  /**
   * What the voice model is given, when it differs from `text`: parts generated separately (with
   * ElevenLabs v3 tags such as [quietly]), joined with `pause` seconds of silence, each at `gain`.
   */
  performance: z
    .array(
      z.strictObject({
        text: z.string().min(1),
        pause: z.number().min(0).optional(),
        gain: z.number().positive().optional(),
      }),
    )
    .min(1)
    .optional(),
  start: T,
  end: T,
});
const Sound = z.strictObject({
  cue: z.string().min(1),
  start: T,
  end: T.optional(),
  gain: z.number().min(0).max(1),
  count: z.number().int().positive().optional(),
  interval: z.number().positive().optional(),
});

const Shot = z.strictObject({
  shotId: z.string().regex(/^S\d\d$/),
  name: z.string(),
  startTime: T,
  endTime: T,
  type: z.string(),
  intent: z.string(),
  camera: z.strictObject({ description: z.string(), keys: z.array(Key).min(1) }),
  environment: z.string(),
  animatedObjects: z.array(z.string()),
  narration: Line.nullable(),
  dialogue: Line.nullable(),
  subtitleTH: z.array(z.string().min(1)).max(2),
  subtitleEN: z.array(z.string().min(1)).max(2),
  soundCues: z.array(Sound),
});

export const TaEpisodeSchema = z
  .strictObject({
    id: z.literal('ta-dont-look-back'),
    title: z.strictObject({ th: z.string(), en: z.string() }),
    character: z.string(),
    format: z.strictObject({
      width: z.literal(1080),
      height: z.literal(1920),
      fps: z.literal(24),
      duration: z.literal(60),
      frames: z.literal(1440),
      characterHold: z.number().int().positive(),
      video: z.string(),
      audio: z.string(),
    }),
    voices: z.record(
      z.string(),
      z.strictObject({
        role: z.string(),
        elevenlabs: z.strictObject({
          name: z.string(),
          voiceId: z.string().min(1),
          stability: z.number().min(0).max(1),
        }),
      }),
    ),
    choices: z.array(z.strictObject({ id: z.string(), th: z.string(), en: z.string() })).length(2),
    choicesStart: T,
    shots: z.array(Shot).length(11),
  })
  .superRefine((episode, ctx) => {
    let cursor = 0;
    episode.shots.forEach((shot, i) => {
      const at = ['shots', i];
      if (Math.abs(shot.startTime - cursor) > 1e-9)
        ctx.addIssue({ code: 'custom', path: at, message: `Must start at ${cursor}` });
      const frames = (t: number) => Math.abs(t * 24 - Math.round(t * 24)) < 1e-6;
      if (!frames(shot.startTime) || !frames(shot.endTime))
        ctx.addIssue({ code: 'custom', path: at, message: 'Cuts must be on whole frames' });
      cursor = shot.endTime;
      for (const line of [shot.narration, shot.dialogue]) {
        if (line && (line.start < shot.startTime || line.end > shot.endTime)) {
          ctx.addIssue({
            code: 'custom',
            path: at,
            message: 'A spoken line must sit inside its shot',
          });
        }
      }
      const spoken = shot.narration !== null || shot.dialogue !== null;
      if (
        spoken !== shot.subtitleTH.length > 0 ||
        shot.subtitleTH.length > 0 !== shot.subtitleEN.length > 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: at,
          message: 'Subtitles exist exactly when something is said, in both languages',
        });
      }
    });
    if (Math.abs(cursor - 60) > 1e-9)
      ctx.addIssue({ code: 'custom', path: ['shots'], message: 'Shots must end at 60 s' });
  });

export type TaEpisode = z.output<typeof TaEpisodeSchema>;
export type TaShot = TaEpisode['shots'][number];

export const TA_EPISODE: TaEpisode = TaEpisodeSchema.parse(data);

export const TimingSchema = z.strictObject({
  /** `measured` once real audio exists; `planned` means subtitles follow the plan, not speech. */
  source: z.enum(['planned', 'measured']),
  lines: z.array(
    z.strictObject({
      shotId: z.string(),
      voice: z.enum(['narrator', 'presence']),
      /** When the speech starts, in scene seconds. */
      start: T,
      /** How long the speech lasts, silence trimmed. */
      duration: z.number().positive(),
    }),
  ),
});
export type Timing = z.output<typeof TimingSchema>;
export const TA_TIMING: Timing = TimingSchema.parse(timingData);

export function taShot(id: string): TaShot {
  const shot = TA_EPISODE.shots.find((candidate) => candidate.shotId === id);
  if (!shot) throw new Error(`Unknown shot ${id}`);
  return shot;
}

/** The spoken line of a shot: its narration, or the voice behind Ta. */
export const spokenLine = (shot: TaShot) => shot.narration ?? shot.dialogue;

/** Timing from the plan, before any audio exists. */
export function plannedTiming(episode: TaEpisode = TA_EPISODE): Timing {
  return {
    source: 'planned',
    lines: episode.shots.flatMap((shot) => {
      const line = spokenLine(shot);
      return line
        ? [
            {
              shotId: shot.shotId,
              voice: line.voice,
              start: line.start,
              duration: line.end - line.start,
            },
          ]
        : [];
    }),
  };
}

/** Subtitles stay up a moment after the words end, but never into the next shot. */
const LINGER = 0.4;

/**
 * One bilingual cue per spoken line, from the measured start of its speech to a moment after it
 * ends. Thai and English share each cue, so they cannot drift apart.
 */
export function taSubtitleCues(
  timing: Timing = TA_TIMING,
  episode: TaEpisode = TA_EPISODE,
): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const shot of episode.shots) {
    const line = timing.lines.find((candidate) => candidate.shotId === shot.shotId);
    if (!line) continue;
    cues.push({
      index: cues.length + 1,
      start: Math.round(line.start * 1000) / 1000,
      end:
        Math.round(Math.min(line.start + line.duration + LINGER, shot.endTime - 0.08) * 1000) /
        1000,
      th: shot.subtitleTH,
      en: shot.subtitleEN,
    });
  }
  return cues;
}
