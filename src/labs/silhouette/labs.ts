import type { ProjectInput } from '../../core/schema';
import { STYLE_PALETTES } from '../../style/cinematicMinimalist';
import {
  BASIC_POSES,
  createMannequinNodes,
  poseValues,
  walkKeyframes,
  walkPoses,
  walkSpeed,
  type NodeInput,
  type PoseKeyframeInput,
} from './mannequin';

/** The three neutral laboratories: shapes and test figures only, with no story or characters. */

type SceneInput = ProjectInput['scenes'][number];

const SAFE_AREA = { x: -500, y: -500, width: 1000, height: 1000 };
const GROUND_Y = 300;
const WIDE = 8000;

const groundNode = (id: string, plane: string | undefined, y: number, fill: string): NodeInput => ({
  id,
  ...(plane === undefined ? {} : { plane }),
  shape: { kind: 'rect', width: WIDE, height: 2000, fill },
  transform: { y: y + 1000 },
});

function labProject(id: string, name: string, scene: Omit<SceneInput, 'id'>): ProjectInput {
  return {
    schemaVersion: 3,
    id,
    name,
    kind: 'technical-demo',
    scenes: [{ id, ...scene }],
  };
}

/** Lab 1: posture, weight and spacing using only primitive shapes. */
function geometricLab(): ProjectInput {
  const tallBase = { x: -210, y: GROUND_Y };
  const wideBase = { x: 280, y: GROUND_Y };
  const heights = { tallBody: 400, wideBody: 180 };

  return labProject('geometric', 'Geometric minimalism lab', {
    duration: 8,
    fps: 24,
    exportFps: 24,
    exposure: { character: 2 },
    background: 'token:sky',
    palette: STYLE_PALETTES.warm,
    safeArea: SAFE_AREA,
    nodes: [
      groundNode('ground', undefined, GROUND_Y, 'token:near'),
      { id: 'tall', subject: true, layer: 1, shape: { kind: 'group' }, transform: tallBase },
      {
        id: 'tall-body',
        parent: 'tall',
        shape: { kind: 'rect', width: 96, height: heights.tallBody, fill: 'token:subject' },
        // Pivots at its base, so it leans from the ground.
        transform: { pivotY: heights.tallBody / 2 },
      },
      {
        id: 'tall-head',
        parent: 'tall',
        shape: { kind: 'ellipse', radiusX: 58, radiusY: 58, fill: 'token:subject' },
        transform: { y: -(heights.tallBody + 72) },
      },
      { id: 'wide', subject: true, layer: 2, shape: { kind: 'group' }, transform: wideBase },
      {
        id: 'wide-body',
        parent: 'wide',
        shape: { kind: 'rect', width: 230, height: heights.wideBody, fill: 'token:subject' },
        transform: { pivotY: heights.wideBody / 2 },
      },
      {
        id: 'wide-head',
        parent: 'wide',
        shape: { kind: 'ellipse', radiusX: 46, radiusY: 46, fill: 'token:accent' },
        transform: { y: -(heights.wideBody + 56) },
      },
    ],
    poses: {
      'tall-still': { tall: { rotation: 0, x: tallBase.x } },
      'tall-lean': { tall: { rotation: 16, x: tallBase.x + 150 } },
      'tall-back': { tall: { rotation: -10, x: tallBase.x - 60 } },
      'wide-still': { wide: { y: GROUND_Y, scaleX: 1, scaleY: 1 } },
      'wide-squash': { wide: { y: GROUND_Y, scaleX: 1.28, scaleY: 0.62 } },
      'wide-stretch': { wide: { y: GROUND_Y - 40, scaleX: 0.84, scaleY: 1.28 } },
      'wide-air': { wide: { y: GROUND_Y - 210, scaleX: 0.98, scaleY: 1.04 } },
    },
    poseTracks: [
      {
        keyframes: [
          { time: 0, pose: 'tall-still' },
          { time: 1, pose: 'tall-still', easing: 'easeInOut' },
          { time: 2.4, pose: 'tall-lean' },
          { time: 4, pose: 'tall-lean', easing: 'easeOut' },
          { time: 4.5, pose: 'tall-back', easing: 'easeInOut' },
          { time: 5.5, pose: 'tall-back', easing: 'easeInOut' },
          { time: 7, pose: 'tall-still' },
        ],
      },
      {
        keyframes: [
          { time: 0, pose: 'wide-still' },
          { time: 3.2, pose: 'wide-still', easing: 'easeOut' },
          { time: 3.6, pose: 'wide-squash', easing: 'easeIn' },
          { time: 3.8, pose: 'wide-stretch', easing: 'easeOut' },
          { time: 4.2, pose: 'wide-air', easing: 'easeIn' },
          { time: 4.6, pose: 'wide-stretch', easing: 'easeOut' },
          { time: 4.75, pose: 'wide-squash', easing: 'easeOut' },
          { time: 5.2, pose: 'wide-still' },
        ],
      },
    ],
    shots: [
      { id: 'wide-shot', start: 0, duration: 3.2 },
      {
        id: 'closer-shot',
        start: 3.2,
        duration: 2.8,
        camera: { x: 40, y: 40, zoom: 1.08 },
      },
      {
        id: 'slow-pull-back',
        start: 6,
        duration: 2,
        tracks: [
          {
            property: 'zoom',
            keyframes: [
              { time: 0, value: 1.08, easing: 'easeInOut' },
              { time: 2, value: 1 },
            ],
          },
        ],
      },
    ],
  });
}

