import type { Point } from './matrix';

/**
 * The SVG path subset used for vector parts: M, L, H, V, C, Q and Z, absolute or relative.
 * Parsing here, rather than in a renderer, keeps bounds and drawing in agreement.
 */
export type PathCommand =
  | { readonly type: 'move'; readonly x: number; readonly y: number }
  | { readonly type: 'line'; readonly x: number; readonly y: number }
  | {
      readonly type: 'cubic';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: 'quadratic';
      readonly x1: number;
      readonly y1: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'close' };

const ARGUMENT_COUNTS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, q: 4, z: 0 };
const TOKEN = /([a-zA-Z])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|([\s,]+)|(.)/g;

/** Throws on anything outside the supported subset. */
export function parseSvgPath(d: string): PathCommand[] {
  const tokens: (string | number)[] = [];
  for (const match of d.matchAll(TOKEN)) {
    if (match[1] !== undefined) tokens.push(match[1]);
    else if (match[2] !== undefined) tokens.push(Number(match[2]));
    else if (match[4] !== undefined) throw new Error(`Unexpected "${match[4]}" in path`);
  }
  if (typeof tokens[0] !== 'string' || tokens[0].toLowerCase() !== 'm') {
    throw new Error('A path must start with M');
  }

  const commands: PathCommand[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let index = 0;
  let letter = '';

  const next = (): number => {
    const value = tokens[index++];
    if (typeof value !== 'number') throw new Error(`Path command "${letter}" is missing a number`);
    return value;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (typeof token === 'string') {
      letter = token;
      index++;
      if (ARGUMENT_COUNTS[letter.toLowerCase()] === undefined) {
        throw new Error(`Unsupported path command "${letter}"`);
      }
    } else if (letter === '' || letter.toLowerCase() === 'z') {
      throw new Error(`Unexpected number ${token} in path`);
    } else if (letter === 'm') {
      letter = 'l';
    } else if (letter === 'M') {
      letter = 'L';
    }

    const relative = letter === letter.toLowerCase();
    const baseX = relative ? x : 0;
    const baseY = relative ? y : 0;

    switch (letter.toLowerCase()) {
      case 'm':
        x = baseX + next();
        y = baseY + next();
        startX = x;
        startY = y;
        commands.push({ type: 'move', x, y });
        break;
      case 'l':
        x = baseX + next();
        y = baseY + next();
        commands.push({ type: 'line', x, y });
        break;
      case 'h':
        x = baseX + next();
        commands.push({ type: 'line', x, y });
        break;
      case 'v':
        y = baseY + next();
        commands.push({ type: 'line', x, y });
        break;
      case 'c': {
        const x1 = baseX + next();
        const y1 = baseY + next();
        const x2 = baseX + next();
        const y2 = baseY + next();
        x = baseX + next();
        y = baseY + next();
        commands.push({ type: 'cubic', x1, y1, x2, y2, x, y });
        break;
      }
      case 'q': {
        const x1 = baseX + next();
        const y1 = baseY + next();
        x = baseX + next();
        y = baseY + next();
        commands.push({ type: 'quadratic', x1, y1, x, y });
        break;
      }
      case 'z':
        x = startX;
        y = startY;
        commands.push({ type: 'close' });
        break;
    }
  }
  return commands;
}

export function isValidSvgPath(d: string): boolean {
  try {
    parseSvgPath(d);
    return true;
  } catch {
    return false;
  }
}

const CURVE_STEPS = 16;

/** Points along the path, with curves approximated by short lines. Used for bounds. */
export function flattenSvgPath(d: string): Point[] {
  const points: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  for (const command of parseSvgPath(d)) {
    switch (command.type) {
      case 'move':
      case 'line':
        current = { x: command.x, y: command.y };
        points.push(current);
        break;
      case 'cubic': {
        const from = current;
        for (let step = 1; step <= CURVE_STEPS; step++) {
          const t = step / CURVE_STEPS;
          const u = 1 - t;
          points.push({
            x:
              u * u * u * from.x +
              3 * u * u * t * command.x1 +
              3 * u * t * t * command.x2 +
              t * t * t * command.x,
            y:
              u * u * u * from.y +
              3 * u * u * t * command.y1 +
              3 * u * t * t * command.y2 +
              t * t * t * command.y,
          });
        }
        current = { x: command.x, y: command.y };
        break;
      }
      case 'quadratic': {
        const from = current;
        for (let step = 1; step <= CURVE_STEPS; step++) {
          const t = step / CURVE_STEPS;
          const u = 1 - t;
          points.push({
            x: u * u * from.x + 2 * u * t * command.x1 + t * t * command.x,
            y: u * u * from.y + 2 * u * t * command.y1 + t * t * command.y,
          });
        }
        current = { x: command.x, y: command.y };
        break;
      }
      case 'close':
        break;
    }
  }
  return points;
}
