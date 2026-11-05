import { applyToPoint } from '../../core/matrix';
import { harmonieParts, PROPORTIONS, transformPath } from './harmonie-geometry';
import { HARMONIE_COLOR_GUIDE, HARMONIE_PALETTE, SILHOUETTE_COLOR } from './harmonie-palette';
import { POSE_SHEET, sheetPose } from './harmonie-poses';
import {
  HARMONIE_HEIGHT,
  HARMONIE_ID,
  HARMONIE_NAME,
  HARMONIE_RIG,
  HARMONIE_VIEWS,
  JOINT_Y,
  pivotOf,
  RIG_NODE_IDS,
  VIEW_LABELS,
  type HarmonieView,
} from './harmonie-rig';
import type { FigurePlacement } from './harmonie-scene';
import { drawFigures, outlinesSvg, partsBounds, partsSvg, type Box } from './harmonie-svg';

/**
 * The master character sheet and the editable rig file. Both are generated from the geometry,
 * so they cannot drift from what the preview animates. Run `npm run build:harmonie` after
 * changing the character, and commit the regenerated files.
 */

export const SHEET_WIDTH = 2560;
export const SHEET_HEIGHT = 1800;

const INK = HARMONIE_PALETTE.deepShadow;
const PAPER = HARMONIE_PALETTE.warmIvory;
const FONT = "Inter, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif";
const MONO = "'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/** Scale of the turnaround and the construction drawing, so the two compare directly. */
export const TURNAROUND_SCALE = 0.9;
/** Scale shared by the pose sheet and the silhouette test. */
export const SMALL_SCALE = 0.55;

export interface Panel extends Box {
  readonly id: string;
  readonly title: string;
}

export const PANELS: readonly Panel[] = [
  { id: 'turnaround', title: 'A  Turnaround', x: 48, y: 176, width: 1472, height: 830 },
  { id: 'construction', title: 'B  Construction', x: 1552, y: 176, width: 960, height: 830 },
  { id: 'poses', title: 'E  Pose sheet', x: 48, y: 1036, width: 1472, height: 716 },
  { id: 'silhouette', title: 'D  Silhouette test', x: 1552, y: 1036, width: 528, height: 716 },
  { id: 'colors', title: 'C  Color guide', x: 2112, y: 1036, width: 400, height: 716 },
];

