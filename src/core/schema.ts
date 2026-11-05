import { z } from 'zod';
import { EASING_NAMES } from './easing';

export const NODE_PROPERTIES = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;
export const CAMERA_PROPERTIES = ['x', 'y', 'zoom', 'rotation'] as const;

const Id = z.string().min(1);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #rrggbb color');
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

/** Times are in scene seconds. */
const NodeTrackSchema = z.strictObject({
  target: Id,
  property: z.enum(NODE_PROPERTIES),
  keyframes,
});

/** Times are in seconds relative to the start of the owning shot. */
const CameraTrackSchema = z.strictObject({
  property: z.enum(CAMERA_PROPERTIES),
  keyframes,
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
    fill: Color,
  }),
  z.strictObject({
    kind: z.literal('ellipse'),
    radiusX: z.number().positive(),
    radiusY: z.number().positive(),
    fill: Color,
  }),
  z.strictObject({
    kind: z.literal('polygon'),
    points: z.array(z.strictObject({ x: z.number(), y: z.number() })).min(3),
    fill: Color,
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
  /** Order among siblings: higher values draw on top. */
  layer: z.number().int().default(0),
  shape: ShapeSchema,
  transform: TransformSchema.prefault({}),
});

const RectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const SceneSchema = z
  .strictObject({
    id: Id,
    duration: z.number().positive(),
    fps: z.number().int().positive(),
    background: Color,
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
  schemaVersion: z.literal(1),
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

export function parseProject(data: unknown): Project {
  return ProjectSchema.parse(data);
}
