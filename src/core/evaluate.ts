import { applyEasing, type EasingName } from './easing';
import { IDENTITY, multiply, rotationDegrees, scaling, translation, type Mat2D } from './matrix';
import type {
  Camera,
  Keyframe,
  PoseTrack,
  PoseValues,
  Rect,
  Scene,
  SceneNode,
  Shape,
  Shot,
  Transform,
} from './schema';
import { interpolatePaths } from './svgPath';
import {
  firstFrameAtOrAfter,
  frameToTime,
  lastFrame,
  poseFrame,
  poseIndex,
  timeToFrame,
  type ProjectFps,
  type TrackGroup,
} from './timing';

/**
 * Review modes. `silhouette` shows only subject nodes in black on white. `grayscale` converts
 * every color to its luma, for checking value structure.
 */
export type DisplayMode = 'normal' | 'silhouette' | 'grayscale';

/** Temporary, non-destructive viewing changes. Scene data is never modified. */
export interface EvaluationOverrides {
  /** Added to the animated camera position. */
  readonly cameraOffset?: { readonly x: number; readonly y: number };
  /** Multiplies the animated camera zoom. */
  readonly zoomFactor?: number;
  /** Replaces the `layer` of the listed nodes. */
  readonly layers?: Readonly<Record<string, number>>;
  /** Replaces the project frame rate. */
  readonly fps?: ProjectFps;
  /** Replaces the hold of every track in the listed groups, including per-track holds. */
  readonly exposure?: Readonly<Partial<Record<TrackGroup, number>>>;
  /** Replaces palette tokens. Tokens it does not list keep the scene's color. */
  readonly palette?: Readonly<Record<string, string>>;
  readonly display?: DisplayMode;
}

export interface GradientStop {
  readonly offset: number;
  readonly color: string;
  readonly opacity: number;
}

export interface EvaluatedNode {
  readonly id: string;
  readonly shape: Shape;
  /** The final color, with tokens resolved. Null for a node that draws nothing. */
  readonly fill: string | null;
  /** Gradient stops with tokens resolved, for gradient shapes only. */
  readonly gradient?: readonly GradientStop[];
  readonly layer: number;
  /** Maps the node's local space to world space. */
  readonly worldMatrix: Mat2D;
  /** Own opacity multiplied by all ancestors' opacity. */
  readonly worldOpacity: number;
}

/** A renderer-neutral description of one frame. Contains no renderer types. */
export interface FrameState {
  /** Project frame number, from 0. */
  readonly frame: number;
  /** Start time of that frame, in seconds. */
  readonly time: number;
  readonly shotId: string;
  readonly background: string;
  readonly safeArea: Rect;
  readonly camera: Camera;
  /** Back-to-front draw order. */
  readonly nodes: readonly EvaluatedNode[];
}

interface Segment<T> {
  readonly from: T;
  readonly to: T;
  /** Eased progress from `from` to `to`. */
  readonly amount: number;
}

/** Finds the two keys around `time`. Before the first and after the last, it holds that key. */
function segmentAt<T extends { readonly time: number; readonly easing: EasingName }>(
  frames: readonly T[],
  time: number,
): Segment<T> {
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (!first || !last) throw new Error('A track needs at least one keyframe');
  if (time <= first.time) return { from: first, to: first, amount: 0 };
  if (time >= last.time) return { from: last, to: last, amount: 0 };

  // Finds the last keyframe at or before `time`.
  let low = 0;
  let high = frames.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if ((frames[middle] as T).time <= time) low = middle;
    else high = middle;
  }
  const from = frames[low] as T;
  const to = frames[high] as T;
  return {
    from,
    to,
    amount: applyEasing(from.easing, (time - from.time) / (to.time - from.time)),
  };
}

export function evaluateKeyframes(frames: readonly Keyframe[], time: number): number {
  const { from, to, amount } = segmentAt(frames, time);
  return from.value + (to.value - from.value) * amount;
}

const POSE_PROPERTIES = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;

/** Applies the blended pose at `time`. Values a pose does not set come from `base`. */
function applyPoseTrack(
  scene: Scene,
  track: PoseTrack,
  time: number,
  transforms: Map<string, Transform>,
  base: ReadonlyMap<string, Transform>,
): void {
  const { from, to, amount } = segmentAt(track.keyframes, time);
  const fromPose = scene.poses[from.pose] ?? {};
  const toPose = scene.poses[to.pose] ?? {};
  for (const nodeId of new Set([...Object.keys(fromPose), ...Object.keys(toPose)])) {
    const transform = transforms.get(nodeId);
    const original = base.get(nodeId);
    if (!transform || !original) continue;
    const a: PoseValues = fromPose[nodeId] ?? {};
    const b: PoseValues = toPose[nodeId] ?? {};
    for (const property of POSE_PROPERTIES) {
      const start = a[property] ?? original[property];
      const end = b[property] ?? original[property];
      transform[property] = start + (end - start) * amount;
    }
  }
}

