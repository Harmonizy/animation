import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../../src/playback/clock';

describe('Clock', () => {
  let wall: number;
  let pending: Map<number, () => void>;
  let nextHandle: number;
  let onChange: ReturnType<typeof vi.fn<() => void>>;
  let clock: Clock;

  /** Advances fake time and fires the scheduled animation frame, if any. */
  const advance = (milliseconds: number) => {
    wall += milliseconds;
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback();
  };

  beforeEach(() => {
    wall = 1000;
    pending = new Map();
    nextHandle = 1;
    onChange = vi.fn<() => void>();
    clock = new Clock({
      duration: 10,
      onChange,
      now: () => wall,
      requestFrame: (callback) => {
        const handle = nextHandle++;
        pending.set(handle, callback);
        return handle;
      },
      cancelFrame: (handle) => pending.delete(handle),
    });
  });

  it('starts paused at zero', () => {
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(false);
    expect(pending.size).toBe(0);
  });

  it('advances while playing and notifies on each frame', () => {
    clock.play();
    onChange.mockClear();
    advance(500);
    expect(clock.time).toBe(0.5);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not depend on the frame rate or accumulate error', () => {
    clock.play();
    for (let i = 0; i < 1000; i++) advance(1000 / 144);
    const fine = clock.time;
    expect(fine).toBeCloseTo(1000 / 144, 9);
  });

  it('holds its time while paused and resumes from it', () => {
    clock.play();
    advance(1000);
    clock.pause();
    expect(pending.size).toBe(0);
    wall += 5000;
    expect(clock.time).toBe(1);
    clock.play();
    advance(1000);
    expect(clock.time).toBe(2);
  });

  it('seeks while paused and clamps to the timeline', () => {
    clock.seek(4);
    expect(clock.time).toBe(4);
    expect(clock.playing).toBe(false);
    clock.seek(-1);
    expect(clock.time).toBe(0);
    clock.seek(99);
    expect(clock.time).toBe(10);
  });

  it('keeps playing from the new time after a seek', () => {
    clock.play();
    advance(1000);
    clock.seek(5);
    advance(1000);
    expect(clock.time).toBe(6);
    expect(clock.playing).toBe(true);
  });

  it('restart returns to zero and keeps the playing state', () => {
    clock.seek(5);
    clock.restart();
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(false);

    clock.play();
    advance(1000);
    clock.restart();
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(true);
  });

  it('stops exactly at the end and replays from the start', () => {
    clock.play();
    advance(11000);
    expect(clock.time).toBe(10);
    expect(clock.playing).toBe(false);
    expect(pending.size).toBe(0);

    clock.play();
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(true);
  });

  it('ignores repeated play and pause', () => {
    clock.play();
    clock.play();
    expect(pending.size).toBe(1);
    clock.pause();
    onChange.mockClear();
    clock.pause();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('destroy cancels pending frames', () => {
    clock.play();
    clock.destroy();
    expect(pending.size).toBe(0);
    expect(clock.playing).toBe(false);
  });
});
