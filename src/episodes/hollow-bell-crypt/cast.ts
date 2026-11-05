import {
  bodyPart,
  clothPart,
  pose,
  POSE_SHEET,
  type HarmoniePose,
  type PoseSpec,
} from '../../characters/harmonie/harmonie-poses';
import type { HarmonieView } from '../../characters/harmonie/harmonie-rig';
import { figureNodes, scenePose } from '../../characters/harmonie/harmonie-scene';
import type { Build } from './kit';

/**
 * Harmonie in the episode: the approved rig and geometry from the character library, unchanged,
 * placed into a shot. Her parts keep their own draw order, lifted by `depth` so she sits in the
 * right layer of the set.
 */

/** Her approved neutral standing pose. */
export const NEUTRAL_SPEC: PoseSpec = POSE_SHEET[0].spec;

export interface Casting {
  readonly id: string;
  readonly parent: string;
  readonly view: HarmonieView;
  readonly x: number;
  readonly groundY: number;
  readonly scale: number;
  readonly depth: number;
  readonly pose?: HarmoniePose;
  /** Replaces every fill, for a figure seen only as a shape through fog. */
  readonly fill?: string;
}

export function castHarmonie(b: Build, cast: Casting): void {
  const nodes = figureNodes({
    id: cast.id,
    view: cast.view,
    x: cast.x,
    groundY: cast.groundY,
    scale: cast.scale,
    ...(cast.pose ? { pose: cast.pose } : {}),
    ...(cast.fill ? { fill: cast.fill } : {}),
  });
  for (const node of nodes) {
    b.nodes.push({
      ...node,
      ...(node.parent === undefined ? { parent: cast.parent } : {}),
      depth: cast.depth + (node.depth ?? 0) / 100,
    });
  }
}

export interface TimedSpec {
  readonly time: number;
  readonly spec: PoseSpec;
  readonly easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

/**
 * Body and cloth as two pose tracks, so the cloth can be keyed on its own times for
 * follow-through. Body keys go on the character track (on twos); cloth keys on the secondary one.
 */
export function animateHarmonie(
  b: Build,
  id: string,
  view: HarmonieView,
  body: readonly TimedSpec[],
  cloth: readonly TimedSpec[],
): void {
  const keyframes = (keys: readonly TimedSpec[], part: 'body' | 'cloth') =>
    keys.map((key, i) => {
      const name = `${id}-${part}-${i}`;
      const full = pose(key.spec);
      b.poses[name] = scenePose(id, view, part === 'body' ? bodyPart(full) : clothPart(full));
      return { time: key.time, pose: name, easing: key.easing ?? 'linear' };
    });
  if (body.length > 0)
    b.poseTracks.push({ group: 'character', keyframes: keyframes(body, 'body') });
  if (cloth.length > 0)
    b.poseTracks.push({ group: 'secondary', keyframes: keyframes(cloth, 'cloth') });
}
