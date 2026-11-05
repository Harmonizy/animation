import { animateHarmonie, castHarmonie, NEUTRAL_SPEC } from '../cast';
import { shotById } from '../episode';
import {
  archway,
  backdrop,
  banner,
  bellSide,
  bellTop,
  chain,
  fog,
  masonry,
  pillar,
  stairs,
  watcher,
} from '../env';
import {
  Build,
  ellipse,
  fadeKeys,
  glow,
  path,
  poly,
  rect,
  ring,
  seeded,
  strokeLine,
  tk,
  type Key,
  text,
} from '../kit';
import { contract, flame, satchelTop, silverCoin } from '../props';
import { goldCoin } from './s01';

/* ------------------------------------------------------------------------------------------------
 * S02 THE OFFER. Harmonie, small, at the top of a stair that falls away to the left into a portal
 * many times her height. Above the portal, a carved bell. The camera starts close on her and
 * pulls out until the entrance dwarfs her.
 * ---------------------------------------------------------------------------------------------- */
export function buildS02(): Build {
  const { start, end } = shotById('S02');
  const b = new Build();
  const far = b.root('S02-far', 'far', start, end);
  const mid = b.root('S02-mid', 'mid', start, end);
  const world = b.root('S02-world', 'world', start, end);
  const screen = b.root('S02-screen', 'screen', start, end);

  backdrop(b, 'S02-sky', far, [
    { offset: 0, color: 'void' },
    { offset: 0.55, color: 'stone0' },
    { offset: 1, color: 'stone1' },
  ]);
  b.add(
    'S02-cold-light',
    far,
    glow(1600, 1200, tk('tealGlow'), 0.25),
    { x: 260, y: -300 },
    { depth: -90 },
  );
  // Far cliff of buried buildings: rooflines and a broken tower.
  b.add(
    'S02-far-ruins',
    far,
    path(
      poly([
        [-1200, 200],
        [-1200, -260],
        [-900, -260],
        [-880, -420],
        [-760, -420],
        [-740, -300],
        [-520, -300],
        [-500, -520],
        [-440, -620],
        [-380, -520],
        [-360, -300],
        [1200, -300],
        [1200, 200],
      ]),
      tk('stone1'),
    ),
    {},
    { depth: -80 },
  );

  // The rock face and its portal, many times Harmonie's height.
  masonry(
    b,
    'S02-wall',
    mid,
    { x: -180, y: -40, depth: -50 },
    { width: 1500, height: 1500, tone: 'stone2', seed: 7 },
  );
  archway(
    b,
    'S02-portal',
    mid,
    { x: -200, y: 640, depth: -40 },
    { width: 560, height: 1180, stone: 'stone3', inner: 'void', depthGlow: 'tealGlow' },
  );
  // The carved bell above the portal, cracked across.
  bellSide(b, 'S02-relief', mid, { x: -200, y: -760, scale: 0.42, depth: -39 });
  b.add(
    'S02-relief-dim',
    mid,
    rect(260, 220, tk('stone2')),
    { x: -200, y: -680, opacity: 0.45 },
    { depth: -38.9 },
  );
  pillar(b, 'S02-pillar-l', mid, { x: -560, y: 660, depth: -35 }, { height: 1260, width: 110 });
  pillar(b, 'S02-pillar-r', mid, { x: 160, y: 660, depth: -35 }, { height: 1260, width: 110 });
  banner(b, 'S02-banner', mid, { x: 160, y: -520, depth: -34 });
  chain(b, 'S02-chain', mid, { x: -420, y: -900, depth: -33 }, 22);

  // The stair, falling from where she stands down into the portal.
  stairs(
    b,
    'S02-stairs',
    world,
    { x: 520, y: 200, depth: -10 },
    { steps: 12, run: 64, rise: 44, tone: 'stone1' },
  );
  b.add('S02-landing', world, rect(700, 1400, tk('stone1')), { x: 650, y: 900 }, { depth: -11 });
  fog(
    b,
    'S02-fog-low',
    world,
    { x: -150, y: 640, depth: 5 },
    { width: 1500, height: 400, opacity: 0.3 },
  );

  castHarmonie(b, {
    id: 'S02-harmonie',
    parent: world,
    view: 'side',
    x: 300,
    groundY: 200,
    scale: 0.42,
    depth: 10,
  });
  // Cold wind from the entrance: the scarf and cloak lift and settle, nothing else moves.
  const wind = (t: number, amount: number) => ({
    time: t,
    spec: { ...NEUTRAL_SPEC, cloak: -2 - amount * 3, scarf: -4 - amount * 7 },
    easing: 'easeInOut' as const,
  });
  animateHarmonie(
    b,
    'S02-harmonie',
    'side',
    [{ time: start, spec: NEUTRAL_SPEC }],
    [
      wind(start, 0.2),
      wind(start + 1.2, 1),
      wind(start + 2.2, 0.4),
      wind(start + 3.4, 1.1),
      wind(start + 4.6, 0.5),
      wind(end, 0.7),
    ],
  );
  const random = seeded(23);
  for (let i = 0; i < 10; i++) {
    const mote = b.add(
      `S02-grit-${i}`,
      world,
      ellipse(2.5, 1.5, tk('mist')),
      { x: 600, y: -200 + random() * 500, opacity: 0.5 },
      { depth: 20 },
    );
    const t0 = start + random() * 3;
    b.track(
      mote,
      'x',
      [
        { time: start, value: 600 },
        { time: t0, value: 600 },
        { time: Math.min(end, t0 + 2.2), value: -400 - random() * 300 },
      ],
      { hold: 2 },
    );
  }

  // The contract, shown briefly at the top of the frame: its seal, and the reward written on it.
  const offer = shotById('S02').emphasis[0];
  const window = { start: offer?.start ?? start + 1.6, end: offer?.end ?? end };
  const card = b.group(
    'S02-contract',
    screen,
    { y: -640, opacity: 0, scaleX: 1.15, scaleY: 1.15 },
    50,
  );
  contract(b, 'S02-contract-art', card, { depth: 50, lines: false });
  if (offer) {
    b.add(
      'S02-reward',
      card,
      text(offer.text.replace(': ', ':\n'), 46, tk('deepShadow'), { weight: 700, align: 'left' }),
      { x: -50, y: 0 },
      { depth: 51 },
    );
  }
  b.track(card, 'opacity', fadeKeys(window.start, window.end - 0.3, 0.4), { hold: 1 });
  b.track(
    card,
    'y',
    [
      { time: window.start, value: -620, easing: 'easeOut' },
      { time: window.start + 0.7, value: -640 },
    ],
    { hold: 1 },
  );
  return b;
}

