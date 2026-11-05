import {
  archFrame,
  Build,
  ellipse,
  glow,
  path,
  pointedArch,
  poly,
  rect,
  ring,
  seeded,
  smooth,
  tk,
  vertical,
  type PaletteToken,
  type Pt,
} from './kit';
import type { Place } from './props';

/**
 * The crypt's architecture. A small vocabulary repeated with care: dressed stone courses,
 * pointed gothic arches with voussoirs, carved pillars with a bell motif, chains, steps and fog.
 * The bell carvings and prayer benches say who built this place, and what it was for.
 */

function group(b: Build, id: string, parent: string, place: Place): string {
  const s = place.scale ?? 1;
  return b.group(
    id,
    parent,
    { x: place.x ?? 0, y: place.y ?? 0, scaleX: s, scaleY: s, rotation: place.rotation ?? 0 },
    place.depth ?? 0,
  );
}

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

/** A wall of dressed stone, centred on its place, with mortar courses and staggered joints. */
export function masonry(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  size: {
    width: number;
    height: number;
    tone: PaletteToken;
    joint?: PaletteToken;
    course?: number;
    seed?: number;
  },
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  const { width, height } = size;
  const course = size.course ?? 70;
  const random = seeded(size.seed ?? 3);
  p('face', rect(width, height, tk(size.tone)));
  const rows = Math.floor(height / course);
  for (let r = 1; r < rows; r++) {
    const y = -height / 2 + r * course;
    p(`course-${r}`, rect(width, 3, tk(size.joint ?? 'void')), { y, opacity: 0.55 });
    const offset = (r % 2) * 60;
    for (
      let x = -width / 2 + offset + 40 + random() * 40;
      x < width / 2;
      x += 110 + random() * 60
    ) {
      p(`joint-${r}-${Math.round(x)}`, rect(3, course - 3, tk(size.joint ?? 'void')), {
        x,
        y: y - course / 2,
        opacity: 0.45,
      });
    }
  }
  // Weathering: a few lighter and darker worn stones.
  for (let i = 0; i < Math.round((width * height) / 90000); i++) {
    const x = (random() - 0.5) * (width - 120);
    const y = (random() - 0.5) * (height - 80);
    p(`wear-${i}`, rect(80 + random() * 60, course - 8, tk(random() > 0.5 ? 'stone0' : 'stone3')), {
      x,
      y,
      opacity: 0.35,
    });
  }
  return g;
}

/**
 * A pointed arch opening cut into a wall: the dark interior, a ring of wedge-shaped voussoirs and
 * a keystone. The base sits at the place's origin.
 */
export function archway(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  size: {
    width: number;
    height: number;
    stone?: PaletteToken;
    inner?: PaletteToken;
    depthGlow?: PaletteToken;
    open?: boolean;
  },
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  const { width, height } = size;
  const band = width * 0.12;
  if (size.open) {
    // A frame only, so whatever lies beyond shows through.
    p('surround', path(archFrame(width, height, band), tk(size.stone ?? 'stone3')));
  } else {
    p('surround', path(pointedArch(width + band * 2, height + band), tk(size.stone ?? 'stone3')));
    p('interior', path(pointedArch(width, height), tk(size.inner ?? 'void')));
  }
  if (size.depthGlow)
    p('glow', glow(width * 0.9, height * 0.6, tk(size.depthGlow), 0.35), { y: -height * 0.35 });
  // Voussoir joints radiating from the arch's centre of curvature.
  const spring = height - width * 0.85;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (0.08 + (i / 8) * 0.84);
    const cx = Math.cos(a) * (width / 2 + band * 0.5);
    const cy = -spring - Math.sin(a) * (height - spring) * 0.95;
    p(`voussoir-${i}`, rect(4, band * 1.1, tk('void')), {
      x: cx,
      y: cy,
      rotation: 90 - (a * 180) / Math.PI,
      opacity: 0.6,
    });
  }
  p(
    'keystone',
    path(
      poly([
        [-band * 0.5, 0],
        [band * 0.5, 0],
        [band * 0.35, band * 1.2],
        [-band * 0.35, band * 1.2],
      ]),
      tk('stone4'),
    ),
    { y: -height - band * 0.9 },
  );
  return g;
}

