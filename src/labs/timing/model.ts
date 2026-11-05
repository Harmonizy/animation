import type { EasingName } from '../../core/easing';
import { evaluateKeyframes, type EvaluatedNode, type FrameState } from '../../core/evaluate';
import { translation } from '../../core/matrix';
import type { Keyframe, Rect, Shape } from '../../core/schema';
import { frameToTime, lastFrame, poseFrame, poseIndex, timeToFrame } from '../../core/timing';

/** One pass of every lab animation: movement, then a rest before it loops. */
export const LAB_DURATION = 3;
const DEFAULT_TRAVEL = 2;

export const LAB_TABS = ['fps', 'exposure', 'spacing', 'timing'] as const;
export type LabTab = (typeof LAB_TABS)[number];

export function isLabTab(value: string): value is LabTab {
  return (LAB_TABS as readonly string[]).includes(value);
}

export interface LaneSpec {
  readonly id: string;
  readonly label: string;
  readonly fps: number;
  /** Project frames each pose is held for. */
  readonly hold: number;
  readonly easing: EasingName;
  /** Seconds taken to cross the rail. */
  readonly travel: number;
  readonly color: string;
}

export interface LaneState {
  readonly frame: number;
  readonly pose: number;
  /** Position along the rail, from 0 to 1. */
  readonly progress: number;
}

const LANE_COLORS = ['#f0653a', '#3f8cff', '#2ec4a6', '#f2c14e', '#c77dff'] as const;

function lanes(specs: readonly Omit<LaneSpec, 'color'>[]): LaneSpec[] {
  return specs.map((spec, index) => ({
    ...spec,
    color: LANE_COLORS[index % LANE_COLORS.length] as string,
  }));
}

/** The lanes each tab compares. `exposureFps` is the frame rate of the exposure tab. */
export function lanesForTab(tab: LabTab, exposureFps = 24): LaneSpec[] {
  const base = { easing: 'linear', travel: DEFAULT_TRAVEL } as const;
  switch (tab) {
    case 'fps':
      return lanes(
        [12, 24, 30, 60].map((fps) => ({
          ...base,
          id: `fps-${fps}`,
          label: `${fps} fps`,
          fps,
          hold: 1,
        })),
      );
    case 'exposure':
      return lanes(
        (
          [
            ['ones', 1],
            ['twos', 2],
            ['threes', 3],
          ] as const
        ).map(([name, hold]) => ({
          ...base,
          id: `exposure-${name}`,
          label: `On ${name}`,
          fps: exposureFps,
          hold,
        })),
      );
    case 'spacing':
      return lanes(
        (['linear', 'easeIn', 'easeOut', 'easeInOut', 'step'] as const).map((easing) => ({
          id: `spacing-${easing}`,
          label: easing === 'step' ? 'Step / hold' : easing,
          fps: 24,
          hold: 2,
          easing,
          travel: DEFAULT_TRAVEL,
        })),
      );
    case 'timing':
      return lanes(
        [0.5, 1, 2].map((travel) => ({
          id: `timing-${travel}`,
          label: `${travel * 24} frames`,
          fps: 24,
          hold: 1,
          easing: 'linear',
          travel,
        })),
      );
  }
}

function laneKeyframes(spec: LaneSpec): Keyframe[] {
  return [
    { time: 0, value: 0, easing: spec.easing },
    { time: spec.travel, value: 1, easing: 'linear' },
  ];
}

/** A pure function of time: each lane reads the same playhead through its own frame grid. */
export function laneState(spec: LaneSpec, time: number): LaneState {
  const frame = Math.min(lastFrame(LAB_DURATION, spec.fps), timeToFrame(time, spec.fps));
  const sampled = frameToTime(poseFrame(frame, spec.hold), spec.fps);
  return {
    frame,
    pose: poseIndex(frame, spec.hold),
    progress: evaluateKeyframes(laneKeyframes(spec), sampled),
  };
}

export function posesPerSecond(spec: LaneSpec): number {
  return spec.fps / spec.hold;
}

/** Where each pose sits on the rail while the lane is moving. The gaps show its spacing. */
export function spacingMarks(spec: LaneSpec): number[] {
  const keyframes = laneKeyframes(spec);
  const marks: number[] = [];
  const movingFrames = Math.round(spec.travel * spec.fps);
  for (let frame = 0; frame <= movingFrames; frame += spec.hold) {
    marks.push(evaluateKeyframes(keyframes, frameToTime(frame, spec.fps)));
  }
  return marks;
}

const RAIL_LENGTH = 1000;
const LANE_HEIGHT = 120;
const MARGIN_X = 50;
const MARKER_RADIUS = 26;
const RAIL_COLOR = '#3a3f4e';
const LAB_BACKGROUND = '#12141c';

export interface LabScene {
  readonly lanes: readonly LaneSpec[];
  readonly safeArea: Rect;
  /** Width divided by height of the area to show. */
  readonly aspectRatio: number;
  frameAt(time: number): FrameState;
}

/** Shapes are created once here, so renderers can reuse what they have already drawn. */
export function createLabScene(laneSpecs: readonly LaneSpec[]): LabScene {
  const safeArea: Rect = {
    x: -MARGIN_X,
    y: 0,
    width: RAIL_LENGTH + MARGIN_X * 2,
    height: laneSpecs.length * LANE_HEIGHT,
  };
  const staticNode = (id: string, shape: Shape, x: number, y: number): EvaluatedNode => ({
    id,
    shape,
    fill: 'fill' in shape ? shape.fill : null,
    layer: 0,
    worldMatrix: translation(x, y),
    worldOpacity: 1,
  });

  const rows = laneSpecs.map((spec, index) => {
    const y = LANE_HEIGHT * (index + 0.5);
    const rail = staticNode(
      `${spec.id}-rail`,
      { kind: 'rect', width: RAIL_LENGTH, height: 4, fill: RAIL_COLOR },
      RAIL_LENGTH / 2,
      y,
    );
    const tickShape: Shape = { kind: 'rect', width: 3, height: 26, fill: spec.color };
    const ticks = spacingMarks(spec).map((progress, tick) =>
      staticNode(`${spec.id}-tick-${tick}`, tickShape, progress * RAIL_LENGTH, y),
    );
    const marker: Shape = {
      kind: 'ellipse',
      radiusX: MARKER_RADIUS,
      radiusY: MARKER_RADIUS,
      fill: spec.color,
    };
    return { spec, y, marker, fixed: [rail, ...ticks] };
  });

  return {
    lanes: laneSpecs,
    safeArea,
    aspectRatio: safeArea.width / safeArea.height,
    frameAt(time) {
      const nodes: EvaluatedNode[] = [];
      for (const row of rows) {
        nodes.push(...row.fixed);
        const { progress } = laneState(row.spec, time);
        nodes.push(staticNode(`${row.spec.id}-marker`, row.marker, progress * RAIL_LENGTH, row.y));
      }
      return {
        frame: 0,
        time,
        shotId: 'lab',
        background: LAB_BACKGROUND,
        safeArea,
        camera: {
          x: safeArea.x + safeArea.width / 2,
          y: safeArea.y + safeArea.height / 2,
          zoom: 1,
          rotation: 0,
        },
        nodes,
      };
    },
  };
}
