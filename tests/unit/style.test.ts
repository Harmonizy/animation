import { describe, expect, it } from 'vitest';
import {
  evaluateFrame,
  planeMatrix,
  toGrayscale,
  type EvaluationOverrides,
} from '../../src/core/evaluate';
import { nodeBounds, viewTransform } from '../../src/core/framing';
import { IDENTITY, applyToPoint, multiply } from '../../src/core/matrix';
import { parseProject, type ProjectInput, type Scene } from '../../src/core/schema';
import { flattenSvgPath, isValidSvgPath, parseSvgPath } from '../../src/core/svgPath';

type SceneInput = ProjectInput['scenes'][number];

function projectOf(changes: Partial<SceneInput>): ProjectInput {
  return {
    schemaVersion: 3,
    id: 'test',
    name: 'Test',
    kind: 'technical-demo',
    scenes: [
      {
        id: 'scene',
        duration: 4,
        fps: 24,
        exportFps: 24,
        background: '#102030',
        safeArea: { x: -50, y: -50, width: 100, height: 100 },
        nodes: [],
        shots: [{ id: 'shot', start: 0, duration: 4 }],
        ...changes,
      },
    ],
  };
}

const sceneOf = (changes: Partial<SceneInput>) =>
  parseProject(projectOf(changes)).scenes[0] as Scene;
const order = (scene: Scene, overrides: EvaluationOverrides = {}) =>
  evaluateFrame(scene, 0, overrides).nodes.map((node) => node.id);
const group = { kind: 'group' } as const;

describe('svg paths', () => {
  it('parses absolute and relative commands to absolute positions', () => {
    expect(parseSvgPath('M 1 2 L 3 4 l 1 1 H 10 v 2 Z')).toEqual([
      { type: 'move', x: 1, y: 2 },
      { type: 'line', x: 3, y: 4 },
      { type: 'line', x: 4, y: 5 },
      { type: 'line', x: 10, y: 5 },
      { type: 'line', x: 10, y: 7 },
      { type: 'close' },
    ]);
  });

  it('parses curves, compact number formatting and implicit repeats', () => {
    expect(parseSvgPath('M0,0C1,2,3,4,5,6q1 1 2 2')).toEqual([
      { type: 'move', x: 0, y: 0 },
      { type: 'cubic', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
      { type: 'quadratic', x1: 6, y1: 7, x: 7, y: 8 },
    ]);
    expect(parseSvgPath('M 0 0 10 10')[1]).toEqual({ type: 'line', x: 10, y: 10 });
    expect(parseSvgPath('M-1-2')[0]).toEqual({ type: 'move', x: -1, y: -2 });
  });

  it('continues from the subpath start after Z', () => {
    expect(parseSvgPath('M 5 5 L 9 9 Z l 1 1').at(-1)).toEqual({ type: 'line', x: 6, y: 6 });
  });

  it.each(['', 'L 1 1', 'M 1', 'M 1 1 A 1 1 0 0 0 2 2', 'M 1 1 L x', 'M 1 1 Z 3'])(
    'rejects %j',
    (d) => {
      expect(isValidSvgPath(d)).toBe(false);
    },
  );

  it('flattens curves through their end points and between their control points', () => {
    const points = flattenSvgPath('M 0 0 C 0 10 10 10 10 0');
    expect(points.at(-1)).toEqual({ x: 10, y: 0 });
    expect(Math.max(...points.map((point) => point.y))).toBeCloseTo(7.5);
  });

  it('uses the flattened outline for node bounds', () => {
    const scene = sceneOf({
      nodes: [{ id: 'p', shape: { kind: 'path', d: 'M 0 0 L 10 0 L 10 20 Z', fill: '#ffffff' } }],
    });
    const node = evaluateFrame(scene, 0).nodes[0];
    if (!node) throw new Error('missing node');
    expect(nodeBounds(node, IDENTITY)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 20 });
  });

  it('is validated by the schema', () => {
    expect(() =>
      sceneOf({ nodes: [{ id: 'p', shape: { kind: 'path', d: 'nope', fill: '#ffffff' } }] }),
    ).toThrow();
  });
});

describe('palette tokens', () => {
  const scene = sceneOf({
    palette: { sky: '#112233', subject: '#445566' },
    background: 'token:sky',
    nodes: [{ id: 'a', shape: { kind: 'rect', width: 1, height: 1, fill: 'token:subject' } }],
  });

  it('resolves tokens for fills and the background', () => {
    const frame = evaluateFrame(scene, 0);
    expect(frame.background).toBe('#112233');
    expect(frame.nodes[0]?.fill).toBe('#445566');
  });

  it('can be replaced without touching the scene', () => {
    const frame = evaluateFrame(scene, 0, { palette: { subject: '#ff0000' } });
    expect(frame.nodes[0]?.fill).toBe('#ff0000');
    expect(frame.background).toBe('#112233');
    expect(scene.palette['subject']).toBe('#445566');
  });

  it('keeps the same shape object when colors change, so geometry is shared', () => {
    const first = evaluateFrame(scene, 0).nodes[0];
    const second = evaluateFrame(scene, 0, { palette: { subject: '#ff0000' } }).nodes[0];
    expect(second?.shape).toBe(first?.shape);
  });

  it('rejects unknown tokens', () => {
    expect(() => sceneOf({ background: 'token:missing' })).toThrow();
    expect(() =>
      sceneOf({
        nodes: [{ id: 'a', shape: { kind: 'rect', width: 1, height: 1, fill: 'token:x' } }],
      }),
    ).toThrow();
  });
});

