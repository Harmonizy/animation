import { Build, ellipse, glow, path, poly, rect, ring, smooth, strokeLine, tk } from './kit';

/**
 * The seven items and the other props, each drawn once and placed anywhere at any scale. Every
 * function returns the id of the prop's group, drawn around its own centre, so a shot can move
 * or animate it as one piece. Shapes stay simple and geometric, but each has the details that
 * make it recognisable at a third of the frame width: the torch's wrapped head, the rope's coil,
 * the bell's lip and clapper.
 */

export interface Place {
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly rotation?: number;
  readonly depth?: number;
}

function group(b: Build, id: string, parent: string, place: Place): string {
  const s = place.scale ?? 1;
  return b.group(
    id,
    parent,
    { x: place.x ?? 0, y: place.y ?? 0, scaleX: s, scaleY: s, rotation: place.rotation ?? 0 },
    place.depth ?? 0,
  );
}

/** A drawing helper bound to one prop: every part inherits the prop's depth, in order. */
function parts(b: Build, id: string, depth: number) {
  let order = 0;
  return (
    name: string,
    shape: Parameters<Build['add']>[2],
    transform: Parameters<Build['add']>[3] = {},
  ) => {
    order += 0.001;
    return b.add(`${id}-${name}`, id, shape, transform, { depth: depth + order });
  };
}

/** Torch: a wooden haft and a pitch-soaked cloth head, about 360 units long, lying horizontal. */
export function torch(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p(
    'haft',
    path(
      poly([
        [-190, -9],
        [70, -13],
        [70, 13],
        [-190, 9],
      ]),
      tk('wood3'),
    ),
  );
  p(
    'haft-dark',
    path(
      poly([
        [-190, 3],
        [70, 4],
        [70, 13],
        [-190, 9],
      ]),
      tk('wood2'),
    ),
  );
  p(
    'head',
    path(
      smooth([
        [60, -30],
        [130, -36],
        [176, -22],
        [182, 0],
        [176, 22],
        [130, 36],
        [60, 30],
      ]),
      tk('leatherDark'),
    ),
  );
  for (let i = 0; i < 4; i++) {
    const x = 78 + i * 26;
    p(
      `wrap-${i}`,
      path(
        poly([
          [x, -32],
          [x + 12, -34],
          [x + 4, 34],
          [x - 8, 32],
        ]),
        tk('leather'),
      ),
    );
  }
  p('band', rect(10, 34, tk('bronzeDark')), { x: 62 });
  return g;
}

/** A flame with a hot core, built to be scaled and flickered by the shot. */
export function flame(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('halo', glow(520, 520, tk('amberGold'), 0.35));
  p(
    'outer',
    path(
      smooth([
        [0, -150],
        [34, -80],
        [52, -10],
        [36, 36],
        [0, 50],
        [-36, 36],
        [-52, -10],
        [-30, -78],
      ]),
      tk('ember'),
    ),
  );
  p(
    'mid',
    path(
      smooth([
        [2, -110],
        [26, -54],
        [36, 0],
        [22, 32],
        [0, 40],
        [-22, 32],
        [-34, 0],
        [-20, -50],
      ]),
      tk('amberGold'),
    ),
  );
  p(
    'core',
    path(
      smooth([
        [2, -60],
        [16, -24],
        [20, 10],
        [0, 26],
        [-18, 10],
        [-14, -24],
      ]),
      tk('torchCore'),
    ),
  );
  return g;
}

/** Chalk: a short white stick, slightly worn at one end. */
export function chalk(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p(
    'stick',
    path(
      smooth([
        [-70, -14],
        [60, -15],
        [76, -6],
        [78, 6],
        [60, 15],
        [-70, 14],
        [-76, 0],
      ]),
      tk('warmIvory'),
    ),
  );
  p(
    'shade',
    path(
      poly([
        [-70, 5],
        [60, 6],
        [72, 10],
        [60, 15],
        [-70, 14],
      ]),
      tk('silver'),
    ),
  );
  return g;
}

/** Rope: a coil seen from above, about 300 units across, with its loose end. */
export function ropeCoil(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('shadow', ellipse(160, 150, tk('void')), { x: 10, y: 14, opacity: 0.45 });
  for (let i = 0; i < 5; i++) {
    const r = 150 - i * 22;
    p(`loop-${i}`, path(ring(r, r * 0.94, 20), tk('rope')), { rotation: i * 23 });
    p(`loop-${i}-shade`, path(ring(r - 12, (r - 12) * 0.94, 6), tk('ropeDark')), {
      rotation: i * 23,
    });
  }
  p(
    'end',
    path(
      strokeLine(
        [
          [120, 60],
          [170, 110],
          [230, 130],
          [270, 170],
        ],
        20,
      ),
      tk('rope'),
    ),
  );
  return g;
}

