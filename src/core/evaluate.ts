import { applyEasing } from './easing';
import { IDENTITY, multiply, rotationDegrees, scaling, translation, type Mat2D } from './matrix';
import type { Camera, Keyframe, Rect, Scene, SceneNode, Shape, Shot, Transform } from './schema';

/** Temporary, non-destructive viewing changes. Scene data is never modified. */
export interface EvaluationOverrides {
  /** Added to the animated camera position. */
  readonly cameraOffset?: { readonly x: number; readonly y: number };
  /** Multiplies the animated camera zoom. */
  readonly zoomFactor?: number;
  /** Replaces the `layer` of the listed nodes. */
  readonly layers?: Readonly<Record<string, number>>;
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

export function activeShot(scene: Scene, time: number): Shot {
  const found = scene.shots.find((shot) => time < shot.start + shot.duration);
  const shot = found ?? scene.shots[scene.shots.length - 1];
  if (!shot) throw new Error(`Scene "${scene.id}" has no shots`);
  return shot;
}

function evaluateCamera(shot: Shot, sceneTime: number, overrides: EvaluationOverrides): Camera {
  const camera = { ...shot.camera };
  const localTime = sceneTime - shot.start;
  for (const track of shot.tracks) {
    camera[track.property] = evaluateKeyframes(track.keyframes, localTime);
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
 * Computes one frame as a pure function of its arguments: no clock, randomness or
 * retained state. Seeking to `time` and playing up to `time` therefore match exactly.
 */
export function evaluateScene(
  scene: Scene,
  time: number,
  overrides: EvaluationOverrides = {},
): FrameState {
  const clamped = Math.min(scene.duration, Math.max(0, time));

  const transforms = new Map<string, Transform>(
    scene.nodes.map((node) => [node.id, { ...node.transform }]),
  );
  for (const track of scene.tracks) {
    const transform = transforms.get(track.target);
    if (transform) transform[track.property] = evaluateKeyframes(track.keyframes, clamped);
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

  const shot = activeShot(scene, clamped);
  return {
    time: clamped,
    shotId: shot.id,
    background: scene.background,
    safeArea: scene.safeArea,
    camera: evaluateCamera(shot, clamped, overrides),
    nodes,
  };
}