describe('display modes', () => {
  const scene = sceneOf({
    nodes: [
      { id: 'back', shape: { kind: 'rect', width: 1, height: 1, fill: '#ff0000' } },
      { id: 'figure', subject: true, shape: group },
      {
        id: 'limb',
        parent: 'figure',
        shape: { kind: 'rect', width: 1, height: 1, fill: '#00ff00' },
      },
    ],
  });

  it('shows only subject nodes in black on white for silhouette review', () => {
    const frame = evaluateFrame(scene, 0, { display: 'silhouette' });
    expect(frame.background).toBe('#ffffff');
    expect(frame.nodes.map((node) => node.id)).toEqual(['figure', 'limb']);
    expect(frame.nodes[1]?.fill).toBe('#000000');
  });

  it('converts every color to luma for grayscale review', () => {
    const frame = evaluateFrame(scene, 0, { display: 'grayscale' });
    expect(frame.nodes.find((node) => node.id === 'back')?.fill).toBe('#363636');
    expect(frame.nodes.find((node) => node.id === 'limb')?.fill).toBe('#b6b6b6');
    expect(frame.background).toBe(toGrayscale('#102030'));
  });

  it('computes luma with Rec. 709 weights', () => {
    expect(toGrayscale('#000000')).toBe('#000000');
    expect(toGrayscale('#ffffff')).toBe('#ffffff');
    expect(toGrayscale('#0000ff')).toBe('#121212');
  });
});

describe('draw order', () => {
  it('draws negative layers behind their parent', () => {
    const scene = sceneOf({
      nodes: [
        { id: 'torso', shape: group },
        { id: 'near', parent: 'torso', layer: 1, shape: group },
        { id: 'far', parent: 'torso', layer: -1, shape: group },
        { id: 'head', parent: 'torso', layer: 0, shape: group },
      ],
    });
    expect(order(scene)).toEqual(['far', 'torso', 'head', 'near']);
  });

  it('keeps a whole subtree together', () => {
    const scene = sceneOf({
      nodes: [
        { id: 'torso', shape: group },
        { id: 'far', parent: 'torso', layer: -1, shape: group },
        { id: 'far-hand', parent: 'far', shape: group },
      ],
    });
    expect(order(scene)).toEqual(['far', 'far-hand', 'torso']);
  });
});

describe('depth planes', () => {
  const planes = [
    { id: 'back', parallax: 0.25 },
    { id: 'mid', parallax: 1 },
    { id: 'front', parallax: 2 },
  ];
  const nodes = [
    { id: 'f', plane: 'front', layer: 0, shape: group },
    { id: 'm', plane: 'mid', layer: 9, shape: group },
    { id: 'b', plane: 'back', layer: 99, shape: group },
  ];

  /** Where the origin of `id` lands on a 100x100 viewport. */
  const screenPoint = (scene: Scene, id: string, overrides: EvaluationOverrides) => {
    const frame = evaluateFrame(scene, 0, overrides);
    const node = frame.nodes.find((candidate) => candidate.id === id);
    if (!node) throw new Error(`missing ${id}`);
    const view = viewTransform(frame.camera, frame.safeArea, { width: 100, height: 100 });
    return applyToPoint(multiply(view, node.worldMatrix), { x: 0, y: 0 });
  };

  it('orders roots by plane before layer', () => {
    expect(order(sceneOf({ planes, nodes }))).toEqual(['b', 'm', 'f']);
  });

  it('moves each plane in proportion to its parallax', () => {
    const scene = sceneOf({ planes, nodes });
    const moved = { cameraOffset: { x: 40, y: 0 } };
    expect(screenPoint(scene, 'b', moved).x).toBeCloseTo(50 - 10);
    expect(screenPoint(scene, 'm', moved).x).toBeCloseTo(50 - 40);
    expect(screenPoint(scene, 'f', moved).x).toBeCloseTo(50 - 80);
  });

  it('applies zoom in proportion to parallax', () => {
    const scene = sceneOf({
      planes,
      nodes: [{ id: 'b', plane: 'back', shape: group, transform: { x: 10 } }],
    });
    // Zoom 3 at parallax 0.25 appears as 1 + 2 * 0.25 = 1.5.
    expect(screenPoint(scene, 'b', { zoomFactor: 3 }).x).toBeCloseTo(50 + 10 * 1.5);
  });

  it('leaves a parallax of 1 matching plain world space exactly', () => {
    const matrix = planeMatrix(1, { x: 12, y: -7, zoom: 2.5, rotation: 0 });
    matrix.forEach((value, index) => expect(value).toBeCloseTo(IDENTITY[index] as number));
  });

  it('keeps a parallax of 0 fixed on screen', () => {
    const scene = sceneOf({
      planes: [{ id: 'sky', parallax: 0 }],
      nodes: [{ id: 's', plane: 'sky', shape: group }],
    });
    const point = screenPoint(scene, 's', { cameraOffset: { x: 500, y: 300 }, zoomFactor: 4 });
    expect(point.x).toBeCloseTo(50);
    expect(point.y).toBeCloseTo(50);
  });

  it('validates planes', () => {
    expect(() => sceneOf({ planes, nodes: [{ id: 'a', shape: group }] })).toThrow();
    expect(() => sceneOf({ planes, nodes: [{ id: 'a', plane: 'nope', shape: group }] })).toThrow();
    expect(() =>
      sceneOf({
        planes,
        nodes: [
          { id: 'a', plane: 'mid', shape: group },
          { id: 'b', parent: 'a', plane: 'mid', shape: group },
        ],
      }),
    ).toThrow();
    expect(() =>
      sceneOf({
        planes: [
          { id: 'x', parallax: 1 },
          { id: 'x', parallax: 1 },
        ],
        nodes: [],
      }),
    ).toThrow();
  });
});

