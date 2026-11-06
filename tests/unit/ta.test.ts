import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { taLeg, taFigureNodes } from '../../src/characters/ta/ta-poses';
import { TA_NODES } from '../../src/characters/ta/ta-rig';
import { evaluateFrame } from '../../src/core/evaluate';
import { nodeBounds } from '../../src/core/framing';
import { IDENTITY } from '../../src/core/matrix';
import { parseProject } from '../../src/core/schema';
import { interpolatePaths, pathStructure } from '../../src/core/svgPath';
import {
  TA_EPISODE,
  TA_TIMING,
  taSubtitleCues,
} from '../../src/episodes/ta-dont-look-back/episode';
import { taTextFiles } from '../../src/episodes/ta-dont-look-back/files';
import { TA_FILM_PALETTE } from '../../src/episodes/ta-dont-look-back/palette';
import { taDontLookBackProject } from '../../src/episodes/ta-dont-look-back/scene';
import { shadowAt } from '../../src/episodes/ta-dont-look-back/shadow';

describe('path morphing', () => {
  it('interpolates point by point between paths of the same structure', () => {
    const a = 'M 0 0 L 10 0 C 10 10 0 10 0 0 Z';
    const b = 'M 0 0 L 20 0 C 20 20 0 20 0 0 Z';
    expect(interpolatePaths(a, b, 0.5)).toBe('M 0 0 L 15 0 C 15 15 0 15 0 0 Z');
    expect(pathStructure(a)).toBe(pathStructure(b));
  });

  it('rejects a shape track whose path does not match its node', () => {
    const scene = (d: string) => ({
      schemaVersion: 3,
      id: 't',
      name: 't',
      kind: 'technical-demo',
      scenes: [
        {
          id: 's',
          duration: 1,
          fps: 24,
          exportFps: 24,
          background: '#000000',
          safeArea: { x: 0, y: 0, width: 1, height: 1 },
          nodes: [{ id: 'p', shape: { kind: 'path', d: 'M 0 0 L 1 0 L 1 1 Z', fill: '#ffffff' } }],
          shapeTracks: [{ target: 'p', keyframes: [{ time: 0, d }] }],
          shots: [{ id: 'a', start: 0, duration: 1 }],
        },
      ],
    });
    expect(() => parseProject(scene('M 0 0 L 2 0 L 2 2 Z'))).not.toThrow();
    expect(() => parseProject(scene('M 0 0 L 2 0 Z'))).toThrow();
  });
});

describe('Ta (CHR-002)', () => {
  it('has the rig the brief asks for', () => {
    for (const joint of [
      'root',
      'torso',
      'neck',
      'head',
      'leftUpperArm',
      'leftForearm',
      'leftHand',
      'leftThigh',
      'leftShin',
      'leftFoot',
    ]) {
      expect(TA_NODES).toContain(joint);
    }
  });

  it('draws no face: no part is named or coloured as a facial feature', () => {
    const nodes = [
      ...taFigureNodes({ id: 'a', view: 'side', x: 0, groundY: 0, scale: 1 }),
      ...taFigureNodes({ id: 'b', view: 'back', x: 0, groundY: 0, scale: 1 }),
    ];
    for (const node of nodes) expect(node.id).not.toMatch(/eye|mouth|nose|brow/);
  });

  it('plants the foot where leg IK was asked to', () => {
    const pose = taLeg('right', { dy: 20 }, { forward: 40 });
    expect(pose.rightThigh?.rotation).toBeLessThan(0);
    expect(pose.rightShin?.rotation).toBeGreaterThan(0);
  });
});