/** A carved pillar: plinth, fluted shaft with a bell carved at the top, and a capital. */
export function pillar(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  size: { height: number; width?: number; tone?: PaletteToken; carving?: boolean },
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  const w = size.width ?? 90;
  const h = size.height;
  const tone = tk(size.tone ?? 'stone2');
  p('shaft', rect(w, h, tone), { y: -h / 2 });
  p('shade', rect(w * 0.28, h, tk('stone0')), { x: w * 0.36, y: -h / 2, opacity: 0.6 });
  p('flute-1', rect(4, h * 0.8, tk('void')), { x: -w * 0.15, y: -h / 2, opacity: 0.5 });
  p('flute-2', rect(4, h * 0.8, tk('void')), { x: w * 0.12, y: -h / 2, opacity: 0.5 });
  p(
    'base',
    path(
      poly([
        [-w * 0.8, 0],
        [w * 0.8, 0],
        [w * 0.7, -40],
        [-w * 0.7, -40],
      ]),
      tk('stone3'),
    ),
  );
  p(
    'capital',
    path(
      poly([
        [-w * 0.55, -h],
        [w * 0.55, -h],
        [w * 0.85, -h - 50],
        [-w * 0.85, -h - 50],
      ]),
      tk('stone3'),
    ),
  );
  if (size.carving ?? true) {
    // An eroded bell, the monastery's emblem.
    p(
      'bell',
      path(
        poly([
          [-w * 0.12, -h * 0.86],
          [w * 0.12, -h * 0.86],
          [w * 0.22, -h * 0.79],
          [w * 0.28, -h * 0.72],
          [-w * 0.28, -h * 0.72],
          [-w * 0.22, -h * 0.79],
        ]),
        tk('stone0'),
      ),
      { opacity: 0.8 },
    );
  }
  return g;
}

/** A hanging chain of alternating links. */
export function chain(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  links: number,
  tone: PaletteToken = 'stone3',
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  for (let i = 0; i < links; i++) {
    const y = i * 30;
    if (i % 2 === 0) p(`link-${i}`, path(ring(10, 20, 5), tk(tone)), { y });
    else p(`link-${i}`, rect(6, 34, tk(tone)), { y });
  }
  return g;
}

/** A soft bank of fog, wider than tall. */
export function fog(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  size: { width: number; height: number; opacity: number; tone?: PaletteToken },
): string {
  return b.add(
    id,
    parent,
    glow(size.width, size.height, tk(size.tone ?? 'mist'), size.opacity),
    { x: place.x ?? 0, y: place.y ?? 0 },
    { depth: place.depth ?? 0 },
  );
}

/** Steps seen from the side, going down to the left. Each step is a tread and a riser. */
export function stairs(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  size: { steps: number; run: number; rise: number; tone?: PaletteToken },
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  const points: Pt[] = [[0, 0]];
  for (let i = 0; i < size.steps; i++) {
    points.push([-i * size.run, i * size.rise]);
    points.push([-(i + 1) * size.run, i * size.rise]);
    points.push([-(i + 1) * size.run, (i + 1) * size.rise]);
  }
  const last = points[points.length - 1] as Pt;
  points.push([last[0], last[1] + 1400], [0, last[1] + 1400]);
  p('mass', path(poly(points), tk(size.tone ?? 'stone2')));
  for (let i = 0; i < size.steps; i++) {
    p(`nosing-${i}`, rect(size.run, 4, tk('stone4')), {
      x: -(i + 0.5) * size.run,
      y: i * size.rise + 2,
      opacity: 0.7,
    });
  }
  return g;
}

/**
 * A watcher: a faceless, elongated shadow with arms hanging to its knees and a head too small
 * for its height. Never more than a silhouette. Its arm groups are returned so shots can give it
 * slow, slightly wrong motion.
 */
export function watcher(
  b: Build,
  id: string,
  parent: string,
  place: Place,
): { root: string; leftArm: string; rightArm: string; head: string } {
  const g = group(b, id, parent, place);
  const depth = place.depth ?? 0;
  const fill = tk('watcher');
  b.add(`${id}-aura`, g, glow(520, 1300, tk('void'), 0.6), { y: -470 }, { depth: depth - 0.01 });
  b.add(
    `${id}-body`,
    g,
    path(
      smooth([
        [-44, -760],
        [44, -760],
        [70, -600],
        [58, -380],
        [40, -200],
        [52, 0],
        [18, 0],
        [0, -230],
        [-18, 0],
        [-52, 0],
        [-40, -200],
        [-58, -380],
        [-70, -600],
      ]),
      fill,
    ),
    {},
    { depth },
  );
  const head = b.group(`${id}-head`, g, { y: -760 }, depth);
  b.add(
    `${id}-head-shape`,
    head,
    path(
      smooth([
        [-20, 0],
        [-26, -50],
        [-8, -82],
        [14, -78],
        [26, -44],
        [20, 0],
      ]),
      fill,
    ),
    {},
    { depth },
  );
  const arm = (side: 'left' | 'right', x: number) => {
    const a = b.group(`${id}-${side}Arm`, g, { x, y: -690 }, depth + 0.01);
    b.add(
      `${id}-${side}Arm-shape`,
      a,
      path(
        smooth([
          [-12, 0],
          [12, 0],
          [16, 220],
          [10, 470],
          [16, 560],
          [0, 600],
          [-14, 560],
          [-8, 470],
          [-14, 220],
        ]),
        fill,
      ),
      {},
      { depth: depth + 0.01 },
    );
    return a;
  };
  return { root: g, leftArm: arm('left', -64), rightArm: arm('right', 64), head };
}