/* ------------------------------------------------------------------------------------------------
 * S03 THE LEGEND. The corridor system from directly above, around the bell shaft. The bell swings,
 * tolls, and three corridor sections slide to new places while dust falls.
 * ---------------------------------------------------------------------------------------------- */
interface Corridor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly move?: { dx: number; dy: number };
}

const CORRIDORS: readonly Corridor[] = [
  { id: 'n', x: 0, y: -640, width: 110, height: 420 },
  { id: 'ne', x: 230, y: -480, width: 360, height: 100, move: { dx: 0, dy: 150 } },
  { id: 'e', x: 340, y: -180, width: 110, height: 420 },
  { id: 'w', x: -320, y: -260, width: 420, height: 110, move: { dx: 0, dy: -170 } },
  { id: 'sw', x: -400, y: 60, width: 110, height: 380 },
  { id: 's', x: 40, y: 130, width: 360, height: 110, move: { dx: -150, dy: 0 } },
  { id: 'se', x: 300, y: 180, width: 110, height: 300 },
];

export function buildS03(): Build {
  const { start, end } = shotById('S03');
  const b = new Build();
  const world = b.root('S03-world', 'world', start, end);
  const toll = shotById('S03').sounds.find((s) => s.cue === 'bell-toll')?.start ?? start + 1.3;
  b.add('S03-ground', world, rect(2400, 3000, tk('void')), {}, { depth: -100 });
  b.add('S03-cool', world, glow(1600, 1800, tk('tealGlow'), 0.18), { y: -250 }, { depth: -99 });
  // The bell shaft: a round pit with a stone rim.
  b.add('S03-shaft-rim', world, ellipse(250, 250, tk('stone3')), { y: -260 }, { depth: -20 });
  b.add('S03-shaft', world, ellipse(215, 215, tk('void')), { y: -260 }, { depth: -19 });
  for (const c of CORRIDORS) {
    const g = b.group(`S03-c-${c.id}`, world, { x: c.x, y: c.y }, -10);
    b.add(
      `S03-c-${c.id}-wall`,
      g,
      rect(c.width + 36, c.height + 36, tk('stone3')),
      {},
      { depth: -10 },
    );
    b.add(`S03-c-${c.id}-floor`, g, rect(c.width, c.height, tk('stone1')), {}, { depth: -9.9 });
    // Map lines: the paths drawn as a thin centre line that moves with the stone.
    const along = c.width > c.height;
    b.add(
      `S03-c-${c.id}-line`,
      g,
      rect(along ? c.width - 20 : 4, along ? 4 : c.height - 20, tk('mist')),
      { opacity: 0.55 },
      { depth: -9.8 },
    );
    if (c.move) {
      const keys = (delta: number, base: number): Key[] => [
        { time: start, value: base },
        { time: toll + 0.35, value: base, easing: 'easeInOut' },
        { time: toll + 2.2, value: base + delta },
      ];
      if (c.move.dx) b.track(g, 'x', keys(c.move.dx, c.x), { hold: 2 });
      if (c.move.dy) b.track(g, 'y', keys(c.move.dy, c.y), { hold: 2 });
      // Dust where stone grinds on stone.
      const dust = b.add(
        `S03-c-${c.id}-dust`,
        world,
        glow(320, 320, tk('mist'), 0.5),
        { x: c.x + c.move.dx / 2, y: c.y + c.move.dy / 2, opacity: 0 },
        { depth: 10 },
      );
      b.track(
        dust,
        'opacity',
        [
          { time: start, value: 0 },
          { time: toll + 0.4, value: 0, easing: 'easeOut' },
          { time: toll + 1, value: 0.8, easing: 'easeIn' },
          { time: toll + 3, value: 0 },
        ],
        { hold: 2 },
      );
    }
  }
  // The bell, seen from above, swinging on its chain; it tolls at its widest swing.
  const bell = bellTop(b, 'S03-bell', world, { y: -260, depth: 0 }, 160);
  b.track(
    bell,
    'x',
    [
      { time: start, value: -40, easing: 'easeInOut' },
      { time: start + 0.65, value: 40, easing: 'easeInOut' },
      { time: toll, value: -46, easing: 'easeInOut' },
      { time: toll + 1.0, value: 34, easing: 'easeInOut' },
      { time: toll + 2.0, value: -24, easing: 'easeInOut' },
      { time: end, value: 14 },
    ],
    { hold: 2 },
  );
  // The toll: rings of sound spreading out across the floor.
  for (let i = 0; i < 3; i++) {
    const wave = b.add(
      `S03-wave-${i}`,
      world,
      { kind: 'path', d: ringPath(200), fill: tk('amberGold') },
      { y: -260, opacity: 0, scaleX: 0.6, scaleY: 0.6 },
      { depth: 5 },
    );
    const t0 = toll + i * 0.35;
    b.track(
      wave,
      'scaleX',
      [
        { time: start, value: 0.6 },
        { time: t0, value: 0.6 },
        { time: t0 + 1.8, value: 4.2 },
      ],
      { hold: 1 },
    );
    b.track(
      wave,
      'scaleY',
      [
        { time: start, value: 0.6 },
        { time: t0, value: 0.6 },
        { time: t0 + 1.8, value: 4.2 },
      ],
      { hold: 1 },
    );
    b.track(
      wave,
      'opacity',
      [
        { time: start, value: 0 },
        { time: t0, value: 0, easing: 'step' },
        { time: t0 + 0.01, value: 0.6 },
        { time: t0 + 1.8, value: 0 },
      ],
      { hold: 1 },
    );
  }
  // Dust falling from the ceiling, towards us.
  const random = seeded(31);
  for (let i = 0; i < 26; i++) {
    const x = (random() - 0.5) * 1000;
    const y = -900 + random() * 1200;
    const mote = b.add(
      `S03-mote-${i}`,
      world,
      ellipse(3, 3, tk('linen')),
      { x, y, opacity: 0 },
      { depth: 20 },
    );
    const t0 = toll + 0.3 + random() * 1.8;
    b.track(
      mote,
      'opacity',
      [
        { time: start, value: 0 },
        { time: t0, value: 0, easing: 'easeOut' },
        { time: t0 + 0.3, value: 0.8, easing: 'easeIn' },
        { time: Math.min(end, t0 + 1.6), value: 0 },
      ],
      { hold: 2 },
    );
    b.track(
      mote,
      'scaleX',
      [
        { time: start, value: 1 },
        { time: t0, value: 1 },
        { time: Math.min(end, t0 + 1.6), value: 3 },
      ],
      { hold: 2 },
    );
    b.track(
      mote,
      'scaleY',
      [
        { time: start, value: 1 },
        { time: t0, value: 1 },
        { time: Math.min(end, t0 + 1.6), value: 3 },
      ],
      { hold: 2 },
    );
  }
  return b;
}

