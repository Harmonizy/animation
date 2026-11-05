import { parseSvgPath } from '../../core/svgPath';
import type { HarmonieMaterialColor } from './harmonie-palette';
import { pivotOf, type HarmonieView, type RigNodeId } from './harmonie-rig';

/**
 * Harmonie's vector parts, one set per view. Every part is authored in character space at rest
 * (see harmonie-rig.ts) and belongs to one rig node. Limb parts are generated from the pivots,
 * so a limb always runs exactly from its joint to the next one and stays connected when posed.
 *
 * The views are drawn separately, not derived from each other by rotation: a turned body changes
 * which parts overlap, how wide they look and which side of an asymmetric costume is visible.
 */

export interface PartDef {
  /** Unique within a view, such as "hood-shell". */
  readonly id: string;
  readonly node: RigNodeId;
  readonly color: HarmonieMaterialColor;
  /** Draw order within the figure. Higher draws on top. */
  readonly depth: number;
  /** SVG path data in character space, using only M, L, C and Z. */
  readonly d: string;
}

type Smooth = readonly [number, number];
type Corner = readonly [number, number, 1];
type OutlinePoint = Smooth | Corner;

const round = (value: number) => Math.round(value * 10) / 10;
const pair = (x: number, y: number) => `${round(x)} ${round(y)}`;

/**
 * A closed outline through the points, with Catmull-Rom curves between smooth points. A corner
 * point gets no tangent, so the outline turns sharply there. This keeps the shapes geometric but
 * softly drawn, which is the balance the style asks for.
 */
export function outline(points: readonly OutlinePoint[]): string {
  const count = points.length;
  const at = (i: number) => points[((i % count) + count) % count] as OutlinePoint;
  const isCorner = (p: OutlinePoint) => p.length === 3;
  const first = at(0);
  let d = `M ${pair(first[0], first[1])}`;
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k1 = isCorner(p1) ? 0 : 1 / 6;
    const k2 = isCorner(p2) ? 0 : 1 / 6;
    const c1x = p1[0] + (p2[0] - p0[0]) * k1;
    const c1y = p1[1] + (p2[1] - p0[1]) * k1;
    const c2x = p2[0] - (p3[0] - p1[0]) * k2;
    const c2y = p2[1] - (p3[1] - p1[1]) * k2;
    d += ` C ${pair(c1x, c1y)} ${pair(c2x, c2y)} ${pair(p2[0], p2[1])}`;
  }
  return `${d} Z`;
}

const KAPPA = 0.5523;

/** A tapered capsule whose round ends are centred on two joints, so it can turn at either one. */
export function limb(
  a: { x: number; y: number },
  b: { x: number; y: number },
  radiusA: number,
  radiusB: number,
): string {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const nx = -uy;
  const ny = ux;
  const p = (cx: number, cy: number, along: number, across: number) =>
    pair(cx + ux * along + nx * across, cy + uy * along + ny * across);
  const ra = radiusA;
  const rb = radiusB;
  const k = KAPPA;
  return [
    `M ${p(a.x, a.y, 0, ra)}`,
    `L ${p(b.x, b.y, 0, rb)}`,
    `C ${p(b.x, b.y, rb * k, rb)} ${p(b.x, b.y, rb, rb * k)} ${p(b.x, b.y, rb, 0)}`,
    `C ${p(b.x, b.y, rb, -rb * k)} ${p(b.x, b.y, rb * k, -rb)} ${p(b.x, b.y, 0, -rb)}`,
    `L ${p(a.x, a.y, 0, -ra)}`,
    `C ${p(a.x, a.y, -ra * k, -ra)} ${p(a.x, a.y, -ra, -ra * k)} ${p(a.x, a.y, -ra, 0)}`,
    `C ${p(a.x, a.y, -ra, ra * k)} ${p(a.x, a.y, -ra * k, ra)} ${p(a.x, a.y, 0, ra)}`,
    'Z',
  ].join(' ');
}

