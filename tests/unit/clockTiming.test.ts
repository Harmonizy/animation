import gsap from 'gsap';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_FPS } from '../../src/core/timing';
import { Clock, PLAYBACK_SPEEDS } from '../../src/playback/clock';

describe('Clock timing', () => {
  let rootTime: number;
  let clock: Clock;
  const clocks: Clock[] = [];

  const advance = (seconds: number) => {
    rootTime += seconds;
    gsap.updateRoot(rootTime);
  };

  const make = (fps = 24, duration = 10) => {
    const created = new Clock({ duration, fps, onChange: vi.fn() });
    clocks.push(created);
    return created;
  };

  beforeAll(() => {
    gsap.ticker.remove(gsap.updateRoot);
  });

  afterAll(() => {
    gsap.ticker.add(gsap.updateRoot);
  });

  beforeEach(() => {
    rootTime = gsap.ticker.time;
    gsap.updateRoot(rootTime);
    clock = make();
  });

  afterEach(() => {
    for (const created of clocks.splice(0)) created.destroy();
  });

  describe('display refresh rate', () => {
    it.each([30, 60, 75, 90, 120, 144, 165, 240, 360])(
      'reaches the same time and frame at %d Hz',
      (hz) => {
        clock.play();
        for (let i = 0; i < hz * 3; i++) advance(1 / hz);
        expect(clock.time).toBeCloseTo(3, 5);
        expect(clock.frame).toBe(72);
      },
    );

    it('is not affected by uneven update spacing', () => {
      clock.play();
      const gaps = [0.001, 0.05, 0.004, 0.2, 0.016, 0.033, 0.3, 0.008];
      let elapsed = 0;
      for (let i = 0; i < 80; i++) {
        const gap = gaps[i % gaps.length] as number;
        advance(gap);
        elapsed += gap;
      }
      expect(clock.time).toBeCloseTo(elapsed, 5);
    });

    it('never skips or repeats a frame on a display faster than the frame rate', () => {
      clock.play();
      const seen: number[] = [];
      for (let i = 0; i < 240; i++) {
        advance(1 / 240);
        if (seen.at(-1) !== clock.frame) seen.push(clock.frame);
      }
      expect(seen[0]).toBe(0);
      expect(seen.at(-1)).toBe(24);
      seen.forEach((frame, index) => expect(frame).toBe(index));
    });
  });

  describe('frames', () => {
    it.each(PROJECT_FPS)('lands on every frame exactly at %d fps', (fps) => {
      const subject = make(fps, 5);
      for (let frame = 0; frame < subject.frameCount; frame++) {
        subject.seekFrame(frame);
        if (subject.frame !== frame) expect.fail(`frame ${frame}`);
      }
    });

    it('reports the last frame at the end of the timeline', () => {
      clock.seek(10);
      expect(clock.frame).toBe(239);
      expect(clock.frameCount).toBe(240);
    });

    it('clamps seekFrame and rounds fractional input', () => {
      clock.seekFrame(9999);
      expect(clock.frame).toBe(239);
      clock.seekFrame(-3);
      expect(clock.frame).toBe(0);
      clock.seekFrame(4.4);
      expect(clock.frame).toBe(4);
    });

    it('keeps the time when the frame rate changes', () => {
      clock.seekFrame(24);
      clock.fps = 60;
      expect(clock.time).toBe(1);
      expect(clock.frame).toBe(60);
      expect(clock.frameCount).toBe(600);
    });
  });

  describe('stepping', () => {
    it('moves exactly one frame each way', () => {
      clock.seekFrame(10);
      clock.stepForward();
      expect(clock.frame).toBe(11);
      clock.stepBackward();
      clock.stepBackward();
      expect(clock.frame).toBe(9);
    });

    it('stays exact over a whole timeline at every frame rate', () => {
      for (const fps of PROJECT_FPS) {
        const subject = make(fps, 2);
        for (let expected = 1; expected < subject.frameCount; expected++) {
          subject.stepForward();
          if (subject.frame !== expected) expect.fail(`${fps} fps, forward to ${expected}`);
        }
        for (let expected = subject.frameCount - 2; expected >= 0; expected--) {
          subject.stepBackward();
          if (subject.frame !== expected) expect.fail(`${fps} fps, back to ${expected}`);
        }
      }
    });

    it('stops at both ends without looping', () => {
      clock.stepBackward();
      expect(clock.frame).toBe(0);
      clock.seekFrame(239);
      clock.stepForward();
      expect(clock.frame).toBe(239);
    });

    it('wraps at both ends when looping', () => {
      clock.loop = true;
      clock.stepBackward();
      expect(clock.frame).toBe(239);
      clock.stepForward();
      expect(clock.frame).toBe(0);
    });

    it('pauses first when stepping during playback', () => {
      clock.play();
      advance(1.01);
      clock.stepForward();
      expect(clock.playing).toBe(false);
      expect(clock.frame).toBe(25);
    });

    it('steps from the frame showing when between frames', () => {
      clock.seek(1.03);
      expect(clock.frame).toBe(24);
      clock.stepForward();
      expect(clock.frame).toBe(25);
      expect(clock.time).toBe(25 / 24);
    });

    it('steps back from the end of the timeline to the frame before the last', () => {
      clock.play();
      advance(11);
      clock.stepBackward();
      expect(clock.frame).toBe(238);
    });
  });

  describe('loop', () => {
    it('wraps while playing and keeps running', () => {
      clock.loop = true;
      clock.play();
      advance(10.5);
      expect(clock.playing).toBe(true);
      expect(clock.time).toBeCloseTo(0.5, 5);
      expect(clock.frame).toBe(12);
    });

    it('can be turned off during playback, then finishes on this pass', () => {
      clock.loop = true;
      clock.play();
      advance(12);
      clock.loop = false;
      expect(clock.time).toBeCloseTo(2, 5);
      advance(9);
      expect(clock.playing).toBe(false);
      expect(clock.time).toBe(10);
    });

    it('seeks to the last frame rather than wrapping when asked for the end', () => {
      clock.loop = true;
      clock.seek(99);
      expect(clock.frame).toBe(239);
    });

    it('seeks correctly after several passes', () => {
      clock.loop = true;
      clock.play();
      advance(25);
      clock.seekFrame(48);
      advance(1);
      expect(clock.time).toBeCloseTo(3, 5);
    });

    it('never produces a frame outside the timeline', () => {
      clock.loop = true;
      clock.play();
      for (let i = 0; i < 2000; i++) {
        advance(1 / 60);
        if (clock.frame < 0 || clock.frame > 239) expect.fail(`frame ${clock.frame}`);
      }
    });
  });

  describe('speed', () => {
    it.each(PLAYBACK_SPEEDS)('moves the playhead at %d times real time', (speed) => {
      clock.speed = speed;
      clock.play();
      for (let i = 0; i < 120; i++) advance(1 / 120);
      expect(clock.time).toBeCloseTo(speed, 5);
    });

    it('does not jump when changed during playback', () => {
      clock.play();
      advance(1);
      clock.speed = 2;
      expect(clock.time).toBeCloseTo(1, 5);
      advance(1);
      expect(clock.time).toBeCloseTo(3, 5);
    });

    it('keeps working across seeks, pauses and loops', () => {
      clock.speed = 2;
      clock.loop = true;
      clock.play();
      advance(6);
      expect(clock.time).toBeCloseTo(2, 5);
      clock.pause();
      clock.seek(1);
      clock.play();
      advance(1);
      expect(clock.time).toBeCloseTo(3, 5);
    });
  });
});