const ringPath = (r: number) => ring(r, r, 6, 64);

/* ------------------------------------------------------------------------------------------------
 * S04 THE WATCHERS. A torch-lit gothic corridor in one-point perspective. Far down it, a tall
 * shadow drifts towards the flame, half hidden by a pillar and the fog. Its motion is on threes,
 * which makes it feel subtly wrong next to everything else.
 * ---------------------------------------------------------------------------------------------- */
export function corridorPerspective(
  b: Build,
  prefix: string,
  parent: string,
  vanish: { x: number; y: number },
  arches: number,
  depth: number,
): void {
  for (let i = arches - 1; i >= 0; i--) {
    const scale = 0.22 + Math.pow(i / (arches - 1), 1.6) * 1.15;
    const x = vanish.x * (1 - scale);
    const y = vanish.y + 640 * scale;
    archway(
      b,
      `${prefix}-arch-${i}`,
      parent,
      { x, y, scale, depth: depth + i },
      { width: 900, height: 1500, stone: i % 2 ? 'stone2' : 'stone3', open: true },
    );
  }
}

export function buildS04(): Build {
  const { start, end } = shotById('S04');
  const b = new Build();
  const far = b.root('S04-far', 'far', start, end);
  const world = b.root('S04-world', 'world', start, end);
  const near = b.root('S04-near', 'near', start, end);
  backdrop(b, 'S04-back', far, [
    { offset: 0, color: 'void' },
    { offset: 1, color: 'stone0' },
  ]);
  const vanish = { x: 60, y: -260 };
  b.add(
    'S04-depth',
    far,
    glow(700, 700, tk('tealGlow'), 0.3),
    { x: vanish.x, y: vanish.y },
    { depth: -90 },
  );
  b.add(
    'S04-floor',
    world,
    path(
      poly([
        [-1400, 1200],
        [1400, 1200],
        [vanish.x + 60, vanish.y + 140],
        [vanish.x - 60, vanish.y + 140],
      ]),
      tk('stone1'),
    ),
    {},
    { depth: -60 },
  );
  corridorPerspective(b, 'S04', world, vanish, 7, -50);
  fog(
    b,
    'S04-fog-far',
    world,
    { x: vanish.x, y: vanish.y + 120, depth: -42 },
    { width: 900, height: 360, opacity: 0.45 },
  );

  // The watcher, deep in the corridor, between the third and fourth arches.
  const w = watcher(b, 'S04-watcher', world, {
    x: 170,
    y: vanish.y + 210,
    scale: 0.36,
    depth: -44.5,
  });
  b.track(
    w.root,
    'x',
    [
      { time: start, value: 170 },
      { time: start + 1.2, value: 170, easing: 'easeInOut' },
      { time: end, value: 40 },
    ],
    { hold: 3 },
  );
  b.track(
    w.root,
    'scaleX',
    [
      { time: start, value: 0.36 },
      { time: end, value: 0.44 },
    ],
    { hold: 3 },
  );
  b.track(
    w.root,
    'scaleY',
    [
      { time: start, value: 0.36 },
      { time: end, value: 0.44 },
    ],
    { hold: 3 },
  );
  b.track(
    w.root,
    'y',
    [
      { time: start, value: vanish.y + 210 },
      { time: end, value: vanish.y + 240 },
    ],
    { hold: 3 },
  );
  b.track(
    w.head,
    'rotation',
    [
      { time: start, value: 0 },
      { time: start + 1.6, value: 0 },
      { time: start + 1.75, value: -14, easing: 'easeOut' },
      { time: end, value: -10 },
    ],
    { hold: 3 },
  );
  b.track(
    w.leftArm,
    'rotation',
    [
      { time: start, value: 2, easing: 'easeInOut' },
      { time: start + 2.5, value: -4, easing: 'easeInOut' },
      { time: end, value: 3 },
    ],
    { hold: 3 },
  );
  b.track(
    w.rightArm,
    'rotation',
    [
      { time: start, value: -2, easing: 'easeInOut' },
      { time: start + 2.2, value: 6, easing: 'easeInOut' },
      { time: end, value: -1 },
    ],
    { hold: 3 },
  );
  fog(
    b,
    'S04-fog-veil',
    world,
    { x: 120, y: vanish.y + 200, depth: -43 },
    { width: 600, height: 300, opacity: 0.35 },
  );

  // The torch on the left wall, in the foreground, lighting the near stones.
  b.add(
    'S04-torch-light',
    near,
    glow(1300, 1500, tk('ember'), 0.45),
    { x: -230, y: -260 },
    { depth: 0 },
  );
  b.add(
    'S04-sconce',
    near,
    path(
      poly([
        [-280, -120],
        [-230, -120],
        [-210, -60],
        [-280, -40],
      ]),
      tk('bronzeDark'),
    ),
    {},
    { depth: 1 },
  );
  b.add(
    'S04-haft',
    near,
    path(
      strokeLine(
        [
          [-260, -60],
          [-230, -250],
        ],
        26,
      ),
      tk('wood2'),
    ),
    {},
    { depth: 1.1 },
  );
  const f = flame(b, 'S04-flame', near, { x: -228, y: -260, scale: 0.9, depth: 2 });
  flicker(b, f, start, end, 0.9, 41);
  return b;
}

