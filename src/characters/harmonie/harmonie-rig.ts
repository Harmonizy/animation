/**
 * Harmonie's rig: stable node ids, the hierarchy, and every pivot.
 *
 * Coordinates are "character space": 800 units from the top of the head room (y = 0) to the soles
 * (y = 800), with x = 0 on the body's centre line. Left and right always mean Harmonie's own left
 * and right, never the viewer's.
 *
 * A pivot is the joint a node rotates around. Pivot heights are shared by every view, so the
 * proportions cannot drift between the turnaround drawings. Only the horizontal positions differ.
 */

export const HARMONIE_ID = 'CHR-001';
export const HARMONIE_NAME = 'Harmonie';

/** Normalised full-body height, in character-space units. */
export const HARMONIE_HEIGHT = 800;

export const RIG_NODE_IDS = [
  'root',
  'pelvis',
  'torso',
  'neck',
  'head',
  'hood',
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
  'cloak',
  'scarf',
  'satchel',
] as const;

export type RigNodeId = (typeof RIG_NODE_IDS)[number];

export const HARMONIE_VIEWS = ['front', 'threeQuarter', 'side', 'back'] as const;
export type HarmonieView = (typeof HARMONIE_VIEWS)[number];

export const VIEW_LABELS: Readonly<Record<HarmonieView, string>> = {
  front: 'Front',
  threeQuarter: 'Three-quarter',
  side: 'Side (left profile)',
  back: 'Back',
};

export interface RigNodeSpec {
  readonly parent: RigNodeId | null;
  /** Height of the pivot in character space, the same in every view. */
  readonly pivotY: number;
  /** Horizontal pivot position in each view. */
  readonly pivotX: Readonly<Record<HarmonieView, number>>;
  /** What the node is for, shown in documentation. */
  readonly role: string;
}

const centred = { front: 0, threeQuarter: 0, side: 0, back: 0 } as const;

/** Joint heights. Rounded numbers keep the construction diagram easy to read and to edit. */
export const JOINT_Y = {
  ground: 800,
  pelvis: 490,
  waist: 470,
  neckBase: 218,
  headBase: 178,
  collar: 222,
  shoulder: 240,
  elbow: 398,
  wrist: 548,
  hip: 512,
  knee: 636,
  ankle: 758,
  belt: 470,
} as const;

/**
 * The hierarchy. Cloth nodes hang from the body part that carries them, so they inherit its
 * motion and only add their own lag on top: the cloak and scarf from the collar, the hood from
 * the head and the satchel from the belt.
 */
