import {
  Build,
  ellipse,
  glow,
  path,
  poly,
  rect,
  smooth,
  strokeLine,
  vertical,
  type Pt,
} from '../shared/build';
import { tk } from './palette';

/**
 * Ta's bedroom, built once and framed by every shot that takes place in it, so nothing moves
 * between shots. The camera faces the back wall. Left to right: the window above the head of the
 * bed, the bed, an empty stretch of wall, and the door with its handle.
 *
 * Units are screen pixels at zoom 1. The wall meets the floor at y = 500.
 */

export const ROOM = {
  floorY: 500,
  window: { left: -1250, right: -720, top: -420, bottom: 100 },
  bed: { left: -1300, right: -440, top: 330 },
  table: { left: -1500, right: -1330, top: 300 },
  door: { left: 600, right: 980, top: -370 },
  /** The door handle: the one warm point in the film. */
  handle: { x: 652, y: 70 },
  /** Where Ta stands at the door, and where the shadow climbs the wall. */
  taAtDoor: { x: 850, groundY: 560 },
} as const;

export const ROOM_SCALE = 0.95;

/** The street outside, seen through the window: empty, dark and completely still. */
function outside(b: Build, root: string): void {
  const w = ROOM.window;
  const cx = (w.left + w.right) / 2;
  b.add(
    'room-sky',
    root,
    vertical(900, 900, [
      { offset: 0, color: tk('deepBlack') },
      { offset: 0.6, color: tk('nightNavy') },
      { offset: 1, color: tk('coldShadow') },
    ]),
    { x: cx, y: -160 },
    { depth: -130 },
  );
  b.add(
    'room-moon-haze',
    root,
    glow(700, 500, tk('moonlight'), 0.22),
    { x: cx - 160, y: -380 },
    { depth: -129 },
  );
  // Houses across the road: flat dark shapes, every window dark.
  const houses: Pt[] = [
    [-1300, 60],
    [-1300, -120],
    [-1220, -170],
    [-1140, -120],
    [-1140, -90],
    [-1060, -90],
    [-1060, -150],
    [-960, -210],
    [-860, -150],
    [-860, -100],
    [-780, -100],
    [-700, -160],
    [-640, -120],
    [-640, 60],
  ];
  b.add('room-houses', root, path(poly(houses), tk('deepBlack')), {}, { depth: -128 });
  for (const [i, x] of [-1180, -1010, -910, -730].entries()) {
    b.add(
      `room-house-window-${i}`,
      root,
      rect(26, 30, tk('nightNavy')),
      { x, y: -70 },
      { depth: -127.9 },
    );
  }
  // Trees, standing perfectly still.
  for (const [i, [x, h]] of (
    [
      [-1235, 150],
      [-820, 190],
    ] as const
  ).entries()) {
    b.add(
      `room-tree-${i}`,
      root,
      path(
        smooth([
          [x - 60, -h + 40],
          [x - 20, -h - 40],
          [x + 40, -h - 20],
          [x + 70, -h + 50],
          [x + 30, -h + 90],
          [x - 40, -h + 90],
        ]),
        tk('deepBlack'),
      ),
      {},
      { depth: -127.5 },
    );
    b.add(
      `room-trunk-${i}`,
      root,
      rect(12, 120, tk('deepBlack')),
      { x, y: -h + 140 },
      { depth: -127.5 },
    );
  }
  // The road, and a street lamp that is not lit.
  b.add('room-road', root, rect(900, 64, tk('coldShadow')), { x: cx, y: 70 }, { depth: -127.8 });
  for (let i = 0; i < 4; i++)
    b.add(
      `room-road-mark-${i}`,
      root,
      rect(46, 5, tk('mutedBlue')),
      { x: w.left + 60 + i * 140, y: 72, opacity: 0.35 },
      { depth: -127.7 },
    );
  b.add(
    'room-lamp-post',
    root,
    rect(8, 300, tk('deepBlack')),
    { x: -940, y: -60 },
    { depth: -127 },
  );
  b.add(
    'room-lamp-head',
    root,
    path(
      poly([
        [-952, -192],
        [-910, -192],
        [-916, -180],
        [-946, -180],
      ]),
      tk('deepBlack'),
    ),
    {},
    { depth: -127 },
  );
}

