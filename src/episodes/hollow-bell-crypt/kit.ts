import type { PoseValues, ProjectInput } from '../../core/schema';
import { HARMONIE_PALETTE } from '../../characters/harmonie/harmonie-palette';

/**
 * Building blocks for the episode's shots. Shots are written in screen units: the frame is
 * 1080 x 1920 with (0, 0) at its centre, so y = -960 is the top edge and y = 960 the bottom.
 */

type SceneInput = ProjectInput['scenes'][number];
export type NodeInput = SceneInput['nodes'][number];
export type TrackInput = NonNullable<SceneInput['tracks']>[number];
export type PoseTrackInput = NonNullable<SceneInput['poseTracks']>[number];
type ShapeInput = NodeInput['shape'];
type TransformInput = NonNullable<NodeInput['transform']>;
type Easing = 'linear' | 'step' | 'easeIn' | 'easeOut' | 'easeInOut';

export const FRAME = { width: 1080, height: 1920 } as const;
export const FPS = 24;

/**
 * Environment and prop colors. Harmonie keeps her own five. These are the crypt's: near-black
 * teal stone that lifts towards mist, warm wood and bronze for the merchant's world, and amber
 * kept for flame, gold and her scarf.
 */
export const EPISODE_PALETTE = {
  ...HARMONIE_PALETTE,
  void: '#070B0D',
  stone0: '#0E161A',
  stone1: '#152126',
  stone2: '#1E2F34',
  stone3: '#2A4146',
  stone4: '#3A5559',
  mist: '#7C9C9B',
  tealGlow: '#3F7472',
  torchCore: '#F6E2B0',
  ember: '#C7712C',
  wood0: '#1E1611',
  wood1: '#2E221A',
  wood2: '#433226',
  wood3: '#5A4433',
  bronze: '#9A7443',
  bronzeDark: '#5C4329',
  silver: '#BCC2BD',
  silverDark: '#7D8783',
  parchment: '#CDBF9E',
  parchmentDark: '#9C8E70',
  linen: '#D8CFBA',
  wax: '#D9C68E',
  waxDark: '#A8925A',
  rope: '#A08659',
  ropeDark: '#6E5A3A',
  leather: '#4C3527',
  leatherDark: '#33241B',
  watcher: '#030506',
} as const;

export type PaletteToken = keyof typeof EPISODE_PALETTE;
export const tk = (name: PaletteToken) => `token:${name}`;

/** Depth planes, back to front. `screen` ignores the camera: it is for text and overlays. */
export const PLANES = [
  { id: 'far', parallax: 0.45 },
  { id: 'mid', parallax: 0.75 },
  { id: 'world', parallax: 1 },
  { id: 'near', parallax: 1.3 },
  { id: 'screen', parallax: 0 },
] as const;
export type PlaneId = (typeof PLANES)[number]['id'];

export interface Key {
  readonly time: number;
  readonly value: number;
  readonly easing?: Easing;
}

/** Collects the nodes, tracks and poses of one part of the episode. */
export class Build {
  readonly nodes: NodeInput[] = [];
  readonly tracks: TrackInput[] = [];
  readonly poses: Record<string, Record<string, PoseValues>> = {};
  readonly poseTracks: PoseTrackInput[] = [];

  /**
   * A root group on a plane that is visible only between `start` and `end` (scene seconds).
   * Cuts are hard: the root's opacity steps, on ones.
   */
  root(id: string, plane: PlaneId, start: number, end: number): string {
    this.nodes.push({ id, plane, shape: { kind: 'group' } });
    const keys: Key[] = [];
    if (start > 0) keys.push({ time: 0, value: 0, easing: 'step' });
    keys.push({ time: start, value: 1, easing: 'step' });
    if (end < 60) keys.push({ time: end, value: 0, easing: 'step' });
    this.track(id, 'opacity', keys, { hold: 1, group: 'background' });
    return id;
  }

  add(
    id: string,
    parent: string,
    shape: ShapeInput,
    transform: TransformInput = {},
    options: { depth?: number; subject?: boolean } = {},
  ): string {
    this.nodes.push({
      id,
      parent,
      shape,
      transform,
      ...(options.depth === undefined ? {} : { depth: options.depth }),
      ...(options.subject ? { subject: true } : {}),
    });
    return id;
  }

  group(id: string, parent: string, transform: TransformInput = {}, depth?: number): string {
    return this.add(id, parent, { kind: 'group' }, transform, depth === undefined ? {} : { depth });
  }

  /**
   * A keyframed property. `hold` sets the exposure for this track alone: 1 for light, text and
   * camera-like moves, 2 for the character and props, 3 for the watchers' unnatural motion.
   */
  track(
    target: string,
    property: TrackInput['property'],
    keys: readonly Key[],
    options: { hold?: number; group?: TrackInput['group'] } = {},
  ): void {
    this.tracks.push({
      target,
      property,
      group: options.group ?? 'secondary',
      ...(options.hold === undefined ? {} : { hold: options.hold }),
      keyframes: keys.map((key) => ({
        time: key.time,
        value: key.value,
        easing: key.easing ?? 'linear',
      })),
    });
  }

