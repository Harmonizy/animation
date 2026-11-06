import type { ProjectInput } from '../../core/schema';
import { FRAME, PLANES } from '../shared/build';
import { TA_EPISODE } from './episode';
import { buildTaOverlay } from './overlay';
import { TA_FILM_PALETTE } from './palette';
import { buildShots } from './shots';

/** DON'T LOOK BACK as one 1440-frame scene, with one camera segment per shot. */
export function taDontLookBackProject(): ProjectInput {
  const all = buildShots();
  all.merge(buildTaOverlay());
  const shots = TA_EPISODE.shots.map((shot) => {
    const first = shot.camera.keys[0];
    return {
      id: shot.shotId,
      start: shot.startTime,
      duration: shot.endTime - shot.startTime,
      camera: { x: first?.x ?? 0, y: first?.y ?? 0, zoom: first?.zoom ?? 1 },
      tracks:
        shot.camera.keys.length < 2
          ? []
          : (['x', 'y', 'zoom'] as const).map((property) => ({
              property,
              keyframes: shot.camera.keys.map((key) => ({
                time: key.time,
                value: key[property],
                easing: key.easing ?? 'linear',
              })),
            })),
    };
  });
  return {
    schemaVersion: 3,
    id: TA_EPISODE.id,
    name: `${TA_EPISODE.title.en} (${TA_EPISODE.title.th})`,
    kind: 'production',
    scenes: [
      {
        id: TA_EPISODE.id,
        duration: 60,
        fps: 24,
        exportFps: 24,
        exposure: {
          character: TA_EPISODE.format.characterHold,
          camera: 1,
          background: 1,
          secondary: 2,
        },
        background: 'token:deepBlack',
        palette: { ...TA_FILM_PALETTE },
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
        shapeTracks: all.shapeTracks,
        shots,
      },
    ],
  };
}