/** Rewrites path data with every point moved, keeping only absolute M, L, C, Q and Z. */
export function transformPath(d: string, map: (x: number, y: number) => [number, number]): string {
  return parseSvgPath(d)
    .map((command) => {
      switch (command.type) {
        case 'move':
          return `M ${pair(...map(command.x, command.y))}`;
        case 'line':
          return `L ${pair(...map(command.x, command.y))}`;
        case 'cubic':
          return `C ${pair(...map(command.x1, command.y1))} ${pair(...map(command.x2, command.y2))} ${pair(...map(command.x, command.y))}`;
        case 'quadratic':
          return `Q ${pair(...map(command.x1, command.y1))} ${pair(...map(command.x, command.y))}`;
        case 'close':
          return 'Z';
      }
    })
    .join(' ');
}

export const translatePath = (d: string, dx: number, dy: number) =>
  transformPath(d, (x, y) => [x + dx, y + dy]);

const mirrorPoints = (points: readonly OutlinePoint[]): OutlinePoint[] =>
  points.map((p) => (p.length === 3 ? [-p[0], p[1], 1] : [-p[0], p[1]]));

/** Construction proportions from the art direction, in character space. */
export const PROPORTIONS = {
  head: { cx: 2, cy: 116.5, rx: 46, ry: 61.5, top: 55, bottom: 178 },
  hood: { top: 25, bottom: 196 },
  neck: { top: 172, bottom: 222 },
  torso: { top: 206, bottom: 476 },
  pelvis: { top: 456, bottom: 536 },
  arms: { top: 224, bottom: 557 },
  hands: { top: 542, bottom: 590 },
  legs: { top: 493, bottom: 767 },
  boots: { top: 734, bottom: 800 },
  cloak: { top: 198, bottom: 745 },
  scarf: { top: 192, bottom: 532 },
} as const;

interface LimbSize {
  readonly upperArm: readonly [number, number];
  readonly forearm: readonly [number, number];
  readonly thigh: readonly [number, number];
  readonly shin: readonly [number, number];
}

const LIMBS: LimbSize = {
  upperArm: [16, 12],
  forearm: [12, 9],
  thigh: [22, 15],
  shin: [15, 10],
};

/** Far limbs in a turned view are slightly slimmer, which reads as distance. */
const FAR_LIMBS: LimbSize = {
  upperArm: [15, 11],
  forearm: [11, 8.5],
  thigh: [20, 14],
  shin: [14, 9.5],
};

type Side = 'left' | 'right';

/** Gloved hands, drawn from the wrist pivot. */
const HAND_FRONT: OutlinePoint[] = [
  [-9, -6],
  [9, -6],
  [12, 12],
  [10, 30],
  [3, 42],
  [-6, 40],
  [-11, 26],
  [-12, 8],
];
const HAND_PROFILE: OutlinePoint[] = [
  [-8, -6],
  [8, -6],
  [11, 14],
  [7, 34],
  [-2, 42],
  [-10, 34],
  [-11, 14],
];

/** Boots, drawn from the ankle pivot. The shaft flares past the shin so the boot reads in silhouette. */
const BOOT_FRONT: OutlinePoint[] = [
  [-12, -24, 1],
  [12, -24, 1],
  [15, 10],
  [18, 32],
  [16, 42, 1],
  [-16, 42, 1],
  [-18, 32],
  [-15, 10],
];
const BOOT_BACK: OutlinePoint[] = [
  [-12, -24, 1],
  [12, -24, 1],
  [15, 10],
  [16, 34],
  [14, 42, 1],
  [-14, 42, 1],
  [-16, 34],
  [-15, 10],
];
/** Facing screen-left: toe towards -x, heel towards +x. */
export const BOOT_PROFILE: readonly OutlinePoint[] = [
  [-12, -24, 1],
  [12, -24, 1],
  [14, 18],
  [17, 34],
  [13, 42, 1],
  [-38, 42, 1],
  [-46, 36],
  [-41, 26],
  [-24, 17],
  [-13, 7],
];
const BOOT_THREE_QUARTER: OutlinePoint[] = [
  [-12, -24, 1],
  [12, -24, 1],
  [14, 14],
  [17, 34],
  [13, 42, 1],
  [-26, 42, 1],
  [-33, 35],
  [-27, 22],
  [-15, 9],
];

