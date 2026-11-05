import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/core/evaluate';
import {
  ASPECT_RATIOS,
  fitAspect,
  isAspectRatioName,
  nodeBounds,
  viewTransform,
  type AspectRatioName,
} from '../../src/core/framing';
import { applyToPoint } from '../../src/core/matrix';
import { parseProject, type Scene } from '../../src/core/schema';
import { geometricDemo } from '../../src/demos/geometricDemo';

const camera = { x: 0, y: 0, zoom: 1, rotation: 0 };
const safeArea = { x: -500, y: -500, width: 1000, height: 1000 };

describe('fitAspect', () => {
  it('fits by width or height and never exceeds the container', () => {
    expect(fitAspect({ width: 1000, height: 1000 }, 16 / 9)).toEqual({ width: 1000, height: 562 });
    expect(fitAspect({ width: 1000, height: 1000 }, 9 / 16)).toEqual({ width: 562, height: 1000 });
    expect(fitAspect({ width: 300, height: 900 }, 1)).toEqual({ width: 300, height: 300 });
  });

  it('never returns an empty size', () => {
    expect(fitAspect({ width: 0, height: 0 }, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('isAspectRatioName', () => {
  it('accepts supported ratios only', () => {
    expect(isAspectRatioName('9:16')).toBe(true);
    expect(isAspectRatioName('4:3')).toBe(false);
    expect(isAspectRatioName('toString')).toBe(false);
  });
});

describe('viewTransform', () => {
  it('places the camera at the viewport center', () => {
    const matrix = viewTransform({ ...camera, x: 30, y: 40 }, safeArea, {
      width: 800,
      height: 600,
    });
    expect(applyToPoint(matrix, { x: 30, y: 40 })).toEqual({ x: 400, y: 300 });
  });

  it.each(Object.values(ASPECT_RATIOS))('keeps the safe area visible at ratio %d', (ratio) => {
    const viewport = fitAspect({ width: 1920, height: 1920 }, ratio);
    const matrix = viewTransform(camera, safeArea, viewport);
    const topLeft = applyToPoint(matrix, { x: -500, y: -500 });
    const bottomRight = applyToPoint(matrix, { x: 500, y: 500 });
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(viewport.width);
    expect(bottomRight.y).toBeLessThanOrEqual(viewport.height);
  });

  it('applies zoom and uniform scale without stretching', () => {
    const matrix = viewTransform({ ...camera, zoom: 2 }, safeArea, { width: 1000, height: 500 });
    const origin = applyToPoint(matrix, { x: 0, y: 0 });
    const right = applyToPoint(matrix, { x: 100, y: 0 });
    const down = applyToPoint(matrix, { x: 0, y: 100 });
    expect(right.x - origin.x).toBeCloseTo(100);
    expect(down.y - origin.y).toBeCloseTo(100);
  });

  it('rotating the camera turns the world the opposite way', () => {
    const matrix = viewTransform({ ...camera, rotation: 90 }, safeArea, {
      width: 1000,
      height: 1000,
    });
    const point = applyToPoint(matrix, { x: 100, y: 0 });
    expect(point.x).toBeCloseTo(500);
    expect(point.y).toBeCloseTo(400);
  });
});

describe('geometric demo framing', () => {
  const scene = parseProject(geometricDemo).scenes[0] as Scene;
  const sampleTimes = Array.from({ length: 161 }, (_, i) => (i / 160) * scene.duration);

  it.each(Object.keys(ASPECT_RATIOS) as AspectRatioName[])(
    'keeps every foreground shape in frame at %s',
    (name) => {
      const viewport = fitAspect({ width: 1080, height: 1080 }, ASPECT_RATIOS[name]);
      for (const time of sampleTimes) {
        const frame = evaluateScene(scene, time);
        const view = viewTransform(frame.camera, frame.safeArea, viewport);
        for (const node of frame.nodes) {
          if (node.id.startsWith('grid')) continue;
          const bounds = nodeBounds(node, view);
          if (!bounds) continue;
          const where = `${node.id} at t=${time}`;
          expect(bounds.minX, where).toBeGreaterThanOrEqual(0);
          expect(bounds.minY, where).toBeGreaterThanOrEqual(0);
          expect(bounds.maxX, where).toBeLessThanOrEqual(viewport.width);
          expect(bounds.maxY, where).toBeLessThanOrEqual(viewport.height);
        }
      }
    },
  );

  it('has no drawable node without bounds except groups', () => {
    const view = viewTransform(camera, safeArea, { width: 100, height: 100 });
    for (const node of evaluateScene(scene, 0).nodes) {
      expect(nodeBounds(node, view) === null).toBe(node.shape.kind === 'group');
    }
  });
});
