import gsap from 'gsap';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../../src/playback/clock';

describe('Clock', () => {
  let rootTime: number;
  let onChange: ReturnType<typeof vi.fn<() => void>>;
  let clock: Clock;

  /** Moves GSAP's root timeline by hand, standing in for animation frames. */
  const advance = (seconds: number) => {
    rootTime += seconds;
    gsap.updateRoot(rootTime);
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
    onChange = vi.fn<() => void>();
    clock = new Clock({ duration: 10, onChange });
  });

  afterEach(() => {
    clock.destroy();
  });

  it('starts paused at zero', () => {
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(false);
  });

  it('advances while playing and notifies on update', () => {
    clock.play();
    onChange.mockClear();
    advance(0.5);
    expect(clock.time).toBeCloseTo(0.5, 5);
    expect(onChange).toHaveBeenCalled();
  });

  it('reaches the same time at any update rate', () => {
    clock.play();
    for (let i = 0; i < 144; i++) advance(1 / 144);
    const fine = clock.time;
    clock.destroy();

    clock = new Clock({ duration: 10, onChange });
    clock.play();
    advance(1);
    expect(fine).toBeCloseTo(clock.time, 5);
    expect(fine).toBeCloseTo(1, 5);
  });

  it('holds its time while paused and resumes from it', () => {
    clock.play();
    advance(1);
    clock.pause();
    advance(5);
    expect(clock.time).toBeCloseTo(1, 5);
    clock.play();
    advance(1);
    expect(clock.time).toBeCloseTo(2, 5);
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
    advance(1);
    clock.seek(5);
    advance(1);
    expect(clock.time).toBeCloseTo(6, 5);
    expect(clock.playing).toBe(true);
  });

  it('restart returns to zero and keeps the playing state', () => {
    clock.seek(5);
    clock.restart();
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(false);

    clock.play();
    advance(1);
    clock.restart();
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(true);
  });

  it('stops exactly at the end and replays from the start', () => {
    clock.play();
    advance(11);
    expect(clock.time).toBe(10);
    expect(clock.playing).toBe(false);

    clock.play();
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(true);
  });

  it('does not resume by itself when seeking back after the end', () => {
    clock.play();
    advance(11);
    clock.seek(2);
    advance(1);
    expect(clock.time).toBe(2);
    expect(clock.playing).toBe(false);
  });

  it('stops when a seek lands on the end during playback', () => {
    clock.play();
    clock.seek(10);
    expect(clock.playing).toBe(false);
    clock.seek(3);
    advance(1);
    expect(clock.time).toBe(3);
  });

  it('ignores repeated play and pause', () => {
    clock.play();
    onChange.mockClear();
    clock.play();
    expect(onChange).not.toHaveBeenCalled();
    clock.pause();
    onChange.mockClear();
    clock.pause();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops notifying after destroy', () => {
    clock.play();
    clock.destroy();
    onChange.mockClear();
    advance(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});