function at(node: RigNodeId, view: HarmonieView, shape: readonly OutlinePoint[]): string {
  const pivot = pivotOf(node, view);
  return translatePath(outline(shape), pivot.x, pivot.y);
}

function armParts(
  view: HarmonieView,
  side: Side,
  depth: number,
  sizes: LimbSize,
  hand: readonly OutlinePoint[],
): PartDef[] {
  const upper = `${side}UpperArm` as const;
  const fore = `${side}Forearm` as const;
  const handNode = `${side}Hand` as const;
  return [
    {
      id: `${side}-sleeve-upper`,
      node: upper,
      color: 'deepShadow',
      depth,
      d: limb(pivotOf(upper, view), pivotOf(fore, view), ...sizes.upperArm),
    },
    {
      id: `${side}-sleeve-fore`,
      node: fore,
      color: 'deepShadow',
      depth: depth + 0.1,
      d: limb(pivotOf(fore, view), pivotOf(handNode, view), ...sizes.forearm),
    },
    {
      id: `${side}-glove`,
      node: handNode,
      color: 'deepShadow',
      depth: depth + 0.2,
      d: at(handNode, view, hand),
    },
  ];
}

function legParts(
  view: HarmonieView,
  side: Side,
  depth: number,
  sizes: LimbSize,
  boot: readonly OutlinePoint[],
): PartDef[] {
  const thigh = `${side}Thigh` as const;
  const shin = `${side}Shin` as const;
  const foot = `${side}Foot` as const;
  return [
    {
      id: `${side}-trouser-thigh`,
      node: thigh,
      color: 'deepShadow',
      depth,
      d: limb(pivotOf(thigh, view), pivotOf(shin, view), ...sizes.thigh),
    },
    {
      id: `${side}-trouser-shin`,
      node: shin,
      color: 'deepShadow',
      depth: depth + 0.1,
      d: limb(pivotOf(shin, view), pivotOf(foot, view), ...sizes.shin),
    },
    {
      id: `${side}-boot`,
      node: foot,
      color: 'deepShadow',
      depth: depth + 0.2,
      d: at(foot, view, boot),
    },
  ];
}

const part = (
  id: string,
  node: RigNodeId,
  color: HarmonieMaterialColor,
  depth: number,
  points: readonly OutlinePoint[],
): PartDef => ({ id, node, color, depth, d: outline(points) });

/* ----------------------------------------------------------------------------------------------
 * Front view. Harmonie faces the viewer, so her left is on screen right (+x).
 * -------------------------------------------------------------------------------------------- */

const FRONT_HOOD: OutlinePoint[] = [
  [6, 22, 1],
  [26, 34],
  [46, 52],
  [62, 82],
  [71, 120],
  [69, 162],
  [58, 194, 1],
  [28, 202],
  [2, 200],
  [-26, 202],
  [-58, 194, 1],
  [-69, 162],
  [-71, 120],
  [-60, 80],
  [-40, 50],
  [-16, 31],
];

/** The shoulder mantle seen from the front or back: a natural shoulder slope, angled hem. */
const MANTLE_FRONT_LEFT: OutlinePoint[] = [
  [30, 196],
  [64, 205],
  [88, 226],
  [99, 262],
  [109, 322, 1],
  [60, 306, 1],
  [42, 270],
  [30, 236],
];
const MANTLE_FRONT_RIGHT: OutlinePoint[] = [
  [-30, 196],
  [-64, 205],
  [-88, 226],
  [-100, 264],
  [-111, 330, 1],
  [-60, 312, 1],
  [-42, 272],
  [-30, 236],
];

const FRONT_CLOAK: OutlinePoint[] = [
  [-50, 210],
  [50, 210],
  [76, 226],
  [92, 330],
  [105, 480],
  [111, 620],
  [114, 690, 1],
  [60, 700],
  [0, 712],
  [-60, 726],
  [-120, 745, 1],
  [-114, 620],
  [-104, 480],
  [-92, 330],
  [-76, 226],
];

