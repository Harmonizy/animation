import { describe, expect, it } from 'vitest';
import { applyEasing, EASING_NAMES } from '../../src/core/easing';
import { evaluateKeyframes, evaluateScene } from '../../src/core/evaluate';
import { applyToPoint } from '../../src/core/matrix';
import { parseProject, type ProjectInput, type Scene } from '../../src/core/schema';
import { geometricDemo } from '../../src/demos/geometricDemo';

type SceneInput = ProjectInput['scenes'][number];

function sceneOf(changes: Partial<SceneInput>): Scene {
  const scene = parseProject({
    schemaVersion: 2,
    id: 'test',
    name: 'Test',
    kind: 'technical-demo',
    scenes: [
      {
        id: 'scene',
        duration: 10,
        fps: 30,
        exportFps: 30,
        background: '#000000',
        safeArea: { x: -50, y: -50, width: 100, height: 100 },
        nodes: [],
        shots: [{ id: 'shot', start: 0, duration: 10 }],
        ...changes,
      },
    ],
  }).scenes[0];
  if (!scene) throw new Error('missing scene');
  return scene;
}

const worldOrigin = (scene: Scene, id: string, time = 0) => {
  const node = evaluateScene(scene, time).nodes.find((n) => n.id === id);
  if (!node) throw new Error(`missing ${id}`);
  return applyToPoint(node.worldMatrix, { x: 0, y: 0 });
};

describe('applyEasing', () => {
  it.each(EASING_NAMES.filter((name) => name !== 'step'))('%s maps 0 to 0 and 1 to 1', (name) => {
    expect(applyEasing(name, 0)).toBeCloseTo(0);
    expect(applyEasing(name, 1)).toBeCloseTo(1);
  });

  it('clamps progress outside the range', () => {
    expect(applyEasing('linear', -1)).toBe(0);
    expect(applyEasing('linear', 2)).toBe(1);
  });

  it('step holds until the end of the segment', () => {
    expect(applyEasing('step', 0.99)).toBe(0);
    expect(applyEasing('step', 1)).toBe(1);
  });
});

describe('evaluateKeyframes', () => {
  const frames = [
    { time: 1, value: 10, easing: 'linear' as const },
    { time: 2, value: 20, easing: 'step' as const },
    { time: 4, value: 40, easing: 'linear' as const },
  ];

  it('holds the first and last values outside the keyframe range', () => {
    expect(evaluateKeyframes(frames, 0)).toBe(10);
    expect(evaluateKeyframes(frames, 9)).toBe(40);
  });

  it('returns exact values on keyframes', () => {
    expect(evaluateKeyframes(frames, 1)).toBe(10);
    expect(evaluateKeyframes(frames, 2)).toBe(20);
    expect(evaluateKeyframes(frames, 4)).toBe(40);
  });

  it('interpolates using the easing of the segment start', () => {
    expect(evaluateKeyframes(frames, 1.5)).toBe(15);
    expect(evaluateKeyframes(frames, 3)).toBe(20);
  });

  it('supports a single keyframe', () => {
    expect(evaluateKeyframes([{ time: 5, value: 7, easing: 'linear' }], 1)).toBe(7);
  });
});

