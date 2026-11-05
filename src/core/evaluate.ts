import { applyEasing } from './easing';
import { IDENTITY, multiply, rotationDegrees, scaling, translation, type Mat2D } from './matrix';
import type { Camera, Keyframe, Rect, Scene, SceneNode, Shape, Shot, Transform } from './schema';
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
}

export interface EvaluatedNode {
  readonly id: string;
  readonly shape: Shape;
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

export function evaluateKeyframes(frames: readonly Keyframe[], time: number): number {
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (!first || !last) throw new Error('A track needs at least one keyframe');
  if (time <= first.time) return first.value;
  if (time >= last.time) return last.value;

  // Finds the last keyframe at or before `time`.
  let low = 0;
  let high = frames.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if ((frames[middle] as Keyframe).time <= time) low = middle;
    else high = middle;
  }
  const from = frames[low] as Keyframe;
  const to = frames[high] as Keyframe;
  const progress = (time - from.time) / (to.time - from.time);
  return from.value + (to.value - from.value) * applyEasing(from.easing, progress);
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
  const frame = Math.min(lastFrame(scene.duration, fps), Math.max(0, requestedFrame));

  const transforms = new Map<string, Transform>(
    scene.nodes.map((node) => [node.id, { ...node.transform }]),
  );
  for (const track of scene.tracks) {
    const transform = transforms.get(track.target);
    if (!transform) continue;
    const hold = resolveHold(scene, track.group, overrides, track.hold);
    const time = frameToTime(poseFrame(frame, hold), fps);
    transform[track.property] = evaluateKeyframes(track.keyframes, time);
  }

  const layerOf = (node: SceneNode) => overrides.layers?.[node.id] ?? node.layer;
  const childrenOf = new Map<string | undefined, SceneNode[]>();
  for (const node of scene.nodes) {
    const siblings = childrenOf.get(node.parent) ?? [];
    siblings.push(node);
    childrenOf.set(node.parent, siblings);
  }
  // Array.prototype.sort is stable, so equal layers keep declaration order.
  for (const siblings of childrenOf.values()) {
    siblings.sort((a, b) => layerOf(a) - layerOf(b));
  }

  const nodes: EvaluatedNode[] = [];
  const visit = (node: SceneNode, parentMatrix: Mat2D, parentOpacity: number): void => {
    const transform = transforms.get(node.id) ?? node.transform;
    const worldMatrix = multiply(parentMatrix, localMatrix(transform));
    const worldOpacity = parentOpacity * Math.min(1, Math.max(0, transform.opacity));
    nodes.push({
      id: node.id,
      shape: node.shape,
      layer: layerOf(node),
      worldMatrix,
      worldOpacity,
    });
    for (const child of childrenOf.get(node.id) ?? []) visit(child, worldMatrix, worldOpacity);
  };
  for (const root of childrenOf.get(undefined) ?? []) visit(root, IDENTITY, 1);

  const shot = shotAtFrame(scene, frame, fps);
  return {
    frame,
    time: frameToTime(frame, fps),
    shotId: shot.id,
    background: scene.background,
    safeArea: scene.safeArea,
    camera: evaluateCamera(scene, shot, frame, fps, overrides),
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
