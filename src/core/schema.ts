import { z } from 'zod';
import { EASING_NAMES } from './easing';
import { isValidSvgPath } from './svgPath';
import { PROJECT_FPS, TRACK_GROUPS } from './timing';

export const NODE_PROPERTIES = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;
export const CAMERA_PROPERTIES = ['x', 'y', 'zoom', 'rotation'] as const;

const Id = z.string().min(1);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #rrggbb color');
/** A color, or a reference to the scene palette such as `token:subject`. */
const ColorRef = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6}|token:[\w-]+)$/, 'Expected a #rrggbb color or token:<name>');
const Time = z.number().min(0);

const KeyframeSchema = z.strictObject({
  time: Time,
  value: z.number(),
  /** Easing of the segment that starts at this keyframe. */
  easing: z.enum(EASING_NAMES).default('linear'),
});

const keyframes = z
  .array(KeyframeSchema)
  .min(1)
  .superRefine((frames, ctx) => {
    for (let i = 1; i < frames.length; i++) {
      const previous = frames[i - 1];
      const current = frames[i];
      if (previous && current && current.time <= previous.time) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'time'],
          message: 'Keyframe times must be strictly increasing',
        });
      }
    }
  });

/** How many project frames each pose stays on screen. */
const Hold = z.number().int().min(1);
const Fps = z.literal(PROJECT_FPS);

/** Times are in scene seconds. */
const NodeTrackSchema = z.strictObject({
  target: Id,
  property: z.enum(NODE_PROPERTIES),
  /** Decides which exposure setting the track follows. Camera tracks always use `camera`. */
  group: z.enum(TRACK_GROUPS.filter((group) => group !== 'camera')).default('character'),
  /** Overrides the scene's exposure for this track. */
  hold: Hold.optional(),
  keyframes,
});

/** Times are in seconds relative to the start of the owning shot. */
const CameraTrackSchema = z.strictObject({
  property: z.enum(CAMERA_PROPERTIES),
  /** Overrides the scene's camera exposure for this track. */
  hold: Hold.optional(),
  keyframes,
});

const ExposureSchema = z.strictObject({
  character: Hold.default(1),
  camera: Hold.default(1),
  background: Hold.default(1),
  secondary: Hold.default(1),
});

const CameraSchema = z.strictObject({
  x: z.number().default(0),
  y: z.number().default(0),
  zoom: z.number().positive().default(1),
  /** Degrees. */
  rotation: z.number().default(0),
});

const ShotSchema = z.strictObject({
  id: Id,
  start: Time,
  duration: z.number().positive(),
  camera: CameraSchema.prefault({}),
  tracks: z.array(CameraTrackSchema).default([]),
});

const ShapeSchema = z.discriminatedUnion('kind', [
  /** A transform-only node that draws nothing. */
  z.strictObject({ kind: z.literal('group') }),
  z.strictObject({
    kind: z.literal('rect'),
    width: z.number().positive(),
    height: z.number().positive(),
    fill: ColorRef,
  }),
  z.strictObject({
    kind: z.literal('ellipse'),
    radiusX: z.number().positive(),
    radiusY: z.number().positive(),
    fill: ColorRef,
  }),
  z.strictObject({
    kind: z.literal('polygon'),
    points: z.array(z.strictObject({ x: z.number(), y: z.number() })).min(3),
    fill: ColorRef,
  }),
  z.strictObject({
    kind: z.literal('path'),
    /** SVG path data, limited to the subset in svgPath.ts. */
    d: z.string().refine(isValidSvgPath, 'Unsupported or malformed SVG path'),
    fill: ColorRef,
  }),
]);

const TransformSchema = z.strictObject({
  x: z.number().default(0),
  y: z.number().default(0),
  /** Degrees. */
  rotation: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  /** Local point that sits at (x, y) and that rotation and scale happen around. */
  pivotX: z.number().default(0),
  pivotY: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
});

