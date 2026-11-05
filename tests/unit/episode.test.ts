import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateFrame } from '../../src/core/evaluate';
import { nodeBounds, type Bounds } from '../../src/core/framing';
import { IDENTITY } from '../../src/core/matrix';
import { parseProject } from '../../src/core/schema';
import {
  EPISODE,
  EpisodeSchema,
  itemById,
  priceLabel,
  subtitleCues,
} from '../../src/episodes/hollow-bell-crypt/episode';
import { hollowBellCryptProject } from '../../src/episodes/hollow-bell-crypt/scene';
import { episodeTextFiles } from '../../src/episodes/hollow-bell-crypt/subtitles';
import data from '../../projects/harmonie/hollow-bell-crypt/episode.json' with { type: 'json' };

const PRICES = {
  torch: 1,
  chalk: 1,
  rope: 4,
  earplugs: 2,
  bandages: 3,
  'decoy-bell': 5,
  rations: 2,
};

describe('episode data', () => {
  it('is 60 s of 24 fps 1080x1920 in exactly 12 contiguous shots', () => {
    expect(EPISODE.format).toMatchObject({ width: 1080, height: 1920, fps: 24, frames: 1440 });
    expect(EPISODE.shots).toHaveLength(12);
    expect(EPISODE.shots[0]?.start).toBe(0);
    expect(EPISODE.shots.at(-1)?.end).toBe(60);
    expect(EPISODE.shots.map((shot) => shot.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
    );
  });

  it('keeps the storyboard times', () => {
    expect(EPISODE.shots.map((shot) => [shot.start, shot.end])).toEqual([
      [0, 4],
      [4, 9],
      [9, 14],
      [14, 19],
      [19, 24],
      [24, 28],
      [28, 33],
      [33, 38],
      [38, 43],
      [43, 48],
      [48, 53],
      [53, 60],
    ]);
  });

  it('uses the exact prices, totalling 18 SP against a 10 SP budget', () => {
    expect(Object.fromEntries(EPISODE.items.map((item) => [item.id, item.price]))).toEqual(PRICES);
    expect(EPISODE.items.reduce((sum, item) => sum + item.price, 0)).toBe(18);
    expect(EPISODE.economy).toEqual({ silverPerGold: 10, budgetSilver: 10 });
  });

  it('spells every price label from the one price table', () => {
    expect(priceLabel(itemById('torch'))).toBe('TORCH — 1 SP');
    expect(priceLabel(itemById('decoy-bell'))).toBe('DECOY BELL — 5 SP');
    expect(priceLabel(itemById('rations'))).toBe('RATIONS & WATER — 2 SP');
  });

  it('rejects a shot list that does not end at 60 s', () => {
    const broken = structuredClone(data);
    const last = broken.shots[11];
    if (last) last.end = 59;
    expect(() => EpisodeSchema.parse(broken)).toThrow();
  });

  it('gives every shot narration inside its own window, at a speakable rate', () => {
    for (const shot of EPISODE.shots) {
      const seconds = shot.narration.end - shot.narration.start;
      // Thai speech runs at roughly 14 characters a second at a calm pace, spaces excluded.
      const characters = shot.narration.th.replace(/[\s.]/g, '').length;
      expect(characters / seconds, shot.id).toBeLessThan(14);
    }
  });

  it('never reveals a purchase in the closing text', () => {
    const last = EPISODE.shots.at(-1);
    expect(last?.question?.th).toBe('ฮาร์โมนีควรซื้ออะไร?');
    expect(last?.question?.en).toBe('What should Harmonie buy?');
    expect(last?.callToAction).toEqual({ th: 'รวมราคาไม่เกิน 10 SP', en: 'Maximum total: 10 SP' });
  });
});

describe('subtitles', () => {
  const cues = subtitleCues();

  it('pairs Thai and English in every cue, at most two lines each', () => {
    expect(cues).toHaveLength(13);
    for (const cue of cues) {
      expect(cue.th.length).toBeGreaterThan(0);
      expect(cue.en.length).toBeGreaterThan(0);
      expect(cue.th.length).toBeLessThanOrEqual(2);
      expect(cue.en.length).toBeLessThanOrEqual(2);
    }
  });

  it('never overlaps one cue with the next', () => {
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]?.start ?? 0).toBeGreaterThanOrEqual(cues[i - 1]?.end ?? 0);
    }
  });

  it('committed SRT, VTT and narration files are up to date. Run npm run build:episode', () => {
    for (const [path, content] of Object.entries(episodeTextFiles())) {
      expect(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), path).toBe(content);
    }
  });
});

describe('episode scene', () => {
  const scene = parseProject(hollowBellCryptProject()).scenes[0];
  if (!scene) throw new Error('missing scene');

  it('validates as one 60 s scene with a camera segment per cut', () => {
    expect(scene.duration).toBe(60);
    expect(scene.fps).toBe(24);
    expect(scene.shots.length).toBe(14);
    expect(scene.exposure.character).toBe(2);
  });

  it('shows only the current shot', () => {
    const visibleRoots = (frame: number) =>
      evaluateFrame(scene, frame)
        .nodes.filter(
          (node) => node.worldOpacity > 0 && /^S\d\d-(far|mid|world|near)$/.test(node.id),
        )
        .map((node) => node.id.slice(0, 3));
    for (const shot of EPISODE.shots) {
      const roots = new Set(visibleRoots(Math.round((shot.start + 0.5) * 24)));
      expect(
        [...roots].every((id) => id === shot.id),
        shot.id,
      ).toBe(true);
    }
  });

  it('is deterministic: the same frame always gives the same state', () => {
    for (const frame of [0, 66, 700, 1439]) {
      expect(evaluateFrame(scene, frame)).toEqual(evaluateFrame(scene, frame));
    }
  });

  it('ends with the hand close to the items but touching none of them', () => {
    const overlaps = (a: Bounds, b: Bounds) =>
      a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
    let closest = Infinity;
    for (let frame = 53 * 24; frame < 1440; frame++) {
      const nodes = evaluateFrame(scene, frame).nodes.filter((node) => node.worldOpacity > 0);
      const bounds = (pattern: RegExp) =>
        nodes
          .filter((node) => pattern.test(node.id))
          .map((node) => nodeBounds(node, IDENTITY))
          .filter((b): b is Bounds => b !== null);
      const hand = bounds(/^S12-glove-(palm|thumb|index|middle|ring|little)/);
      const cards = bounds(/^S12-card-.*-paper$/);
      for (const h of hand) {
        for (const c of cards) expect(overlaps(h, c), `frame ${frame}`).toBe(false);
      }
      if (hand.length > 0 && cards.length > 0) {
        const top = Math.min(...hand.map((h) => h.minY));
        const bottom = Math.max(...cards.map((c) => c.maxY));
        closest = Math.min(closest, top - bottom);
      }
    }
    // Close enough to read as a reach: within about the width of a finger.
    expect(closest).toBeLessThan(60);
  });
});
