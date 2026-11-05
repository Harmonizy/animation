import { applyToPoint, multiply, rotationDegrees, translation, scaling } from './matrix';
import type { Mat2D, Point } from './matrix';
import type { EvaluatedNode } from './evaluate';
import type { Camera, Rect, Shape } from './schema';
import { flattenSvgPath } from './svgPath';

export const ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
} as const;
export type AspectRatioName = keyof typeof ASPECT_RATIOS;

export function isAspectRatioName(value: string): value is AspectRatioName {
  return Object.hasOwn(ASPECT_RATIOS, value);
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The largest whole-pixel size of the given ratio that fits inside `container`. */
export function fitAspect(container: Size, ratio: number): Size {
  const width = Math.min(container.width, container.height * ratio);
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(width / ratio)),
  };
}

/**
 * Maps world space to viewport pixels. At zoom 1 the safe area always fits, so a
 * wider or taller viewport reveals more of the world instead of stretching it.
 */
export function viewTransform(camera: Camera, safeArea: Rect, viewport: Size): Mat2D {
  const scale =
    Math.min(viewport.width / safeArea.width, viewport.height / safeArea.height) * camera.zoom;
  return multiply(
    translation(viewport.width / 2, viewport.height / 2),
    multiply(
      scaling(scale, scale),
      multiply(rotationDegrees(-camera.rotation), translation(-camera.x, -camera.y)),
    ),
  );
}

const OUTLINE_SEGMENTS = 32;

function shapeOutline(shape: Shape): readonly Point[] {
  switch (shape.kind) {
    case 'group':
      return [];
    case 'rect': {
      const x = shape.width / 2;
      const y = shape.height / 2;
      return [
        { x: -x, y: -y },
        { x, y: -y },
        { x, y },
        { x: -x, y },
      ];
    }
    case 'ellipse':
      return Array.from({ length: OUTLINE_SEGMENTS }, (_, i) => {
        const angle = (i / OUTLINE_SEGMENTS) * Math.PI * 2;
        return { x: Math.cos(angle) * shape.radiusX, y: Math.sin(angle) * shape.radiusY };
      });
    case 'polygon':
      return shape.points;
    case 'path':
      return flattenSvgPath(shape.d);
    case 'gradient': {
      const x = shape.width / 2;
      const y = shape.height / 2;
      return [
        { x: -x, y: -y },
        { x, y: -y },
        { x, y },
        { x: -x, y },
      ];
    }
    case 'text': {
      // An estimate: renderers measure real text, but bounds must not depend on fonts.
      const lines = shape.content.split('\n');
      const longest = Math.max(...lines.map((line) => line.length));
      const width = longest * shape.fontSize * 0.55;
      const height = lines.length * shape.fontSize * shape.lineHeight;
      const left = shape.align === 'left' ? 0 : shape.align === 'right' ? -width : -width / 2;
      return [
        { x: left, y: -height / 2 },
        { x: left + width, y: -height / 2 },
        { x: left + width, y: height / 2 },
        { x: left, y: height / 2 },
      ];
    }
  }
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Bounds of a node's shape after `matrix`, or null for a node that draws nothing. */
export function nodeBounds(node: EvaluatedNode, matrix: Mat2D): Bounds | null {
  const outline = shapeOutline(node.shape);
  if (outline.length === 0) return null;
  const toTarget = multiply(matrix, node.worldMatrix);
  const points = outline.map((point) => applyToPoint(toTarget, point));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
