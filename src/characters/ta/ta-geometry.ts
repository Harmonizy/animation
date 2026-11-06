import { limb, outline, translatePath } from '../harmonie/harmonie-geometry';
import { taPivot, type TaNode, type TaView } from './ta-rig';

/**
 * Ta's vector parts. Built from the brief's construction: an elliptical head, a short neck, a
 * tapered torso in a loose T-shirt, a trapezoid pelvis in shorts, segmented rounded limbs,
 * simplified hands and flat bare feet. No face is drawn in any view. Moonlight comes from the
 * bedroom window on screen left, so each view carries a thin rim of light on that side.
 */

export type TaColor = 'skin' | 'shirt' | 'shorts' | 'hair' | 'rim';

/** Ta's colours, from the film's palette. Skin and shirt are as moonlight renders them. */
export const TA_COLORS: Readonly<Record<TaColor, string>> = {
  skin: 'mutedBlue',
  shirt: 'moonlight',
  shorts: 'coldShadow',
  hair: 'deepBlack',
  rim: 'paleLight',
};

export interface TaPart {
  readonly id: string;
  readonly node: TaNode;
  readonly color: TaColor;
  readonly depth: number;
  readonly d: string;
  readonly opacity?: number;
}

type P = readonly [number, number] | readonly [number, number, 1];

const part = (
  id: string,
  node: TaNode,
  color: TaColor,
  depth: number,
  points: readonly P[],
  opacity?: number,
): TaPart => ({
  id,
  node,
  color,
  depth,
  d: outline(points),
  ...(opacity === undefined ? {} : { opacity }),
});

const at = (node: TaNode, view: TaView, points: readonly P[]) => {
  const p = taPivot(node, view);
  return translatePath(outline(points), p.x, p.y);
};

const LIMB = { upper: [17, 14], fore: [14, 11], thigh: [27, 19], shin: [19, 12] } as const;

/** A relaxed hand, drawn down from the wrist. */
const HAND_SIDE: P[] = [
  [-9, -4],
  [10, -4],
  [14, 18],
  [12, 44],
  [2, 60],
  [-8, 52],
  [-12, 26],
];
const HAND_BACK: P[] = [
  [-11, -4],
  [11, -4],
  [15, 20],
  [12, 46],
  [0, 60],
  [-12, 46],
  [-15, 20],
];
/** Bare feet, flat. The side foot points the way he faces (+x). */
const FOOT_SIDE: P[] = [
  [-14, -10],
  [10, -10],
  [24, 14],
  [58, 22, 1],
  [60, 30, 1],
  [-18, 30, 1],
  [-20, 12],
];
const FOOT_BACK: P[] = [
  [-13, -10],
  [13, -10],
  [16, 14],
  [15, 30, 1],
  [-15, 30, 1],
  [-16, 14],
];

function arm(view: TaView, side: 'left' | 'right', depth: number, hand: readonly P[]): TaPart[] {
  const u = `${side}UpperArm` as const;
  const f = `${side}Forearm` as const;
  const h = `${side}Hand` as const;
  const shoulder = taPivot(u, view);
  const elbow = taPivot(f, view);
  // The short sleeve: a loose cuff over the top of the upper arm.
  const sleeve =
    view === 'side'
      ? ([
          [-24, -14],
          [22, -14],
          [27, 40],
          [22, 92, 1],
          [-24, 92, 1],
          [-27, 40],
        ] as P[])
      : ([
          [-23, -2],
          [23, -2],
          [26, 40],
          [22, 90, 1],
          [-22, 90, 1],
          [-26, 40],
        ] as P[]);
  return [
    { id: `${side}-upper`, node: u, color: 'skin', depth, d: limb(shoulder, elbow, ...LIMB.upper) },
    { id: `${side}-sleeve`, node: u, color: 'shirt', depth: depth + 0.05, d: at(u, view, sleeve) },
    {
      id: `${side}-fore`,
      node: f,
      color: 'skin',
      depth: depth + 0.1,
      d: limb(elbow, taPivot(h, view), ...LIMB.fore),
    },
    { id: `${side}-hand`, node: h, color: 'skin', depth: depth + 0.2, d: at(h, view, hand) },
  ];
}

function leg(view: TaView, side: 'left' | 'right', depth: number, foot: readonly P[]): TaPart[] {
  const t = `${side}Thigh` as const;
  const s = `${side}Shin` as const;
  const f = `${side}Foot` as const;
  return [
    {
      id: `${side}-thigh`,
      node: t,
      color: 'skin',
      depth,
      d: limb(taPivot(t, view), taPivot(s, view), ...LIMB.thigh),
    },
    {
      id: `${side}-shin`,
      node: s,
      color: 'skin',
      depth: depth + 0.1,
      d: limb(taPivot(s, view), taPivot(f, view), ...LIMB.shin),
    },
    { id: `${side}-foot`, node: f, color: 'skin', depth: depth + 0.2, d: at(f, view, foot) },
  ];
}