/** Two lumps of wax, the earplugs. */
export function earplugs(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  for (const [i, x] of [-52, 52].entries()) {
    p(`shadow-${i}`, ellipse(46, 16, tk('void')), { x: x + 6, y: 34, opacity: 0.5 });
    p(
      `wax-${i}`,
      path(
        smooth([
          [-36, 10],
          [-30, -22],
          [0, -36],
          [30, -24],
          [38, 6],
          [24, 30],
          [-20, 30],
        ]),
        tk('wax'),
      ),
      { x, rotation: i * 40 - 10 },
    );
    p(
      `wax-${i}-shade`,
      path(
        smooth([
          [-26, 18],
          [10, 12],
          [30, 4],
          [22, 26],
          [-14, 28],
        ]),
        tk('waxDark'),
      ),
      { x, rotation: i * 40 - 10 },
    );
    p(`wax-${i}-shine`, ellipse(9, 6, tk('warmIvory')), { x: x - 10, y: -14, opacity: 0.7 });
  }
  return g;
}

/** A roll of linen bandage with its loose tail. */
export function bandageRoll(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('shadow', ellipse(110, 22, tk('void')), { y: 74, opacity: 0.5 });
  p(
    'tail',
    path(
      poly([
        [40, 40],
        [150, 56],
        [176, 76],
        [60, 72],
      ]),
      tk('linen'),
    ),
  );
  p('body', rect(150, 140, tk('linen')));
  p('body-shade', rect(150, 30, tk('parchmentDark')), { y: 55 });
  p('end', ellipse(26, 70, tk('parchment')), { x: -75 });
  p('end-hole', ellipse(10, 26, tk('wood1')), { x: -75 });
  for (let i = 0; i < 3; i++)
    p(`layer-${i}`, rect(2, 140, tk('parchmentDark')), { x: -30 + i * 34, opacity: 0.6 });
  return g;
}

/** The bronze decoy bell: a small hand bell with a wooden handle and a visible clapper. */
export function decoyBell(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('shadow', ellipse(110, 20, tk('void')), { y: 96, opacity: 0.5 });
  p(
    'handle',
    path(
      smooth([
        [-14, -170],
        [14, -170],
        [18, -110],
        [12, -60],
        [-12, -60],
        [-18, -110],
      ]),
      tk('wood3'),
    ),
  );
  p('collar', rect(52, 14, tk('bronzeDark')), { y: -60 });
  p('clapper', ellipse(16, 18, tk('bronzeDark')), { y: 92 });
  p(
    'body',
    path(
      smooth([
        [-40, -58],
        [40, -58],
        [58, -10],
        [66, 50],
        [96, 82],
        [-96, 82],
        [-66, 50],
        [-58, -10],
      ]),
      tk('bronze'),
    ),
  );
  p(
    'lip',
    path(
      poly([
        [-98, 76],
        [98, 76],
        [92, 90],
        [-92, 90],
      ]),
      tk('bronzeDark'),
    ),
  );
  p(
    'shine',
    path(
      smooth([
        [-34, -40],
        [-20, -44],
        [-30, 20],
        [-46, 56],
        [-52, 40],
      ]),
      tk('parchment'),
    ),
    { opacity: 0.55 },
  );
  return g;
}