function frontParts(): PartDef[] {
  return [
    part('cloak-back', 'cloak', 'slateBlue', 0, FRONT_CLOAK),
    ...legParts('front', 'left', 10, LIMBS, BOOT_FRONT),
    ...legParts('front', 'right', 10, LIMBS, BOOT_FRONT),
    part('trouser-seat', 'pelvis', 'deepShadow', 12, [
      [-36, 470, 1],
      [36, 470, 1],
      [34, 528],
      [0, 536],
      [-34, 528],
    ]),
    part('tunic-skirt', 'pelvis', 'mistTeal', 20, [
      [-44, 462, 1],
      [44, 462, 1],
      [54, 530],
      [61, 591, 1],
      [20, 595],
      [-20, 598],
      [-64, 595, 1],
      [-55, 530],
    ]),
    part('tunic-body', 'torso', 'mistTeal', 22, [
      [-30, 208],
      [2, 216],
      [30, 208],
      [56, 214],
      [68, 240],
      [60, 330],
      [50, 410],
      [44, 476, 1],
      [-44, 476, 1],
      [-50, 410],
      [-60, 330],
      [-68, 240],
      [-56, 214],
    ]),
    part('belt', 'pelvis', 'deepShadow', 24, [
      [-46, 456, 1],
      [46, 456, 1],
      [47, 474, 1],
      [-47, 474, 1],
    ]),
    part('satchel-bag', 'satchel', 'deepShadow', 26, [
      [-66, 474, 1],
      [-28, 474, 1],
      [-27, 504],
      [-30, 538],
      [-40, 548],
      [-58, 548],
      [-68, 538],
      [-70, 504],
    ]),
    part('satchel-buckle', 'satchel', 'amberGold', 26.1, [
      [-51, 496, 1],
      [-43, 496, 1],
      [-43, 508, 1],
      [-51, 508, 1],
    ]),
    part('neck', 'neck', 'deepShadow', 28, [
      [-16, 172, 1],
      [16, 172, 1],
      [17, 222, 1],
      [-17, 222, 1],
    ]),
    ...armParts('front', 'left', 30, LIMBS, HAND_FRONT),
    ...armParts('front', 'right', 30, LIMBS, HAND_FRONT),
    part('mantle-left', 'cloak', 'slateBlue', 32, MANTLE_FRONT_LEFT),
    part('mantle-right', 'cloak', 'slateBlue', 32, MANTLE_FRONT_RIGHT),
    part('scarf-tail', 'scarf', 'amberGold', 34, [
      [32, 238],
      [48, 240],
      [56, 300],
      [60, 380],
      [64, 460],
      [68, 522, 1],
      [52, 532, 1],
      [50, 460],
      [44, 380],
      [38, 300],
    ]),
    part('hood-shell', 'hood', 'slateBlue', 36, FRONT_HOOD),
    part('face', 'head', 'deepShadow', 38, [
      [-38, 88, 1],
      [-18, 77],
      [4, 72, 1],
      [24, 77],
      [42, 90, 1],
      [47, 118],
      [41, 150],
      [25, 172],
      [3, 180],
      [-19, 173],
      [-37, 152],
      [-44, 122],
    ]),
    part('scarf-wrap', 'scarf', 'amberGold', 40, [
      [-54, 200],
      [-20, 192],
      [20, 192],
      [54, 200],
      [58, 214],
      [52, 232],
      [20, 242],
      [-20, 242],
      [-52, 232],
      [-58, 214],
    ]),
    part('scarf-knot', 'scarf', 'amberGold', 41, [
      [26, 222],
      [44, 218],
      [53, 230],
      [47, 246],
      [31, 247],
      [24, 236],
    ]),
  ];
}

/* ----------------------------------------------------------------------------------------------
 * Three-quarter view. Turned towards screen left, so her left side (+x) is nearer.
 * -------------------------------------------------------------------------------------------- */

