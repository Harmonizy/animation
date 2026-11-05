import { BOOT_PROFILE } from './harmonie-geometry';
import { HARMONIE_RIG, pivotOf, type RigNodeId } from './harmonie-rig';

/**
 * Harmonie's poses, for the side-view rig (left profile, facing screen left).
 *
 * Rotation is in degrees and clockwise on screen, relative to the parent. In this view that means:
 * - a positive value swings a hanging part (arm, leg, cloak, scarf) forwards, the way she faces;
 * - a positive value tilts an upright part (torso, neck, head) backwards, so leaning forward is
 *   negative.
 *
 * Emotion is carried only by posture: the line of the spine, the head angle, the space the arms
 * take up and the width of the stance. There is no face to act with.
 */

export interface NodePose {
  readonly rotation?: number;
  /** Offset from the node's rest position, in its parent's space. */
  readonly dx?: number;
  readonly dy?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export type HarmoniePose = Readonly<Partial<Record<RigNodeId, NodePose>>>;

/** Nodes animated as secondary motion: they follow the body with lag. */
export const CLOTH_NODES = ['cloak', 'scarf', 'hood', 'satchel'] as const satisfies RigNodeId[];

const isCloth = (node: RigNodeId) => (CLOTH_NODES as readonly RigNodeId[]).includes(node);

export function bodyPart(pose: HarmoniePose): HarmoniePose {
  return Object.fromEntries(Object.entries(pose).filter(([node]) => !isCloth(node as RigNodeId)));
}

export function clothPart(pose: HarmoniePose): HarmoniePose {
  return Object.fromEntries(Object.entries(pose).filter(([node]) => isCloth(node as RigNodeId)));
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

/** Angle of a hanging segment in the rotation convention above: 0 points straight down. */
const hangingAngle = (dx: number, dy: number) => degrees(Math.atan2(-dx, dy));

interface Segment {
  readonly length: number;
  /** Angle at rest, in degrees. */
  readonly rest: number;
}

function segment(from: RigNodeId, to: RigNodeId): Segment {
  const a = pivotOf(from, 'side');
  const b = pivotOf(to, 'side');
  return { length: Math.hypot(b.x - a.x, b.y - a.y), rest: hangingAngle(b.x - a.x, b.y - a.y) };
}

/** Distance from the ankle pivot down to the sole, at rest. */
const SOLE_DEPTH = Math.max(...BOOT_PROFILE.map((point) => point[1]));

/**
 * How far the ankle must rise for a boot turned by `toe` degrees to rest on the ground instead
 * of sinking into it: up on the toes when pointed, back on the heel when raised.
 */
export function groundedLift(toe: number): number {
  const angle = (toe * Math.PI) / 180;
  const lowest = Math.max(
    ...BOOT_PROFILE.map(([x, y]) => x * Math.sin(angle) + y * Math.cos(angle)),
  );
  return Math.max(0, lowest - SOLE_DEPTH);
}

export interface FootTarget {
  /** Ankle distance in front of the hip, in the direction she faces. Negative is behind. */
  readonly forward: number;
  /** Ankle height above its resting height, on top of what the toe angle needs. */
  readonly lift?: number;
  /** Extra foot angle in degrees. Positive raises the toe, negative points it. */
  readonly toe?: number;
}

/**
 * Two-bone inverse kinematics for one leg, solved when the pose is built so evaluation stays
 * a plain blend between stored values. The knee always bends forwards.
 */
export function legPose(
  side: 'left' | 'right',
  pelvis: { readonly dx?: number; readonly dy?: number; readonly rotation?: number },
  target: FootTarget,
): HarmoniePose {
  const thighNode = `${side}Thigh` as const;
  const shinNode = `${side}Shin` as const;
  const footNode = `${side}Foot` as const;
  const thigh = segment(thighNode, shinNode);
  const shin = segment(shinNode, footNode);
  const ankle = pivotOf(footNode, 'side');
  // The hip moves with the pelvis, including its tilt around the pelvis pivot.
  const tilt = pelvis.rotation ?? 0;
  const centre = pivotOf('pelvis', 'side');
  const rest = pivotOf(thighNode, 'side');
  const angle = (tilt * Math.PI) / 180;
  const ox = rest.x - centre.x;
  const oy = rest.y - centre.y;
  const hip = {
    x: centre.x + (pelvis.dx ?? 0) + ox * Math.cos(angle) - oy * Math.sin(angle),
    y: centre.y + (pelvis.dy ?? 0) + ox * Math.sin(angle) + oy * Math.cos(angle),
  };

  // The ankle target is measured from where the hip would stand without the pelvis shift.
  const dx = ankle.x - target.forward - (hip.x - (pelvis.dx ?? 0));
  const lift = (target.lift ?? 0) + groundedLift(target.toe ?? 0);
  const dy = ankle.y - lift - hip.y;
  const reach = Math.min(Math.hypot(dx, dy), thigh.length + shin.length - 0.5);
  const toward = hangingAngle(dx, dy);
  const cosine = (a: number, b: number, c: number) =>
    Math.min(1, Math.max(-1, (a * a + c * c - b * b) / (2 * a * c)));
  const atHip = degrees(Math.acos(cosine(thigh.length, shin.length, reach)));
  const atAnkle = degrees(Math.acos(cosine(shin.length, thigh.length, reach)));

  const thighRotation = toward + atHip - thigh.rest - tilt;
  const shinRotation = toward - atAnkle - shin.rest - thighRotation - tilt;
  const footRotation = (target.toe ?? 0) - thighRotation - shinRotation - tilt;
  return {
    [thighNode]: { rotation: thighRotation },
    [shinNode]: { rotation: shinRotation },
    [footNode]: { rotation: footRotation },
  };
}

export interface PoseSpec {
  readonly pelvisDy?: number;
  readonly pelvisDx?: number;
  /** Pelvis tilt. Positive swings the tunic skirt forwards, as when sitting back into a crouch. */
  readonly pelvisTilt?: number;
  readonly torso?: number;
  readonly neck?: number;
  readonly head?: number;
  /** Upper arm, forearm and optionally hand. */
  readonly leftArm?: readonly [number, number, number?];
  readonly rightArm?: readonly [number, number, number?];
  readonly leftFoot: FootTarget;
  readonly rightFoot: FootTarget;
  readonly cloak?: number;
  /** Below 1 bunches the cloak up, for poses where its hem would reach the ground. */
  readonly cloakLength?: number;
  readonly scarf?: number;
  readonly hood?: number;
  readonly satchel?: number;
  readonly breath?: number;
}

/** Turns a readable description into per-node values. */
export function pose(spec: PoseSpec): HarmoniePose {
  const pelvis = { dx: spec.pelvisDx ?? 0, dy: spec.pelvisDy ?? 0, rotation: spec.pelvisTilt ?? 0 };
  const arm = (side: 'left' | 'right', values: readonly [number, number, number?] = [0, 0]) => ({
    [`${side}UpperArm`]: { rotation: values[0] },
    [`${side}Forearm`]: { rotation: values[1] },
    [`${side}Hand`]: { rotation: values[2] ?? 0 },
  });
  return {
    pelvis,
    // Torso values are written as the lean seen on screen, so the pelvis tilt is taken out.
    torso: { rotation: (spec.torso ?? 0) - pelvis.rotation, scaleY: 1 + (spec.breath ?? 0) },
    neck: { rotation: spec.neck ?? 0 },
    head: { rotation: spec.head ?? 0 },
    ...arm('left', spec.leftArm),
    ...arm('right', spec.rightArm),
    ...legPose('left', pelvis, spec.leftFoot),
    ...legPose('right', pelvis, spec.rightFoot),
    cloak: { rotation: spec.cloak ?? 0, scaleY: spec.cloakLength ?? 1 },
    scarf: { rotation: spec.scarf ?? 0 },
    hood: { rotation: spec.hood ?? 0 },
    satchel: { rotation: spec.satchel ?? 0 },
  };
}

/* ----------------------------------------------------------------------------------------------
 * The pose sheet.
 * -------------------------------------------------------------------------------------------- */

export const POSE_SHEET = [
  {
    id: 'neutral',
    label: 'Neutral standing',
    note: 'Upright, weight even, head slightly lowered: calm and observant.',
    spec: {
      torso: -1,
      head: -4,
      leftArm: [3, 6],
      rightArm: [-3, 5],
      leftFoot: { forward: 10 },
      rightFoot: { forward: -10 },
    },
  },
  {
    id: 'walking',
    label: 'Walking',
    note: 'Contact position. Opposite arm swings, cloak and scarf trail.',
    spec: {
      pelvisDy: 12,
      torso: -3,
      head: -3,
      leftArm: [-22, 12],
      rightArm: [24, 20],
      leftFoot: { forward: 72, toe: 14 },
      rightFoot: { forward: -66, toe: -10 },
      cloak: -5,
      scarf: -8,
    },
  },
  {
    id: 'running',
    label: 'Running',
    note: 'Push-off. Forward lean, bent arms, cloth streams back.',
    spec: {
      pelvisDy: 16,
      torso: -16,
      neck: 4,
      head: 8,
      leftArm: [-48, 78],
      rightArm: [54, 84],
      leftFoot: { forward: 74, lift: 80, toe: 8 },
      rightFoot: { forward: -96, lift: 26, toe: -34 },
      cloak: -6,
      scarf: -24,
      hood: -6,
      satchel: -14,
    },
  },
  {
    id: 'reaching',
    label: 'Reaching',
    note: 'Up on the front foot, arm and gaze lead the line of action.',
    spec: {
      pelvisDy: 4,
      torso: 4,
      neck: 2,
      head: 8,
      leftArm: [150, 12, 10],
      rightArm: [-14, 10],
      leftFoot: { forward: 24 },
      rightFoot: { forward: -40, toe: -30 },
      cloak: -2,
      scarf: -4,
    },
  },
  {
    id: 'crouching',
    label: 'Crouching',
    note: 'Low and compact. Cloth keeps hanging with gravity.',
    spec: {
      pelvisDy: 150,
      pelvisTilt: 40,
      torso: -36,
      neck: 8,
      head: 22,
      leftArm: [46, 44],
      rightArm: [24, 40],
      leftFoot: { forward: 66 },
      rightFoot: { forward: -46, toe: -26 },
      cloak: 26,
      cloakLength: 0.72,
      scarf: 30,
      hood: 4,
    },
  },
  {
    id: 'defensive',
    label: 'Defensive posture',
    note: 'Wide base, weight back, both forearms raised as a guard.',
    spec: {
      pelvisDy: 46,
      pelvisDx: 10,
      torso: 10,
      neck: -6,
      head: -14,
      leftArm: [52, 74, 10],
      rightArm: [34, 84, 6],
      leftFoot: { forward: 88 },
      rightFoot: { forward: -78, toe: -6 },
      cloak: -8,
      scarf: -8,
    },
  },
  {
    id: 'withdrawn',
    label: 'Quiet, withdrawn',
    note: 'Closed and small: spine curls, head bowed, arms drawn in.',
    spec: {
      pelvisDy: 10,
      torso: -7,
      neck: -4,
      head: -8,
      leftArm: [2, 20, 10],
      rightArm: [0, 24, 10],
      leftFoot: { forward: 2 },
      rightFoot: { forward: -2 },
      cloak: 7,
      scarf: 6,
      hood: -2,
    },
  },
] as const satisfies readonly { id: string; label: string; note: string; spec: PoseSpec }[];

export type SheetPoseId = (typeof POSE_SHEET)[number]['id'];

export function sheetPose(id: SheetPoseId): HarmoniePose {
  const entry = POSE_SHEET.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown pose "${id}"`);
  return pose(entry.spec);
}

/* ----------------------------------------------------------------------------------------------
 * Animation clips for the motion preview. Every clip is a list of timed poses. Body and cloth
 * are separate tracks, so the cloth can be keyed later than the body: that delay is the
 * follow-through, and it stays deterministic because it is stored, not simulated.
 * -------------------------------------------------------------------------------------------- */

export interface TimedPose {
  readonly time: number;
  readonly pose: HarmoniePose;
  readonly easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface Clip {
  readonly id: string;
  readonly label: string;
  readonly start: number;
  readonly duration: number;
  readonly body: readonly TimedPose[];
  readonly cloth: readonly TimedPose[];
  /** Framing for this clip's shot, when the default would crop the action. */
  readonly camera?: { readonly x?: number; readonly y?: number; readonly zoom?: number };
}

export const PREVIEW_FPS = 24;
/** Character and cloth drawings are held for two frames: on twos. */
export const PREVIEW_HOLD = 2;

const NEUTRAL: PoseSpec = POSE_SHEET[0].spec;

const idleBreath = (amount: number, head: number): PoseSpec => ({
  ...NEUTRAL,
  breath: amount,
  head,
});

function idleClip(start: number): Clip {
  const inhale = pose(idleBreath(0.014, -3));
  const exhale = pose(idleBreath(0, -4));
  const times = [0, 1, 2, 3, 4];
  return {
    id: 'idle',
    label: 'Neutral idle',
    start,
    duration: 4,
    body: times.map((t, i) => ({
      time: start + t,
      pose: i % 2 === 0 ? exhale : inhale,
      easing: 'easeInOut',
    })),
    // The cloak settles a fraction after each breath.
    cloth: [
      { time: start, pose: clothPart(exhale) },
      ...[1, 2, 3].map((t, i) => ({
        time: start + t + 0.17,
        pose: clothPart(pose({ ...NEUTRAL, cloak: i % 2 === 0 ? 0.8 : 0, scarf: i % 2 ? 0 : 0.6 })),
        easing: 'easeInOut' as const,
      })),
      { time: start + 4, pose: clothPart(exhale) },
    ],
  };
}

const WALK_KEYS = 8;
const WALK_STRIDE = 128;
const WALK_LIFT = [0, 26, 34, 12] as const;
const WALK_BOB = [12, 18, 6, 4] as const;

/** One foot, eight keys per cycle: planted and sliding back, then swinging through. */
function walkFoot(key: number): FootTarget {
  const k = ((key % WALK_KEYS) + WALK_KEYS) % WALK_KEYS;
  const half = WALK_KEYS / 2;
  if (k < half) {
    const forward = WALK_STRIDE / 2 - (WALK_STRIDE * k) / half;
    return { forward, toe: k === 0 ? 14 : 0 };
  }
  const swing = k - half;
  return {
    forward: -WALK_STRIDE / 2 + (WALK_STRIDE * swing) / half,
    lift: WALK_LIFT[swing] ?? 0,
    toe: swing === 0 ? -22 : swing === 1 ? -8 : 0,
  };
}

/** The walk as eight keys: left contact, down, passing, up, then the same on the right. */
export function walkCyclePoses(): HarmoniePose[] {
  return Array.from({ length: WALK_KEYS }, (_, key) => {
    const left = walkFoot(key);
    const right = walkFoot(key + WALK_KEYS / 2);
    // Arms swing against the legs: the left arm goes back as the left foot comes forward.
    const swing = left.forward / (WALK_STRIDE / 2);
    return pose({
      pelvisDy: WALK_BOB[key % (WALK_KEYS / 2)] ?? 0,
      torso: -3,
      head: -3,
      leftArm: [-22 * swing, 10 + 8 * Math.max(0, swing)],
      rightArm: [22 * swing, 10 + 8 * Math.max(0, -swing)],
      leftFoot: left,
      rightFoot: right,
    });
  });
}

/** Cloth for each walk key: it swings at the step rate and trails behind the body. */
function walkCloth(key: number): HarmoniePose {
  const phase = (key / WALK_KEYS) * Math.PI * 4;
  return clothPart(
    pose({
      ...NEUTRAL,
      cloak: -4 + 2.5 * Math.sin(phase),
      scarf: -7 + 4 * Math.sin(phase),
      hood: 1.2 * Math.sin(phase),
      satchel: 6 * Math.sin(phase + Math.PI / 2),
    }),
  );
}

export const WALK_CYCLE_DURATION = 1;

function walkClip(start: number, cycles: number): Clip {
  const poses = walkCyclePoses();
  const keyTime = WALK_CYCLE_DURATION / WALK_KEYS;
  const keys = cycles * WALK_KEYS;
  const lag = 2 / PREVIEW_FPS;
  const duration = cycles * WALK_CYCLE_DURATION;
  return {
    id: 'walk',
    label: 'Walk cycle (in place)',
    start,
    duration,
    body: Array.from({ length: keys + 1 }, (_, k) => ({
      time: start + k * keyTime,
      pose: poses[k % WALK_KEYS] as HarmoniePose,
    })),
    cloth: [
      { time: start, pose: walkCloth(0) },
      ...Array.from({ length: keys - 1 }, (_, k) => ({
        time: start + (k + 1) * keyTime + lag,
        pose: walkCloth(k + 1),
      })),
      { time: start + duration, pose: walkCloth(0) },
    ],
  };
}

function reachClip(start: number): Clip {
  const neutral = pose(NEUTRAL);
  const anticipate = pose({
    ...NEUTRAL,
    pelvisDy: 18,
    torso: -6,
    head: -10,
    leftArm: [-8, 20],
    leftFoot: { forward: 14 },
    rightFoot: { forward: -14 },
  });
  const reach = sheetPose('reaching');
  const settle = pose({
    ...POSE_SHEET[3].spec,
    leftArm: [140, 16, 6],
    head: 12,
  });
  return {
    id: 'reach',
    label: 'Reach',
    start,
    duration: 3.5,
    // Pulled back so the raised hand stays in frame in every aspect ratio.
    camera: { y: -70, zoom: 0.84 },
    body: [
      { time: start, pose: neutral, easing: 'easeInOut' },
      { time: start + 0.5, pose: neutral, easing: 'easeInOut' },
      { time: start + 0.9, pose: anticipate, easing: 'easeOut' },
      { time: start + 1.5, pose: reach, easing: 'easeInOut' },
      { time: start + 2.2, pose: settle, easing: 'easeInOut' },
      { time: start + 3.1, pose: neutral },
      { time: start + 3.5, pose: neutral },
    ],
    cloth: [
      { time: start, pose: clothPart(neutral) },
      { time: start + 0.6, pose: clothPart(neutral), easing: 'easeInOut' },
      { time: start + 1.0, pose: clothPart(pose({ ...NEUTRAL, cloak: 3, scarf: 4 })) },
      { time: start + 1.6, pose: clothPart(pose({ ...NEUTRAL, cloak: -5, scarf: -8 })) },
      { time: start + 2.0, pose: clothPart(pose({ ...NEUTRAL, cloak: 1, scarf: 2 })) },
      { time: start + 2.4, pose: clothPart(reach), easing: 'easeInOut' },
      { time: start + 3.3, pose: clothPart(neutral) },
      { time: start + 3.5, pose: clothPart(neutral) },
    ],
  };
}

/**
 * A sharp lean forward and a sudden stop, then back. The body moves on its keys; the cloak,
 * scarf, hood and satchel arrive later, overshoot and settle.
 */
function clothTestClip(start: number): Clip {
  const neutral = pose(NEUTRAL);
  const lean = pose({
    ...NEUTRAL,
    pelvisDx: -24,
    pelvisDy: 14,
    torso: -14,
    head: 4,
    leftArm: [-14, 14],
    rightArm: [-10, 12],
    leftFoot: { forward: 34 },
    rightFoot: { forward: 10 },
  });
  const cloth = (cloak: number, scarf: number, hood: number, satchel: number) =>
    clothPart(pose({ ...NEUTRAL, cloak, scarf, hood, satchel }));
  return {
    id: 'cloth',
    label: 'Cloth follow-through',
    start,
    duration: 3.5,
    body: [
      { time: start, pose: neutral },
      { time: start + 0.3, pose: neutral, easing: 'easeIn' },
      { time: start + 0.6, pose: lean, easing: 'easeOut' },
      { time: start + 1.8, pose: lean, easing: 'easeIn' },
      { time: start + 2.1, pose: neutral },
      { time: start + 3.5, pose: neutral },
    ],
    cloth: [
      { time: start, pose: cloth(0, 0, 0, 0) },
      { time: start + 0.4, pose: cloth(0, 0, 0, 0), easing: 'easeIn' },
      // The body has stopped; the cloth is still dragging behind it.
      { time: start + 0.7, pose: cloth(12, 16, 4, 14), easing: 'easeOut' },
      // It catches up and swings past.
      { time: start + 1.0, pose: cloth(-6, -10, -3, -10), easing: 'easeInOut' },
      { time: start + 1.3, pose: cloth(3, 4, 1, 4), easing: 'easeInOut' },
      { time: start + 1.6, pose: cloth(0, 0, 0, 0) },
      { time: start + 1.9, pose: cloth(0, 0, 0, 0), easing: 'easeIn' },
      { time: start + 2.2, pose: cloth(-9, -12, -3, -12), easing: 'easeOut' },
      { time: start + 2.5, pose: cloth(5, 7, 2, 7), easing: 'easeInOut' },
      { time: start + 2.8, pose: cloth(-2, -2, 0, -2), easing: 'easeInOut' },
      { time: start + 3.1, pose: cloth(0, 0, 0, 0) },
      { time: start + 3.5, pose: cloth(0, 0, 0, 0) },
    ],
  };
}

/** The four clips, back to back. */
export function previewClips(): Clip[] {
  const idle = idleClip(0);
  const walk = walkClip(idle.start + idle.duration, 4);
  const reach = reachClip(walk.start + walk.duration);
  const cloth = clothTestClip(reach.start + reach.duration);
  return [idle, walk, reach, cloth];
}

/** Every node a full pose sets. Used by tests to check that poses are complete. */
export const POSED_NODES = Object.keys(HARMONIE_RIG).filter((node) => node !== 'root');