const NodeSchema = z.strictObject({
  id: Id,
  parent: Id.optional(),
  /**
   * Order among siblings: higher values draw on top. Children draw above their parent,
   * unless their layer is negative, which places them behind it.
   */
  layer: z.number().int().default(0),
  /**
   * Draw order within the node's root, independent of the hierarchy, as in skeletal rigs where
   * bones and draw order are separate. Higher values draw on top. Nodes of equal depth keep the
   * order the hierarchy and layers give, so a tree that sets no depth draws exactly as before.
   */
  depth: z.number().default(0),
  /** Depth plane. Only root nodes have one, and it applies to their descendants. */
  plane: Id.optional(),
  /** Marks a node and its descendants as the subject shown in silhouette review. */
  subject: z.boolean().default(false),
  shape: ShapeSchema,
  transform: TransformSchema.prefault({}),
});

const RectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const PoseValuesSchema = z.strictObject({
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().optional(),
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
});

const PoseKeyframeSchema = z.strictObject({
  time: Time,
  pose: Id,
  /** Easing of the blend that starts at this keyframe. */
  easing: z.enum(EASING_NAMES).default('linear'),
});

/** Blends between named poses over time. Times are in scene seconds. */
const PoseTrackSchema = z.strictObject({
  group: z.enum(TRACK_GROUPS.filter((group) => group !== 'camera')).default('character'),
  hold: Hold.optional(),
  keyframes: z.array(PoseKeyframeSchema).min(1),
});

const PlaneSchema = z.strictObject({
  id: Id,
  /** How much camera movement applies: 0 is infinitely far, 1 is the world, above 1 is nearer. */
  parallax: z.number().min(0),
});

const SceneSchema = z
  .strictObject({
    id: Id,
    duration: z.number().positive(),
    fps: Fps,
    exportFps: Fps,
    exposure: ExposureSchema.prefault({}),
    background: ColorRef,
    /** Named colors, referenced as token:<name>. */
    palette: z.record(Id, Color).default({}),
    /** Depth planes, from back to front. */
    planes: z.array(PlaneSchema).default([]),
    /** Named poses: for each pose, the local transform values of the nodes it sets. */
    poses: z.record(Id, z.record(Id, PoseValuesSchema)).default({}),
    poseTracks: z.array(PoseTrackSchema).default([]),
    /** World-space region guaranteed visible at zoom 1 in every aspect ratio. */
    safeArea: RectSchema,
    nodes: z.array(NodeSchema),
    tracks: z.array(NodeTrackSchema).default([]),
    shots: z.array(ShotSchema).min(1),
  })
  .superRefine((scene, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    const parents = new Map<string, string | undefined>();
    scene.nodes.forEach((node, i) => {
      if (parents.has(node.id)) issue(['nodes', i, 'id'], `Duplicate node id "${node.id}"`);
      parents.set(node.id, node.parent);
    });

    scene.nodes.forEach((node, i) => {
      if (node.parent !== undefined && !parents.has(node.parent)) {
        issue(['nodes', i, 'parent'], `Unknown parent "${node.parent}"`);
      }
      const seen = new Set([node.id]);
      for (let at = node.parent; at !== undefined; at = parents.get(at)) {
        if (seen.has(at)) {
          issue(['nodes', i, 'parent'], `Parent cycle through "${node.id}"`);
          break;
        }
        seen.add(at);
      }
    });

    const checkColor = (value: string, path: (string | number)[]) => {
      if (value.startsWith('token:') && scene.palette[value.slice(6)] === undefined) {
        issue(path, `Unknown palette token "${value}"`);
      }
    };
    checkColor(scene.background, ['background']);

    const planeIds = new Set<string>();
    scene.planes.forEach((plane, i) => {
      if (planeIds.has(plane.id)) issue(['planes', i, 'id'], `Duplicate plane "${plane.id}"`);
      planeIds.add(plane.id);
    });

    scene.nodes.forEach((node, i) => {
      if ('fill' in node.shape) checkColor(node.shape.fill, ['nodes', i, 'shape', 'fill']);
      if (node.plane !== undefined) {
        if (node.parent !== undefined) issue(['nodes', i, 'plane'], 'Only root nodes have a plane');
        if (!planeIds.has(node.plane))
          issue(['nodes', i, 'plane'], `Unknown plane "${node.plane}"`);
      } else if (node.parent === undefined && scene.planes.length > 0) {
        issue(['nodes', i, 'plane'], 'Root nodes need a plane when a scene has planes');
      }
    });

    for (const [poseName, pose] of Object.entries(scene.poses)) {
      for (const nodeId of Object.keys(pose)) {
        if (!parents.has(nodeId)) issue(['poses', poseName, nodeId], `Unknown node "${nodeId}"`);
      }
    }
    scene.poseTracks.forEach((track, i) => {
      track.keyframes.forEach((frame, k) => {
        const path = ['poseTracks', i, 'keyframes', k];
        if (scene.poses[frame.pose] === undefined) {
          issue([...path, 'pose'], `Unknown pose "${frame.pose}"`);
        }
        if (frame.time > scene.duration) {
          issue([...path, 'time'], 'Keyframe is after the end of the scene');
        }
        const previous = track.keyframes[k - 1];
        if (previous && frame.time <= previous.time) {
          issue([...path, 'time'], 'Keyframe times must be strictly increasing');
        }
      });
    });

    const trackKeys = new Set<string>();
    scene.tracks.forEach((track, i) => {
      if (!parents.has(track.target)) {
        issue(['tracks', i, 'target'], `Unknown node "${track.target}"`);
      }
      const key = `${track.target}.${track.property}`;
      if (trackKeys.has(key)) issue(['tracks', i], `Duplicate track for "${key}"`);
      trackKeys.add(key);
      track.keyframes.forEach((frame, k) => {
        if (frame.time > scene.duration) {
          issue(['tracks', i, 'keyframes', k, 'time'], 'Keyframe is after the end of the scene');
        }
      });
    });

    // Shots must cover the scene exactly so every timestamp has one active camera.
    let cursor = 0;
    const shotIds = new Set<string>();
    scene.shots.forEach((shot, i) => {
      if (shotIds.has(shot.id)) issue(['shots', i, 'id'], `Duplicate shot id "${shot.id}"`);
      shotIds.add(shot.id);
      if (Math.abs(shot.start - cursor) > 1e-9) {
        issue(['shots', i, 'start'], `Shot must start at ${cursor}, the end of the previous shot`);
      }
      cursor = shot.start + shot.duration;
      shot.tracks.forEach((track, t) => {
        track.keyframes.forEach((frame, k) => {
          if (frame.time > shot.duration) {
            issue(['shots', i, 'tracks', t, 'keyframes', k, 'time'], 'Keyframe is after the shot');
          }
        });
      });
    });
    if (Math.abs(cursor - scene.duration) > 1e-9) {
      issue(['shots'], `Shots end at ${cursor} but the scene lasts ${scene.duration}`);
    }
  });