function threeQuarterParts(): PartDef[] {
  const v = 'threeQuarter';
  return [
    part('cloak-back', 'cloak', 'slateBlue', 0, [
      [-36, 212],
      [44, 210],
      [66, 226],
      [84, 320],
      [104, 470],
      [115, 620],
      [120, 700, 1],
      [70, 706],
      [20, 716],
      [-40, 728],
      [-98, 745, 1],
      [-94, 640],
      [-84, 480],
      [-74, 330],
      [-62, 230],
    ]),
    ...armParts(v, 'right', 4, FAR_LIMBS, HAND_FRONT),
    ...legParts(v, 'right', 8, FAR_LIMBS, BOOT_THREE_QUARTER),
    ...legParts(v, 'left', 10, LIMBS, BOOT_THREE_QUARTER),
    part('trouser-seat', 'pelvis', 'deepShadow', 12, [
      [-34, 470, 1],
      [30, 470, 1],
      [28, 528],
      [-2, 536],
      [-32, 528],
    ]),
    part('tunic-skirt', 'pelvis', 'mistTeal', 20, [
      [-40, 462, 1],
      [36, 462, 1],
      [46, 530],
      [54, 592, 1],
      [10, 596],
      [-30, 598],
      [-59, 596, 1],
      [-50, 530],
    ]),
    part('tunic-body', 'torso', 'mistTeal', 22, [
      [-32, 208],
      [-2, 216],
      [28, 208],
      [50, 214],
      [60, 240],
      [54, 330],
      [44, 410],
      [36, 476, 1],
      [-40, 476, 1],
      [-47, 410],
      [-55, 330],
      [-58, 240],
      [-50, 214],
    ]),
    part('belt', 'pelvis', 'deepShadow', 24, [
      [-42, 456, 1],
      [38, 456, 1],
      [39, 474, 1],
      [-43, 474, 1],
    ]),
    part('satchel-bag', 'satchel', 'deepShadow', 26, [
      [-66, 474, 1],
      [-36, 474, 1],
      [-34, 504],
      [-36, 538],
      [-44, 548],
      [-60, 548],
      [-68, 538],
      [-70, 504],
    ]),
    part('satchel-buckle', 'satchel', 'amberGold', 26.1, [
      [-53, 496, 1],
      [-46, 496, 1],
      [-46, 508, 1],
      [-53, 508, 1],
    ]),
    part('neck', 'neck', 'deepShadow', 28, [
      [-20, 172, 1],
      [12, 172, 1],
      [14, 222, 1],
      [-20, 222, 1],
    ]),
    part('scarf-tail', 'scarf', 'amberGold', 47, [
      [18, 238],
      [32, 240],
      [38, 300],
      [42, 380],
      [46, 460],
      [50, 522, 1],
      [34, 532, 1],
      [32, 460],
      [28, 380],
      [24, 300],
    ]),
    part('hood-shell', 'hood', 'slateBlue', 36, [
      [12, 25, 1],
      [38, 38],
      [60, 62],
      [72, 98],
      [74, 134],
      [70, 168],
      [58, 194, 1],
      [28, 202],
      [-4, 200],
      [-34, 202],
      [-60, 192, 1],
      [-66, 170],
      [-66, 130],
      [-62, 98],
      [-58, 78, 1],
      [-42, 50],
      [-16, 32],
    ]),
    part('face', 'head', 'deepShadow', 38, [
      [-52, 90, 1],
      [-32, 79],
      [-12, 76, 1],
      [6, 84],
      [20, 100],
      [24, 124],
      [18, 152],
      [4, 171],
      [-14, 180],
      [-34, 172],
      [-48, 150],
      [-55, 120],
    ]),
    part('scarf-wrap', 'scarf', 'amberGold', 48, [
      [-50, 200],
      [-16, 192],
      [20, 192],
      [52, 202],
      [58, 216],
      [50, 232],
      [16, 242],
      [-20, 241],
      [-48, 232],
      [-54, 216],
    ]),
    part('scarf-knot', 'scarf', 'amberGold', 49, [
      [12, 222],
      [30, 218],
      [38, 230],
      [32, 246],
      [16, 247],
      [10, 236],
    ]),
    ...armParts(v, 'left', 44, LIMBS, HAND_FRONT),
    part('mantle-right', 'cloak', 'slateBlue', 45, [
      [-24, 198],
      [-46, 206],
      [-62, 226],
      [-71, 262],
      [-79, 324, 1],
      [-46, 308, 1],
      [-38, 272],
      [-30, 236],
    ]),
    part('mantle-left', 'cloak', 'slateBlue', 46, [
      [22, 196],
      [50, 204],
      [76, 226],
      [87, 262],
      [97, 320, 1],
      [50, 306, 1],
      [34, 270],
      [22, 236],
    ]),
  ];
}

