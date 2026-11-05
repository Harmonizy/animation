import { z } from 'zod';
import data from '../../../projects/harmonie/hollow-bell-crypt/episode.json';

/**
 * The episode's single source of truth for timing, text, sound and prices, validated on load.
 * Shot builders read their times from here, the subtitle files are generated from here, and the
 * audio script reads the same file. Nothing else stores a time or a price.
 */

const Bilingual = z.strictObject({ th: z.string().min(1), en: z.string().min(1) });
const Time = z.number().min(0);

const CameraKey = z.strictObject({
  time: Time,
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
  easing: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'step']).optional(),
});

const Segment = z.strictObject({
  id: z.string().min(1),
  start: Time,
  end: Time,
  /** Which set of the shot this segment frames: 0 is the main set, 1 the insert after a cut. */
  origin: z.number().int().min(0),
  keys: z.array(CameraKey).min(1),
});

const Sound = z.strictObject({
  cue: z.string().min(1),
  start: Time,
  end: Time.optional(),
  gain: z.number().min(0).max(1),
  count: z.number().int().positive().optional(),
  interval: z.number().positive().optional(),
});

const Window = z.strictObject({ start: Time, end: Time });

const Shot = z.strictObject({
  id: z.string().regex(/^S\d\d$/),
  name: z.string().min(1),
  scene: z.string().min(1),
  start: Time,
  end: Time,
  type: z.string().min(1),
  intent: z.string().min(1),
  camera: z.strictObject({ description: z.string(), segments: z.array(Segment).min(1) }),
  narration: z.strictObject({ th: z.string().min(1), start: Time, end: Time }),
  subtitle: z.strictObject({
    th: z.array(z.string().min(1)).min(1).max(2),
    en: z.array(z.string().min(1)).min(1).max(2),
  }),
  subtitleEnd: Time.optional(),
  question: Bilingual.extend({ start: Time, end: Time }).optional(),
  callToAction: Bilingual.optional(),
  emphasis: z.array(z.strictObject({ text: z.string().min(1), start: Time, end: Time })),
  prices: z.array(Window.extend({ item: z.string().min(1) })).optional(),
  sounds: z.array(Sound),
  assets: z.array(z.string().min(1)),
});

const Item = z.strictObject({
  id: z.string().min(1),
  th: z.string().min(1),
  en: z.string().min(1),
  price: z.number().int().positive(),
  advantage: Bilingual,
  disadvantage: Bilingual,
});

export const EpisodeSchema = z
  .strictObject({
    id: z.string(),
    title: Bilingual,
    subtitle: Bilingual,
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
    economy: z.strictObject({ silverPerGold: z.number(), budgetSilver: z.number() }),
    items: z.array(Item).length(7),
    shots: z.array(Shot).length(12),
  })
  .superRefine((episode, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const onFrame = (t: number) =>
      Math.abs(t * episode.format.fps - Math.round(t * episode.format.fps)) < 1e-6;
    let cursor = 0;
    const items = new Set(episode.items.map((item) => item.id));
    episode.shots.forEach((shot, i) => {
      if (Math.abs(shot.start - cursor) > 1e-9)
        issue(['shots', i, 'start'], `Must start at ${cursor}`);
      if (!onFrame(shot.start) || !onFrame(shot.end))
        issue(['shots', i], 'Cuts must fall on whole frames');
      cursor = shot.end;
      let local = 0;
      shot.camera.segments.forEach((segment, s) => {
        const path = ['shots', i, 'camera', 'segments', s];
        if (Math.abs(segment.start - local) > 1e-9) issue(path, `Segment must start at ${local}`);
        if (!onFrame(shot.start + segment.start))
          issue(path, 'Segment cuts must fall on whole frames');
        local = segment.end;
      });
      if (Math.abs(local - (shot.end - shot.start)) > 1e-9)
        issue(['shots', i, 'camera'], 'Segments must cover the shot');
      const n = shot.narration;
      if (n.start < shot.start || n.end > shot.end || n.end <= n.start) {
        issue(['shots', i, 'narration'], 'Narration must sit inside its shot');
      }
      for (const price of shot.prices ?? []) {
        if (!items.has(price.item)) issue(['shots', i, 'prices'], `Unknown item ${price.item}`);
      }
    });
    if (Math.abs(cursor - episode.format.duration) > 1e-9)
      issue(['shots'], 'Shots must end at 60 s');
  });

export type Episode = z.output<typeof EpisodeSchema>;
export type EpisodeShot = Episode['shots'][number];
export type EpisodeItem = Episode['items'][number];

export const EPISODE: Episode = EpisodeSchema.parse(data);

export function shotById(id: string): EpisodeShot {
  const shot = EPISODE.shots.find((candidate) => candidate.id === id);
  if (!shot) throw new Error(`Unknown shot ${id}`);
  return shot;
}

export function itemById(id: string): EpisodeItem {
  const item = EPISODE.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown item ${id}`);
  return item;
}

/** "TORCH — 1 SP", the one place a price label is spelled. */
export const priceLabel = (item: EpisodeItem) => `${item.en.toUpperCase()} — ${item.price} SP`;

export interface SubtitleCue {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly th: readonly string[];
  readonly en: readonly string[];
}

/**
 * One cue per shot, from just after the cut to just before the next, plus the closing question.
 * Thai and English always share a cue, so they can never drift apart.
 */
export function subtitleCues(episode: Episode = EPISODE): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const shot of episode.shots) {
    cues.push({
      index: cues.length + 1,
      start: shot.start + 0.25,
      end: shot.subtitleEnd ?? shot.end - 0.15,
      th: shot.subtitle.th,
      en: shot.subtitle.en,
    });
    if (shot.question) {
      cues.push({
        index: cues.length + 1,
        start: shot.question.start,
        end: shot.question.end,
        th: [shot.question.th],
        en: [shot.question.en],
      });
    }
  }
  return cues;
}