/** Rations and water: a cloth bundle tied with cord, beside a leather flask. */
export function rations(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('shadow', ellipse(200, 26, tk('void')), { x: 20, y: 100, opacity: 0.55 });
  // The bundle.
  p(
    'bundle',
    path(
      smooth([
        [-190, 90],
        [-200, 10],
        [-150, -50],
        [-90, -60],
        [-40, -20],
        [-20, 60],
        [-50, 96],
      ]),
      tk('linen'),
    ),
  );
  p(
    'bundle-shade',
    path(
      smooth([
        [-190, 90],
        [-120, 70],
        [-40, 70],
        [-50, 96],
      ]),
      tk('parchmentDark'),
    ),
  );
  p(
    'knot',
    path(
      smooth([
        [-120, -60],
        [-96, -100],
        [-70, -86],
        [-84, -54],
      ]),
      tk('linen'),
    ),
  );
  p(
    'cord',
    path(
      strokeLine(
        [
          [-160, -30],
          [-110, -10],
          [-60, 20],
          [-30, 50],
        ],
        7,
      ),
      tk('ropeDark'),
    ),
  );
  // The flask.
  p(
    'flask',
    path(
      smooth([
        [40, 96],
        [26, 20],
        [40, -50],
        [80, -76],
        [120, -50],
        [134, 20],
        [120, 96],
      ]),
      tk('leather'),
    ),
  );
  p(
    'flask-shade',
    path(
      smooth([
        [100, 96],
        [118, 20],
        [110, -40],
        [126, -20],
        [134, 30],
        [120, 96],
      ]),
      tk('leatherDark'),
    ),
  );
  p('neck', rect(26, 40, tk('leatherDark')), { x: 80, y: -94 });
  p('stopper', rect(32, 18, tk('wood3')), { x: 80, y: -120 });
  p(
    'strap',
    path(
      strokeLine(
        [
          [40, -40],
          [80, -60],
          [124, -40],
        ],
        6,
      ),
      tk('leatherDark'),
    ),
  );
  return g;
}

/** A silver piece, face on. */
export function silverCoin(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('shadow', ellipse(46, 46, tk('void')), { x: 5, y: 7, opacity: 0.55 });
  p('rim', ellipse(44, 44, tk('silverDark')));
  p('face', ellipse(37, 37, tk('silver')));
  p('ring', path(ring(30, 30, 3), tk('silverDark')));
  p(
    'mark',
    path(
      poly([
        [-6, -14],
        [6, -14],
        [10, 10],
        [-10, 10],
      ]),
      tk('silverDark'),
    ),
  );
  return g;
}

/** Harmonie's satchel from above: leather, flap and the one amber buckle. */
export function satchelTop(b: Build, id: string, parent: string, place: Place = {}): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p(
    'shadow',
    path(
      smooth([
        [-150, -100],
        [150, -100],
        [170, 110],
        [-170, 110],
      ]),
      tk('void'),
    ),
    { x: 10, y: 12, opacity: 0.5 },
  );
  p(
    'bag',
    path(
      smooth([
        [-150, -100],
        [150, -100],
        [164, 60],
        [130, 110],
        [-130, 110],
        [-164, 60],
      ]),
      tk('deepShadow'),
    ),
  );
  p(
    'flap',
    path(
      smooth([
        [-140, -96],
        [140, -96],
        [130, 20],
        [0, 50],
        [-130, 20],
      ]),
      tk('leatherDark'),
    ),
  );
  p('buckle', rect(26, 34, tk('amberGold')), { y: 36 });
  p(
    'strap',
    path(
      strokeLine(
        [
          [-120, -100],
          [-150, -200],
          [-180, -320],
        ],
        26,
      ),
      tk('deepShadow'),
    ),
  );
  return g;
}

/** A contract on worn parchment, its metal seal drawn on it. */
export function contract(
  b: Build,
  id: string,
  parent: string,
  place: Place & { lines?: boolean } = {},
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p(
    'sheet',
    path(
      poly([
        [-250, -150],
        [240, -160],
        [252, 150],
        [-244, 160],
      ]),
      tk('parchment'),
    ),
  );
  p(
    'edge',
    path(
      poly([
        [-244, 130],
        [252, 120],
        [252, 150],
        [-244, 160],
      ]),
      tk('parchmentDark'),
    ),
  );
  for (let i = 0; i < (place.lines === false ? 0 : 5); i++) {
    p(`line-${i}`, rect(i === 0 ? 220 : 260 - i * 18, 8, tk('parchmentDark')), {
      x: 40,
      y: -96 + i * 40,
    });
  }
  // The seal she must bring back: a metal disc with the bell.
  p('seal-rim', ellipse(70, 70, tk('silverDark')), { x: -150, y: 10 });
  p('seal', ellipse(58, 58, tk('silver')), { x: -150, y: 10 });
  p(
    'seal-bell',
    path(
      poly([
        [-8, -30],
        [8, -30],
        [22, 10],
        [34, 22],
        [-34, 22],
        [-22, 10],
      ]),
      tk('silverDark'),
    ),
    { x: -150, y: 10 },
  );
  p('seal-ring', path(ring(48, 48, 4), tk('silverDark')), { x: -150, y: 10 });
  return g;
}