const panel = (id: string): Panel => {
  const found = PANELS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown panel ${id}`);
  return found;
};

/** A region a figure must stay inside, with the figure that goes there. */
export interface FigureCell {
  readonly cell: Box;
  readonly figure: FigurePlacement;
}

const TURNAROUND_GROUND = 946;
const POSE_GROUND = 1600;

interface PoseSlot {
  readonly id: (typeof POSE_SHEET)[number]['id'];
  readonly x: number;
  readonly width: number;
  readonly figureX: number;
}

/**
 * Pose cells sized to each pose: a run is far wider than a neutral stance. Spare width is shared
 * evenly, and each figure is centred on its own extent, not on its root.
 */
export function poseSlots(): PoseSlot[] {
  const p = panel('poses');
  const extents = POSE_SHEET.map((entry) => {
    const figure: FigurePlacement = {
      id: 'measure',
      view: 'side',
      x: 0,
      groundY: 0,
      scale: SMALL_SCALE,
      pose: sheetPose(entry.id),
    };
    const bounds = partsBounds(drawFigures([figure]));
    return { id: entry.id, minX: bounds.x, width: bounds.width };
  });
  // Narrow poses still get room for a readable caption.
  const minimum = 168;
  const inner = p.width - 32;
  const base = extents.map((extent) => Math.max(extent.width + 24, minimum));
  const spare = (inner - base.reduce((sum, width) => sum + width, 0)) / extents.length;
  let x = p.x + 16;
  return extents.map((extent, i) => {
    const width = (base[i] ?? minimum) + spare;
    const slot = { id: extent.id, x, width, figureX: x + (width - extent.width) / 2 - extent.minX };
    x += width;
    return slot;
  });
}

export function sheetFigures(): FigureCell[] {
  const turnaround = panel('turnaround');
  const cellWidth = 340;
  const firstCell = turnaround.x + 108;
  const cells: FigureCell[] = HARMONIE_VIEWS.map((view, i) => ({
    cell: { x: firstCell + i * cellWidth, y: turnaround.y + 44, width: cellWidth, height: 740 },
    figure: {
      id: `turn-${view}`,
      view,
      x: firstCell + i * cellWidth + cellWidth / 2,
      groundY: TURNAROUND_GROUND,
      scale: TURNAROUND_SCALE,
    },
  }));

  for (const slot of poseSlots()) {
    cells.push({
      cell: {
        x: slot.x,
        y: panel('poses').y + 40,
        width: slot.width,
        height: POSE_GROUND - (panel('poses').y + 40) + 4,
      },
      figure: {
        id: `pose-${slot.id}`,
        view: 'side',
        x: slot.figureX,
        groundY: POSE_GROUND,
        scale: SMALL_SCALE,
        pose: sheetPose(slot.id),
      },
    });
  }

  const silhouette = panel('silhouette');
  const silhouetteViews: HarmonieView[] = ['front', 'threeQuarter', 'side'];
  const silhouetteWidth = silhouette.width / silhouetteViews.length;
  silhouetteViews.forEach((view, i) => {
    cells.push({
      cell: {
        x: silhouette.x + i * silhouetteWidth,
        y: silhouette.y + 40,
        width: silhouetteWidth,
        height: POSE_GROUND - (silhouette.y + 40) + 4,
      },
      figure: {
        id: `silhouette-${view}`,
        view,
        x: silhouette.x + i * silhouetteWidth + silhouetteWidth / 2,
        groundY: POSE_GROUND,
        scale: SMALL_SCALE,
        fill: SILHOUETTE_COLOR,
      },
    });
  });
  return cells;
}

const construction = panel('construction');
const CONSTRUCTION_FIGURE: FigurePlacement = {
  id: 'construction',
  view: 'front',
  x: construction.x + 480,
  groundY: TURNAROUND_GROUND,
  scale: TURNAROUND_SCALE,
};

/** Character space to sheet space for a placed figure at rest. */
const place = (figure: FigurePlacement, x: number, y: number) => ({
  x: figure.x + x * figure.scale,
  y: figure.groundY + (y - HARMONIE_HEIGHT) * figure.scale,
});

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function text(
  x: number,
  y: number,
  content: string,
  options: {
    size?: number;
    weight?: number;
    anchor?: string;
    mono?: boolean;
    opacity?: number;
  } = {},
): string {
  const { size = 16, weight = 400, anchor = 'start', mono = false, opacity = 1 } = options;
  return `<text x="${x}" y="${y}" font-family="${mono ? MONO : FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${INK}"${opacity === 1 ? '' : ` fill-opacity="${opacity}"`}>${escape(content)}</text>`;
}

/** Splits text into lines of at most `width` characters, at word boundaries. */
export function wrap(content: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of content.split(' ')) {
    if (line !== '' && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function panelFrame(p: Panel): string {
  return [
    `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="none" stroke="${INK}" stroke-opacity="0.28" stroke-width="1.5"/>`,
    text(p.x + 20, p.y + 32, p.title, { size: 20, weight: 700 }),
  ].join('\n  ');
}

/** A faint square grid inside a panel, for measuring by eye. */
function grid(p: Panel, step: number): string {
  const lines: string[] = [];
  for (let x = p.x + step; x < p.x + p.width; x += step) {
    lines.push(`M ${x} ${p.y + 44} V ${p.y + p.height}`);
  }
  for (let y = p.y + 44 + step; y < p.y + p.height; y += step) {
    lines.push(`M ${p.x} ${y} H ${p.x + p.width}`);
  }
  return `<path d="${lines.join(' ')}" stroke="${INK}" stroke-opacity="0.05" stroke-width="1" fill="none"/>`;
}

const GUIDES = [
  [25, 'hood'],
  [55, 'head'],
  [178, 'chin'],
  [JOINT_Y.shoulder, 'shoulder'],
  [JOINT_Y.waist, 'waist'],
  [JOINT_Y.hip, 'hip'],
  [JOINT_Y.knee, 'knee'],
  [JOINT_Y.ankle, 'ankle'],
  [800, 'ground'],
] as const;

function turnaroundGuides(cells: readonly FigureCell[]): string {
  const p = panel('turnaround');
  const first = cells[0];
  if (!first) return '';
  const out: string[] = [];
  for (const [y, label] of GUIDES) {
    const sheetY = place(first.figure, 0, y).y;
    const solid = label === 'ground';
    out.push(
      `<path d="M ${p.x + 108} ${sheetY} H ${p.x + p.width - 12}" stroke="${INK}" stroke-opacity="${solid ? 0.5 : 0.16}" stroke-width="${solid ? 2 : 1}"${solid ? '' : ' stroke-dasharray="6 6"'} fill="none"/>`,
      text(p.x + 100, sheetY + 4, `${y} ${label}`, {
        size: 12,
        anchor: 'end',
        mono: true,
        opacity: 0.7,
      }),
    );
  }
  for (const { figure } of cells.slice(0, 4)) {
    out.push(
      text(figure.x, TURNAROUND_GROUND + 40, VIEW_LABELS[figure.view], {
        size: 18,
        weight: 600,
        anchor: 'middle',
      }),
    );
  }
  out.push(
    text(
      p.x + p.width - 20,
      p.y + 32,
      'Each view is drawn separately from shared joint heights. Scale 0.9, 800-unit figure.',
      {
        size: 14,
        anchor: 'end',
        opacity: 0.7,
      },
    ),
  );
  return out.join('\n  ');
}

interface Callout {
  readonly label: string;
  readonly detail: string;
  readonly side: 'left' | 'right';
  readonly at: readonly [number, number];
}

const P = PROPORTIONS;
const range = (r: { top: number; bottom: number }) => `y ${r.top}–${r.bottom}`;

const CALLOUTS: readonly Callout[] = [
  { label: 'Hood', detail: `curved polygon, ${range(P.hood)}`, side: 'left', at: [-58, 66] },
  { label: 'Head', detail: `ellipse, ${range(P.head)}`, side: 'left', at: [-34, 124] },
  { label: 'Neck', detail: `rounded block, ${range(P.neck)}`, side: 'left', at: [-16, 186] },
  { label: 'Arms', detail: `tapered capsules, ${range(P.arms)}`, side: 'left', at: [-76, 400] },
  { label: 'Satchel', detail: 'leather, on her right hip', side: 'left', at: [-62, 520] },
  { label: 'Hands', detail: `gloves, ${range(P.hands)}`, side: 'left', at: [-84, 578] },
  { label: 'Legs', detail: `tapered capsules, ${range(P.legs)}`, side: 'left', at: [-30, 690] },
  { label: 'Boots', detail: `flared trapezoids, ${range(P.boots)}`, side: 'left', at: [-26, 784] },
  { label: 'Scarf', detail: `wrap, knot, tail, ${range(P.scarf)}`, side: 'right', at: [52, 216] },
  { label: 'Torso', detail: `tapered tunic, ${range(P.torso)}`, side: 'right', at: [34, 340] },
  {
    label: 'Pelvis',
    detail: `trapezoid + skirt, ${range(P.pelvis)}`,
    side: 'right',
    at: [44, 520],
  },
  { label: 'Cloak', detail: `${range(P.cloak)}, right hem lower`, side: 'right', at: [106, 640] },
];

function constructionDiagram(): string {
  const figure = CONSTRUCTION_FIGURE;
  const out: string[] = [];
  const parts = drawFigures([figure]);
  // A pale fill keeps the volumes readable under the outlines.
  out.push(`<g opacity="0.14">\n${partsSvg(parts)}\n  </g>`);
  out.push(`<g>\n${outlinesSvg(parts, INK)}\n  </g>`);

  const head = P.head;
  const centre = place(figure, head.cx, head.cy);
  out.push(
    `<ellipse cx="${centre.x}" cy="${centre.y}" rx="${head.rx * figure.scale}" ry="${head.ry * figure.scale}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="5 4"/>`,
  );

  const leftEdge = construction.x + 250;
  const rightEdge = construction.x + 700;
  for (const callout of CALLOUTS) {
    const anchor = place(figure, callout.at[0], callout.at[1]);
    const lineEnd = callout.side === 'left' ? leftEdge : rightEdge;
    out.push(
      `<path d="M ${anchor.x} ${anchor.y} L ${lineEnd} ${anchor.y}" stroke="${INK}" stroke-opacity="0.55" stroke-width="1" fill="none"/>`,
      `<circle cx="${anchor.x}" cy="${anchor.y}" r="2.5" fill="${INK}"/>`,
    );
    const x = callout.side === 'left' ? lineEnd - 8 : lineEnd + 8;
    const anchorText = callout.side === 'left' ? 'end' : 'start';
    out.push(
      text(x, anchor.y - 3, callout.label, { size: 16, weight: 700, anchor: anchorText }),
      text(x, anchor.y + 15, callout.detail, { size: 13, anchor: anchorText, opacity: 0.75 }),
    );
  }

  for (const node of RIG_NODE_IDS) {
    const pivot = pivotOf(node, 'front');
    const at = place(figure, pivot.x, pivot.y);
    out.push(
      `<circle id="pivot-${node}" cx="${at.x}" cy="${at.y}" r="5" fill="${HARMONIE_PALETTE.amberGold}" stroke="${INK}" stroke-width="1.5"/>`,
    );
  }
  // The legend sits in the empty lower right, clear of every callout.
  const legendX = rightEdge + 8;
  const legendY = construction.y + construction.height - 92;
  out.push(
    `<circle cx="${legendX + 6}" cy="${legendY - 5}" r="5" fill="${HARMONIE_PALETTE.amberGold}" stroke="${INK}" stroke-width="1.5"/>`,
    text(legendX + 20, legendY, `Pivot, ${RIG_NODE_IDS.length} rig nodes`, {
      size: 14,
      weight: 700,
    }),
    text(legendX + 20, legendY + 20, 'Heights shared by every view', { size: 13, opacity: 0.75 }),
    `<path d="M ${legendX} ${legendY + 45} h 14" stroke="${INK}" stroke-width="1.4" stroke-dasharray="5 4"/>`,
    text(legendX + 20, legendY + 50, 'Head ellipse, under the hood', { size: 13, opacity: 0.75 }),
  );
  return out.join('\n  ');
}