/** Deterministic flicker: scale and sway keyed every few frames from a seeded sequence. */
export function flicker(
  b: Build,
  id: string,
  start: number,
  end: number,
  base: number,
  seed: number,
): void {
  const random = seeded(seed);
  const sx: Key[] = [];
  const sy: Key[] = [];
  const rot: Key[] = [];
  for (let t = start; t <= end + 1e-9; t += 0.125) {
    sx.push({ time: t, value: base * (0.92 + random() * 0.14) });
    sy.push({ time: t, value: base * (0.88 + random() * 0.24) });
    rot.push({ time: t, value: (random() - 0.5) * 8 });
  }
  b.track(id, 'scaleX', sx, { hold: 2 });
  b.track(id, 'scaleY', sy, { hold: 2 });
  b.track(id, 'rotation', rot, { hold: 2 });
}

/* ------------------------------------------------------------------------------------------------
 * S05 THE WHISPERS. Over her shoulder: Harmonie's back fills the lower left, the narrow corridor
 * runs ahead. Mist ripples behind her with no one there. Her head turns a little, not all the
 * way. Cloak and scarf, moving gently in the draught, go still while she listens.
 * ---------------------------------------------------------------------------------------------- */
export function buildS05(): Build {
  const shot = shotById('S05');
  const { start, end } = shot;
  const b = new Build();
  const far = b.root('S05-far', 'far', start, end);
  const world = b.root('S05-world', 'world', start, end);
  const near = b.root('S05-near', 'near', start, end);
  backdrop(b, 'S05-back', far, [
    { offset: 0, color: 'void' },
    { offset: 1, color: 'stone0' },
  ]);
  const vanish = { x: 140, y: -330 };
  b.add(
    'S05-depth',
    far,
    glow(600, 600, tk('tealGlow'), 0.32),
    { x: vanish.x, y: vanish.y },
    { depth: -90 },
  );
  // Narrow walls: two dark planes converging on the far opening.
  b.add(
    'S05-wall-l',
    world,
    path(
      poly([
        [-900, -1400],
        [vanish.x - 70, vanish.y - 160],
        [vanish.x - 70, vanish.y + 130],
        [-900, 1400],
      ]),
      tk('stone1'),
    ),
    {},
    { depth: -60 },
  );
  b.add(
    'S05-wall-r',
    world,
    path(
      poly([
        [1100, -1400],
        [vanish.x + 70, vanish.y - 160],
        [vanish.x + 70, vanish.y + 130],
        [1100, 1400],
      ]),
      tk('stone2'),
    ),
    {},
    { depth: -60 },
  );
  archway(
    b,
    'S05-far-arch',
    world,
    { x: vanish.x, y: vanish.y + 130, scale: 0.18, depth: -58 },
    { width: 760, height: 1500, stone: 'stone3', inner: 'void', depthGlow: 'tealGlow' },
  );
  fog(
    b,
    'S05-fog',
    world,
    { x: vanish.x, y: vanish.y + 100, depth: -50 },
    { width: 900, height: 420, opacity: 0.4 },
  );

  // Mist ripples near the camera, on the right: something speaking where nothing is.
  for (let i = 0; i < 4; i++) {
    const ripple = b.add(
      `S05-ripple-${i}`,
      near,
      path(ring(200, 70, 7, 64), tk('mist')),
      { x: 280, y: -80 + i * 20, opacity: 0, scaleX: 0.4, scaleY: 0.4 },
      { depth: 10 },
    );
    const t0 = start + 0.8 + i * 0.6;
    b.track(
      ripple,
      'scaleX',
      [
        { time: start, value: 0.4 },
        { time: t0, value: 0.4 },
        { time: t0 + 1.6, value: 1.6 },
      ],
      { hold: 1 },
    );
    b.track(
      ripple,
      'scaleY',
      [
        { time: start, value: 0.4 },
        { time: t0, value: 0.4 },
        { time: t0 + 1.6, value: 1.6 },
      ],
      { hold: 1 },
    );
    b.track(
      ripple,
      'opacity',
      [
        { time: start, value: 0 },
        { time: t0, value: 0, easing: 'easeOut' },
        { time: t0 + 0.4, value: 0.45, easing: 'easeIn' },
        { time: Math.min(end, t0 + 1.6), value: 0 },
      ],
      { hold: 1 },
    );
  }
  fog(
    b,
    'S05-fog-near',
    near,
    { x: 300, y: -60, depth: 9 },
    { width: 700, height: 500, opacity: 0.18 },
  );

  castHarmonie(b, {
    id: 'S05-harmonie',
    parent: world,
    view: 'back',
    x: -230,
    groundY: 1240,
    scale: 1.75,
    depth: 0,
  });
  // Her head turns slightly to her right, towards the sound, and stops short.
  const listen = shot.sounds[0]?.start ?? start + 0.8;
  const head = 'S05-harmonie-head';
  b.track(
    head,
    'rotation',
    [
      { time: start, value: 0 },
      { time: listen + 0.5, value: 0, easing: 'easeInOut' },
      { time: listen + 1.2, value: 7, easing: 'easeOut' },
      { time: listen + 1.35, value: 6 },
      { time: end, value: 6.5 },
    ],
    { group: 'character' },
  );
  b.track(
    head,
    'x',
    [
      { time: start, value: 0 },
      { time: listen + 0.5, value: 0, easing: 'easeInOut' },
      { time: listen + 1.2, value: 10 },
    ],
    { group: 'character' },
  );
  // The draught moves her cloak and scarf, until she holds still to listen.
  const cloak = 'S05-harmonie-cloak';
  const scarf = 'S05-harmonie-scarf';
  b.track(
    cloak,
    'rotation',
    [
      { time: start, value: 0, easing: 'easeInOut' },
      { time: start + 0.7, value: 1.4, easing: 'easeInOut' },
      { time: listen + 0.6, value: 0.2, easing: 'easeOut' },
      { time: listen + 0.9, value: 0 },
      { time: end - 0.6, value: 0, easing: 'easeInOut' },
      { time: end, value: 0.8 },
    ],
    { hold: 2 },
  );
  b.track(
    scarf,
    'rotation',
    [
      { time: start, value: 0, easing: 'easeInOut' },
      { time: start + 0.6, value: -3, easing: 'easeInOut' },
      { time: listen + 0.6, value: -0.6, easing: 'easeOut' },
      { time: listen + 0.9, value: 0 },
      { time: end - 0.6, value: 0, easing: 'easeInOut' },
      { time: end, value: -2 },
    ],
    { hold: 2 },
  );
  return b;
}