export function buildRoom(b: Build, root: string): void {
  const { floorY } = ROOM;
  const w = ROOM.window;
  outside(b, root);

  // The wall, in four pieces round the window opening so the street shows only through it.
  const wallTone = tk('coldShadow');
  const top = -2000;
  const left = -2600;
  const right = 2600;
  b.add(
    'room-wall-l',
    root,
    rect(w.left - left, floorY - top, wallTone),
    { x: (left + w.left) / 2, y: (top + floorY) / 2 },
    { depth: -100 },
  );
  b.add(
    'room-wall-r',
    root,
    rect(right - w.right, floorY - top, wallTone),
    { x: (w.right + right) / 2, y: (top + floorY) / 2 },
    { depth: -100 },
  );
  b.add(
    'room-wall-t',
    root,
    rect(w.right - w.left, w.top - top, wallTone),
    { x: (w.left + w.right) / 2, y: (top + w.top) / 2 },
    { depth: -100 },
  );
  b.add(
    'room-wall-b',
    root,
    rect(w.right - w.left, floorY - w.bottom, wallTone),
    { x: (w.left + w.right) / 2, y: (w.bottom + floorY) / 2 },
    { depth: -100 },
  );
  // Moonlight on the walls: brightest by the window, a faint bounce across the empty wall.
  b.add(
    'room-wall-wash',
    root,
    glow(1500, 1300, tk('mutedBlue'), 0.38),
    { x: -700, y: -120 },
    { depth: -99 },
  );
  b.add(
    'room-wall-bounce',
    root,
    glow(1500, 1200, tk('mutedBlue'), 0.22),
    { x: 260, y: 80 },
    { depth: -99 },
  );
  b.add(
    'room-skirting',
    root,
    rect(right - left, 14, tk('nightNavy')),
    { y: floorY - 7 },
    { depth: -98 },
  );

  // Window frame, mullion and sill.
  const frame = tk('mutedBlue');
  b.add(
    'room-window-top',
    root,
    rect(w.right - w.left + 24, 16, frame),
    { x: (w.left + w.right) / 2, y: w.top },
    { depth: -96 },
  );
  b.add(
    'room-window-sill',
    root,
    rect(w.right - w.left + 50, 20, frame),
    { x: (w.left + w.right) / 2, y: w.bottom + 6 },
    { depth: -96 },
  );
  b.add(
    'room-window-left',
    root,
    rect(14, w.bottom - w.top, frame),
    { x: w.left, y: (w.top + w.bottom) / 2 },
    { depth: -96 },
  );
  b.add(
    'room-window-right',
    root,
    rect(14, w.bottom - w.top, frame),
    { x: w.right, y: (w.top + w.bottom) / 2 },
    { depth: -96 },
  );
  b.add(
    'room-window-mullion',
    root,
    rect(10, w.bottom - w.top, frame),
    { x: (w.left + w.right) / 2, y: (w.top + w.bottom) / 2 },
    { depth: -96 },
  );
  b.add(
    'room-window-transom',
    root,
    rect(w.right - w.left, 8, frame),
    { x: (w.left + w.right) / 2, y: w.top + 150 },
    { depth: -96 },
  );
  // Curtains, gathered at each side. The left one hangs in a group so it can barely move.
  const curtain = (id: string, x: number, flip: 1 | -1) => {
    const g = b.group(id, root, { x, y: w.top - 30 }, -94);
    const cloth: Pt[] = [
      [-40 * flip, 0],
      [60 * flip, 0],
      [70 * flip, 180],
      [52 * flip, 400],
      [66 * flip, 610],
      [-46 * flip, 610],
      [-30 * flip, 400],
      [-44 * flip, 180],
    ];
    b.add(`${id}-cloth`, g, path(smooth(cloth), tk('nightNavy')), {}, { depth: -94 });
    b.add(
      `${id}-fold`,
      g,
      path(
        smooth([
          [0, 10],
          [12 * flip, 10],
          [20 * flip, 300],
          [14 * flip, 600],
          [2 * flip, 600],
          [-6 * flip, 300],
        ]),
        tk('deepBlack'),
      ),
      { opacity: 0.6 },
      { depth: -93.9 },
    );
    return g;
  };
  curtain('room-curtain-l', w.left - 20, 1);
  curtain('room-curtain-r', w.right + 20, -1);
  b.add(
    'room-curtain-rod',
    root,
    rect(w.right - w.left + 240, 8, tk('deepBlack')),
    { x: (w.left + w.right) / 2, y: w.top - 34 },
    { depth: -93 },
  );

  // The floor, and the pale patch of moonlight thrown from the window.
  b.add(
    'room-floor',
    root,
    vertical(5200, 1400, [
      { offset: 0, color: tk('nightNavy') },
      { offset: 1, color: tk('deepBlack') },
    ]),
    { y: floorY + 700 },
    { depth: -110 },
  );
  b.add(
    'room-moon-patch',
    root,
    path(
      poly([
        [-1180, 520],
        [-640, 520],
        [-300, 900],
        [-980, 900],
      ]),
      tk('moonlight'),
    ),
    { opacity: 0.12 },
    { depth: -105 },
  );

  // The bed, low, with its headboard against the window wall.
  const bed = ROOM.bed;
  b.add(
    'room-bed-headboard',
    root,
    path(
      poly([
        [bed.left - 20, floorY],
        [bed.left - 20, 150],
        [bed.left + 10, 140],
        [bed.left + 10, floorY],
      ]),
      tk('nightNavy'),
    ),
    {},
    { depth: -60 },
  );
  b.add(
    'room-bed-frame',
    root,
    rect(bed.right - bed.left, 90, tk('nightNavy')),
    { x: (bed.left + bed.right) / 2, y: floorY - 70 },
    { depth: -60 },
  );
  b.add(
    'room-bed-mattress',
    root,
    path(
      smooth([
        [bed.left, bed.top + 6],
        [bed.left + 20, bed.top - 6],
        [bed.right - 20, bed.top - 6],
        [bed.right, bed.top + 6],
        [bed.right, bed.top + 60],
        [bed.left, bed.top + 60],
      ]),
      tk('mutedBlue'),
    ),
    {},
    { depth: -59 },
  );
  b.add(
    'room-bed-leg-l',
    root,
    rect(18, 26, tk('deepBlack')),
    { x: bed.left + 20, y: floorY - 12 },
    { depth: -60 },
  );
  b.add(
    'room-bed-leg-r',
    root,
    rect(18, 26, tk('deepBlack')),
    { x: bed.right - 20, y: floorY - 12 },
    { depth: -60 },
  );
  b.add(
    'room-pillow',
    root,
    path(
      smooth([
        [bed.left + 20, bed.top - 4],
        [bed.left + 60, bed.top - 46],
        [bed.left + 200, bed.top - 50],
        [bed.left + 230, bed.top - 10],
        [bed.left + 200, bed.top + 6],
        [bed.left + 30, bed.top + 6],
      ]),
      tk('moonlight'),
    ),
    {},
    { depth: -58 },
  );

  // Bedside table at the head of the bed, its charger cable running down to the wall.
  const t = ROOM.table;
  b.add(
    'room-table-top',
    root,
    rect(t.right - t.left, 16, tk('mutedBlue')),
    { x: (t.left + t.right) / 2, y: t.top },
    { depth: -62 },
  );
  b.add(
    'room-table-body',
    root,
    rect(t.right - t.left - 16, floorY - t.top - 8, tk('nightNavy')),
    { x: (t.left + t.right) / 2, y: (t.top + floorY) / 2 + 4 },
    { depth: -62.1 },
  );
  b.add(
    'room-table-drawer',
    root,
    rect(t.right - t.left - 50, 4, tk('deepBlack')),
    { x: (t.left + t.right) / 2, y: t.top + 60 },
    { depth: -62 },
  );
  b.add(
    'room-socket',
    root,
    rect(30, 40, tk('mutedBlue')),
    { x: t.left + 30, y: 400 },
    { depth: -63 },
  );
  b.add(
    'room-cable',
    root,
    path(
      strokeLine(
        [
          [t.right - 30, t.top - 4],
          [t.right - 4, t.top + 40],
          [t.right - 60, 380],
          [t.left + 30, 400],
        ],
        4,
      ),
      tk('deepBlack'),
    ),
    {},
    { depth: -61 },
  );

  // The door: a slab in a frame, with a lever handle in the faint warm accent.
  const d = ROOM.door;
  b.add(
    'room-door-frame',
    root,
    path(
      poly([
        [d.left - 30, floorY],
        [d.left - 30, d.top - 30],
        [d.right + 30, d.top - 30],
        [d.right + 30, floorY],
        [d.right, floorY],
        [d.right, d.top],
        [d.left, d.top],
        [d.left, floorY],
      ]),
      tk('nightNavy'),
    ),
    {},
    { depth: -90 },
  );
  b.add(
    'room-door',
    root,
    rect(d.right - d.left, floorY - d.top, tk('mutedBlue')),
    { x: (d.left + d.right) / 2, y: (d.top + floorY) / 2 },
    { depth: -91 },
  );
  b.add(
    'room-door-shade',
    root,
    glow(700, 1200, tk('deepBlack'), 0.45),
    { x: d.right, y: (d.top + floorY) / 2 },
    { depth: -90.9 },
  );
  b.add(
    'room-door-panel-1',
    root,
    path(
      poly([
        [d.left + 50, d.top + 60],
        [d.right - 50, d.top + 60],
        [d.right - 50, d.top + 380],
        [d.left + 50, d.top + 380],
      ]),
      tk('coldShadow'),
    ),
    { opacity: 0.6 },
    { depth: -90.8 },
  );
  b.add(
    'room-door-panel-2',
    root,
    path(
      poly([
        [d.left + 50, d.top + 470],
        [d.right - 50, d.top + 470],
        [d.right - 50, floorY - 60],
        [d.left + 50, floorY - 60],
      ]),
      tk('coldShadow'),
    ),
    { opacity: 0.6 },
    { depth: -90.8 },
  );
  b.add(
    'room-door-gap',
    root,
    rect(d.right - d.left, 4, tk('deepBlack')),
    { x: (d.left + d.right) / 2, y: floorY - 2 },
    { depth: -90.7 },
  );
  handle(b, 'room-handle', root, ROOM.handle.x, ROOM.handle.y, 1, -89);
}