function poseCaptions(): string {
  const p = panel('poses');
  const slots = poseSlots();
  const out: string[] = [
    `<path d="M ${p.x + 16} ${POSE_GROUND} H ${p.x + p.width - 16}" stroke="${INK}" stroke-opacity="0.45" stroke-width="2" fill="none"/>`,
  ];
  POSE_SHEET.forEach((entry, i) => {
    const slot = slots[i];
    if (!slot) return;
    const x = slot.x + slot.width / 2;
    out.push(text(x, POSE_GROUND + 34, entry.label, { size: 16, weight: 700, anchor: 'middle' }));
    // About 6.6 px per character at 13 px, with a margin either side.
    wrap(entry.note, Math.floor((slot.width - 16) / 6.6)).forEach((line, l) => {
      out.push(
        text(x, POSE_GROUND + 58 + l * 19, line, { size: 13, anchor: 'middle', opacity: 0.75 }),
      );
    });
  });
  return out.join('\n  ');
}

function silhouetteCaptions(): string {
  const p = panel('silhouette');
  const out = [
    `<path d="M ${p.x + 16} ${POSE_GROUND} H ${p.x + p.width - 16}" stroke="${INK}" stroke-opacity="0.45" stroke-width="2" fill="none"/>`,
  ];
  const lines = [
    'One solid color, no interior detail.',
    'Identity reads from the pointed hood,',
    'the stepped mantle, the uneven hem',
    'and the scarf tail in profile.',
  ];
  lines.forEach((line, i) => {
    out.push(text(p.x + 24, POSE_GROUND + 34 + i * 20, line, { size: 14, opacity: 0.8 }));
  });
  return out.join('\n  ');
}

