export interface ClockOptions {
  /** Timeline length in seconds. */
  readonly duration: number;
  /** Called whenever the time or the playing state may have changed. */
  readonly onChange: () => void;
  /** Monotonic time in milliseconds. */
  readonly now?: () => number;
  readonly requestFrame?: (callback: () => void) => number;
  readonly cancelFrame?: (handle: number) => void;
}

/**
 * The transport. Elapsed time is derived from a fixed anchor rather than accumulated
 * per frame, so playback does not drift and is independent of the frame rate.
 */
export class Clock {
  private readonly duration: number;
  private readonly onChange: () => void;
  private readonly now: () => number;
  private readonly requestFrame: (callback: () => void) => number;
  private readonly cancelFrame: (handle: number) => void;

  private anchorWall = 0;
  private anchorTime = 0;
  private frameHandle: number | null = null;

  constructor(options: ClockOptions) {
    this.duration = options.duration;
    this.onChange = options.onChange;
    this.now = options.now ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
  }

  get playing(): boolean {
    return this.frameHandle !== null;
  }

  get time(): number {
    if (!this.playing) return this.anchorTime;
    const elapsed = (this.now() - this.anchorWall) / 1000;
    return Math.min(this.duration, this.anchorTime + elapsed);
  }

  /** Starts playback. Playing from the end starts again from the beginning. */
  play(): void {
    if (this.playing) return;
    if (this.anchorTime >= this.duration) this.anchorTime = 0;
    this.anchorWall = this.now();
    this.scheduleFrame();
    this.onChange();
  }

  pause(): void {
    if (!this.playing) return;
    this.anchorTime = this.time;
    this.stopFrames();
    this.onChange();
  }

  /** Jumps to a time, clamped to the timeline. Keeps playing if it was playing. */
  seek(time: number): void {
    this.anchorTime = Math.min(this.duration, Math.max(0, time));
    this.anchorWall = this.now();
    this.onChange();
  }

  /** Returns to the start. Keeps the current playing state. */
  restart(): void {
    this.seek(0);
  }

  destroy(): void {
    this.stopFrames();
  }

  private scheduleFrame(): void {
    this.frameHandle = this.requestFrame(() => this.onFrame());
  }

  private stopFrames(): void {
    if (this.frameHandle !== null) this.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private onFrame(): void {
    const time = this.time;
    if (time >= this.duration) {
      this.anchorTime = this.duration;
      this.frameHandle = null;
    } else {
      this.scheduleFrame();
    }
    this.onChange();
  }
}
