/**
 * Ta (CHR-002): rig ids, hierarchy and pivots. Character space is 800 units from the top of the
 * head room (y = 0) to the soles (y = 800), x = 0 on the centre line. Left and right are Ta's own.
 *
 * Views: `side` faces screen right (+x), so his right side is nearer. `back` shows him from behind,
 * so his left is on screen left.
 */

export const TA_ID = 'CHR-002';
export const TA_HEIGHT = 800;

export const TA_NODES = [
  'root',
  'pelvis',
  'torso',
  'neck',
  'head',
  'leftUpperArm',
  'leftForearm',
  'leftHand',
  'rightUpperArm',
  'rightForearm',
  'rightHand',
  'leftThigh',
  'leftShin',
  'leftFoot',
  'rightThigh',
  'rightShin',
  'rightFoot',
] as const;
export type TaNode = (typeof TA_NODES)[number];

export const TA_VIEWS = ['side', 'back'] as const;
export type TaView = (typeof TA_VIEWS)[number];

/** Joint heights, shared by every view. */
export const TA_JOINT_Y = {
  ground: 800,
  pelvis: 455,
  waist: 440,
  neckBase: 176,
  headBase: 140,
  shoulder: 206,
  elbow: 350,
  wrist: 478,
  hip: 462,
  knee: 624,
  ankle: 770,
} as const;

interface Spec {
  readonly parent: TaNode | null;
  readonly y: number;
  readonly x: Readonly<Record<TaView, number>>;
  /** The joint this node turns at, in the brief's words. */
  readonly joint: string;
}

const c = { side: 0, back: 0 } as const;

export const TA_RIG: Readonly<Record<TaNode, Spec>> = {
  root: { parent: null, y: TA_JOINT_Y.ground, x: c, joint: 'Root, at the ground' },
  pelvis: { parent: 'root', y: TA_JOINT_Y.pelvis, x: c, joint: 'Hips (centre)' },
  torso: { parent: 'pelvis', y: TA_JOINT_Y.waist, x: c, joint: 'Waist' },
  neck: { parent: 'torso', y: TA_JOINT_Y.neckBase, x: { side: 4, back: 0 }, joint: 'Neck' },
  head: { parent: 'neck', y: TA_JOINT_Y.headBase, x: { side: 6, back: 0 }, joint: 'Head' },
  leftUpperArm: {
    parent: 'torso',
    y: TA_JOINT_Y.shoulder,
    x: { side: -2, back: -80 },
    joint: 'Left shoulder',
  },
  leftForearm: {
    parent: 'leftUpperArm',
    y: TA_JOINT_Y.elbow,
    x: { side: -4, back: -88 },
    joint: 'Left elbow',
  },
  leftHand: {
    parent: 'leftForearm',
    y: TA_JOINT_Y.wrist,
    x: { side: 0, back: -92 },
    joint: 'Left wrist',
  },
  rightUpperArm: {
    parent: 'torso',
    y: TA_JOINT_Y.shoulder,
    x: { side: -2, back: 80 },
    joint: 'Right shoulder',
  },
  rightForearm: {
    parent: 'rightUpperArm',
    y: TA_JOINT_Y.elbow,
    x: { side: -4, back: 88 },
    joint: 'Right elbow',
  },
  rightHand: {
    parent: 'rightForearm',
    y: TA_JOINT_Y.wrist,
    x: { side: 0, back: 92 },
    joint: 'Right wrist',
  },
  leftThigh: { parent: 'pelvis', y: TA_JOINT_Y.hip, x: { side: 0, back: -32 }, joint: 'Left hip' },
  leftShin: {
    parent: 'leftThigh',
    y: TA_JOINT_Y.knee,
    x: { side: 4, back: -32 },
    joint: 'Left knee',
  },
  leftFoot: {
    parent: 'leftShin',
    y: TA_JOINT_Y.ankle,
    x: { side: 0, back: -32 },
    joint: 'Left ankle',
  },
  rightThigh: { parent: 'pelvis', y: TA_JOINT_Y.hip, x: { side: 0, back: 32 }, joint: 'Right hip' },
  rightShin: {
    parent: 'rightThigh',
    y: TA_JOINT_Y.knee,
    x: { side: 4, back: 32 },
    joint: 'Right knee',
  },
  rightFoot: {
    parent: 'rightShin',
    y: TA_JOINT_Y.ankle,
    x: { side: 0, back: 32 },
    joint: 'Right ankle',
  },
};

export const taPivot = (node: TaNode, view: TaView) => ({
  x: TA_RIG[node].x[view],
  y: TA_RIG[node].y,
});

export function taLocalOffset(node: TaNode, view: TaView) {
  const spec = TA_RIG[node];
  const own = taPivot(node, view);
  if (spec.parent === null) return own;
  const parent = taPivot(spec.parent, view);
  return { x: own.x - parent.x, y: own.y - parent.y };
}

export function taOrder(): TaNode[] {
  const ordered: TaNode[] = [];
  const visit = (id: TaNode) => {
    if (ordered.includes(id)) return;
    const parent = TA_RIG[id].parent;
    if (parent) visit(parent);
    ordered.push(id);
  };
  TA_NODES.forEach(visit);
  return ordered;
}
