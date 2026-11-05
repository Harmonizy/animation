import type { PoseValues, ProjectInput } from '../../core/schema';

/**
 * A faceless test mannequin built from reusable SVG path parts. It is a neutral rig for checking
 * posture and silhouette, not a character. Each part is drawn from its joint at the local origin,
 * so rotating a part pivots it at that joint.
 */

type SceneInput = ProjectInput['scenes'][number];
export type NodeInput = SceneInput['nodes'][number];
export type PoseMap = Record<string, Record<string, PoseValues>>;
export type PoseKeyframeInput = NonNullable<SceneInput['poseTracks']>[number]['keyframes'][number];

const THIGH = 140;
const SHIN = 135;
const UPPER_ARM = 95;
const FOREARM = 90;
const HIP_Y = 14;
const FOOT_HEIGHT = 22;
const WAIST_Y = -10;
const NECK_Y = -165;
const SHOULDER_Y = -150;

/** Distance from a mannequin's root down to the ground, at scale 1. */
export const GROUND_OFFSET = HIP_Y + THIGH + SHIN + FOOT_HEIGHT;

/** A tapered, round-ended limb running from the origin down to (0, length). */
function limb(length: number, top: number, bottom: number): string {
  const topCurve = top * 1.3;
  const bottomCurve = length + bottom * 1.3;
  return (
    `M ${-top} 0 C ${-top} ${-topCurve} ${top} ${-topCurve} ${top} 0 ` +
    `L ${bottom} ${length} C ${bottom} ${bottomCurve} ${-bottom} ${bottomCurve} ${-bottom} ${length} Z`
  );
}

export const MANNEQUIN_PARTS = {
  pelvis: 'M -26 -24 C -37 -8 -37 18 -24 24 C -9 29 9 29 24 24 C 37 18 37 -8 26 -24 Z',
  torso: 'M -30 8 L -46 -140 C -48 -186 48 -186 46 -140 L 30 8 Z',
  head: 'M -13 4 L -13 -20 C -44 -32 -42 -92 0 -92 C 42 -92 44 -32 13 -20 L 13 4 Z',
  upperArm: limb(UPPER_ARM, 19, 14),
  forearm: limb(FOREARM, 14, 10),
  hand: 'M -11 -4 C -14 10 -12 30 0 34 C 12 30 14 10 11 -4 Z',
  thigh: limb(THIGH, 28, 18),
  shin: limb(SHIN, 18, 11),
  foot: 'M -15 -9 L 14 -9 L 54 12 Q 58 22 48 22 L -16 22 Q -24 20 -20 6 Z',
} as const;

export interface MannequinOptions {
  /** Prefix for its node ids and pose names. */
  readonly id: string;
  readonly plane?: string;
  readonly x?: number;
  readonly groundY: number;
  readonly scale?: number;
  readonly layer?: number;
  /** Set for figures mirrored to face the other way. */
  readonly facing?: 1 | -1;
}