/* ------------------------------------------------------------------------------------------------
 * S06 THE BUDGET. Straight down on the counter. One gold piece in the middle becomes ten silver
 * pieces in two neat rows. Her empty satchel lies open at the edge of frame.
 * ---------------------------------------------------------------------------------------------- */
export function counterTop(
  b: Build,
  prefix: string,
  parent: string,
  tone: 'wood1' | 'wood2' = 'wood1',
): void {
  b.add(`${prefix}-wood`, parent, rect(2400, 3000, tk(tone)), {}, { depth: -100 });
  for (let i = -6; i <= 6; i++) {
    b.add(
      `${prefix}-plank-${i}`,
      parent,
      rect(4, 3000, tk('wood0')),
      { x: i * 170 + (i % 2) * 20, opacity: 0.7 },
      { depth: -99 },
    );
  }
  const random = seeded(5);
  for (let i = 0; i < 18; i++) {
    b.add(
      `${prefix}-grain-${i}`,
      parent,
      rect(2, 120 + random() * 240, tk('wood3')),
      { x: (random() - 0.5) * 1800, y: (random() - 0.5) * 2400, opacity: 0.35 },
      { depth: -98 },
    );
  }
  b.add(
    `${prefix}-light`,
    parent,
    glow(1400, 1600, tk('amberGold'), 0.16),
    { y: -200 },
    { depth: -97 },
  );
  b.add(`${prefix}-vignette`, parent, glow(2600, 3200, tk('void'), 0), {}, { depth: -96 });
}