/* ----------------------------------------------------------------------------------------------
 * Side view: her left profile, facing screen left (-x). This is the animation rig's view.
 * -------------------------------------------------------------------------------------------- */

function sideParts(): PartDef[] {
  const v = 'side';
  return [
    part('cloak-back', 'cloak', 'slateBlue', 0, [
      [6, 206],
      [34, 210],
      [50, 236],
      [56, 300],
      [66, 420],
      [86, 560],
      [104, 700],
      [112, 745, 1],
      [64, 738],
      [30, 722],
      [0, 706],
      [-14, 694, 1],
      [-10, 600],
      [-6, 460],
      [-4, 330],
      [-6, 240],
    ]),
    ...armParts(v, 'right', 4, LIMBS, HAND_PROFILE),
    part('satchel-bag', 'satchel', 'deepShadow', 6, [
      [26, 478, 1],
      [50, 480, 1],
      [58, 500],
      [58, 532],
      [52, 548, 1],
      [30, 548, 1],
      [26, 520],
    ]),
    ...legParts(v, 'right', 8, LIMBS, BOOT_PROFILE),
    ...legParts(v, 'left', 10, LIMBS, BOOT_PROFILE),
    part('trouser-seat', 'pelvis', 'deepShadow', 12, [
      [-26, 470, 1],
      [24, 470, 1],
      [24, 528],
      [-26, 528],
    ]),
    part('tunic-skirt', 'pelvis', 'mistTeal', 20, [
      [-30, 462, 1],
      [28, 462, 1],
      [36, 520],
      [44, 600, 1],
      [4, 598],
      [-30, 592, 1],
      [-34, 530],
    ]),
    part('tunic-body', 'torso', 'mistTeal', 22, [
      [-16, 206],
      [-30, 216],
      [-38, 250],
      [-40, 300],
      [-36, 370],
      [-30, 430],
      [-28, 476, 1],
      [26, 476, 1],
      [30, 420],
      [34, 340],
      [36, 270],
      [30, 226],
      [16, 206],
    ]),
    part('belt', 'pelvis', 'deepShadow', 24, [
      [-32, 456, 1],
      [30, 456, 1],
      [31, 474, 1],
      [-33, 474, 1],
    ]),
    part('neck', 'neck', 'deepShadow', 28, [
      [-14, 170, 1],
      [14, 170, 1],
      [16, 222, 1],
      [-14, 222, 1],
    ]),
    part('scarf-tail', 'scarf', 'amberGold', 30, [
      [-44, 240],
      [-32, 242],
      [-36, 300],
      [-38, 380],
      [-38, 460],
      [-34, 522, 1],
      [-50, 530, 1],
      [-52, 460],
      [-52, 380],
      [-50, 300],
    ]),
    part('hood-shell', 'hood', 'slateBlue', 36, [
      [16, 25, 1],
      [-6, 32],
      [-28, 48],
      [-42, 68],
      [-48, 80, 1],
      [-40, 84],
      [-32, 110],
      [-26, 150],
      [-20, 186, 1],
      [4, 196],
      [30, 200],
      [50, 208, 1],
      [54, 180],
      [56, 140],
      [52, 100],
      [42, 62],
      [30, 40],
    ]),
    part('face', 'head', 'deepShadow', 38, [
      [-38, 86, 1],
      [-46, 104],
      [-48, 128],
      [-44, 152],
      [-36, 170],
      [-22, 184, 1],
      [-24, 160],
      [-28, 130],
      [-32, 104],
    ]),
    part('scarf-wrap', 'scarf', 'amberGold', 40, [
      [-34, 198],
      [-6, 192],
      [24, 194],
      [40, 202],
      [42, 218],
      [36, 234],
      [10, 240],
      [-20, 238],
      [-38, 230],
      [-42, 214],
    ]),
    part('scarf-knot', 'scarf', 'amberGold', 41, [
      [-44, 214],
      [-30, 212],
      [-24, 228],
      [-32, 244],
      [-46, 242],
      [-50, 228],
    ]),
    ...armParts(v, 'left', 44, LIMBS, HAND_PROFILE),
    part('mantle-left', 'cloak', 'slateBlue', 46, [
      [-16, 198],
      [-32, 212],
      [-42, 246],
      [-50, 302, 1],
      [-4, 310],
      [48, 324, 1],
      [50, 274],
      [44, 230],
      [26, 204],
    ]),
  ];
}