/** Lab 2: the jointed test mannequin, for posture and silhouette readability. */
function articulatedLab(): ProjectInput {
  const id = 'figure';
  const stride = 200;
  const stepDuration = 0.5;
  const walkStart = 5.2;
  const duration = 8;
  const speed = walkSpeed(stride, stepDuration);
  const start = -60;
  const end = start + speed * (duration - walkStart);

  const pose = (name: string): string => `${id}-${name}`;
  const hold = (time: number, name: string): PoseKeyframeInput => ({
    time,
    pose: pose(name),
    easing: 'easeInOut',
  });

  // Fence posts on the ground make the figure's travel, and the camera's, readable.
  const posts: NodeInput[] = Array.from({ length: 25 }, (_, index) => ({
    id: `post-${index}`,
    parent: 'posts',
    shape: { kind: 'rect', width: 18, height: 150, fill: 'token:far' },
    transform: { x: -1600 + index * 200, y: GROUND_Y - 75 },
  }));

  return labProject('articulated', 'Articulated silhouette lab', {
    duration,
    fps: 24,
    exportFps: 24,
    exposure: { character: 2 },
    background: 'token:sky',
    palette: STYLE_PALETTES.cool,
    safeArea: SAFE_AREA,
    planes: [{ id: 'stage', parallax: 1 }],
    nodes: [
      { id: 'posts', plane: 'stage', shape: { kind: 'group' } },
      ...posts,
      groundNode('ground', 'stage', GROUND_Y, 'token:mid'),
      ...createMannequinNodes({ id, plane: 'stage', groundY: GROUND_Y + 20, x: start, layer: 1 }),
    ],
    poses: {
      [pose('neutral')]: poseValues(id, BASIC_POSES.neutral),
      [pose('lean')]: poseValues(id, BASIC_POSES.lean),
      [pose('reach')]: poseValues(id, BASIC_POSES.reach),
      [pose('crouch')]: poseValues(id, BASIC_POSES.crouch),
      ...walkPoses(id, stride),
    },
    poseTracks: [
      {
        keyframes: [
          hold(0, 'neutral'),
          hold(0.6, 'neutral'),
          hold(1.2, 'lean'),
          hold(1.8, 'lean'),
          hold(2.3, 'neutral'),
          hold(2.9, 'reach'),
          hold(3.4, 'reach'),
          hold(3.8, 'crouch'),
          hold(4.4, 'crouch'),
          { time: walkStart - 0.2, pose: pose('neutral') },
          ...walkKeyframes(id, walkStart, duration, stepDuration),
        ],
      },
    ],
    tracks: [
      {
        target: id,
        property: 'x',
        keyframes: [
          { time: 0, value: start },
          { time: walkStart, value: start },
          { time: duration, value: end },
        ],
      },
    ],
    shots: [
      {
        id: 'full-figure',
        start: 0,
        duration: walkStart,
        camera: { x: start + 30, y: 10 },
      },
      {
        id: 'following',
        start: walkStart,
        duration: duration - walkStart,
        camera: { y: 10, zoom: 0.94 },
        tracks: [
          {
            property: 'x',
            keyframes: [
              { time: 0, value: start + 80 },
              { time: duration - walkStart, value: end - 40 },
            ],
          },
        ],
      },
    ],
  });
}