export function buildS06(): Build {
  const shot = shotById('S06');
  const { start, end } = shot;
  const b = new Build();
  const world = b.root('S06-world', 'world', start, end);
  counterTop(b, 'S06', world);
  satchelTop(b, 'S06-satchel', world, { x: -330, y: 760, rotation: 18, scale: 1.1, depth: 5 });

  const change = (shot.sounds.find((s) => s.cue === 'silver-clink')?.start ?? start + 1.1) - 0.15;
  const gold = b.group('S06-gold', world, { y: -250 }, 10);
  goldCoin(b, 'S06-gold-art', gold, 120, 10);
  b.track(
    gold,
    'opacity',
    [
      { time: start, value: 0 },
      { time: start + 0.3, value: 1 },
      { time: change - 0.1, value: 1, easing: 'easeIn' },
      { time: change + 0.15, value: 0 },
    ],
    { hold: 1 },
  );
  b.track(
    gold,
    'scaleX',
    [
      { time: start, value: 1.15, easing: 'easeOut' },
      { time: start + 0.5, value: 1 },
      { time: change - 0.2, value: 1, easing: 'easeIn' },
      { time: change + 0.15, value: 0.3 },
    ],
    { hold: 2 },
  );
  b.track(
    gold,
    'scaleY',
    [
      { time: start, value: 1.15, easing: 'easeOut' },
      { time: start + 0.5, value: 1 },
      { time: change - 0.2, value: 1, easing: 'easeIn' },
      { time: change + 0.15, value: 0.3 },
    ],
    { hold: 2 },
  );
  const flash = b.add(
    'S06-flash',
    world,
    glow(520, 520, tk('torchCore'), 0.8),
    { y: -250, opacity: 0 },
    { depth: 12 },
  );
  b.track(
    flash,
    'opacity',
    [
      { time: start, value: 0 },
      { time: change - 0.1, value: 0, easing: 'easeOut' },
      { time: change + 0.05, value: 1, easing: 'easeIn' },
      { time: change + 0.6, value: 0 },
    ],
    { hold: 1 },
  );

  const interval = shot.sounds.find((s) => s.cue === 'silver-clink')?.interval ?? 0.11;
  for (let i = 0; i < 10; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = (col - 2) * 118;
    const y = -330 + row * 150;
    const coin = silverCoin(b, `S06-silver-${i}`, world, { x, y, depth: 14 + i * 0.01 });
    const t0 = change + 0.15 + i * interval;
    b.track(
      coin,
      'opacity',
      [
        { time: start, value: 0 },
        { time: t0 - 0.04, value: 0, easing: 'step' },
        { time: t0, value: 1 },
      ],
      { hold: 1 },
    );
    b.track(
      coin,
      'scaleX',
      [
        { time: start, value: 1.4 },
        { time: t0, value: 1.4, easing: 'easeIn' },
        { time: t0 + 0.12, value: 0.94, easing: 'easeOut' },
        { time: t0 + 0.2, value: 1 },
      ],
      { hold: 1 },
    );
    b.track(
      coin,
      'scaleY',
      [
        { time: start, value: 1.4 },
        { time: t0, value: 1.4, easing: 'easeIn' },
        { time: t0 + 0.12, value: 0.94, easing: 'easeOut' },
        { time: t0 + 0.2, value: 1 },
      ],
      { hold: 1 },
    );
  }
  return b;
}