describe('evaluateScene', () => {
  const demo = parseProject(geometricDemo).scenes[0] as Scene;

  it('is repeatable and independent of evaluation order', () => {
    const direct = evaluateScene(demo, 3.3);
    evaluateScene(demo, 7);
    evaluateScene(demo, 0.1);
    expect(evaluateScene(demo, 3.3)).toEqual(direct);
  });

  it('does not modify the scene', () => {
    const before = structuredClone(demo);
    evaluateScene(demo, 5, { zoomFactor: 2, layers: { square: 99 } });
    expect(demo).toEqual(before);
  });

  it('animates back to its starting values, so the frame after the last would match frame 0', () => {
    for (const track of demo.tracks) {
      const change =
        evaluateKeyframes(track.keyframes, demo.duration) - evaluateKeyframes(track.keyframes, 0);
      const remainder = track.property === 'rotation' ? change % 360 : change;
      expect(remainder, `${track.target}.${track.property}`).toBeCloseTo(0);
    }
  });

  it('clamps time to the scene', () => {
    expect(evaluateScene(demo, -5).time).toBe(0);
    expect(evaluateScene(demo, 99).frame).toBe(239);
    expect(evaluateScene(demo, 99).time).toBeCloseTo(239 / 30);
  });

  it('composes transforms through the hierarchy', () => {
    const scene = sceneOf({
      nodes: [
        { id: 'parent', shape: { kind: 'group' }, transform: { x: 100, rotation: 90 } },
        { id: 'child', parent: 'parent', shape: { kind: 'group' }, transform: { x: 10 } },
      ],
    });
    const child = worldOrigin(scene, 'child');
    expect(child.x).toBeCloseTo(100);
    expect(child.y).toBeCloseTo(10);
  });

  it('rotates and scales around the pivot', () => {
    const scene = sceneOf({
      nodes: [
        {
          id: 'n',
          shape: { kind: 'group' },
          transform: { x: 5, y: 5, rotation: 180, pivotX: 10, pivotY: 0 },
        },
      ],
    });
    const node = evaluateScene(scene, 0).nodes[0];
    if (!node) throw new Error('missing node');
    const pivot = applyToPoint(node.worldMatrix, { x: 10, y: 0 });
    expect(pivot.x).toBeCloseTo(5);
    expect(pivot.y).toBeCloseTo(5);
  });

  it('multiplies opacity down the hierarchy', () => {
    const scene = sceneOf({
      nodes: [
        { id: 'parent', shape: { kind: 'group' }, transform: { opacity: 0.5 } },
        { id: 'child', parent: 'parent', shape: { kind: 'group' }, transform: { opacity: 0.5 } },
      ],
    });
    expect(evaluateScene(scene, 0).nodes[1]?.worldOpacity).toBe(0.25);
  });

  it('orders siblings by layer, keeps ties in order and children above parents', () => {
    const scene = sceneOf({
      nodes: [
        { id: 'top', layer: 2, shape: { kind: 'group' } },
        { id: 'bottom', layer: 1, shape: { kind: 'group' } },
        { id: 'tie', layer: 1, shape: { kind: 'group' } },
        { id: 'child', parent: 'bottom', layer: 9, shape: { kind: 'group' } },
      ],
    });
    const order = (overrides = {}) => evaluateScene(scene, 0, overrides).nodes.map((n) => n.id);
    expect(order()).toEqual(['bottom', 'child', 'tie', 'top']);
    expect(order({ layers: { top: 0 } })).toEqual(['top', 'bottom', 'child', 'tie']);
  });

  describe('camera', () => {
    const scene = sceneOf({
      shots: [
        {
          id: 'first',
          start: 0,
          duration: 4,
          camera: { y: 7 },
          tracks: [
            {
              property: 'x',
              keyframes: [
                { time: 0, value: 0 },
                { time: 4, value: 40 },
              ],
            },
          ],
        },
        {
          id: 'second',
          start: 4,
          duration: 6,
          camera: { x: 500 },
          tracks: [
            {
              property: 'zoom',
              keyframes: [
                { time: 0, value: 1 },
                { time: 6, value: 4 },
              ],
            },
          ],
        },
      ],
    });

    it('evaluates camera tracks in shot-local time', () => {
      expect(evaluateScene(scene, 2).camera).toMatchObject({ x: 20, y: 7, zoom: 1 });
      expect(evaluateScene(scene, 7).camera).toMatchObject({ x: 500, zoom: 2.5 });
    });

    it('cuts between shots exactly at the boundary', () => {
      expect(evaluateScene(scene, 3.999).shotId).toBe('first');
      expect(evaluateScene(scene, 4).shotId).toBe('second');
      expect(evaluateScene(scene, 10).shotId).toBe('second');
    });

    it('applies viewing overrides on top of the animation', () => {
      const camera = evaluateScene(scene, 2, {
        cameraOffset: { x: 1, y: 2 },
        zoomFactor: 3,
      }).camera;
      expect(camera).toMatchObject({ x: 21, y: 9, zoom: 3 });
    });
  });
});
