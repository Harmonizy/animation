import gsap from 'gsap';
import { describe, expect, it } from 'vitest';
import {
  EXPOSURE_PRESETS,
  PROJECT_FPS,
  exportFrameTimes,
  firstFrameAtOrAfter,
  formatTimecode,
  frameCount,
  frameToTime,
  lastFrame,
  poseFrame,
  poseIndex,
  timeToFrame,
} from '../../src/core/timing';

describe('frame and time mapping', () => {
  it.each(PROJECT_FPS)('round-trips every frame at %d fps', (fps) => {
    for (let frame = 0; frame <= 100_000; frame++) {
      if (timeToFrame(frameToTime(frame, fps), fps) !== frame) {
        expect.fail(`frame ${frame} at ${fps} fps`);
      }
    }
  });

  it.each(PROJECT_FPS)('round-trips through GSAP seek rounding at %d fps', (fps) => {
    const timeline = gsap.timeline({ paused: true });
    timeline.to({}, { duration: 200, ease: 'none' });
    for (let frame = 0; frame < 200 * fps; frame++) {
      timeline.seek(frameToTime(frame, fps), true);
      if (timeToFrame(timeline.time(), fps) !== frame) {
        expect.fail(`frame ${frame} at ${fps} fps`);
      }
    }
    timeline.kill();
  });

  it('gives the expected frame part way through a frame', () => {
    expect(timeToFrame(0.04, 24)).toBe(0);
    expect(timeToFrame(0.042, 24)).toBe(1);
    expect(timeToFrame(1, 24)).toBe(24);
    expect(timeToFrame(1 / 24 - 0.001, 24)).toBe(0);
  });

  it('never returns a negative frame', () => {
    expect(timeToFrame(-5, 24)).toBe(0);
    expect(firstFrameAtOrAfter(-5, 24)).toBe(0);
  });

  it('rounds shot boundaries up to the next frame', () => {
    expect(firstFrameAtOrAfter(1, 12)).toBe(12);
    expect(firstFrameAtOrAfter(1.01, 12)).toBe(13);
  });
});

describe('frame counts', () => {
  it.each([
    [12, 96],
    [24, 192],
    [25, 200],
    [30, 240],
    [60, 480],
  ])('8 seconds at %d fps is %d frames', (fps, expected) => {
    expect(frameCount(8, fps)).toBe(expected);
    expect(lastFrame(8, fps)).toBe(expected - 1);
    expect(exportFrameTimes(8, fps)).toHaveLength(expected);
  });

  it('rounds partial frames up, so the whole duration is covered', () => {
    expect(frameCount(2.5, 25)).toBe(63);
    expect(frameCount(0.01, 24)).toBe(1);
  });

  it('is not thrown off by float error in the duration', () => {
    expect(frameCount(0.1 + 0.2, 30)).toBe(9);
    expect(frameCount(1.1, 30)).toBe(33);
  });
});

describe('exposure', () => {
  const sequence = (hold: number, frames: number, anchor = 0) =>
    Array.from({ length: frames }, (_, frame) => poseIndex(frame, hold, anchor));

  it('maps presets to the expected hold frames', () => {
    expect(EXPOSURE_PRESETS).toEqual({ ones: 1, twos: 2, threes: 3, fours: 4 });
  });

  it('exposes one pose per frame on ones', () => {
    expect(sequence(1, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('holds each pose for two frames on twos', () => {
    expect(sequence(2, 7)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('holds each pose for three frames on threes', () => {
    expect(sequence(3, 7)).toEqual([0, 0, 0, 1, 1, 1, 2]);
  });

  it('holds each pose for four frames on fours', () => {
    expect(sequence(4, 9)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2]);
  });

  it('supports custom holds', () => {
    expect(sequence(5, 11)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2]);
  });

  it('samples a held pose at the frame where it started', () => {
    const frames = [0, 1, 2, 3, 4, 5, 6].map((frame) => poseFrame(frame, 3));
    expect(frames).toEqual([0, 0, 0, 3, 3, 3, 6]);
  });

  it('can count poses from an anchor, such as the start of a shot', () => {
    expect([10, 11, 12, 13].map((frame) => poseFrame(frame, 2, 10))).toEqual([10, 10, 12, 12]);
    expect(poseIndex(13, 2, 10)).toBe(1);
  });
});

describe('formatTimecode', () => {
  it('formats the frame part in the project frame rate', () => {
    expect(formatTimecode(0, 24)).toBe('00:00:00:00');
    expect(formatTimecode(23, 24)).toBe('00:00:00:23');
    expect(formatTimecode(24, 24)).toBe('00:00:01:00');
    expect(formatTimecode(75, 30)).toBe('00:00:02:15');
    expect(formatTimecode(24, 25)).toBe('00:00:00:24');
  });

  it('carries into minutes and hours', () => {
    expect(formatTimecode(60 * 60, 60)).toBe('00:01:00:00');
    expect(formatTimecode(3661 * 12 + 5, 12)).toBe('01:01:01:05');
  });
});

describe('exportFrameTimes', () => {
  it('derives each time from its index', () => {
    expect(exportFrameTimes(1, 12)).toEqual(Array.from({ length: 12 }, (_, i) => i / 12));
  });

  it('does not contain the end of the timeline', () => {
    expect(exportFrameTimes(2, 30).at(-1)).toBe(59 / 30);
  });
});
