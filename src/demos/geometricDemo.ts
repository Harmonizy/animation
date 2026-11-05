import type { ProjectInput } from '../core/schema';

type SceneInput = ProjectInput['scenes'][number];
type NodeInput = SceneInput['nodes'][number];

const GRID_EXTENT = 2000;
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
  schemaVersion: 1,
  id: 'geometric-demo',
  name: 'Geometric technical demo',
  kind: 'technical-demo',
  scenes: [
    {
      id: 'shapes',
      duration: 8,
      fps: 30,
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
          shape: { kind: 'ellipse', radiusX: 170, radiusY: 170, fill: '#3f8cff' },
          transform: { y: 200 },
        },
        {
          id: 'triangle',
          layer: 3,
          shape: {
            kind: 'polygon',
            points: [
              { x: 0, y: -130 },
              { x: 125, y: 90 },
              { x: -125, y: 90 },
            ],
            fill: '#2ec4a6',
          },
          transform: { x: 330, y: -240 },
        },
        { id: 'hub', layer: 4, shape: { kind: 'group' }, transform: { y: -180 } },
        {
          id: 'hub-core',
          parent: 'hub',
          shape: { kind: 'rect', width: 90, height: 90, fill: '#e8e6df' },
        },
        {
          id: 'satellite',
          parent: 'hub',
          shape: { kind: 'ellipse', radiusX: 55, radiusY: 55, fill: '#f2c14e' },
          transform: { x: 200 },
        },
        {
          id: 'moon',
          parent: 'satellite',
          shape: { kind: 'ellipse', radiusX: 24, radiusY: 24, fill: '#c77dff' },
          transform: { x: 80 },
        },
      ],
      tracks: [
        {
          target: 'square',
          property: 'x',
          keyframes: [
            { time: 0, value: -280, easing: 'easeInOut' },
            { time: 4, value: 280, easing: 'easeInOut' },
            { time: 8, value: -280 },
          ],
        },
        {
          target: 'square',
          property: 'rotation',
          keyframes: [
            { time: 0, value: 0 },
            { time: 8, value: 360 },
          ],
        },
        {
          target: 'circle',
          property: 'scaleX',
          keyframes: [
            { time: 0, value: 1, easing: 'easeInOut' },
            { time: 4, value: 1.25, easing: 'easeInOut' },
            { time: 8, value: 1 },
          ],
        },
        {
          target: 'circle',
          property: 'scaleY',
          keyframes: [
            { time: 0, value: 1, easing: 'easeInOut' },
            { time: 4, value: 1.25, easing: 'easeInOut' },
            { time: 8, value: 1 },
          ],
        },
        {
          target: 'triangle',
          property: 'opacity',
          keyframes: [
            { time: 0, value: 0.25, easing: 'easeOut' },
            { time: 4, value: 1, easing: 'easeIn' },
            { time: 8, value: 0.25 },
          ],
        },
        {
          target: 'hub',
          property: 'rotation',
          keyframes: [
            { time: 0, value: 0 },
            { time: 8, value: 360 },
          ],
        },
        {
          target: 'satellite',
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