describe('poses', () => {
  const nodes = [
    { id: 'arm', shape: group, transform: { rotation: 10, x: 5 } },
    { id: 'leg', shape: group },
  ];
  const poses = {
    stand: { arm: { rotation: 0 }, leg: { rotation: 0 } },
    reach: { arm: { rotation: 100 } },
  };
  const rotation = (scene: Scene, id: string, frame: number, overrides = {}) => {
    const node = evaluateFrame(scene, frame, overrides).nodes.find((n) => n.id === id);
    if (!node) throw new Error(`missing ${id}`);
    return (Math.atan2(node.worldMatrix[1], node.worldMatrix[0]) * 180) / Math.PI;
  };
  const twoPoses = (easing: 'linear' | 'step' = 'linear') =>
    sceneOf({
      nodes,
      poses,
      poseTracks: [
        {
          keyframes: [
            { time: 0, pose: 'stand', easing },
            { time: 2, pose: 'reach' },
          ],
        },
      ],
    });

  it('holds the first pose, blends, then holds the last', () => {
    const scene = twoPoses();
    expect(rotation(scene, 'arm', 0)).toBeCloseTo(0);
    expect(rotation(scene, 'arm', 24)).toBeCloseTo(50);
    expect(rotation(scene, 'arm', 48)).toBeCloseTo(100);
    expect(rotation(scene, 'arm', 90)).toBeCloseTo(100);
  });

  it('falls back to the node transform for values a pose does not set', () => {
    const scene = twoPoses();
    const arm = evaluateFrame(scene, 24).nodes.find((node) => node.id === 'arm');
    expect(arm?.worldMatrix[4]).toBeCloseTo(5);
    expect(rotation(scene, 'leg', 48)).toBeCloseTo(0);
  });

  it('supports hold blending between poses', () => {
    const scene = twoPoses('step');
    expect(rotation(scene, 'arm', 47)).toBeCloseTo(0);
    expect(rotation(scene, 'arm', 48)).toBeCloseTo(100);
  });

  it('follows group exposure', () => {
    const scene = twoPoses();
    const on = { exposure: { character: 4 } };
    expect(rotation(scene, 'arm', 3, on)).toBeCloseTo(0);
    expect(rotation(scene, 'arm', 4, on)).toBeCloseTo((4 / 48) * 100);
    expect(rotation(scene, 'arm', 7, on)).toBeCloseTo((4 / 48) * 100);
  });

  it('lets node tracks animate on top of a pose', () => {
    const scene = sceneOf({
      nodes,
      poses,
      poseTracks: [{ keyframes: [{ time: 0, pose: 'reach' }] }],
      tracks: [{ target: 'arm', property: 'rotation', keyframes: [{ time: 0, value: 33 }] }],
    });
    expect(rotation(scene, 'arm', 0)).toBeCloseTo(33);
  });

  it('validates pose references', () => {
    expect(() => sceneOf({ nodes, poses: { bad: { missing: { x: 1 } } } })).toThrow();
    expect(() =>
      sceneOf({ nodes, poses, poseTracks: [{ keyframes: [{ time: 0, pose: 'missing' }] }] }),
    ).toThrow();
    expect(() =>
      sceneOf({
        nodes,
        poses,
        poseTracks: [
          {
            keyframes: [
              { time: 1, pose: 'stand' },
              { time: 1, pose: 'reach' },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('schema migration', () => {
  it('upgrades version 2 projects unchanged in meaning', () => {
    const project = parseProject({ ...projectOf({}), schemaVersion: 2 });
    expect(project.schemaVersion).toBe(3);
    expect(project.scenes[0]?.planes).toEqual([]);
    expect(project.scenes[0]?.palette).toEqual({});
  });
});