/** Builds the part hierarchy. Far limbs use a negative layer to pass behind the body. */
export function createMannequinNodes(options: MannequinOptions): NodeInput[] {
  const { id, plane, x = 0, groundY, scale = 1, layer = 0, facing = 1 } = options;
  const part = (
    name: string,
    parent: string,
    d: string,
    fill: 'token:subject' | 'token:subjectFar',
    transform: { x?: number; y?: number } = {},
    partLayer = 0,
  ): NodeInput => ({
    id: `${id}-${name}`,
    parent: parent === id ? id : `${id}-${parent}`,
    layer: partLayer,
    shape: { kind: 'path', d, fill },
    transform,
  });
  const arm = (
    side: 'Near' | 'Far',
    sideLayer: number,
    fill: 'token:subject' | 'token:subjectFar',
  ) => [
    part(`upperArm${side}`, 'torso', MANNEQUIN_PARTS.upperArm, fill, { y: SHOULDER_Y }, sideLayer),
    part(`forearm${side}`, `upperArm${side}`, MANNEQUIN_PARTS.forearm, fill, { y: UPPER_ARM }),
    part(`hand${side}`, `forearm${side}`, MANNEQUIN_PARTS.hand, fill, { y: FOREARM }),
  ];
  const leg = (
    side: 'Near' | 'Far',
    sideLayer: number,
    fill: 'token:subject' | 'token:subjectFar',
  ) => [
    part(`thigh${side}`, 'pelvis', MANNEQUIN_PARTS.thigh, fill, { y: HIP_Y }, sideLayer),
    part(`shin${side}`, `thigh${side}`, MANNEQUIN_PARTS.shin, fill, { y: THIGH }),
    part(`foot${side}`, `shin${side}`, MANNEQUIN_PARTS.foot, fill, { y: SHIN }),
  ];

  return [
    {
      id,
      subject: true,
      layer,
      ...(plane === undefined ? {} : { plane }),
      shape: { kind: 'group' },
      transform: { x, y: groundY - GROUND_OFFSET * scale, scaleX: scale * facing, scaleY: scale },
    },
    part('pelvis', id, MANNEQUIN_PARTS.pelvis, 'token:subject'),
    ...leg('Far', -1, 'token:subjectFar'),
    ...leg('Near', 1, 'token:subject'),
    part('torso', 'pelvis', MANNEQUIN_PARTS.torso, 'token:subject', { y: WAIST_Y }),
    part('head', 'torso', MANNEQUIN_PARTS.head, 'token:subject', { y: NECK_Y }),
    ...arm('Far', -1, 'token:subjectFar'),
    ...arm('Near', 1, 'token:subject'),
  ];
}

interface FootTarget {
  /** Horizontal position relative to the root. Positive is the way the mannequin faces. */
  readonly x: number;
  /** Height of the ankle above its resting height. */
  readonly lift?: number;
  /** Extra rotation of the foot, in degrees. */
  readonly toe?: number;
}

export interface PoseSpec {
  readonly pelvisY: number;
  readonly torso: number;
  readonly head: number;
  /** Upper arm and forearm rotations. Negative raises the arm forwards. */
  readonly armNear: readonly [number, number];
  readonly armFar: readonly [number, number];
  readonly footNear: FootTarget;
  readonly footFar: FootTarget;
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

/** Two-bone inverse kinematics, solved once when a pose is built. The knee bends forwards. */
function legRotations(pelvisY: number, foot: FootTarget) {
  const dx = foot.x;
  const dy = THIGH + SHIN - (foot.lift ?? 0) - pelvisY;
  const reach = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.5);
  const toward = Math.atan2(dx, dy);
  const thighOffset = Math.acos((THIGH ** 2 + reach ** 2 - SHIN ** 2) / (2 * THIGH * reach));
  const shinOffset = Math.acos((SHIN ** 2 + reach ** 2 - THIGH ** 2) / (2 * SHIN * reach));
  const thigh = -degrees(toward + thighOffset);
  const shin = degrees(thighOffset + shinOffset);
  return { thigh, shin, foot: -(thigh + shin) + (foot.toe ?? 0) };
}

/** Turns a pose description into per-part values for one mannequin. */
export function poseValues(id: string, spec: PoseSpec): Record<string, PoseValues> {
  const near = legRotations(spec.pelvisY, spec.footNear);
  const far = legRotations(spec.pelvisY, spec.footFar);
  return {
    [`${id}-pelvis`]: { y: spec.pelvisY },
    [`${id}-torso`]: { rotation: spec.torso },
    [`${id}-head`]: { rotation: spec.head },
    [`${id}-upperArmNear`]: { rotation: spec.armNear[0] },
    [`${id}-forearmNear`]: { rotation: spec.armNear[1] },
    [`${id}-upperArmFar`]: { rotation: spec.armFar[0] },
    [`${id}-forearmFar`]: { rotation: spec.armFar[1] },
    [`${id}-thighNear`]: { rotation: near.thigh },
    [`${id}-shinNear`]: { rotation: near.shin },
    [`${id}-footNear`]: { rotation: near.foot },
    [`${id}-thighFar`]: { rotation: far.thigh },
    [`${id}-shinFar`]: { rotation: far.shin },
    [`${id}-footFar`]: { rotation: far.foot },
  };
}

