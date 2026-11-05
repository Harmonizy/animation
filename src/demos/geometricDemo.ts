import type { ProjectInput } from '../core/schema';

type SceneInput = ProjectInput['scenes'][number];
type NodeInput = SceneInput['nodes'][number];

/** Reaches past the widest view: 16:9 at the minimum zoom with the camera fully panned. */
const GRID_EXTENT = 3000;
const GRID_STEP = 250;
const GRID_COLOR = '#262b38';

/** A static reference grid, larger than any framing, that makes camera motion readable. */
function referenceGrid(): NodeInput[] {
  const nodes: NodeInput[] = [{ id: 'grid', layer: 0, shape: { kind: 'group' } }];
  for (let offset = -GRID_EXTENT; offset <= GRID_EXTENT; offset += GRID_STEP) {
    nodes.push(
      {
        id: `grid-v${offset}`,
        parent: 'grid',
        shape: { kind: 'rect', width: 3, height: GRID_EXTENT * 2, fill: GRID_COLOR },
        transform: { x: offset },
      },
      {
        id: `grid-h${offset}`,
        parent: 'grid',
        shape: { kind: 'rect', width: GRID_EXTENT * 2, height: 3, fill: GRID_COLOR },
        transform: { y: offset },
      },
    );
  }
  return nodes;
}

/**
 * Neutral technical demonstration: geometric shapes only, with no characters or story.
 * It exercises tracks, easing, hierarchy, pivots, layering, opacity and a camera cut.
 */
export const geometricDemo: ProjectInput = {
  schemaVersion: 2,
  id: 'geometric-demo',
  name: 'Geometric technical demo',
  kind: 'technical-demo',
  scenes: [
    {
      id: 'shapes',
      duration: 8,
      fps: 30,
      exportFps: 30,
      background: '#12141c',
      safeArea: { x: -540, y: -540, width: 1080, height: 1080 },
      nodes: [
        ...referenceGrid(),
        {
          id: 'square',
          layer: 1,
          shape: { kind: 'rect', width: 300, height: 300, fill: '#f0653a' },
          transform: { x: -280, y: 200 },
        },
        {
          id: 'circle',
          layer: 2,
          // Small enough to sit fully inside the square when they overlap, so neither
          // silhouette is reduced to stray corners.
          shape: { kind: 'ellipse', radiusX: 120, radiusY: 120, fill: '#3f8cff' },
          transform: { y: 200 },
        },
        {
          id: 'triangle',
          layer: 3,
          shape: {
            kind: 'polygon',
            points: [
              { x: 0, y: -125 },
              { x: 110, y: 85 },
              { x: -110, y: 85 },
            ],
            fill: '#2ec4a6',
          },
          // Clear of the hub's orbit, so its faded state stays readable.
          transform: { x: 390, y: -240 },
        },
        { id: 'hub', layer: 4, shape: { kind: 'group' }, transform: { y: -200 } },
        // The arms make the parent-child structure visible in the silhouette.
        {
          id: 'hub-arm',
          parent: 'hub',
          layer: 0,
          shape: { kind: 'rect', width: 160, height: 10, fill: '#8d8f99' },
          transform: { x: 80 },
        },
        {
          id: 'hub-core',
          parent: 'hub',
          layer: 1,
          shape: { kind: 'rect', width: 90, height: 90, fill: '#e8e6df' },
        },
        {
          id: 'satellite',
          parent: 'hub',
          layer: 2,
          shape: { kind: 'ellipse', radiusX: 50, radiusY: 50, fill: '#f2c14e' },
          transform: { x: 160 },
        },
        {
          id: 'moon-arm',
          parent: 'satellite',
          layer: 0,
          // Spans only the gap between the two discs: children draw above their parent.
          shape: { kind: 'rect', width: 30, height: 6, fill: '#8d8f99' },
          transform: { x: 65 },
        },
        {
          id: 'moon',
          parent: 'satellite',
          layer: 1,
          shape: { kind: 'ellipse', radiusX: 24, radiusY: 24, fill: '#c77dff' },
          transform: { x: 95 },
        },
      ],
      tracks: [
        // A slow drift, so background exposure has a visible effect.
        {
          target: 'grid',
          property: 'x',
          group: 'background',
          keyframes: [
            { time: 0, value: 0, easing: 'easeInOut' },
            { time: 4, value: 40, easing: 'easeInOut' },
            { time: 8, value: 0 },
          ],
        },
        {
          target: 'square',
          group: 'character',
          property: 'x',
          keyframes: [
            { time: 0, value: -280, easing: 'easeInOut' },
            { time: 4, value: 280, easing: 'easeInOut' },
            { time: 8, value: -280 },
          ],
        },
        {
          target: 'square',
          group: 'character',
          property: 'rotation',
          keyframes: [
            { time: 0, value: 0 },
            { time: 8, value: 360 },
          ],
        },
        {
          target: 'circle',
          group: 'character',
          property: 'scaleX',
          keyframes: [
            { time: 0, value: 1, easing: 'easeInOut' },
            { time: 4, value: 1.25, easing: 'easeInOut' },
            { time: 8, value: 1 },
          ],
        },
        {
          target: 'circle',
          group: 'character',
          property: 'scaleY',
          keyframes: [
            { time: 0, value: 1, easing: 'easeInOut' },
            { time: 4, value: 1.25, easing: 'easeInOut' },
            { time: 8, value: 1 },
          ],
        },
        {
          target: 'triangle',
          group: 'secondary',
          property: 'opacity',
          keyframes: [
            { time: 0, value: 0.45, easing: 'easeInOut' },
            { time: 4, value: 1, easing: 'easeInOut' },
            { time: 8, value: 0.45 },
          ],
        },
        {
          target: 'hub',
          group: 'secondary',
          property: 'rotation',
          keyframes: [
            { time: 0, value: 0 },
            { time: 8, value: 360 },
          ],
        },
        {
          target: 'satellite',
          group: 'secondary',
          property: 'rotation',
          keyframes: [
            { time: 0, value: 0 },
            { time: 8, value: 1080 },
          ],
        },
      ],
      shots: [
        {
          id: 'shot-a',
          start: 0,
          duration: 4,
          tracks: [
            {
              property: 'zoom',
              keyframes: [
                { time: 0, value: 1, easing: 'easeInOut' },
                { time: 4, value: 1.05 },
              ],
            },
          ],
        },
        {
          id: 'shot-b',
          start: 4,
          duration: 4,
          tracks: [
            {
              property: 'x',
              keyframes: [
                { time: 0, value: -40, easing: 'easeInOut' },
                { time: 2, value: 40, easing: 'easeInOut' },
                { time: 4, value: 0 },
              ],
            },
            {
              property: 'zoom',
              keyframes: [
                { time: 0, value: 0.85, easing: 'easeInOut' },
                { time: 4, value: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
};