export const HARMONIE_RIG: Readonly<Record<RigNodeId, RigNodeSpec>> = {
  root: {
    parent: null,
    pivotY: JOINT_Y.ground,
    pivotX: centred,
    role: 'Ground contact point. Moves and turns the whole character.',
  },
  pelvis: {
    parent: 'root',
    pivotY: JOINT_Y.pelvis,
    pivotX: centred,
    role: 'Centre of mass. Carries the bob of walks and runs.',
  },
  torso: {
    parent: 'pelvis',
    pivotY: JOINT_Y.waist,
    pivotX: centred,
    role: 'Bends at the waist. Scaled slightly for idle breathing.',
  },
  neck: {
    parent: 'torso',
    pivotY: JOINT_Y.neckBase,
    pivotX: centred,
    role: 'Base of the neck.',
  },
  head: {
    parent: 'neck',
    pivotY: JOINT_Y.headBase,
    pivotX: { front: 0, threeQuarter: -4, side: -2, back: 0 },
    role: 'Top of the neck. The faceless head turns and nods here.',
  },
  hood: {
    parent: 'head',
    pivotY: JOINT_Y.headBase,
    pivotX: { front: 0, threeQuarter: -4, side: -2, back: 0 },
    role: 'Follows the head, with its own lag for cloth follow-through.',
  },
  leftUpperArm: {
    parent: 'torso',
    pivotY: JOINT_Y.shoulder,
    pivotX: { front: 64, threeQuarter: 54, side: 2, back: -64 },
    role: 'Left shoulder.',
  },
  leftForearm: {
    parent: 'leftUpperArm',
    pivotY: JOINT_Y.elbow,
    pivotX: { front: 76, threeQuarter: 62, side: 4, back: -76 },
    role: 'Left elbow.',
  },
  leftHand: {
    parent: 'leftForearm',
    pivotY: JOINT_Y.wrist,
    pivotX: { front: 82, threeQuarter: 66, side: 0, back: -82 },
    role: 'Left wrist.',
  },
  rightUpperArm: {
    parent: 'torso',
    pivotY: JOINT_Y.shoulder,
    pivotX: { front: -64, threeQuarter: -44, side: 2, back: 64 },
    role: 'Right shoulder.',
  },
  rightForearm: {
    parent: 'rightUpperArm',
    pivotY: JOINT_Y.elbow,
    pivotX: { front: -76, threeQuarter: -50, side: 4, back: 76 },
    role: 'Right elbow.',
  },
  rightHand: {
    parent: 'rightForearm',
    pivotY: JOINT_Y.wrist,
    pivotX: { front: -82, threeQuarter: -54, side: 0, back: 82 },
    role: 'Right wrist.',
  },
  leftThigh: {
    parent: 'pelvis',
    pivotY: JOINT_Y.hip,
    pivotX: { front: 24, threeQuarter: 18, side: 0, back: -24 },
    role: 'Left hip.',
  },
  leftShin: {
    parent: 'leftThigh',
    pivotY: JOINT_Y.knee,
    pivotX: { front: 25, threeQuarter: 18, side: -2, back: -25 },
    role: 'Left knee.',
  },
  leftFoot: {
    parent: 'leftShin',
    pivotY: JOINT_Y.ankle,
    pivotX: { front: 26, threeQuarter: 20, side: 2, back: -26 },
    role: 'Left ankle.',
  },
  rightThigh: {
    parent: 'pelvis',
    pivotY: JOINT_Y.hip,
    pivotX: { front: -24, threeQuarter: -22, side: 0, back: 24 },
    role: 'Right hip.',
  },
  rightShin: {
    parent: 'rightThigh',
    pivotY: JOINT_Y.knee,
    pivotX: { front: -25, threeQuarter: -22, side: -2, back: 25 },
    role: 'Right knee.',
  },
  rightFoot: {
    parent: 'rightShin',
    pivotY: JOINT_Y.ankle,
    pivotX: { front: -26, threeQuarter: -22, side: 2, back: 26 },
    role: 'Right ankle.',
  },
  cloak: {
    parent: 'torso',
    pivotY: JOINT_Y.collar,
    pivotX: { front: 0, threeQuarter: 4, side: 8, back: 0 },
    role: 'Hangs from the collar. Lags behind the torso for follow-through.',
  },
  scarf: {
    parent: 'neck',
    pivotY: JOINT_Y.collar,
    pivotX: { front: 30, threeQuarter: 20, side: -30, back: -30 },
    role: 'Pivots at the knot on her left, so the tail swings from there.',
  },
  satchel: {
    parent: 'pelvis',
    pivotY: JOINT_Y.belt,
    pivotX: { front: -44, threeQuarter: -44, side: 38, back: 44 },
    role: 'Hangs from the belt on her right hip and swings with lag.',
  },
};

/** Pivot of a node in character space. */
export function pivotOf(node: RigNodeId, view: HarmonieView): { x: number; y: number } {
  const spec = HARMONIE_RIG[node];
  return { x: spec.pivotX[view], y: spec.pivotY };
}

/** Pivot of a node relative to its parent's pivot: the node's local translation at rest. */
export function localOffset(node: RigNodeId, view: HarmonieView): { x: number; y: number } {
  const spec = HARMONIE_RIG[node];
  const own = pivotOf(node, view);
  if (spec.parent === null) return own;
  const parent = pivotOf(spec.parent, view);
  return { x: own.x - parent.x, y: own.y - parent.y };
}

/** Nodes in an order where every parent comes before its children. */
export function rigOrder(): RigNodeId[] {
  const ordered: RigNodeId[] = [];
  const visit = (id: RigNodeId) => {
    if (ordered.includes(id)) return;
    const parent = HARMONIE_RIG[id].parent;
    if (parent !== null) visit(parent);
    ordered.push(id);
  };
  RIG_NODE_IDS.forEach(visit);
  return ordered;
}