function sideParts(): TaPart[] {
  const v = 'side';
  return [
    ...arm(v, 'left', 2, HAND_SIDE),
    ...leg(v, 'left', 4, FOOT_SIDE),
    ...leg(v, 'right', 6, FOOT_SIDE),
    part('shorts', 'pelvis', 'shorts', 10, [
      [-42, 440, 1],
      [38, 440, 1],
      [46, 520],
      [50, 584, 1],
      [-4, 590],
      [-46, 582, 1],
      [-50, 510],
    ]),
    // A loose sleeping T-shirt: rounded shoulders, a soft fall over the chest and belly.
    part('shirt', 'torso', 'shirt', 12, [
      [-18, 176],
      [24, 178],
      [42, 200],
      [50, 250],
      [52, 330],
      [54, 400],
      [52, 474, 1],
      [-48, 474, 1],
      [-50, 400],
      [-52, 300],
      [-50, 230],
      [-38, 192],
    ]),
    part(
      'shirt-rim',
      'torso',
      'rim',
      12.1,
      [
        [-40, 196],
        [-50, 232],
        [-52, 300],
        [-50, 400],
        [-47, 470, 1],
        [-42, 470, 1],
        [-45, 400],
        [-47, 300],
        [-45, 234],
        [-34, 200],
      ],
      0.55,
    ),
    part('neck', 'neck', 'skin', 11, [
      [-15, 128, 1],
      [17, 128, 1],
      [20, 188, 1],
      [-15, 188, 1],
    ]),
    part('head', 'head', 'skin', 14, [
      [8, 30],
      [44, 44],
      [60, 84],
      [56, 120],
      [36, 146],
      [6, 150],
      [-28, 138],
      [-44, 104],
      [-40, 60],
      [-22, 36],
    ]),
    // Short hair: a close cap over the top and back of the skull.
    part('hair', 'head', 'hair', 14.1, [
      [-8, 24],
      [30, 28],
      [52, 44],
      [57, 60, 1],
      [40, 54],
      [14, 50],
      [-8, 58],
      [-28, 82],
      [-38, 112],
      [-34, 132, 1],
      [-48, 112],
      [-50, 70],
      [-34, 38],
    ]),
    part(
      'head-rim',
      'head',
      'rim',
      14.2,
      [
        [-44, 70],
        [-46, 104],
        [-40, 126],
        [-34, 132],
        [-40, 104],
        [-39, 72],
      ],
      0.45,
    ),
    ...arm(v, 'right', 20, HAND_SIDE),
  ];
}

function backParts(): TaPart[] {
  const v = 'back';
  return [
    ...leg(v, 'left', 2, FOOT_BACK),
    ...leg(v, 'right', 2, FOOT_BACK),
    part('shorts', 'pelvis', 'shorts', 10, [
      [-66, 440, 1],
      [66, 440, 1],
      [72, 520],
      [74, 586, 1],
      [4, 590],
      [-4, 590],
      [-74, 586, 1],
      [-72, 520],
    ]),
    part(
      'shorts-seam',
      'pelvis',
      'hair',
      10.1,
      [
        [-2, 500, 1],
        [2, 500, 1],
        [3, 588, 1],
        [-3, 588, 1],
      ],
      0.5,
    ),
    ...arm(v, 'left', 6, HAND_BACK),
    ...arm(v, 'right', 6, HAND_BACK),
    // The back of the T-shirt, its shoulders sloping and a little rounded forward.
    part('shirt', 'torso', 'shirt', 12, [
      [-30, 176],
      [30, 176],
      [62, 184],
      [86, 204],
      [90, 240],
      [82, 300],
      [78, 400],
      [76, 476, 1],
      [-76, 476, 1],
      [-78, 400],
      [-82, 300],
      [-90, 240],
      [-86, 204],
      [-62, 184],
    ]),
    part(
      'shirt-rim',
      'torso',
      'rim',
      12.2,
      [
        [-62, 186],
        [-86, 206],
        [-90, 240],
        [-82, 300],
        [-78, 400],
        [-76, 470, 1],
        [-71, 470, 1],
        [-73, 400],
        [-77, 300],
        [-84, 242],
        [-80, 210],
        [-58, 190],
      ],
      0.5,
    ),
    part('neck', 'neck', 'skin', 11, [
      [-18, 128, 1],
      [18, 128, 1],
      [22, 190, 1],
      [-22, 190, 1],
    ]),
    part('head', 'head', 'skin', 14, [
      [0, 32],
      [36, 42],
      [50, 84],
      [44, 124],
      [24, 146],
      [0, 150],
      [-24, 146],
      [-44, 124],
      [-50, 84],
      [-36, 42],
    ]),
    part('ear-l', 'head', 'skin', 13.9, [
      [-46, 82],
      [-56, 86],
      [-56, 108],
      [-46, 112],
    ]),
    part('ear-r', 'head', 'skin', 13.9, [
      [46, 82],
      [56, 86],
      [56, 108],
      [46, 112],
    ]),
    part('hair', 'head', 'hair', 14.1, [
      [0, 26],
      [38, 34],
      [54, 70],
      [52, 104, 1],
      [36, 116],
      [14, 126],
      [0, 128],
      [-14, 126],
      [-36, 116],
      [-52, 104, 1],
      [-54, 70],
      [-38, 34],
    ]),
    part(
      'head-rim',
      'head',
      'rim',
      14.2,
      [
        [-50, 70],
        [-53, 100],
        [-46, 112],
        [-48, 96],
        [-46, 70],
      ],
      0.4,
    ),
  ];
}

export function taParts(view: TaView): TaPart[] {
  return (view === 'side' ? sideParts() : backParts()).sort((a, b) => a.depth - b.depth);
}
