import { describe, expect, it } from 'vitest';
import { evaluateFrame } from '../../src/core/evaluate';
import { ASPECT_RATIOS, fitAspect, nodeBounds, viewTransform } from '../../src/core/framing';
import { applyToPoint } from '../../src/core/matrix';
import { parseProject, type Scene } from '../../src/core/schema';
import { isValidSvgPath } from '../../src/core/svgPath';
import { frameCount } from '../../src/core/timing';
import { STYLE_LABS, type StyleLabId } from '../../src/labs/silhouette/labs';
import {
  BASIC_POSES,
  GROUND_OFFSET,
  MANNEQUIN_PARTS,
  poseValues,
} from '../../src/labs/silhouette/mannequin';
import { STYLE_PALETTES, STYLE_TOKENS } from '../../src/style/cinematicMinimalist';

const LAB_IDS = Object.keys(STYLE_LABS) as StyleLabId[];
const scene = (id: StyleLabId) => parseProject(STYLE_LABS[id].build()).scenes[0] as Scene;

describe('style palettes', () => {
  it.each(Object.entries(STYLE_PALETTES))('%s defines every token', (_name, palette) => {
    expect(Object.keys(palette).sort()).toEqual([...STYLE_TOKENS].sort());
  });

  it.each(Object.entries(STYLE_PALETTES))(
    '%s separates the subject from its surround',
    (_name, palette) => {
      const luma = (hex: string) => {
        const value = Number.parseInt(hex.slice(1), 16);
        return 0.2126 * (value >> 16) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255);
      };
      expect(Math.abs(luma(palette.subject) - luma(palette.sky))).toBeGreaterThan(100);
    },
  );
});

describe('mannequin parts', () => {
  it.each(Object.entries(MANNEQUIN_PARTS))('%s is valid path data', (_name, d) => {
    expect(isValidSvgPath(d)).toBe(true);
  });

  it('has no facial parts', () => {
    const names = Object.keys(MANNEQUIN_PARTS).join(' ');
    expect(names).not.toMatch(/eye|mouth|nose|brow|face/i);
  });

  it.each(Object.entries(BASIC_POSES))(
    'solves the %s pose without impossible joints',
    (_name, spec) => {
      const values = poseValues('m', spec);
      for (const part of Object.values(values)) {
        for (const value of Object.values(part)) expect(Number.isFinite(value)).toBe(true);
      }
      // Knees only bend one way.
      expect(values['m-shinNear']?.rotation).toBeGreaterThanOrEqual(0);
      expect(values['m-shinFar']?.rotation).toBeGreaterThanOrEqual(0);
    },
  );
});

describe.each(LAB_IDS)('%s lab', (id) => {
  const subject = scene(id);

  it('is valid, neutral technical content', () => {
    expect(parseProject(STYLE_LABS[id].build()).kind).toBe('technical-demo');
  });

  it('has a subject for silhouette review', () => {
    const frame = evaluateFrame(subject, 0, { display: 'silhouette' });
    expect(frame.nodes.length).toBeGreaterThan(0);
    expect(frame.background).toBe('#ffffff');
  });

  it('has more than one shot for camera composition', () => {
    expect(subject.shots.length).toBeGreaterThan(1);
  });

  it('moves over time', () => {
    const shape = (frame: number) => evaluateFrame(subject, frame, { display: 'silhouette' }).nodes;
    expect(shape(0)).not.toEqual(shape(96));
  });

  it('gives the same result however frames are reached', () => {
    const forward = [0, 50, 100, 150].map((frame) => evaluateFrame(subject, frame));
    const backward = [150, 100, 50, 0].map((frame) => evaluateFrame(subject, frame)).reverse();
    expect(backward).toEqual(forward);
  });

  it.each(Object.entries(ASPECT_RATIOS))(
    'keeps the whole subject in frame at %s',
    (_name, ratio) => {
      const viewport = fitAspect({ width: 1080, height: 1080 }, ratio);
      const count = frameCount(subject.duration, subject.fps);
      for (let frame = 0; frame < count; frame += 2) {
        const state = evaluateFrame(subject, frame, { display: 'silhouette' });
        const view = viewTransform(state.camera, state.safeArea, viewport);
        for (const node of state.nodes) {
          const bounds = nodeBounds(node, view);
          if (!bounds) continue;
          const where = `${node.id} on frame ${frame}`;
          expect(bounds.minX, where).toBeGreaterThanOrEqual(0);
          expect(bounds.minY, where).toBeGreaterThanOrEqual(0);
          expect(bounds.maxX, where).toBeLessThanOrEqual(viewport.width);
          expect(bounds.maxY, where).toBeLessThanOrEqual(viewport.height);
        }
      }
    },
  );
});

describe('articulated lab grounding', () => {
  const lab = scene('articulated');
  const footPoint = (frame: number, side: 'Near' | 'Far') => {
    const node = evaluateFrame(lab, frame, { exposure: { character: 1 } }).nodes.find(
      (candidate) => candidate.id === `figure-foot${side}`,
    );
    if (!node) throw new Error('missing foot');
    return applyToPoint(node.worldMatrix, { x: 0, y: 22 });
  };
  const ground = lab.nodes.find((node) => node.id === 'figure')?.transform.y ?? 0;

  it('keeps at least one foot on the ground in every held pose', () => {
    for (const frame of [0, 34, 74, 96]) {
      const lowest = Math.max(footPoint(frame, 'Near').y, footPoint(frame, 'Far').y);
      expect(lowest, `frame ${frame}`).toBeCloseTo(ground + GROUND_OFFSET, -1);
    }
  });

  it('keeps a planted foot from sliding far during a walk step', () => {
    // Near foot plants at the start of the cycle and stays down for one step (12 frames at 24 fps).
    const start = Math.round(5.2 * 24) + 1;
    const positions = Array.from({ length: 10 }, (_, i) => footPoint(start + i, 'Near').x);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(25);
  });
});

describe('atmospheric lab depth', () => {
  const lab = scene('atmospheric');

  it('does not hide the subject behind foreground pillars for long', () => {
    const view = { width: 1778, height: 1000 };
    const count = frameCount(lab.duration, lab.fps);
    let covered = 0;
    for (let frame = 0; frame < count; frame++) {
      const state = evaluateFrame(lab, frame);
      const matrix = viewTransform(state.camera, state.safeArea, view);
      const torso = state.nodes.find((node) => node.id === 'figure-torso');
      const bounds = torso && nodeBounds(torso, matrix);
      if (!bounds) throw new Error('missing torso');
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const hidden = state.nodes.some((node) => {
        if (!node.id.startsWith('fore-pillar-')) return false;
        const pillar = nodeBounds(node, matrix);
        return pillar !== null && pillar.minX < centerX && centerX < pillar.maxX;
      });
      if (hidden) covered++;
    }
    expect(covered / count).toBeLessThan(0.12);
  });

  it('has foreground, midground and background planes that move at different rates', () => {
    const rates = lab.planes.map((plane) => plane.parallax);
    expect(rates[0]).toBe(0);
    expect(rates.at(-1)).toBeGreaterThan(1);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(new Set(rates).size).toBe(rates.length);
  });

  it('moves the fog using background exposure, separate from the figure', () => {
    const fog = (frame: number, hold: number) =>
      evaluateFrame(lab, frame, { exposure: { background: hold, camera: hold } }).nodes.find(
        (node) => node.id === 'fog-mid-1',
      )?.worldMatrix[4];
    expect(fog(3, 4)).toBe(fog(0, 4));
    expect(fog(4, 4)).not.toBe(fog(0, 4));
  });
});