/** The great bronze bell from the side: crown, waist, flared lip, crack and clapper. */
export function bellSide(b: Build, id: string, parent: string, place: Place): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('glow', glow(900, 900, tk('bronze'), 0.12), { y: 180 });
  p(
    'crown',
    path(
      smooth([
        [-50, -40],
        [-40, -90],
        [0, -110],
        [40, -90],
        [50, -40],
      ]),
      tk('bronzeDark'),
    ),
  );
  p(
    'body',
    path(
      smooth([
        [-120, -40],
        [120, -40],
        [170, 60],
        [190, 260],
        [270, 360],
        [-270, 360],
        [-190, 260],
        [-170, 60],
      ]),
      tk('bronze'),
    ),
  );
  p(
    'shade',
    path(
      smooth([
        [60, -36],
        [120, -40],
        [170, 60],
        [190, 260],
        [270, 360],
        [150, 360],
        [120, 240],
        [100, 40],
      ]),
      tk('bronzeDark'),
    ),
    { opacity: 0.7 },
  );
  p('band-1', rect(380, 10, tk('bronzeDark')), { y: 40 });
  p('band-2', rect(470, 12, tk('bronzeDark')), { y: 300 });
  p(
    'lip',
    path(
      poly([
        [-276, 352],
        [276, 352],
        [262, 380],
        [-262, 380],
      ]),
      tk('bronzeDark'),
    ),
  );
  p(
    'crack',
    path(
      poly([
        [-60, 360],
        [-40, 280],
        [-70, 220],
        [-48, 160],
        [-56, 162],
        [-80, 222],
        [-52, 282],
        [-70, 360],
      ]),
      tk('void'),
    ),
  );
  p('clapper', ellipse(30, 36, tk('bronzeDark')), { y: 400 });
  return g;
}

/** The bell from directly above: concentric rings and the shadow of its crown. */
export function bellTop(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  radius: number,
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('shadow', ellipse(radius * 1.1, radius * 1.1, tk('void')), { x: 30, y: 30, opacity: 0.6 });
  p('lip', ellipse(radius, radius, tk('bronzeDark')));
  p('body', ellipse(radius * 0.86, radius * 0.86, tk('bronze')));
  p('ring-1', path(ring(radius * 0.7, radius * 0.7, 8), tk('bronzeDark')));
  p('ring-2', path(ring(radius * 0.45, radius * 0.45, 6), tk('bronzeDark')));
  p('crown', ellipse(radius * 0.22, radius * 0.22, tk('bronzeDark')));
  p('crown-top', ellipse(radius * 0.12, radius * 0.12, tk('parchmentDark')));
  return g;
}

/** A worn prayer bench, side on. */
export function bench(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  tone: PaletteToken = 'stone2',
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('seat', rect(260, 26, tk(tone)), { y: -80 });
  p('leg-1', rect(26, 80, tk(tone)), { x: -100, y: -40 });
  p('leg-2', rect(26, 80, tk(tone)), { x: 100, y: -40 });
  p(
    'crack',
    path(
      poly([
        [40, -93],
        [60, -67],
        [52, -67],
        [34, -93],
      ]),
      tk('void'),
    ),
  );
  return g;
}

/** A tattered ceremonial banner, hanging from a rod. */
export function banner(
  b: Build,
  id: string,
  parent: string,
  place: Place,
  tone: PaletteToken = 'stone3',
): string {
  const g = group(b, id, parent, place);
  const p = parts(b, g, place.depth ?? 0);
  p('rod', rect(180, 8, tk('bronzeDark')));
  p(
    'cloth',
    path(
      poly([
        [-70, 0],
        [70, 0],
        [66, 260],
        [40, 300],
        [20, 250],
        [-10, 320],
        [-34, 260],
        [-70, 290],
      ]),
      tk(tone),
    ),
  );
  p(
    'emblem',
    path(
      poly([
        [-14, 80],
        [14, 80],
        [24, 120],
        [34, 132],
        [-34, 132],
        [-24, 120],
      ]),
      tk('stone0'),
    ),
    { opacity: 0.7 },
  );
  return g;
}

/** A top-to-bottom backdrop gradient, sized to cover the frame through camera moves. */
export function backdrop(
  b: Build,
  id: string,
  parent: string,
  stops: { offset: number; color: PaletteToken; opacity?: number }[],
  height = 2600,
  y = 0,
): string {
  return b.add(
    id,
    parent,
    vertical(
      2400,
      height,
      stops.map((s) => ({ offset: s.offset, color: tk(s.color), opacity: s.opacity ?? 1 })),
    ),
    { y },
    { depth: -100 },
  );
}