  merge(other: Build): void {
    this.nodes.push(...other.nodes);
    this.tracks.push(...other.tracks);
    Object.assign(this.poses, other.poses);
    this.poseTracks.push(...other.poseTracks);
  }
}

/** A fade in and out over `fade` seconds, inside a window. */
export function fadeKeys(start: number, end: number, fade = 0.25, peak = 1): Key[] {
  const rise: Key[] = [
    { time: Math.max(0, start - 1e-3), value: 0 },
    { time: start + fade, value: peak },
  ];
  // Anything still showing at the end of the film holds to the last frame: the cut is the end.
  if (end >= 60 - 1e-9) return [...rise, { time: 60, value: peak }];
  return [
    ...rise,
    { time: Math.max(start + fade + 1e-3, end - fade), value: peak },
    { time: end, value: 0 },
  ];
}

/** Deterministic pseudo-random numbers: the same seed always gives the same sequence. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

const r1 = (value: number) => Math.round(value * 10) / 10;

export type Pt = readonly [number, number];

export function poly(points: readonly Pt[]): string {
  const [first, ...rest] = points;
  if (!first) throw new Error('Empty polygon');
  return `M ${r1(first[0])} ${r1(first[1])} ${rest.map((p) => `L ${r1(p[0])} ${r1(p[1])}`).join(' ')} Z`;
}

/** A closed smooth outline (Catmull-Rom), as used for Harmonie's parts. */
export function smooth(points: readonly Pt[]): string {
  const count = points.length;
  const at = (i: number) => points[((i % count) + count) % count] as Pt;
  const first = at(0);
  let d = `M ${r1(first[0])} ${r1(first[1])}`;
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += ` C ${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return `${d} Z`;
}

/** A line of constant width along a polyline, as a filled outline. Ends are square. */
export function strokeLine(points: readonly Pt[], width: number): string {
  const half = width / 2;
  const left: Pt[] = [];
  const right: Pt[] = [];
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)] as Pt;
    const next = points[Math.min(points.length - 1, i + 1)] as Pt;
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  });
  return poly([...left, ...right.reverse()]);
}

/** A gothic pointed arch opening, base centred at the origin, as a closed outline. */
export function pointedArch(width: number, height: number): string {
  const w = width / 2;
  const spring = height - width * 0.85;
  return [
    `M ${r1(-w)} 0`,
    `L ${r1(-w)} ${r1(-spring)}`,
    `C ${r1(-w)} ${r1(-spring - w * 0.9)} ${r1(-w * 0.35)} ${r1(-height + w * 0.15)} 0 ${r1(-height)}`,
    `C ${r1(w * 0.35)} ${r1(-height + w * 0.15)} ${r1(w)} ${r1(-spring - w * 0.9)} ${r1(w)} ${r1(-spring)}`,
    `L ${r1(w)} 0 Z`,
  ].join(' ');
}

/** A ring (annulus) as one outline, for ripples and coin rims. Pixi fills it as a band. */
export function ring(radiusX: number, radiusY: number, thickness: number, segments = 48): string {
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    outer.push([Math.cos(a) * radiusX, Math.sin(a) * radiusY]);
    inner.push([Math.cos(-a) * (radiusX - thickness), Math.sin(-a) * (radiusY - thickness)]);
  }
  return poly([...outer, ...inner]);
}

export const rect = (width: number, height: number, fill: string): ShapeInput => ({
  kind: 'rect',
  width,
  height,
  fill,
});
export const ellipse = (radiusX: number, radiusY: number, fill: string): ShapeInput => ({
  kind: 'ellipse',
  radiusX,
  radiusY,
  fill,
});
export const path = (d: string, fill: string): ShapeInput => ({ kind: 'path', d, fill });

/** A soft glow: color at the centre fading to nothing at the edge. */
export const glow = (width: number, height: number, color: string, peak = 1): ShapeInput => ({
  kind: 'gradient',
  type: 'radial',
  width,
  height,
  stops: [
    { offset: 0, color, opacity: peak },
    { offset: 0.45, color, opacity: peak * 0.45 },
    { offset: 1, color, opacity: 0 },
  ],
});

export const vertical = (
  width: number,
  height: number,
  stops: readonly { offset: number; color: string; opacity?: number }[],
): ShapeInput => ({
  kind: 'gradient',
  type: 'vertical',
  width,
  height,
  stops: stops.map((s) => ({ offset: s.offset, color: s.color, opacity: s.opacity ?? 1 })),
});

export const text = (
  content: string,
  fontSize: number,
  fill: string,
  options: {
    weight?: 400 | 500 | 600 | 700;
    align?: 'left' | 'center' | 'right';
    spacing?: number;
  } = {},
): ShapeInput => ({
  kind: 'text',
  content,
  fontSize,
  fill,
  fontWeight: options.weight ?? 400,
  align: options.align ?? 'center',
  letterSpacing: options.spacing ?? 0,
});