function colorGuide(): string {
  const p = panel('colors');
  const out: string[] = [];
  HARMONIE_COLOR_GUIDE.forEach((entry, i) => {
    const y = p.y + 64 + i * 128;
    const hex = HARMONIE_PALETTE[entry.token];
    out.push(
      `<rect id="swatch-${entry.token}" x="${p.x + 24}" y="${y}" width="84" height="84" fill="${hex}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1.5"/>`,
      text(p.x + 128, y + 22, entry.name, { size: 18, weight: 700 }),
      text(p.x + 128, y + 44, hex, { size: 16, mono: true }),
    );
    entry.materials.forEach((material, m) => {
      out.push(text(p.x + 128, y + 66 + m * 18, material, { size: 13, opacity: 0.75 }));
    });
  });
  return out.join('\n  ');
}

function header(): string {
  return [
    text(48, 92, HARMONIE_NAME.toUpperCase(), { size: 60, weight: 800 }),
    text(48, 132, `${HARMONIE_ID}  ·  Protagonist  ·  Female, 24  ·  Medieval fantasy traveler`, {
      size: 20,
      opacity: 0.8,
    }),
    text(SHEET_WIDTH - 48, 92, 'Cinematic Minimalist Silhouette 2.5D', {
      size: 26,
      weight: 700,
      anchor: 'end',
    }),
    text(
      SHEET_WIDTH - 48,
      132,
      'Character sheet v1  ·  Calm, observant, gentle, quietly determined',
      {
        size: 18,
        anchor: 'end',
        opacity: 0.8,
      },
    ),
    `<path d="M 48 152 H ${SHEET_WIDTH - 48}" stroke="${INK}" stroke-width="2"/>`,
    text(
      48,
      SHEET_HEIGHT - 20,
      'Generated from src/characters/harmonie by npm run build:harmonie. Do not edit by hand: change the geometry and rebuild.',
      {
        size: 13,
        opacity: 0.6,
      },
    ),
  ].join('\n  ');
}