function shotAtFrame(scene: Scene, frame: number, fps: number): Shot {
  const found = scene.shots.find(
    (shot) => frame < firstFrameAtOrAfter(shot.start + shot.duration, fps),
  );
  const shot = found ?? scene.shots[scene.shots.length - 1];
  if (!shot) throw new Error(`Scene "${scene.id}" has no shots`);
  return shot;
}

/** The hold a group's tracks use, with `trackHold` being a track's own setting if it has one. */
export function resolveHold(
  scene: Scene,
  group: TrackGroup,
  overrides: EvaluationOverrides = {},
  trackHold?: number,
): number {
  return overrides.exposure?.[group] ?? trackHold ?? scene.exposure[group];
}

/** The pose number a group is showing on `frame`, counted as that group's tracks count it. */
export function posePosition(
  scene: Scene,
  group: TrackGroup,
  frame: number,
  overrides: EvaluationOverrides = {},
): number {
  const fps = overrides.fps ?? scene.fps;
  const anchor =
    group === 'camera' ? firstFrameAtOrAfter(shotAtFrame(scene, frame, fps).start, fps) : 0;
  return poseIndex(frame, resolveHold(scene, group, overrides), anchor);
}

function evaluateCamera(
  scene: Scene,
  shot: Shot,
  frame: number,
  fps: number,
  overrides: EvaluationOverrides,
): Camera {
  const camera = { ...shot.camera };
  // Poses count from the start of the shot, so every shot opens on a fresh pose.
  const shotStartFrame = firstFrameAtOrAfter(shot.start, fps);
  for (const track of shot.tracks) {
    const hold = resolveHold(scene, 'camera', overrides, track.hold);
    const sceneTime = frameToTime(poseFrame(frame, hold, shotStartFrame), fps);
    camera[track.property] = evaluateKeyframes(track.keyframes, sceneTime - shot.start);
  }
  return {
    ...camera,
    x: camera.x + (overrides.cameraOffset?.x ?? 0),
    y: camera.y + (overrides.cameraOffset?.y ?? 0),
    zoom: camera.zoom * (overrides.zoomFactor ?? 1),
  };
}

function localMatrix(t: Transform): Mat2D {
  // Applied right to left: pivot to origin, scale, rotate, move into place.
  return multiply(
    translation(t.x, t.y),
    multiply(
      rotationDegrees(t.rotation),
      multiply(scaling(t.scaleX, t.scaleY), translation(-t.pivotX, -t.pivotY)),
    ),
  );
}

const MIN_PLANE_ZOOM = 0.01;

/**
 * Places a depth plane by adjusting its world position, so renderers need no notion of planes.
 * Camera movement and zoom apply in proportion to `parallax`: the plane appears as if viewed by
 * a camera at `camera * parallax` with zoom `1 + (zoom - 1) * parallax`.
 */
export function planeMatrix(parallax: number, camera: Camera): Mat2D {
  const planeZoom = Math.max(MIN_PLANE_ZOOM, 1 + (camera.zoom - 1) * parallax);
  const scale = planeZoom / camera.zoom;
  return multiply(
    translation(camera.x, camera.y),
    multiply(scaling(scale, scale), translation(-camera.x * parallax, -camera.y * parallax)),
  );
}

/** Converts #rrggbb to its gray of equal luma, using Rec. 709 weights on the encoded values. */
export function toGrayscale(color: string): string {
  const value = Number.parseInt(color.slice(1), 16);
  const luma = Math.round(
    0.2126 * (value >> 16) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255),
  );
  const channel = luma.toString(16).padStart(2, '0');
  return `#${channel}${channel}${channel}`;
}

const SILHOUETTE_FILL = '#000000';
const SILHOUETTE_BACKGROUND = '#ffffff';

/**
 * Computes one project frame as a pure function of its arguments: no clock, randomness or
 * retained state. However a frame is reached, and whatever the display, the result is the same.
 */
