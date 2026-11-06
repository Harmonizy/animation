import { Build, smooth, type Pt } from '../shared/build';
import { tk } from './palette';

/**
 * The shadow. It is not Ta's: his own shadow falls to the right, away from the window. This one
 * comes from behind the camera, where nothing can be seen, runs along the floor and climbs the
 * empty wall: too tall, arms too long, one of them reaching towards the door. It has no face and
 * its source is never shown.
 *
 * It is a single outline that morphs between keyed shapes (a shape track), so it grows and leans
 * like a cast shadow rather than sliding in as a cut-out. Every key uses the same points in the same
 * order; growth is the outline's points released upwards from the floor in turn.
 */

/** The full shadow on the wall, in room coordinates, clockwise from the floor nearest the camera. */
const FULL: readonly Pt[] = [
  [40, 990],
  [150, 760],
  [248, 520],
  [262, 300],
  [272, 60],
  [228, -120],
  [204, 80],
  [186, 72],
  [204, -200],
  [232, -392],
  [292, -432],
  [298, -522],
  [330, -566],
  [362, -524],
  [364, -440],
  [424, -402],
  [522, -306],
  [604, -166],
  [646, -92],
  [614, -62],
  [500, -238],
  [404, -262],
  [382, 60],
  [362, 300],
  [332, 520],
  [300, 760],
  [226, 990],
];

/** Where the shadow first appears: a sliver at the bottom of the frame, by the camera. */
const BASE: Pt = [130, 980];

/**
 * The shadow at `extent` (0 at the camera's feet, 1 fully up the wall). It lengthens from its base
 * the way a cast shadow does when its source moves: stretched first, then filling out in width.
 * `lean` bends the upper part sideways, as a shadow distorts crossing from floor to wall, and
 * `grow` makes it larger than the full shape.
 */
export function shadowAt(extent: number, lean = 0, grow = 1): Pt[] {
  const f = Math.max(0.02, extent) * grow;
  const widen = 0.35 + 0.65 * Math.min(1, extent);
  return FULL.map(([x, y]) => {
    const height = Math.max(0, Math.min(1, (BASE[1] - y) / (BASE[1] + 600)));
    return [
      BASE[0] + (x - BASE[0]) * widen * grow + lean * height,
      BASE[1] + (y - BASE[1]) * f,
    ] as const;
  });
}

export interface ShadowKey {
  readonly time: number;
  /** How far it has climbed: 0 at the floor by the camera, 1 fully up the wall. */
  readonly extent: number;
  readonly lean?: number;
  readonly grow?: number;
  readonly easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

/**
 * Adds the shadow under `parent`: a dense core and a softer, slightly larger halo that gives it a
 * blurred edge, both following the same keys.
 */
export function addShadow(
  b: Build,
  id: string,
  parent: string,
  keys: readonly ShadowKey[],
  depth: number,
): void {
  const first = keys[0];
  if (!first) return;
  const halo = (points: Pt[]): Pt[] =>
    points.map(([x, y]) => [300 + (x - 300) * 1.05, y - (y < 500 ? 8 : 0)]);
  const core = `${id}-core`;
  const soft = `${id}-halo`;
  const shape = (k: ShadowKey) => shadowAt(k.extent, k.lean ?? 0, k.grow ?? 1);
  b.add(
    soft,
    parent,
    { kind: 'path', d: smooth(halo(shape(first))), fill: tk('deepBlack') },
    { opacity: 0.35 },
    { depth },
  );
  b.add(
    core,
    parent,
    { kind: 'path', d: smooth(shape(first)), fill: tk('deepBlack') },
    { opacity: 0.88 },
    { depth: depth + 0.01 },
  );
  b.shapeTracks.push(
    {
      target: soft,
      group: 'secondary',
      keyframes: keys.map((k) => ({
        time: k.time,
        d: smooth(halo(shape(k))),
        easing: k.easing ?? 'linear',
      })),
    },
    {
      target: core,
      group: 'secondary',
      keyframes: keys.map((k) => ({
        time: k.time,
        d: smooth(shape(k)),
        easing: k.easing ?? 'linear',
      })),
    },
  );
}