/** A rolling ridge line closed off below, from layered sines so it stays deterministic. */
function ridgePath(
  baseY: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  width = WIDE,
): string {
  const samples = 96;
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const x = -width / 2 + (index / samples) * width;
    const angle = (x / wavelength) * Math.PI * 2 + phase;
    const y =
      baseY +
      amplitude * (Math.sin(angle) * 0.6 + Math.sin(angle * 2.3 + 1.1) * 0.28) +
      amplitude * Math.sin(angle * 0.37 + 2) * 0.35;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M ${points.join(' L ')} L ${width / 2} 3000 L ${-width / 2} 3000 Z`;
}

/** Lab 3: cutout layers, parallax and flat fog around a walking test figure. */
function atmosphericLab(): ProjectInput {
  const id = 'figure';
  const stride = 150;
  const stepDuration = 0.6;
  const duration = 8;
  const speed = walkSpeed(stride, stepDuration);
  const start = -speed * (duration / 2);
  const end = -start;
  const cut = 4.5;
  const positionAt = (time: number) => start + speed * time;

  const fogDrift = (target: string, distance: number) => ({
    target,
    property: 'x' as const,
    group: 'background' as const,
    keyframes: [
      { time: 0, value: -distance },
      { time: duration, value: distance },
    ],
  });
  const fogBand = (
    bandId: string,
    plane: string,
    y: number,
    opacity: number,
    phase: number,
  ): NodeInput => ({
    id: bandId,
    plane,
    shape: { kind: 'path', d: ridgePath(y, 16, 1500, phase), fill: 'token:atmosphere' },
    transform: { opacity },
  });

  const pillars = (
    prefix: string,
    plane: string,
    fill: string,
    positions: readonly number[],
    width: number,
  ): NodeInput[] => [
    { id: prefix, plane, shape: { kind: 'group' } } as NodeInput,
    ...positions.map((x, index): NodeInput => ({
      id: `${prefix}-${index}`,
      parent: prefix,
      shape: {
        kind: 'path',
        d: `M ${-width * 0.4} -1200 L ${width * 0.4} -1200 L ${width * 0.5} 900 L ${-width * 0.5} 900 Z`,
        fill,
      },
      transform: { x },
    })),
  ];

  return labProject('atmospheric', 'Layered atmospheric cutout lab', {
    duration,
    fps: 24,
    exportFps: 24,
    exposure: { character: 2 },
    background: 'token:sky',
    palette: STYLE_PALETTES.warm,
    safeArea: SAFE_AREA,
    planes: [
      { id: 'sky', parallax: 0 },
      { id: 'far', parallax: 0.2 },
      { id: 'mid', parallax: 0.5 },
      { id: 'stage', parallax: 1 },
      { id: 'fore', parallax: 2 },
    ],
    nodes: [
      {
        id: 'light-source',
        plane: 'sky',
        shape: { kind: 'ellipse', radiusX: 150, radiusY: 150, fill: 'token:atmosphere' },
        transform: { x: 180, y: -150 },
      },
      {
        id: 'far-ridge',
        plane: 'far',
        shape: { kind: 'path', d: ridgePath(40, 90, 1700, 0.4), fill: 'token:far' },
      },
      fogBand('fog-far-1', 'far', 95, 0.5, 2.1),
      fogBand('fog-far-2', 'far', 150, 0.5, 4.2),
      {
        id: 'mid-ridge',
        plane: 'mid',
        shape: { kind: 'path', d: ridgePath(165, 70, 1200, 2.6), fill: 'token:mid' },
      },
      ...pillars('mid-pillar', 'mid', 'token:mid', [-1100, -640, -180, 420, 980, 1500], 54),
      fogBand('fog-mid-1', 'mid', 215, 0.45, 1.3),
      fogBand('fog-mid-2', 'mid', 260, 0.45, 3.4),
      groundNode('ground', 'stage', GROUND_Y, 'token:near'),
      ...createMannequinNodes({
        id,
        plane: 'stage',
        groundY: GROUND_Y + 25,
        x: start,
        layer: 1,
        scale: 0.86,
      }),
      // Foreground passes through quickly and rarely, so it adds depth without hiding the subject.
      ...pillars('fore-pillar', 'fore', 'token:foreground', [-1250, 1300], 110),
      {
        id: 'fore-mound',
        plane: 'fore',
        shape: { kind: 'path', d: ridgePath(470, 34, 900, 0.7), fill: 'token:foreground' },
      },
    ],
    poses: walkPoses(id, stride),
    poseTracks: [{ keyframes: walkKeyframes(id, 0, duration, stepDuration) }],
    tracks: [
      {
        target: id,
        property: 'x',
        keyframes: [
          { time: 0, value: start },
          { time: duration, value: end },
        ],
      },
      fogDrift('fog-far-1', 60),
      fogDrift('fog-far-2', -40),
      fogDrift('fog-mid-1', 90),
      fogDrift('fog-mid-2', -70),
    ],
    shots: [
      {
        id: 'wide-layers',
        start: 0,
        duration: cut,
        camera: { y: -10, zoom: 0.95 },
        tracks: [
          {
            property: 'x',
            keyframes: [
              { time: 0, value: positionAt(0) + 110 },
              { time: cut, value: positionAt(cut) + 40 },
            ],
          },
        ],
      },
      {
        id: 'closer-layers',
        start: cut,
        duration: duration - cut,
        camera: { y: 60, zoom: 1.08 },
        tracks: [
          {
            property: 'x',
            keyframes: [
              { time: 0, value: positionAt(cut) - 40 },
              { time: duration - cut, value: positionAt(duration) - 70 },
            ],
          },
        ],
      },
    ],
  });
}

export const STYLE_LABS = {
  geometric: { label: 'Geometric minimalism', build: geometricLab, showParts: false },
  articulated: { label: 'Articulated silhouette', build: articulatedLab, showParts: true },
  atmospheric: { label: 'Layered atmospheric', build: atmosphericLab, showParts: false },
} as const;

export type StyleLabId = keyof typeof STYLE_LABS;

export function isStyleLabId(value: string): value is StyleLabId {
  return Object.hasOwn(STYLE_LABS, value);
}
