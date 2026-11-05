export const PROJECT_FPS = [12, 24, 25, 30, 60] as const;
export type ProjectFps = (typeof PROJECT_FPS)[number];

export const TRACK_GROUPS = ['character', 'camera', 'background', 'secondary'] as const;
export type TrackGroup = (typeof TRACK_GROUPS)[number];

/** Named exposures. Any other whole number of frames is a custom hold. */
export const EXPOSURE_PRESETS = { ones: 1, twos: 2, threes: 3, fours: 4 } as const;

/**
 * Tolerance, in frames, when converting time to a frame. Both float division and GSAP's
 * time rounding (up to about 3.3e-8 s) can land just below a frame boundary, where a plain
 * floor would give the previous frame. See docs/architecture/timing.md.
 */
const FRAME_EPSILON = 1e-3;

export function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

/** The frame showing at `time`: the latest frame that starts at or before it. */
export function timeToFrame(time: number, fps: number): number {
  return Math.max(0, Math.floor(time * fps + FRAME_EPSILON));
}

/** The first frame that starts at or after `time`. */
export function firstFrameAtOrAfter(time: number, fps: number): number {
  return Math.max(0, Math.ceil(time * fps - FRAME_EPSILON));
}

/**
 * Frames in a timeline. They cover [0, duration): the end time is not a frame of its own,
 * because it is frame 0 of the next pass. A loop therefore never repeats a picture.
 */
export function frameCount(duration: number, fps: number): number {
  return Math.max(1, firstFrameAtOrAfter(duration, fps));
}

export function lastFrame(duration: number, fps: number): number {
  return frameCount(duration, fps) - 1;
}

/** Which pose is exposed on `frame`, counting from `anchorFrame`. */
export function poseIndex(frame: number, hold: number, anchorFrame = 0): number {
  return Math.floor((frame - anchorFrame) / hold);
}

/** The frame on which the pose exposed at `frame` was sampled. */
export function poseFrame(frame: number, hold: number, anchorFrame = 0): number {
  return anchorFrame + poseIndex(frame, hold, anchorFrame) * hold;
}

/** Non-drop-frame HH:MM:SS:FF. */
export function formatTimecode(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(totalSeconds % 60)}:${pad(frame % fps)}`;
}

/** Output sample times. Each comes directly from its index, so errors cannot accumulate. */
export function exportFrameTimes(duration: number, exportFps: number): number[] {
  return Array.from({ length: frameCount(duration, exportFps) }, (_, index) =>
    frameToTime(index, exportFps),
  );
}
