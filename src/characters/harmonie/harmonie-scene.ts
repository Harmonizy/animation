import type { PoseValues, ProjectInput } from '../../core/schema';
import { harmonieParts, translatePath } from './harmonie-geometry';
import { HARMONIE_PALETTE, type HarmonieMaterialColor } from './harmonie-palette';
import {
  bodyPart,
  clothPart,
  PREVIEW_FPS,
  PREVIEW_HOLD,
  previewClips,
  type HarmoniePose,
  type TimedPose,
} from './harmonie-poses';
import { HARMONIE_RIG, localOffset, pivotOf, rigOrder, type HarmonieView } from './harmonie-rig';

type SceneInput = ProjectInput['scenes'][number];
type NodeInput = SceneInput['nodes'][number];
type PoseKeyframeInput = NonNullable<SceneInput['poseTracks']>[number]['keyframes'][number];

export interface FigurePlacement {
  /** Prefix for every node id of this figure. */
  readonly id: string;
  readonly view: HarmonieView;
  /** Where the ground point under the figure goes. */
  readonly x: number;
  readonly groundY: number;
  readonly scale: number;
  /** Values set directly on the nodes. Animated figures use pose tracks instead. */
  readonly pose?: HarmoniePose;
  /** Fill every part with this color, for the silhouette test. */
  readonly fill?: string;
}

const token = (color: HarmonieMaterialColor) => `token:${color}`;

/** Local transform values of one node for a pose, in the form the scene schema stores. */
function nodeValues(
  node: (typeof RIG)[number],
  view: HarmonieView,
  pose: HarmoniePose | undefined,
): PoseValues {
  const rest = localOffset(node, view);
  const values = pose?.[node];
  return {
    x: rest.x + (values?.dx ?? 0),
    y: rest.y + (values?.dy ?? 0),
    rotation: values?.rotation ?? 0,
    scaleX: values?.scaleX ?? 1,
    scaleY: values?.scaleY ?? 1,
  };
}

const RIG = rigOrder();

export const nodeId = (figure: string, node: string) => `${figure}-${node}`;
/** Part nodes get their own namespace, so a part can share a name with its rig node. */
export const partNodeId = (figure: string, part: string) => `${figure}-part-${part}`;

/**
 * One figure as scene nodes: a group per rig node, at its pivot, and the parts as children drawn
 * relative to that pivot. The figure's root node is the rig's root, at the ground point.
 */
export function figureNodes(figure: FigurePlacement): NodeInput[] {
  const nodes: NodeInput[] = [];
  for (const rigNode of RIG) {
    const spec = HARMONIE_RIG[rigNode];
    if (spec.parent === null) {
      const values = figure.pose?.root;
      nodes.push({
        id: nodeId(figure.id, rigNode),
        subject: true,
        shape: { kind: 'group' },
        transform: {
          x: figure.x + (values?.dx ?? 0) * figure.scale,
          y: figure.groundY + (values?.dy ?? 0) * figure.scale,
          rotation: values?.rotation ?? 0,
          scaleX: figure.scale,
          scaleY: figure.scale,
        },
      });
      continue;
    }
    nodes.push({
      id: nodeId(figure.id, rigNode),
      parent: nodeId(figure.id, spec.parent),
      shape: { kind: 'group' },
      transform: nodeValues(rigNode, figure.view, figure.pose),
    });
  }
  for (const part of harmonieParts(figure.view)) {
    const pivot = pivotOf(part.node, figure.view);
    nodes.push({
      id: partNodeId(figure.id, part.id),
      parent: nodeId(figure.id, part.node),
      depth: part.depth,
      shape: {
        kind: 'path',
        d: translatePath(part.d, -pivot.x, -pivot.y),
        fill: figure.fill ?? token(part.color),
      },
    });
  }
  return nodes;
}

/** A pose as a named scene pose for one figure. Only nodes the pose mentions are included. */
export function scenePose(
  figure: string,
  view: HarmonieView,
  pose: HarmoniePose,
): Record<string, PoseValues> {
  const values: Record<string, PoseValues> = {};
  for (const node of RIG) {
    if (node === 'root' || pose[node] === undefined) continue;
    values[nodeId(figure, node)] = nodeValues(node, view, pose);
  }
  return values;
}

export const PREVIEW_FIGURE = 'harmonie';
export const PREVIEW_GROUND_Y = 400;

/**
 * The motion preview: the side-view rig through idle, walk, reach and a cloth test, one shot per
 * clip. Everything is keyed data, so the same time always gives the same picture.
 */
export function harmoniePreviewProject(): ProjectInput {
  const clips = previewClips();
  const poses: Record<string, Record<string, PoseValues>> = {};
  const track = (part: 'body' | 'cloth') => {
    const keyframes: PoseKeyframeInput[] = [];
    for (const clip of clips) {
      const timed: readonly TimedPose[] = clip[part];
      timed.forEach((entry, index) => {
        const name = `${clip.id}-${part}-${index}`;
        const pose = part === 'body' ? bodyPart(entry.pose) : clothPart(entry.pose);
        poses[name] = scenePose(PREVIEW_FIGURE, 'side', pose);
        const keyframe = { time: entry.time, pose: name, easing: entry.easing ?? 'linear' };
        // A clip starts where the previous one ended. The new clip's first key wins, as a cut.
        const last = keyframes[keyframes.length - 1];
        if (last && Math.abs(last.time - entry.time) < 1e-9) keyframes.pop();
        keyframes.push(keyframe);
      });
    }
    return keyframes;
  };
  const body = track('body');
  const cloth = track('cloth');
  const last = clips[clips.length - 1];
  const duration = last ? last.start + last.duration : 1;

  return {
    schemaVersion: 3,
    id: 'harmonie-preview',
    name: 'Harmonie motion preview',
    kind: 'technical-demo',
    scenes: [
      {
        id: 'harmonie-preview',
        duration,
        fps: PREVIEW_FPS,
        exportFps: PREVIEW_FPS,
        exposure: { character: PREVIEW_HOLD, secondary: PREVIEW_HOLD },
        background: 'token:warmIvory',
        palette: { ...HARMONIE_PALETTE },
        safeArea: { x: -330, y: -440, width: 660, height: 880 },
        nodes: [
          {
            id: 'ground-line',
            shape: { kind: 'rect', width: 1400, height: 3, fill: 'token:deepShadow' },
            transform: { y: PREVIEW_GROUND_Y + 1.5, opacity: 0.35 },
          },
          ...figureNodes({
            id: PREVIEW_FIGURE,
            view: 'side',
            x: 0,
            groundY: PREVIEW_GROUND_Y,
            scale: 1,
          }),
        ],
        poses,
        poseTracks: [
          { group: 'character', keyframes: body },
          { group: 'secondary', keyframes: cloth },
        ],
        shots: clips.map((clip) => ({
          id: clip.id,
          start: clip.start,
          duration: clip.duration,
          ...(clip.camera ? { camera: clip.camera } : {}),
        })),
      },
    ],
  };
}
