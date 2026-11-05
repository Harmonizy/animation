import { describe, expect, it } from 'vitest';
import {
  LAB_DURATION,
  LAB_TABS,
  createLabScene,
  laneState,
  lanesForTab,
  posesPerSecond,
  spacingMarks,
  type LaneSpec,
} from '../../src/labs/timing/model';

const lane = (tab: Parameters<typeof lanesForTab>[0], id: string, fps?: number): LaneSpec => {
  const found = lanesForTab(tab, fps).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing lane ${id}`);
  return found;
};

const gaps = (marks: number[]) => marks.slice(1).map((mark, i) => mark - (marks[i] as number));

describe('FPS comparison', () => {
  it('compares 12, 24, 30 and 60 fps on ones', () => {
    const specs = lanesForTab('fps');
    expect(specs.map((spec) => spec.fps)).toEqual([12, 24, 30, 60]);
    expect(specs.every((spec) => spec.hold === 1)).toBe(true);
  });

  it('shows the frame number each rate is on at one second', () => {
    expect(lanesForTab('fps').map((spec) => laneState(spec, 1).frame)).toEqual([12, 24, 30, 60]);
  });

  it('reaches the same position on frame boundaries they share', () => {
    const positions = lanesForTab('fps').map((spec) => laneState(spec, 1).progress);
    for (const position of positions) expect(position).toBeCloseTo(0.5);
  });

  it('updates less often at lower rates', () => {
    const changes = (spec: LaneSpec) => {
      const seen = new Set<number>();
      for (let i = 0; i < 240; i++) seen.add(laneState(spec, i / 240).progress);
      return seen.size;
    };
    expect(changes(lane('fps', 'fps-12'))).toBe(12);
    expect(changes(lane('fps', 'fps-60'))).toBe(60);
  });
});

describe('exposure comparison', () => {
  it('compares ones, twos and threes at the chosen rate', () => {
    expect(lanesForTab('exposure', 30).map((spec) => [spec.fps, spec.hold])).toEqual([
      [30, 1],
      [30, 2],
      [30, 3],
    ]);
  });

  it('gives the expected pose numbers', () => {
    const at = (id: string, frame: number) => laneState(lane('exposure', id), frame / 24).pose;
    expect([0, 1, 2, 3, 4].map((frame) => at('exposure-ones', frame))).toEqual([0, 1, 2, 3, 4]);
    expect([0, 1, 2, 3, 4].map((frame) => at('exposure-twos', frame))).toEqual([0, 0, 1, 1, 2]);
    expect([0, 1, 2, 3, 4].map((frame) => at('exposure-threes', frame))).toEqual([0, 0, 0, 1, 1]);
  });

  it('holds position for the whole hold', () => {
    const twos = lane('exposure', 'exposure-twos');
    expect(laneState(twos, 3 / 24).progress).toBe(laneState(twos, 2 / 24).progress);
    expect(laneState(twos, 4 / 24).progress).toBeGreaterThan(laneState(twos, 3 / 24).progress);
  });

  it('reports poses per second', () => {
    expect(lanesForTab('exposure').map(posesPerSecond)).toEqual([24, 12, 8]);
  });
});

describe('spacing comparison', () => {
  const marks = (id: string) => spacingMarks(lane('spacing', id));

  it('gives every lane the same timing', () => {
    const specs = lanesForTab('spacing');
    expect(new Set(specs.map((spec) => spec.travel)).size).toBe(1);
    expect(new Set(specs.map((spec) => spacingMarks(spec).length)).size).toBe(1);
  });

  it('spaces poses evenly on linear', () => {
    const steps = gaps(marks('spacing-linear'));
    for (const step of steps) expect(step).toBeCloseTo(steps[0] as number);
  });

  it('widens the gaps on ease in and narrows them on ease out', () => {
    const easeIn = gaps(marks('spacing-easeIn'));
    const easeOut = gaps(marks('spacing-easeOut'));
    expect(easeIn.at(-1)).toBeGreaterThan(easeIn[0] as number);
    expect(easeOut.at(-1)).toBeLessThan(easeOut[0] as number);
  });

  it('is tightest at both ends on ease in-out', () => {
    const steps = gaps(marks('spacing-easeInOut'));
    const middle = steps[Math.floor(steps.length / 2)] as number;
    expect(middle).toBeGreaterThan(steps[0] as number);
    expect(middle).toBeGreaterThan(steps.at(-1) as number);
  });

  it('holds still until the end on step', () => {
    const values = marks('spacing-step');
    expect(values.slice(0, -1).every((value) => value === 0)).toBe(true);
    expect(values.at(-1)).toBe(1);
  });
});

describe('timing comparison', () => {
  it('covers the same distance in different numbers of frames', () => {
    const specs = lanesForTab('timing');
    expect(specs.map((spec) => spacingMarks(spec).length - 1)).toEqual([12, 24, 48]);
    for (const spec of specs) expect(spacingMarks(spec).at(-1)).toBe(1);
  });

  it('arrives sooner with fewer frames, then rests', () => {
    const [fast, medium, slow] = lanesForTab('timing') as [LaneSpec, LaneSpec, LaneSpec];
    expect(laneState(fast, 0.5).progress).toBe(1);
    expect(laneState(medium, 0.5).progress).toBeCloseTo(0.5);
    expect(laneState(slow, 0.5).progress).toBeCloseTo(0.25);
    expect(laneState(fast, 2).progress).toBe(1);
  });
});

describe('createLabScene', () => {
  it.each(LAB_TABS)('builds a stable, reproducible frame for the %s tab', (tab) => {
    const scene = createLabScene(lanesForTab(tab));
    const frame = scene.frameAt(1.23);
    expect(scene.frameAt(1.23)).toEqual(frame);
    expect(new Set(frame.nodes.map((node) => node.id)).size).toBe(frame.nodes.length);
    expect(frame.nodes.at(-1)?.id).toContain('-marker');
  });

  it('reuses shape objects between frames so renderers can skip redrawing', () => {
    const scene = createLabScene(lanesForTab('fps'));
    const shapes = (time: number) => scene.frameAt(time).nodes.map((node) => node.shape);
    shapes(0).forEach((shape, index) => expect(shapes(2)[index]).toBe(shape));
  });

  it('never goes past the end of the lab timeline', () => {
    for (const spec of lanesForTab('fps')) {
      expect(laneState(spec, LAB_DURATION).frame).toBe(LAB_DURATION * spec.fps - 1);
    }
  });
});