/** The complete landscape master sheet. */
export function buildCharacterSheet(): string {
  const cells = sheetFigures();
  const figures = drawFigures(cells.map((cell) => cell.figure));
  const byFigure = (prefix: string) => figures.filter((part) => part.id.startsWith(`${prefix}-`));
  const groups = cells
    .map(
      ({ figure }) =>
        `  <g id="figure-${figure.id}" data-view="${figure.view}">\n${partsSvg(byFigure(figure.id))}\n  </g>`,
    )
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}">`,
    `  <title>${HARMONIE_NAME} (${HARMONIE_ID}) character sheet</title>`,
    `  <rect id="background" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}" fill="${PAPER}"/>`,
    ...PANELS.map((p) => `  ${grid(p, 40)}`),
    ...PANELS.map((p) => `  ${panelFrame(p)}`),
    `  ${header()}`,
    `  ${turnaroundGuides(cells)}`,
    groups,
    `  <g id="construction">\n  ${constructionDiagram()}\n  </g>`,
    `  ${poseCaptions()}`,
    `  ${silhouetteCaptions()}`,
    `  ${colorGuide()}`,
    '</svg>',
    '',
  ].join('\n');
}

/** Bounds of every sheet figure, with the cell it must fit in. Used by the layout tests. */
export function sheetFigureBounds(): { id: string; cell: Box; bounds: Box }[] {
  const cells = sheetFigures();
  const figures = drawFigures(cells.map((cell) => cell.figure));
  return cells.map(({ cell, figure }) => ({
    id: figure.id,
    cell,
    bounds: partsBounds(figures.filter((part) => part.id.startsWith(`${figure.id}-`))),
  }));
}

