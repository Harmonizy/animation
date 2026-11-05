import { describe, expect, it } from 'vitest';
import {
  evaluateFrame,
  evaluateKeyframes,
  evaluateScene,
  resolveHold,
} from '../../src/core/evaluate';
import { sampleExportFrames } from '../../src/core/exportSampling';
import { applyToPoint } from '../../src/core/matrix';
import { parseProject, type ProjectInput, type Scene } from '../../src/core/schema';
import { frameCount } from '../../src/core/timing';
import { geometricDemo } from '../../src/demos/geometricDemo';

type SceneInput = ProjectInput['scenes'][number];

/** Two nodes moving 1 world unit per frame at 24 fps, in different groups. */
function sceneOf(changes: Partial<SceneInput> = {}): Scene {
  const scene = parseProject({
    schemaVersion: 3,
    id: 'test',
    name: 'Test',
    kind: 'technical-demo',
    scenes: [
      {
        id: 'scene',
        duration: 2,
        fps: 24,
        exportFps: 24,
        background: '#000000',
        safeArea: { x: -50, y: -50, width: 100, height: 100 },
        nodes: [
          { id: 'a', shape: { kind: 'group' } },
          { id: 'b', shape: { kind: 'group' } },
        ],
        tracks: [
          {
            target: 'a',
            property: 'x',
            group: 'character',
            keyframes: [
              { time: 0, value: 0 },
              { time: 2, value: 48 },
            ],
          },
          {
            target: 'b',
            property: 'x',
            group: 'background',
            keyframes: [
              { time: 0, value: 0 },
              { time: 2, value: 48 },
            ],
          },
        ],
        shots: [
          {
            id: 'shot-1',
            start: 0,
            duration: 1,
            tracks: [
              {
                property: 'x',
                keyframes: [
                  { time: 0, value: 0 },
                  { time: 1, value: 24 },
                ],
              },
            ],
          },
          {
            id: 'shot-2',
            start: 1,
            duration: 1,
            tracks: [
              {
                property: 'x',
                keyframes: [
                  { time: 0, value: 100 },
                  { time: 1, value: 124 },
                ],
              },
            ],
          },
        ],
        ...changes,
      },
    ],
  }).scenes[0];
  if (!scene) throw new Error('missing scene');
  return scene;
}

const xOf = (scene: Scene, id: string, frame: number, overrides = {}) => {
  const node = evaluateFrame(scene, frame, overrides).nodes.find((n) => n.id === id);
  if (!node) throw new Error(`missing ${id}`);
  return applyToPoint(node.worldMatrix, { x: 0, y: 0 }).x;
};

const series = (scene: Scene, id: string, frames: number, overrides = {}) =>
  Array.from(
    { length: frames },
    (_, frame) => Math.round(xOf(scene, id, frame, overrides) * 1000) / 1000,
  );

