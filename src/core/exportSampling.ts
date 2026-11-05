import { evaluateScene, type EvaluationOverrides, type FrameState } from './evaluate';
import type { Scene } from './schema';
import { exportFrameTimes } from './timing';

/**
 * Produces every output frame by sampling the scene at index / exportFps. It never touches a
 * clock, so the result cannot depend on real time, display rate or playback speed.
 * This selects frames only: encoding files is planned for Phase 5.
 */
export function* sampleExportFrames(
  scene: Scene,
  exportFps: number = scene.exportFps,
  overrides: EvaluationOverrides = {},
): Generator<FrameState> {
  for (const time of exportFrameTimes(scene.duration, exportFps)) {
    yield evaluateScene(scene, time, overrides);
  }
}
