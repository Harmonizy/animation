import { evaluateFrame } from '../../core/evaluate';
import { applyToPoint, type Mat2D } from '../../core/matrix';
import { parseProject, type ProjectInput } from '../../core/schema';
import { flattenSvgPath } from '../../core/svgPath';
import { figureNodes, type FigurePlacement } from './harmonie-scene';
import { HARMONIE_PALETTE } from './harmonie-palette';

/**
 * Turns Harmonie figures into SVG markup. It goes through the same scene evaluation as the
 * browser preview, so a pose drawn on the sheet is exactly what the rig produces.
 */

const num = (value: number) => String(Math.round(value * 1000) / 1000);
const matrix = (m: Mat2D) => `matrix(${m.map(num).join(' ')})`;

export interface DrawnPart {
  readonly id: string;
  readonly d: string;
  readonly fill: string;
  readonly matrix: Mat2D;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Evaluates figures and returns their parts back to front, in world space. */
export function drawFigures(figures: readonly FigurePlacement[]): DrawnPart[] {
  const project: ProjectInput = {
    schemaVersion: 3,
    id: 'harmonie-sheet',
    name: 'Harmonie sheet',
    kind: 'technical-demo',
    scenes: [
      {
        id: 'sheet',
        duration: 1,
        fps: 24,
        exportFps: 24,
        background: '#ffffff',
        palette: { ...HARMONIE_PALETTE },
        safeArea: { x: 0, y: 0, width: 1, height: 1 },
        nodes: figures.flatMap(figureNodes),
        shots: [{ id: 'still', start: 0, duration: 1 }],
      },
    ],
  };
  const scene = parseProject(project).scenes[0];
  if (!scene) throw new Error('Sheet scene missing');
  const frame = evaluateFrame(scene, 0);
  return frame.nodes.flatMap((node) =>
    node.shape.kind === 'path' && node.fill !== null
      ? [{ id: node.id, d: node.shape.d, fill: node.fill, matrix: node.worldMatrix }]
      : [],
  );
}

export function partsSvg(parts: readonly DrawnPart[], indent = '    '): string {
  return parts
    .map(
      (part) =>
        `${indent}<path id="${part.id}" fill="${part.fill}" transform="${matrix(part.matrix)}" d="${part.d}"/>`,
    )
    .join('\n');
}

/** Outline-only version, for the construction diagram. */
export function outlinesSvg(parts: readonly DrawnPart[], stroke: string, indent = '    '): string {
  return parts
    .map(
      (part) =>
        `${indent}<path id="${part.id}" fill="none" stroke="${stroke}" stroke-width="1.6" vector-effect="non-scaling-stroke" transform="${matrix(part.matrix)}" d="${part.d}"/>`,
    )
    .join('\n');
}

/** World-space bounds of drawn parts, from their flattened outlines. */
export function partsBounds(parts: readonly DrawnPart[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const part of parts) {
    for (const point of flattenSvgPath(part.d)) {
      const p = applyToPoint(part.matrix, point);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
