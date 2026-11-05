import type { ProjectInput } from '../../core/schema';
import { EPISODE } from './episode';
import { Build, EPISODE_PALETTE, FPS, FRAME, PLANES } from './kit';
import { buildOverlay } from './overlay';
import { SHOT_BUILDERS } from './shots';

/**
 * The whole episode as one scene of 1440 frames. Every shot is built at the same origin and
 * shown only during its own time, so a cut is a change of which roots are visible. The camera
 * moves come from episode.json, one schema shot per camera segment.
 */
export function hollowBellCryptProject(): ProjectInput {
  const all = new Build();
  for (const shot of EPISODE.shots) {
    const builder = SHOT_BUILDERS[shot.id];
    if (builder) all.merge(builder());
  }
  all.merge(buildOverlay());

  const shots = EPISODE.shots.flatMap((shot) =>
    shot.camera.segments.map((segment) => {
      const first = segment.keys[0];
      return {
        id: segment.id,
        start: shot.start + segment.start,
        duration: segment.end - segment.start,
        camera: { x: first?.x ?? 0, y: first?.y ?? 0, zoom: first?.zoom ?? 1 },
        tracks:
          segment.keys.length < 2
            ? []
            : (['x', 'y', 'zoom'] as const).map((property) => ({
                property,
                keyframes: segment.keys.map((key) => ({
                  time: key.time,
                  value: key[property],
                  easing: key.easing ?? 'linear',
                })),
              })),
      };
    }),
  );

  return {
    schemaVersion: 3,
    id: EPISODE.id,
    name: `${EPISODE.title.en}: ${EPISODE.subtitle.en}`,
    kind: 'production',
    scenes: [
      {
        id: EPISODE.id,
        duration: EPISODE.format.duration,
        fps: FPS,
        exportFps: FPS,
        exposure: {
          character: EPISODE.format.characterHold,
          camera: 1,
          background: 1,
          secondary: 2,
        },
        background: 'token:void',
        palette: { ...EPISODE_PALETTE },
        planes: PLANES.map((plane) => ({ ...plane })),
        safeArea: {
          x: -FRAME.width / 2,
          y: -FRAME.height / 2,
          width: FRAME.width,
          height: FRAME.height,
        },
        nodes: all.nodes,
        tracks: all.tracks,
        poses: all.poses,
        poseTracks: all.poseTracks,
        shots,
      },
    ],
  };
}
