import type { PoseValues, ProjectInput } from '../../core/schema';
import { limb, outline } from './harmonie-geometry';

/**
 * Harmonie's gloved hand for close-ups: the same dark leather glove as the full figure, under
 * her undersleeve and the edge of her cloak, drawn large enough to fill a frame. The hand points
 * up its local -y axis from the wrist pivot at (0, 0), palm towards the viewer.
 *
 * Fingers curl by foreshortening: each finger has two segments that shorten along their length,
 * which reads as bending towards the palm when seen from above. Nothing is drawn for a face,
 * since this is a hand, and nothing here changes her design.
 */

type NodeInput = ProjectInput['scenes'][number]['nodes'][number];

const FINGERS = [
  { id: 'index', x: -58, angle: -8, lengths: [72, 60], radii: [17, 15, 12] },
  { id: 'middle', x: -20, angle: -3, lengths: [78, 66], radii: [17, 15, 12] },
  { id: 'ring', x: 20, angle: 3, lengths: [74, 60], radii: [16, 14, 11] },
  { id: 'little', x: 56, angle: 9, lengths: [58, 48], radii: [14, 12, 10] },
] as const;
const KNUCKLE_Y = -188;

const PALM: [number, number][] = [
  [-58, 0],
  [58, 0],
  [78, -60],
  [86, -128],
  [80, -182],
  [40, -198],
  [0, -202],
  [-42, -198],
  [-78, -182],
  [-88, -122],
  [-74, -50],
];

export interface GloveOptions {
  readonly prefix: string;
  readonly parent: string;
  readonly x?: number;
  readonly y?: number;
  readonly rotation?: number;
  readonly scale?: number;
  /** A token for rim light where a beam catches the glove's edge, or none. */
  readonly palmLight?: string;
  /** The hand's fill. Harmonie's glove by default; another character's skin when reused. */
  readonly skin?: string;
  /** The forearm's fill: an undersleeve, or the skin of a bare arm. */
  readonly sleeve?: string;
  /** The cloak edge over the forearm, or null for none. */
  readonly cloak?: string | null;
  readonly depth?: number;
}

const id = (prefix: string, part: string) => `${prefix}-${part}`;

export function gloveNodes(options: GloveOptions): NodeInput[] {
  const SKIN = options.skin ?? 'token:deepShadow';
  const { prefix, parent, depth = 0 } = options;
  const scale = options.scale ?? 1;
  const nodes: NodeInput[] = [
    {
      id: id(prefix, 'wrist'),
      parent,
      shape: { kind: 'group' },
      transform: {
        x: options.x ?? 0,
        y: options.y ?? 0,
        rotation: options.rotation ?? 0,
        scaleX: scale,
        scaleY: scale,
      },
      depth,
    },
  ];
  const shape = (part: string, of: string, d: string, fill: string, extra = 0, opacity = 1) =>
    nodes.push({
      id: id(prefix, part),
      parent: id(prefix, of),
      shape: { kind: 'path', d, fill },
      transform: { opacity },
      depth: depth + extra,
    });

  // Undersleeve and the slate cloak edge falling over the forearm.
  shape(
    'sleeve',
    'wrist',
    outline([
      [-66, -6],
      [64, -6],
      [80, 200],
      [92, 520],
      [-96, 520],
      [-82, 200],
    ]),
    options.sleeve ?? SKIN,
    0,
  );
  if (options.cloak !== null)
    shape(
      'cloak-edge',
      'wrist',
      // A fold of cloak over the top of the forearm, its hem cut at an angle above the wrist.
      outline([
        [-8, 70, 1],
        [92, 30, 1],
        [118, 180],
        [146, 520],
        [-20, 520],
        [-30, 300],
      ]),
      options.cloak ?? 'token:slateBlue',
      0.3,
    );
  shape('palm', 'wrist', outline(PALM), SKIN, 0.5);
  if (options.palmLight) {
    // Rim light: a thin edge where the beam from the upper left catches the leather.
    shape(
      'palm-light',
      'wrist',
      outline([
        [-88, -122],
        [-82, -170],
        [-64, -192, 1],
        [-74, -160],
        [-80, -118],
        [-70, -60],
        [-78, -64],
      ]),
      options.palmLight,
      0.55,
      0.8,
    );
  }

  nodes.push({
    id: id(prefix, 'thumb'),
    parent: id(prefix, 'wrist'),
    shape: { kind: 'group' },
    transform: { x: -74, y: -64, rotation: -52 },
    depth: depth + 0.6,
  });
  shape('thumb-base', 'thumb', limb({ x: 0, y: 0 }, { x: 0, y: -70 }, 22, 18), SKIN, 0.6);
  nodes.push({
    id: id(prefix, 'thumb-tip'),
    parent: id(prefix, 'thumb'),
    shape: { kind: 'group' },
    transform: { y: -70, rotation: 14 },
    depth: depth + 0.6,
  });
  shape('thumb-tip-shape', 'thumb-tip', limb({ x: 0, y: 0 }, { x: 0, y: -52 }, 18, 14), SKIN, 0.6);

  for (const finger of FINGERS) {
    const base = `${finger.id}`;
    nodes.push({
      id: id(prefix, base),
      parent: id(prefix, 'wrist'),
      shape: { kind: 'group' },
      transform: { x: finger.x, y: KNUCKLE_Y, rotation: finger.angle },
      depth: depth + 0.7,
    });
    shape(
      `${base}-1`,
      base,
      limb({ x: 0, y: 0 }, { x: 0, y: -finger.lengths[0] }, finger.radii[0], finger.radii[1]),
      SKIN,
      0.7,
    );
    nodes.push({
      id: id(prefix, `${base}-tip`),
      parent: id(prefix, base),
      shape: { kind: 'group' },
      transform: { y: -finger.lengths[0] },
      depth: depth + 0.7,
    });
    shape(
      `${base}-2`,
      `${base}-tip`,
      limb({ x: 0, y: 0 }, { x: 0, y: -finger.lengths[1] }, finger.radii[1], finger.radii[2]),
      SKIN,
      0.7,
    );
  }
  return nodes;
}

/**
 * The hand's openness, from 0 (curled over the palm) to 1 (open and relaxed), with an optional
 * spread of the fingers in degrees. Values are absolute, as scene poses store them.
 */
export function glovePose(prefix: string, open: number, spread = 0): Record<string, PoseValues> {
  const curl = 1 - Math.min(1, Math.max(0, open));
  const pose: Record<string, PoseValues> = {
    [id(prefix, 'thumb')]: { x: -74, y: -64, rotation: -52 + curl * 34 },
    [id(prefix, 'thumb-tip')]: { y: -70, rotation: 14 + curl * 30, scaleY: 1 - curl * 0.35 },
  };
  for (const [index, finger] of FINGERS.entries()) {
    const fan = (index - 1.5) * spread;
    pose[id(prefix, finger.id)] = {
      x: finger.x,
      y: KNUCKLE_Y,
      rotation: finger.angle * (1 - curl * 0.6) + fan,
      scaleY: 1 - curl * 0.5,
    };
    pose[id(prefix, `${finger.id}-tip`)] = {
      y: -finger.lengths[0],
      rotation: 0,
      scaleY: 1 - curl * 0.75,
    };
  }
  return pose;
}
