import { describe, expect, it } from 'vitest';
import { parseProject, type ProjectInput } from '../../src/core/schema';
import { geometricDemo } from '../../src/demos/geometricDemo';

type SceneInput = ProjectInput['scenes'][number];

function projectWith(changes: Partial<SceneInput>): ProjectInput {
  return {
    schemaVersion: 1,
    id: 'test',
    name: 'Test',
    kind: 'technical-demo',
    scenes: [
      {
        id: 'scene',
        duration: 2,
        fps: 30,
        background: '#000000',
        safeArea: { x: 0, y: 0, width: 100, height: 100 },
        nodes: [{ id: 'a', shape: { kind: 'group' } }],
        shots: [{ id: 'shot', start: 0, duration: 2 }],
        ...changes,
      },
    ],
  };
}

describe('parseProject', () => {
  it('accepts a valid project and fills in defaults', () => {
    const scene = parseProject(projectWith({})).scenes[0];
    expect(scene?.tracks).toEqual([]);
    expect(scene?.nodes[0]?.transform).toMatchObject({ scaleX: 1, opacity: 1, pivotX: 0 });
    expect(scene?.shots[0]?.camera).toEqual({ x: 0, y: 0, zoom: 1, rotation: 0 });
  });

  it('accepts the bundled technical demo', () => {
    expect(parseProject(geometricDemo).kind).toBe('technical-demo');
  });

  it.each<[string, Partial<SceneInput>]>([
    [
      'duplicate node ids',
      {
        nodes: [
          { id: 'a', shape: { kind: 'group' } },
          { id: 'a', shape: { kind: 'group' } },
        ],
      },
    ],
    ['an unknown parent', { nodes: [{ id: 'a', parent: 'missing', shape: { kind: 'group' } }] }],
    [
      'a parent cycle',
      {
        nodes: [
          { id: 'a', parent: 'b', shape: { kind: 'group' } },
          { id: 'b', parent: 'a', shape: { kind: 'group' } },
        ],
      },
    ],
    [
      'a track on an unknown node',
      { tracks: [{ target: 'missing', property: 'x', keyframes: [{ time: 0, value: 0 }] }] },
    ],
    [
      'duplicate tracks',
      {
        tracks: [
          { target: 'a', property: 'x', keyframes: [{ time: 0, value: 0 }] },
          { target: 'a', property: 'x', keyframes: [{ time: 1, value: 0 }] },
        ],
      },
    ],
    [
      'unsorted keyframes',
      {
        tracks: [
          {
            target: 'a',
            property: 'x',
            keyframes: [
              { time: 1, value: 0 },
              { time: 0.5, value: 1 },
            ],
          },
        ],
      },
    ],
    [
      'equal keyframe times',
      {
        tracks: [
          {
            target: 'a',
            property: 'x',
            keyframes: [
              { time: 1, value: 0 },
              { time: 1, value: 1 },
            ],
          },
        ],
      },
    ],
    [
      'a keyframe after the scene',
      { tracks: [{ target: 'a', property: 'x', keyframes: [{ time: 3, value: 0 }] }] },
    ],
    ['shots that do not cover the scene', { shots: [{ id: 'shot', start: 0, duration: 1 }] }],
    [
      'a gap between shots',
      {
        shots: [
          { id: 's1', start: 0, duration: 1 },
          { id: 's2', start: 1.5, duration: 0.5 },
        ],
      },
    ],
    ['an invalid color', { background: 'red' }],
  ])('rejects %s', (_name, changes) => {
    expect(() => parseProject(projectWith(changes))).toThrow();
  });

  it('rejects unknown schema versions and unknown fields', () => {
    expect(() => parseProject({ ...projectWith({}), schemaVersion: 2 })).toThrow();
    expect(() => parseProject({ ...projectWith({}), extra: true })).toThrow();
  });
});
