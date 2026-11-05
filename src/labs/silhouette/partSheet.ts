import { flattenSvgPath } from '../../core/svgPath';
import { MANNEQUIN_PARTS } from './mannequin';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PADDING = 6;

/** Shows each reusable part as real inline SVG, from the same path data the renderer draws. */
export function createPartSheet(): HTMLElement {
  const sheet = document.createElement('div');
  sheet.id = 'part-sheet';
  for (const [name, d] of Object.entries(MANNEQUIN_PARTS)) {
    const points = flattenSvgPath(d);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs) - PADDING;
    const minY = Math.min(...ys) - PADDING;
    const width = Math.max(...xs) - minX + PADDING;
    const height = Math.max(...ys) - minY + PADDING;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', name);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);

    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    caption.textContent = name;
    figure.append(svg, caption);
    sheet.append(figure);
  }
  return sheet;
}