export const ProjectSchema = z.strictObject({
  schemaVersion: z.literal(3),
  id: Id,
  name: z.string().min(1),
  /** Keeps technical demonstrations clearly apart from production content. */
  kind: z.enum(['technical-demo', 'production']),
  scenes: z.array(SceneSchema).min(1),
});

export type ProjectInput = z.input<typeof ProjectSchema>;
export type Project = z.output<typeof ProjectSchema>;
export type Scene = Project['scenes'][number];
export type SceneNode = Scene['nodes'][number];
export type Shape = SceneNode['shape'];
export type Transform = SceneNode['transform'];
export type Shot = Scene['shots'][number];
export type Camera = Shot['camera'];
export type Keyframe = z.output<typeof KeyframeSchema>;
export type Rect = Scene['safeArea'];

export type Exposure = Scene['exposure'];
export type PoseTrack = Scene['poseTracks'][number];
export type PoseValues = z.output<typeof PoseValuesSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Version 2 added export FPS and exposure. Version 1 scenes export at their own FPS. */
function migrateV1(project: Record<string, unknown>): Record<string, unknown> {
  const scenes = Array.isArray(project['scenes']) ? (project['scenes'] as unknown[]) : [];
  return {
    ...project,
    schemaVersion: 2,
    scenes: scenes.map((scene) =>
      isRecord(scene) ? { exportFps: scene['fps'], ...scene } : scene,
    ),
  };
}

/** Validates project data, upgrading it from older schema versions first. */
export function parseProject(data: unknown): Project {
  let current = data;
  if (isRecord(current) && current['schemaVersion'] === 1) current = migrateV1(current);
  // Version 3 only added optional fields: palette, planes, poses, path shapes and subject.
  if (isRecord(current) && current['schemaVersion'] === 2) {
    current = { ...current, schemaVersion: 3 };
  }
  return ProjectSchema.parse(current);
}