/* ----------------------------------------------------------------------------------------------
 * Back view. Her left is on screen left (-x), so the longer right hem is on screen right.
 * -------------------------------------------------------------------------------------------- */

function backParts(): PartDef[] {
  const v = 'back';
  return [
    ...armParts(v, 'left', 4, LIMBS, HAND_FRONT),
    ...armParts(v, 'right', 4, LIMBS, HAND_FRONT),
    ...legParts(v, 'left', 8, LIMBS, BOOT_BACK),
    ...legParts(v, 'right', 8, LIMBS, BOOT_BACK),
    part('trouser-seat', 'pelvis', 'deepShadow', 12, [
      [-36, 470, 1],
      [36, 470, 1],
      [34, 528],
      [0, 536],
      [-34, 528],
    ]),
    part('tunic-body', 'torso', 'mistTeal', 22, [
      [-30, 208],
      [30, 208],
      [56, 214],
      [68, 240],
      [60, 330],
      [50, 410],
      [44, 476, 1],
      [-44, 476, 1],
      [-50, 410],
      [-60, 330],
      [-68, 240],
      [-56, 214],
    ]),
    part('satchel-bag', 'satchel', 'deepShadow', 26, [
      [28, 474, 1],
      [66, 474, 1],
      [70, 504],
      [68, 538],
      [58, 548],
      [40, 548],
      [30, 538],
      [27, 504],
    ]),
    part('neck', 'neck', 'deepShadow', 28, [
      [-16, 172, 1],
      [16, 172, 1],
      [17, 222, 1],
      [-17, 222, 1],
    ]),
    part(
      'cloak-back',
      'cloak',
      'slateBlue',
      50,
      mirrorPoints([
        [-76, 226],
        [-40, 214],
        [0, 216],
        [40, 214],
        [76, 226],
        [92, 330],
        [105, 480],
        [111, 620],
        [114, 690, 1],
        [60, 700],
        [0, 712],
        [-60, 726],
        [-120, 745, 1],
        [-114, 620],
        [-104, 480],
        [-92, 330],
      ]),
    ),
    part('mantle-left', 'cloak', 'slateBlue', 51, mirrorPoints(MANTLE_FRONT_LEFT)),
    part('mantle-right', 'cloak', 'slateBlue', 51, mirrorPoints(MANTLE_FRONT_RIGHT)),
    part('mantle-back', 'cloak', 'slateBlue', 51.5, [
      [-40, 198],
      [40, 198],
      [62, 250],
      [56, 300],
      [0, 318, 1],
      [-56, 300],
      [-62, 250],
    ]),
    part('scarf-wrap', 'scarf', 'amberGold', 54, [
      [-56, 200],
      [-20, 194],
      [20, 194],
      [56, 200],
      [60, 216],
      [52, 232],
      [0, 240],
      [-52, 232],
      [-60, 216],
    ]),
    part('hood-shell', 'hood', 'slateBlue', 56, mirrorPoints(FRONT_HOOD)),
  ];
}

const BUILDERS: Readonly<Record<HarmonieView, () => PartDef[]>> = {
  front: frontParts,
  threeQuarter: threeQuarterParts,
  side: sideParts,
  back: backParts,
};

/** All parts of one view, sorted back to front. */
export function harmonieParts(view: HarmonieView): PartDef[] {
  return BUILDERS[view]().sort((a, b) => a.depth - b.depth);
}