describe('exposure holds', () => {
  it('moves every frame on ones', () => {
    expect(series(sceneOf(), 'a', 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('holds on twos, threes and fours', () => {
    const on = (character: number) => sceneOf({ exposure: { character } });
    expect(series(on(2), 'a', 6)).toEqual([0, 0, 2, 2, 4, 4]);
    expect(series(on(3), 'a', 7)).toEqual([0, 0, 0, 3, 3, 3, 6]);
    expect(series(on(4), 'a', 9)).toEqual([0, 0, 0, 0, 4, 4, 4, 4, 8]);
  });

  it('supports custom holds', () => {
    expect(series(sceneOf({ exposure: { character: 7 } }), 'a', 8)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 7,
    ]);
  });

  it('applies per group, leaving other groups alone', () => {
    const scene = sceneOf({ exposure: { character: 3 } });
    expect(series(scene, 'a', 4)).toEqual([0, 0, 0, 3]);
    expect(series(scene, 'b', 4)).toEqual([0, 1, 2, 3]);
  });

  it('lets a track override its group, and a viewing override beat both', () => {
    const scene = sceneOf({
      exposure: { character: 2 },
      tracks: [
        {
          target: 'a',
          property: 'x',
          group: 'character',
          hold: 4,
          keyframes: [
            { time: 0, value: 0 },
            { time: 2, value: 48 },
          ],
        },
      ],
    });
    expect(series(scene, 'a', 5)).toEqual([0, 0, 0, 0, 4]);
    expect(series(scene, 'a', 3, { exposure: { character: 1 } })).toEqual([0, 1, 2]);
    expect(resolveHold(scene, 'character')).toBe(2);
    expect(resolveHold(scene, 'character', {}, 4)).toBe(4);
    expect(resolveHold(scene, 'character', { exposure: { character: 1 } }, 4)).toBe(1);
  });

  it('holds the camera independently of objects', () => {
    const scene = sceneOf({ exposure: { camera: 3 } });
    const camera = (frame: number) => evaluateFrame(scene, frame).camera.x;
    expect([0, 1, 2, 3].map(camera)).toEqual([0, 0, 0, 3]);
    expect(series(scene, 'a', 3)).toEqual([0, 1, 2]);
  });

  it('starts a fresh camera pose on the first frame of every shot', () => {
    const scene = sceneOf({ exposure: { camera: 5 } });
    expect(evaluateFrame(scene, 23).camera.x).toBe(20);
    // Frame 24 is 4 frames into a hold if counted from frame 0, but it opens shot 2.
    expect(evaluateFrame(scene, 24).camera.x).toBe(100);
    expect(evaluateFrame(scene, 28).camera.x).toBe(100);
    expect(evaluateFrame(scene, 29).camera.x).toBe(105);
  });
});

describe('frame rate independence', () => {
  it('keeps values at the same time when the frame rate changes', () => {
    const scene = sceneOf();
    for (const fps of [12, 24, 30, 60] as const) {
      expect(xOf(scene, 'a', fps, { fps })).toBeCloseTo(24);
    }
  });

  it('changes how many distinct values appear per second', () => {
    const scene = sceneOf();
    const distinct = (fps: 12 | 24 | 60) =>
      new Set(Array.from({ length: 60 }, (_, i) => evaluateScene(scene, i / 60, { fps }).frame))
        .size;
    expect(distinct(12)).toBe(12);
    expect(distinct(24)).toBe(24);
    expect(distinct(60)).toBe(60);
  });

  it('cuts on the same frame the boundary falls on at every frame rate', () => {
    const scene = sceneOf();
    for (const fps of [12, 24, 25, 30, 60] as const) {
      expect(evaluateFrame(scene, fps - 1, { fps }).shotId).toBe('shot-1');
      expect(evaluateFrame(scene, fps, { fps }).shotId).toBe('shot-2');
    }
  });
});

describe('interpolation on the frame grid', () => {
  const frames = (easing: 'step' | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut') => [
    { time: 0, value: 0, easing },
    { time: 1, value: 1, easing },
  ];

  it('step holds until the next keyframe, then lands exactly on it', () => {
    expect(evaluateKeyframes(frames('step'), 23 / 24)).toBe(0);
    expect(evaluateKeyframes(frames('step'), 1)).toBe(1);
  });

  it('orders the eases as expected at the midpoint', () => {
    expect(evaluateKeyframes(frames('linear'), 0.5)).toBe(0.5);
    expect(evaluateKeyframes(frames('easeIn'), 0.5)).toBeCloseTo(0.125);
    expect(evaluateKeyframes(frames('easeOut'), 0.5)).toBeCloseTo(0.875);
    expect(evaluateKeyframes(frames('easeInOut'), 0.5)).toBeCloseTo(0.5);
    expect(evaluateKeyframes(frames('easeInOut'), 0.25)).toBeCloseTo(0.0625);
  });
});

describe('export sampling', () => {
  const demo = parseProject(geometricDemo).scenes[0] as Scene;

  it.each([
    [12, 96],
    [24, 192],
    [25, 200],
    [30, 240],
    [60, 480],
  ])('produces the right number of frames at %d fps', (fps, expected) => {
    expect([...sampleExportFrames(demo, fps)]).toHaveLength(expected);
  });

  it('defaults to the scene export frame rate', () => {
    expect([...sampleExportFrames(demo)]).toHaveLength(frameCount(demo.duration, demo.exportFps));
  });

  it('is identical across runs', () => {
    expect([...sampleExportFrames(demo, 24)]).toEqual([...sampleExportFrames(demo, 24)]);
  });

  it('matches direct evaluation of each frame when rates are equal', () => {
    const exported = [...sampleExportFrames(demo, demo.fps)];
    exported.forEach((frame, index) => {
      if (frame.frame !== index) expect.fail(`frame ${index}`);
    });
    expect(exported[100]).toEqual(evaluateFrame(demo, 100));
  });

  it('repeats project frames when exporting faster than the project rate', () => {
    const scene = sceneOf();
    const frames = [...sampleExportFrames(scene, 60)].slice(0, 6).map((frame) => frame.frame);
    expect(frames).toEqual([0, 0, 0, 1, 1, 2]);
  });

  it('skips project frames when exporting slower than the project rate', () => {
    const scene = sceneOf();
    const frames = [...sampleExportFrames(scene, 12)].slice(0, 3).map((frame) => frame.frame);
    expect(frames).toEqual([0, 2, 4]);
  });

  it('keeps exposure independent of export rate', () => {
    const scene = sceneOf({ exposure: { character: 2 } });
    const at = (exportFps: number, index: number) => {
      const frames = [...sampleExportFrames(scene, exportFps)];
      const node = frames[index]?.nodes.find((n) => n.id === 'a');
      return node?.worldMatrix[4];
    };
    // One second in, every export rate shows the same pose.
    expect(at(60, 60)).toBeCloseTo(24);
    expect(at(24, 24)).toBeCloseTo(24);
    expect(at(12, 12)).toBeCloseTo(24);
  });
});

describe('reproducibility', () => {
  const demo = parseProject(geometricDemo).scenes[0] as Scene;

  it('gives the same frame in any evaluation order', () => {
    const forward = Array.from({ length: 240 }, (_, frame) => evaluateFrame(demo, frame));
    const backward = Array.from({ length: 240 }, (_, i) => evaluateFrame(demo, 239 - i)).reverse();
    expect(backward).toEqual(forward);
  });

  it('clamps to the last frame, never past the timeline', () => {
    expect(evaluateFrame(demo, 9999).frame).toBe(239);
    expect(evaluateFrame(demo, -9).frame).toBe(0);
    expect(evaluateScene(demo, 8).frame).toBe(239);
  });
});