export function evaluateFrame(
  scene: Scene,
  requestedFrame: number,
  overrides: EvaluationOverrides = {},
): FrameState {
  const fps = overrides.fps ?? scene.fps;
  const display = overrides.display ?? 'normal';
  const frame = Math.min(lastFrame(scene.duration, fps), Math.max(0, requestedFrame));

  const resolveColor = (value: string): string => {
    const color = value.startsWith('token:')
      ? (overrides.palette?.[value.slice(6)] ?? scene.palette[value.slice(6)])
      : value;
    if (color === undefined) throw new Error(`Unknown palette token "${value}"`);
    return display === 'grayscale' ? toGrayscale(color) : color;
  };

  const base = new Map(scene.nodes.map((node) => [node.id, node.transform]));
  const transforms = new Map<string, Transform>(
    scene.nodes.map((node) => [node.id, { ...node.transform }]),
  );
  for (const track of scene.poseTracks) {
    const hold = resolveHold(scene, track.group, overrides, track.hold);
    const time = frameToTime(poseFrame(frame, hold), fps);
    applyPoseTrack(scene, track, time, transforms, base);
  }
  // Node tracks come last, so they can animate on top of a pose.
  for (const track of scene.tracks) {
    const transform = transforms.get(track.target);
    if (!transform) continue;
    const hold = resolveHold(scene, track.group, overrides, track.hold);
    const time = frameToTime(poseFrame(frame, hold), fps);
    transform[track.property] = evaluateKeyframes(track.keyframes, time);
  }

  // Shape tracks morph paths between keyed outlines.
  const morphs = new Map<string, string>();
  for (const track of scene.shapeTracks) {
    const hold = resolveHold(scene, track.group, overrides, track.hold);
    const time = frameToTime(poseFrame(frame, hold), fps);
    const { from, to, amount } = segmentAt(track.keyframes, time);
    morphs.set(track.target, interpolatePaths(from.d, to.d, amount));
  }

  const shot = shotAtFrame(scene, frame, fps);
  const camera = evaluateCamera(scene, shot, frame, fps, overrides);

  const planeIndex = new Map(scene.planes.map((plane, index) => [plane.id, index]));
  const planeOrder = (node: SceneNode) =>
    node.plane === undefined ? 0 : (planeIndex.get(node.plane) ?? 0);
  const rootMatrix = (node: SceneNode): Mat2D => {
    const plane = scene.planes.find((candidate) => candidate.id === node.plane);
    return plane ? planeMatrix(plane.parallax, camera) : IDENTITY;
  };

  const layerOf = (node: SceneNode) => overrides.layers?.[node.id] ?? node.layer;
  const childrenOf = new Map<string | undefined, SceneNode[]>();
  for (const node of scene.nodes) {
    const siblings = childrenOf.get(node.parent) ?? [];
    siblings.push(node);
    childrenOf.set(node.parent, siblings);
  }
  // Array.prototype.sort is stable, so equal layers keep declaration order.
  for (const siblings of childrenOf.values()) {
    siblings.sort((a, b) => planeOrder(a) - planeOrder(b) || layerOf(a) - layerOf(b));
  }

  const shapeAt = (node: SceneNode): Shape => {
    const d = morphs.get(node.id);
    return d !== undefined && node.shape.kind === 'path' ? { ...node.shape, d } : node.shape;
  };

  const nodes: EvaluatedNode[] = [];
  const visit = (
    node: SceneNode,
    parentMatrix: Mat2D,
    parentOpacity: number,
    parentSubject: boolean,
  ): void => {
    const transform = transforms.get(node.id) ?? node.transform;
    const worldMatrix = multiply(parentMatrix, localMatrix(transform));
    const worldOpacity = parentOpacity * Math.min(1, Math.max(0, transform.opacity));
    const subject = parentSubject || node.subject;
    const children = childrenOf.get(node.id) ?? [];

    for (const child of children) {
      if (layerOf(child) < 0) visit(child, worldMatrix, worldOpacity, subject);
    }
    if (display !== 'silhouette' || subject) {
      let fill: string | null = null;
      if ('fill' in node.shape) {
        fill = display === 'silhouette' ? SILHOUETTE_FILL : resolveColor(node.shape.fill);
      }
      const gradient =
        node.shape.kind === 'gradient'
          ? node.shape.stops.map((stop) => ({
              offset: stop.offset,
              color: display === 'silhouette' ? SILHOUETTE_FILL : resolveColor(stop.color),
              opacity: stop.opacity,
            }))
          : undefined;
      nodes.push({
        id: node.id,
        shape: shapeAt(node),
        fill,
        ...(gradient ? { gradient } : {}),
        layer: layerOf(node),
        worldMatrix,
        worldOpacity,
      });
    }
    for (const child of children) {
      if (layerOf(child) >= 0) visit(child, worldMatrix, worldOpacity, subject);
    }
  };
  const roots = childrenOf.get(undefined) ?? [];
  const rootOf = new Map<string, number>();
  for (const [index, root] of roots.entries()) {
    const start = nodes.length;
    visit(root, rootMatrix(root), 1, false);
    for (const drawn of nodes.slice(start)) rootOf.set(drawn.id, index);
  }
  // Depth orders nodes within each root. The sort is stable, so equal depths keep tree order.
  const depthOf = new Map(scene.nodes.map((node) => [node.id, node.depth]));
  nodes.sort(
    (a, b) =>
      (rootOf.get(a.id) ?? 0) - (rootOf.get(b.id) ?? 0) ||
      (depthOf.get(a.id) ?? 0) - (depthOf.get(b.id) ?? 0),
  );

  return {
    frame,
    time: frameToTime(frame, fps),
    shotId: shot.id,
    background: display === 'silhouette' ? SILHOUETTE_BACKGROUND : resolveColor(scene.background),
    safeArea: scene.safeArea,
    camera,
    nodes,
  };
}

/** Evaluates the project frame showing at `time`. */
export function evaluateScene(
  scene: Scene,
  time: number,
  overrides: EvaluationOverrides = {},
): FrameState {
  return evaluateFrame(scene, timeToFrame(time, overrides.fps ?? scene.fps), overrides);
}
