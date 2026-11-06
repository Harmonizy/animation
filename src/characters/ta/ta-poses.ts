import type { PoseValues, ProjectInput } from '../../core/schema';
import { translatePath } from '../harmonie/harmonie-geometry';
import { TA_COLORS, taParts } from './ta-geometry';
import { TA_RIG, taLocalOffset, taOrder, taPivot, type TaNode, type TaView } from './ta-rig';

/**
 * Ta's poses and scene nodes.
 *
 * Rotation is in degrees, clockwise on screen, relative to the parent. In the side view (facing
 * screen right) a NEGATIVE value swings a hanging limb forwards, and a POSITIVE value leans an
 * upright part (torso, neck, head) forwards. Emotion is all posture and timing: he has no face.
 */

type NodeInput = ProjectInput['scenes'][number]['nodes'][number];

export interface NodePose {
  readonly rotation?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}
export type TaPose = Readonly<Partial<Record<TaNode, NodePose>>>;

const degrees = (r: number) => (r * 180) / Math.PI;
const hanging = (dx: number, dy: number) => degrees(Math.atan2(-dx, dy));

export interface FootTarget {
  /** Ankle position relative to the hip at rest, in the direction he faces. */
  readonly forward: number;
  readonly lift?: number;
  readonly toe?: number;
}

/** Two-bone leg IK for the side view, solved when the pose is built. The knee bends forwards. */
export function taLeg(side: 'left' | 'right', pelvis: NodePose, target: FootTarget): TaPose {
  const thigh = `${side}Thigh` as const;
  const shin = `${side}Shin` as const;
  const foot = `${side}Foot` as const;
  const hip = taPivot(thigh, 'side');
  const knee = taPivot(shin, 'side');
  const ankle = taPivot(foot, 'side');
  const tilt = pelvis.rotation ?? 0;
  const centre = taPivot('pelvis', 'side');
  const a = (tilt * Math.PI) / 180;
  const ox = hip.x - centre.x;
  const oy = hip.y - centre.y;
  const hipNow = {
    x: centre.x + ox * Math.cos(a) - oy * Math.sin(a),
    y: centre.y + (pelvis.dy ?? 0) + ox * Math.sin(a) + oy * Math.cos(a),
  };
  const lengthA = Math.hypot(knee.x - hip.x, knee.y - hip.y);
  const lengthB = Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
  const restA = hanging(knee.x - hip.x, knee.y - hip.y);
  const restB = hanging(ankle.x - knee.x, ankle.y - knee.y);
  const dx = ankle.x + target.forward - hipNow.x;
  const dy = ankle.y - (target.lift ?? 0) - hipNow.y;
  const reach = Math.min(Math.hypot(dx, dy), lengthA + lengthB - 0.5);
  const cos = (p: number, q: number, r: number) =>
    Math.min(1, Math.max(-1, (p * p + r * r - q * q) / (2 * p * r)));
  const toward = hanging(dx, dy);
  const atHip = degrees(Math.acos(cos(lengthA, lengthB, reach)));
  const atAnkle = degrees(Math.acos(cos(lengthB, lengthA, reach)));
  const thighRotation = toward - atHip - restA - tilt;
  const shinRotation = toward + atAnkle - restB - thighRotation - tilt;
  const footRotation = -(target.toe ?? 0) - thighRotation - shinRotation - tilt;
  return {
    [thigh]: { rotation: thighRotation },
    [shin]: { rotation: shinRotation },
    [foot]: { rotation: footRotation },
  };
}

/** Local transform values for one node in one view, as a scene pose stores them. */
function values(node: TaNode, view: TaView, pose: TaPose | undefined): PoseValues {
  const rest = taLocalOffset(node, view);
  const p = pose?.[node];
  return {
    x: rest.x + (p?.dx ?? 0),
    y: rest.y + (p?.dy ?? 0),
    rotation: p?.rotation ?? 0,
    scaleX: p?.scaleX ?? 1,
    scaleY: p?.scaleY ?? 1,
  };
}

export const taNodeId = (figure: string, node: TaNode) => `${figure}-${node}`;

export interface TaPlacement {
  readonly id: string;
  readonly parent?: string;
  readonly view: TaView;
  readonly x: number;
  readonly groundY: number;
  readonly scale: number;
  readonly rotation?: number;
  readonly depth?: number;
  readonly pose?: TaPose;
}

/** Ta as scene nodes: a group at each joint, and the parts drawn relative to their joint. */
export function taFigureNodes(figure: TaPlacement): NodeInput[] {
  const base = figure.depth ?? 0;
  const nodes: NodeInput[] = [];
  for (const node of taOrder()) {
    const spec = TA_RIG[node];
    if (spec.parent === null) {
      nodes.push({
        id: taNodeId(figure.id, node),
        ...(figure.parent ? { parent: figure.parent } : {}),
        subject: true,
        depth: base,
        shape: { kind: 'group' },
        transform: {
          x: figure.x,
          y: figure.groundY,
          rotation: figure.rotation ?? 0,
          scaleX: figure.scale,
          scaleY: figure.scale,
        },
      });
      continue;
    }
    nodes.push({
      id: taNodeId(figure.id, node),
      parent: taNodeId(figure.id, spec.parent),
      depth: base,
      shape: { kind: 'group' },
      transform: values(node, figure.view, figure.pose),
    });
  }
  for (const part of taParts(figure.view)) {
    const pivot = taPivot(part.node, figure.view);
    nodes.push({
      id: `${figure.id}-part-${part.id}`,
      parent: taNodeId(figure.id, part.node),
      depth: base + part.depth / 100,
      shape: {
        kind: 'path',
        d: translatePath(part.d, -pivot.x, -pivot.y),
        fill: `token:${TA_COLORS[part.color]}`,
      },
      transform: { opacity: part.opacity ?? 1 },
    });
  }
  return nodes;
}

/** A pose as named scene pose values, for every node it mentions. */
export function taScenePose(
  figure: string,
  view: TaView,
  pose: TaPose,
): Record<string, PoseValues> {
  const out: Record<string, PoseValues> = {};
  for (const node of taOrder()) {
    if (node === 'root' || !pose[node]) continue;
    out[taNodeId(figure, node)] = values(node, view, pose);
  }
  return out;
}

/** Merges poses; later ones win node by node. */
export const mergePoses = (...poses: TaPose[]): TaPose => Object.assign({}, ...poses);