describe("DON'T LOOK BACK", () => {
  const scene = parseProject(taDontLookBackProject()).scenes[0];
  if (!scene) throw new Error('missing scene');

  it('is 60 s of 24 fps 1080x1920 in 11 shots on the storyboard times', () => {
    expect(scene.duration).toBe(60);
    expect(scene.fps).toBe(24);
    expect(TA_EPISODE.shots.map((s) => [s.startTime, s.endTime])).toEqual([
      [0, 4],
      [4, 10],
      [10, 16],
      [16, 21],
      [21, 27],
      [27, 33],
      [33, 38],
      [38, 43],
      [43, 49],
      [49, 54],
      [54, 60],
    ]);
  });

  it('uses only the brief palette', () => {
    expect(TA_FILM_PALETTE).toMatchObject({
      nightNavy: '#141C2A',
      coldShadow: '#202B3B',
      mutedBlue: '#40566D',
      moonlight: '#849DB5',
      paleLight: '#C7D4DA',
      deepBlack: '#0A0D13',
      warmAccent: '#A9957C',
    });
  });

  it('has no narration or subtitle in S07, and one voice line in S08', () => {
    const s7 = TA_EPISODE.shots[6];
    expect(s7?.narration).toBeNull();
    expect(s7?.subtitleTH).toEqual([]);
    expect(TA_EPISODE.shots[7]?.dialogue?.text).toBe('อย่าออกไปจากห้องนี้');
    expect(TA_EPISODE.shots[7]?.dialogue?.voice).toBe('presence');
  });

  it('keeps every subtitle inside its shot and in order', () => {
    const cues = taSubtitleCues();
    expect(cues).toHaveLength(10);
    cues.forEach((cue, i) => {
      const next = cues[i + 1];
      if (next) expect(cue.end).toBeLessThanOrEqual(next.start);
    });
  });

  it('offers two choices with identical styling', () => {
    expect(TA_EPISODE.choices.map((c) => c.th)).toEqual(['หันไปมอง', 'ทำเป็นไม่สนใจ']);
    const frame = evaluateFrame(scene, 1439);
    const card = (id: string) => frame.nodes.find((n) => n.id === `choice-${id}-back`);
    expect(card('A')?.shape).toEqual(card('B')?.shape);
    expect(card('A')?.worldOpacity).toBe(card('B')?.worldOpacity);
  });

  it('stops the shadow before the voice speaks, and Ta does not move after the warning', () => {
    const voice = TA_EPISODE.shots[7]?.dialogue?.start ?? 39;
    const shadowAtFrame = (f: number) =>
      evaluateFrame(scene, f).nodes.find((n) => n.id === 'shadow-core')?.shape;
    expect(shadowAtFrame(Math.round((voice - 0.6) * 24))).toEqual(
      shadowAtFrame(Math.round(voice * 24)),
    );
    const ta = (f: number) =>
      evaluateFrame(scene, f)
        .nodes.filter((n) => n.id.startsWith('door-ta-part'))
        .map((n) => n.worldMatrix);
    expect(ta(Math.round((voice + 0.5) * 24))).toEqual(ta(1439));
  });

  it('never lets the hand touch the handle, while reaching or after', () => {
    // From the start of the reach to the end of the film: it rises beside his body and stops short.
    for (let f = 27 * 24; f < 1440; f += 3) {
      const frame = evaluateFrame(scene, f);
      const box = (id: string) => {
        const node = frame.nodes.find((n) => n.id === id && n.worldOpacity > 0);
        return node ? nodeBounds(node, IDENTITY) : null;
      };
      const hand = box('door-ta-part-left-hand');
      const lever = box('room-handle-lever');
      if (!hand || !lever) continue;
      const apart =
        hand.maxY < lever.minY ||
        hand.minY > lever.maxY ||
        hand.maxX < lever.minX ||
        hand.minX > lever.maxX;
      expect(apart, `frame ${f}`).toBe(true);
    }
    expect(shadowAt(1).length).toBeGreaterThan(10);
  });

  it('is deterministic', () => {
    for (const f of [20, 700, 900, 1300])
      expect(evaluateFrame(scene, f)).toEqual(evaluateFrame(scene, f));
  });

  it('committed subtitle and script files are up to date. Run npm run build:ta', () => {
    for (const [path, content] of Object.entries(taTextFiles())) {
      expect(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), path).toBe(content);
    }
  });

  it('says honestly whether subtitle timing comes from real audio', () => {
    expect(['planned', 'measured']).toContain(TA_TIMING.source);
  });
});