export const BASIC_POSES = {
  // Limbs stay clear of the body, so the pose still reads when filled solid.
  neutral: {
    pelvisY: 8,
    torso: 3,
    head: -2,
    armNear: [-20, -24],
    armFar: [22, -10],
    footNear: { x: 40 },
    footFar: { x: -36 },
  },
  lean: {
    pelvisY: 12,
    torso: 22,
    head: -8,
    armNear: [-26, -22],
    armFar: [-14, -28],
    footNear: { x: 46 },
    footFar: { x: -34 },
  },
  reach: {
    pelvisY: 0,
    torso: -8,
    head: -24,
    armNear: [-165, -10],
    armFar: [18, -8],
    footNear: { x: 12, lift: 12, toe: 22 },
    footFar: { x: -26 },
  },
  crouch: {
    pelvisY: 118,
    torso: 44,
    head: -30,
    armNear: [-52, -58],
    armFar: [-30, -64],
    footNear: { x: 66 },
    footFar: { x: -40 },
  },
} as const satisfies Record<string, PoseSpec>;

const WALK_KEYS_PER_STEP = 4;
const SWING_LIFT = [0, 40, 34, 12] as const;
const PELVIS_BOB = [16, 11, 3, 7] as const;

/** One foot through a full cycle of eight keys: planted going back, then swinging forwards. */
function walkFoot(key: number, stride: number): FootTarget {
  const k = key % (WALK_KEYS_PER_STEP * 2);
  if (k < WALK_KEYS_PER_STEP) return { x: stride / 2 - (stride * k) / WALK_KEYS_PER_STEP };
  const swing = k - WALK_KEYS_PER_STEP;
  return {
    x: -stride / 2 + (stride * swing) / WALK_KEYS_PER_STEP,
    lift: SWING_LIFT[swing] ?? 0,
    toe: swing === 1 ? 30 : 0,
  };
}

/** Eight poses making one walk cycle, for a foot planted at constant speed. */
export function walkPoses(id: string, stride: number): PoseMap {
  const poses: PoseMap = {};
  for (let key = 0; key < WALK_KEYS_PER_STEP * 2; key++) {
    const near = walkFoot(key, stride);
    const far = walkFoot(key + WALK_KEYS_PER_STEP, stride);
    const swing = near.x / (stride / 2);
    poses[`${id}-walk-${key}`] = poseValues(id, {
      pelvisY: PELVIS_BOB[key % WALK_KEYS_PER_STEP] ?? 0,
      torso: 6,
      head: -4,
      armNear: [24 * swing, -16 - 8 * Math.max(0, -swing)],
      armFar: [-24 * swing, -16 - 8 * Math.max(0, swing)],
      footNear: near,
      footFar: far,
    });
  }
  return poses;
}

/** Keyframes that repeat the walk from `start` until `end`. `stepDuration` is one step's length. */
export function walkKeyframes(
  id: string,
  start: number,
  end: number,
  stepDuration: number,
): PoseKeyframeInput[] {
  const keyDuration = stepDuration / WALK_KEYS_PER_STEP;
  const keyframes: PoseKeyframeInput[] = [];
  for (let key = 0; start + key * keyDuration <= end + 1e-9; key++) {
    keyframes.push({
      time: start + key * keyDuration,
      pose: `${id}-walk-${key % (WALK_KEYS_PER_STEP * 2)}`,
    });
  }
  return keyframes;
}

/** How fast the root must move for planted feet not to slide. */
export function walkSpeed(stride: number, stepDuration: number): number {
  return stride / stepDuration;
}
