/** 2D affine matrix: x' = a*x + c*y + tx, y' = b*x + d*y + ty. */
export type Mat2D = readonly [a: number, b: number, c: number, d: number, tx: number, ty: number];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

/** Returns the matrix that applies `right` first, then `left`. */
export function multiply(left: Mat2D, right: Mat2D): Mat2D {
  const [a1, b1, c1, d1, tx1, ty1] = left;
  const [a2, b2, c2, d2, tx2, ty2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * tx2 + c1 * ty2 + tx1,
    b1 * tx2 + d1 * ty2 + ty1,
  ];
}

export function applyToPoint(m: Mat2D, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export function translation(x: number, y: number): Mat2D {
  return [1, 0, 0, 1, x, y];
}

export function scaling(x: number, y: number): Mat2D {
  return [x, 0, 0, y, 0, 0];
}

export function rotationDegrees(degrees: number): Mat2D {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, 0, 0];
}
