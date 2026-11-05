import gsap from 'gsap';
import { frameCount, frameToTime, lastFrame, timeToFrame } from '../core/timing';

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const;

export interface ClockOptions {
  /** Timeline length in seconds. */
  readonly duration: number;
  /** Frame rate used for frame numbers and stepping. It has no effect on playback rate. */
  readonly fps: number;
  /** Called whenever the time or the playing state may have changed. */
  readonly onChange: () => void;
}

// Use real elapsed time. GSAP's default lag smoothing would shift the timeline after a stall.
gsap.ticker.lagSmoothing(0);

/**
 * The transport, built on a paused GSAP timeline. GSAP only decides what the current
 * time is. Frame contents come from core/evaluate, so any timestamp stays reproducible
 * and this file is the only one that has to change if GSAP is ever replaced.
 *
 * While paused, the time is held here rather than read back from GSAP, which rounds it.
 */
export class Clock {
  private readonly duration: number;
  private readonly onChange: () => void;
  private readonly timeline: gsap.core.Timeline;
  private currentFps: number;
  private heldTime = 0;
  private looping = false;

  constructor(options: ClockOptions) {
    this.duration = options.duration;
    this.currentFps = options.fps;
    this.onChange = options.onChange;
    this.timeline = gsap.timeline({
      paused: true,
      onUpdate: () => this.onChange(),
      onComplete: () => {
        this.heldTime = this.duration;
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

  /** Playhead position in seconds, between 0 and the duration. */
  get time(): number {
    return this.playing ? this.timeline.time() : this.heldTime;
  }

  get fps(): number {
    return this.currentFps;
  }

  set fps(fps: number) {
    this.currentFps = fps;
    this.onChange();
  }

  /** The project frame under the playhead. The end of the timeline shows the last frame. */
  get frame(): number {
    return Math.min(this.lastFrame, timeToFrame(this.time, this.currentFps));
  }

  get frameCount(): number {
    return frameCount(this.duration, this.currentFps);
  }

  private get lastFrame(): number {
    return lastFrame(this.duration, this.currentFps);
  }

  get loop(): boolean {
    return this.looping;
  }

  set loop(enabled: boolean) {
    const time = this.time;
    this.looping = enabled;
    this.timeline.repeat(enabled ? -1 : 0);
    this.timeline.seek(time, true);
    this.onChange();
  }

  get speed(): number {
    return this.timeline.timeScale();
  }

  /** Changes how fast the playhead moves. It never changes what any frame contains. */
  set speed(speed: number) {
    this.timeline.timeScale(speed);
    this.onChange();
  }

  /** Starts playback. Playing from the end starts again from the beginning. */
  play(): void {
    if (this.playing) return;
    if (this.heldTime >= this.duration) this.heldTime = 0;
    this.timeline.seek(this.heldTime, true);
    this.timeline.play();
    this.onChange();
  }

  pause(): void {
    if (!this.playing) return;
    this.heldTime = this.timeline.time();
    this.timeline.pause();
    this.onChange();
  }

  /**
   * Jumps to a time, clamped to the timeline. Keeps playing, unless that reaches the end
   * without looping. When looping, the end is the last frame, since it would otherwise wrap.
   */
  seek(time: number): void {
    let target = Math.min(this.duration, Math.max(0, time));
    if (target >= this.duration) {
      if (this.looping) target = frameToTime(this.lastFrame, this.currentFps);
      else this.timeline.pause();
    }
    this.heldTime = target;
    this.timeline.seek(target, true);
    this.onChange();
  }

  /** Jumps to the start of a frame, clamped to the timeline. */
  seekFrame(frame: number): void {
    const clamped = Math.min(this.lastFrame, Math.max(0, Math.round(frame)));
    this.seek(frameToTime(clamped, this.currentFps));
  }

  /** Pauses, then moves one frame on. Stops at the last frame, or wraps when looping. */
  stepForward(): void {
    this.step(1);
  }

  /** Pauses, then moves one frame back. Stops at frame 0, or wraps when looping. */
  stepBackward(): void {
    this.step(-1);
  }

  /** Returns to the start. Keeps the current playing state. */
  restart(): void {
    this.seek(0);
  }

  destroy(): void {
    this.timeline.kill();
  }

  private step(delta: number): void {
    this.pause();
    const target = this.frame + delta;
    const count = this.frameCount;
    this.seekFrame(this.looping ? (target + count) % count : target);
  }
}
