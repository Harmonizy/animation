import gsap from 'gsap';

export interface ClockOptions {
  /** Timeline length in seconds. */
  readonly duration: number;
  /** Called whenever the time or the playing state may have changed. */
  readonly onChange: () => void;
}

// Use real elapsed time. GSAP's default lag smoothing would shift the timeline after a stall.
gsap.ticker.lagSmoothing(0);

/**
 * The transport, built on a paused GSAP timeline. GSAP only decides what the current
 * time is. Frame contents come from core/evaluate, so any timestamp stays reproducible
 * and this file is the only one that has to change if GSAP is ever replaced.
 */
export class Clock {
  private readonly duration: number;
  private readonly onChange: () => void;
  private readonly timeline: gsap.core.Timeline;

  constructor(options: ClockOptions) {
    this.duration = options.duration;
    this.onChange = options.onChange;
    this.timeline = gsap.timeline({
      paused: true,
      onUpdate: () => this.onChange(),
      onComplete: () => {
        this.timeline.pause();
        this.onChange();
      },
    });
    // The timeline animates nothing visible: an empty tween only gives it a length.
    this.timeline.to({}, { duration: this.duration, ease: 'none' });
  }

  get playing(): boolean {
    return !this.timeline.paused();
  }

  get time(): number {
    return this.timeline.time();
  }

  /** Starts playback. Playing from the end starts again from the beginning. */
  play(): void {
    if (this.playing) return;
    if (this.time >= this.duration) this.timeline.seek(0, true);
    this.timeline.play();
    this.onChange();
  }

  pause(): void {
    if (!this.playing) return;
    this.timeline.pause();
    this.onChange();
  }

  /** Jumps to a time, clamped to the timeline. Keeps playing unless that reaches the end. */
  seek(time: number): void {
    const target = Math.min(this.duration, Math.max(0, time));
    this.timeline.seek(target, true);
    if (target >= this.duration) this.timeline.pause();
    this.onChange();
  }

  /** Returns to the start. Keeps the current playing state. */
  restart(): void {
    this.seek(0);
  }

  destroy(): void {
    this.timeline.kill();
  }
}