/** The lever handle and its rosette, drawn at any size for the close-ups. */
export function handle(
  b: Build,
  id: string,
  parent: string,
  x: number,
  y: number,
  scale: number,
  depth: number,
): string {
  const g = b.group(id, parent, { x, y, scaleX: scale, scaleY: scale }, depth);
  b.add(
    `${id}-plate`,
    g,
    path(
      smooth([
        [-12, -40],
        [12, -40],
        [14, 40],
        [-12, 40],
      ]),
      tk('nightNavy'),
    ),
    {},
    { depth },
  );
  b.add(`${id}-rose`, g, ellipse(16, 16, tk('warmAccent')), {}, { depth: depth + 0.01 });
  b.add(
    `${id}-lever`,
    g,
    path(
      smooth([
        [-6, -7],
        [60, -9],
        [70, -4],
        [70, 4],
        [60, 8],
        [-6, 7],
      ]),
      tk('warmAccent'),
    ),
    {},
    { depth: depth + 0.02 },
  );
  b.add(
    `${id}-lever-shade`,
    g,
    path(
      poly([
        [2, 2],
        [54, 3],
        [56, 6],
        [50, 7],
        [2, 6],
      ]),
      tk('mutedBlue'),
    ),
    { opacity: 0.6 },
    { depth: depth + 0.03 },
  );
  b.add(
    `${id}-shine`,
    g,
    ellipse(5, 3, tk('paleLight')),
    { x: 10, y: -4, opacity: 0.7 },
    { depth: depth + 0.04 },
  );
  return g;
}