/* ----------------------------------------------------------------------------------------------
 * The editable rig file.
 * -------------------------------------------------------------------------------------------- */

const RIG_COLUMN = 300;
const RIG_TOP = 60;

/**
 * Every view at rest, at full scale, with path data in plain character space so the file opens
 * and edits cleanly in any vector editor. Each path names its rig node and draw depth, and the
 * pivots are listed per view.
 */
export function buildRigSvg(): string {
  const width = RIG_COLUMN * HARMONIE_VIEWS.length;
  const height = HARMONIE_HEIGHT + RIG_TOP + 40;
  const views = HARMONIE_VIEWS.map((view, i) => {
    const figure: FigurePlacement = { id: view, view, x: 0, groundY: HARMONIE_HEIGHT, scale: 1 };
    const drawn = drawFigures([figure]);
    const depthOf = new Map(harmonieParts(view).map((part) => [`${view}-part-${part.id}`, part]));
    const paths = drawn.map((part) => {
      const def = depthOf.get(part.id);
      const d = transformPath(part.d, (x, y) => {
        const p = applyToPoint(part.matrix, { x, y });
        return [p.x, p.y];
      });
      return `      <path id="${part.id}" data-rig-node="${def?.node ?? ''}" data-depth="${def?.depth ?? 0}" fill="${part.fill}" d="${d}"/>`;
    });
    const pivots = RIG_NODE_IDS.map((node) => {
      const pivot = pivotOf(node, view);
      const parent = HARMONIE_RIG[node].parent ?? '';
      return `      <circle id="${view}-pivot-${node}" data-rig-node="${node}" data-parent="${parent}" cx="${pivot.x}" cy="${pivot.y}" r="4"/>`;
    });
    return [
      `  <g id="view-${view}" data-view="${view}" transform="translate(${RIG_COLUMN * i + RIG_COLUMN / 2} ${RIG_TOP})">`,
      `    <g id="${view}-parts">`,
      ...paths,
      '    </g>',
      `    <g id="${view}-pivots" fill="${HARMONIE_PALETTE.amberGold}" stroke="${INK}" stroke-width="1.5">`,
      ...pivots,
      '    </g>',
      '  </g>',
    ].join('\n');
  });
  const hierarchy = RIG_NODE_IDS.map(
    (node) => `${node} <- ${HARMONIE_RIG[node].parent ?? '(none)'}`,
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `  <title>${HARMONIE_NAME} (${HARMONIE_ID}) articulated rig parts</title>`,
    `  <desc>Character space: x = 0 is the centre line, y = 0 is the top of the head room and y = 800 is the ground. Paths are at rest. Rig hierarchy (node &lt;- parent): ${hierarchy.join('; ')}.</desc>`,
    `  <rect id="background" width="${width}" height="${height}" fill="${PAPER}"/>`,
    ...HARMONIE_VIEWS.map((view, i) =>
      text(RIG_COLUMN * i + RIG_COLUMN / 2, 36, VIEW_LABELS[view], {
        size: 18,
        weight: 700,
        anchor: 'middle',
      }),
    ).map((line) => `  ${line}`),
    ...views,
    '</svg>',
    '',
  ].join('\n');
}
