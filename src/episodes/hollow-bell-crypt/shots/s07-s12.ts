import { gloveNodes, glovePose } from '../../../characters/harmonie/harmonie-hand';
import { castHarmonie, NEUTRAL_SPEC, animateHarmonie } from '../cast';
import { EPISODE, shotById } from '../episode';
import { archway, backdrop, chain, fog, masonry, pillar, watcher } from '../env';
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
  text,
  tk,
  vertical,
  type Key,
  type Pt,
} from '../kit';
import { priceTag, roundedRect } from '../overlay';
import {
  bandageRoll,
  chalk,
  decoyBell,
  earplugs,
  flame,
  rations,
  ropeCoil,
  silverCoin,
  torch,
  type Place,
} from '../props';
import { corridorPerspective, counterTop, flicker } from './s02-s06';

const segment = (shotId: string, index: number) => {
  const shot = shotById(shotId);
  const seg = shot.camera.segments[index];
  if (!seg) throw new Error(`${shotId} has no segment ${index}`);
  return { start: shot.start + seg.start, end: shot.start + seg.end };
};

const priceWindow = (shotId: string, item: string) => {
  const found = shotById(shotId).prices?.find((price) => price.item === item);
  if (!found) throw new Error(`${shotId} shows no price for ${item}`);
  return found;
};

/** The merchant's counter at eye level: a dark wall behind, worn wood in front. */
function counterSide(b: Build, prefix: string, far: string, world: string, top = -40): void {
  backdrop(b, `${prefix}-wall`, far, [
    { offset: 0, color: 'void' },
    { offset: 1, color: 'stone0' },
  ]);
  masonry(
    b,
    `${prefix}-stones`,
    far,
    { y: -500, depth: -90 },
    { width: 2000, height: 1200, tone: 'stone0', joint: 'void', seed: 17 },
  );
  b.add(
    `${prefix}-surface`,
    world,
    vertical(2400, 1400, [
      { offset: 0, color: tk('wood1') },
      { offset: 0.3, color: tk('wood2') },
      { offset: 1, color: tk('wood0') },
    ]),
    { y: top + 700 },
    { depth: -50 },
  );
  b.add(`${prefix}-edge`, world, rect(2400, 8, tk('wood3')), { y: top }, { depth: -49 });
  for (let i = 0; i < 5; i++) {
    b.add(
      `${prefix}-plank-${i}`,
      world,
      rect(2400, 2 + i, tk('wood0')),
      { y: top + 70 + i * i * 40, opacity: 0.6 },
      { depth: -49 },
    );
  }
}

/* ------------------------------------------------------------------------------------------------
 * S07 TORCH AND CHALK. Two inserts joined by a match cut. The torch lies on the counter and
 * catches. Then, from above, chalk draws a line across a stone map, and the map shifts under it
 * while the line stays where it was drawn.
 * ---------------------------------------------------------------------------------------------- */
export function buildS07(): Build {
  const b = new Build();
  const a = segment('S07', 0);
  const far = b.root('S07a-far', 'far', a.start, a.end);
  const world = b.root('S07a-world', 'world', a.start, a.end);
  counterSide(b, 'S07a', far, world, -40);
  const ignite = shotById('S07').sounds.find((s) => s.cue === 'torch-ignite')?.start ?? a.start + 1;
  b.add(
    'S07a-shadow',
    world,
    ellipse(260, 26, tk('void')),
    { x: -10, y: 70, opacity: 0.6 },
    { depth: -40 },
  );
  torch(b, 'S07a-torch', world, { x: -60, y: 40, rotation: -6, scale: 1.6, depth: -30 });
  const warm = b.add(
    'S07a-warm',
    far,
    glow(1800, 1600, tk('ember'), 0.5),
    { x: 180, y: -260, opacity: 0 },
    { depth: -80 },
  );
  b.track(
    warm,
    'opacity',
    [
      { time: a.start, value: 0 },
      { time: ignite, value: 0, easing: 'easeOut' },
      { time: ignite + 0.6, value: 1 },
    ],
    { hold: 1 },
  );
  const f = b.group('S07a-flame-pivot', world, { x: 150, y: -36, scaleX: 0.01, scaleY: 0.01 }, -20);
  const fl = flame(b, 'S07a-flame', f, { depth: -20 });
  b.track(
    f,
    'scaleX',
    [
      { time: a.start, value: 0.01 },
      { time: ignite, value: 0.01, easing: 'easeOut' },
      { time: ignite + 0.35, value: 1.1, easing: 'easeInOut' },
      { time: ignite + 0.6, value: 0.95 },
    ],
    { hold: 1 },
  );
  b.track(
    f,
    'scaleY',
    [
      { time: a.start, value: 0.01 },
      { time: ignite, value: 0.01, easing: 'easeOut' },
      { time: ignite + 0.35, value: 1.25, easing: 'easeInOut' },
      { time: ignite + 0.6, value: 1 },
    ],
    { hold: 1 },
  );
  flicker(b, fl, ignite + 0.6, a.end, 1, 71);
  const spark = b.add(
    'S07a-spark',
    world,
    glow(300, 300, tk('torchCore'), 1),
    { x: 150, y: -44, opacity: 0 },
    { depth: -19 },
  );
  b.track(
    spark,
    'opacity',
    [
      { time: a.start, value: 0 },
      { time: ignite - 0.02, value: 0, easing: 'step' },
      { time: ignite, value: 1, easing: 'easeOut' },
      { time: ignite + 0.3, value: 0 },
    ],
    { hold: 1 },
  );
  priceTag(b, world, 'torch', -150, -420, priceWindow('S07', 'torch'));

  // Insert B: the stone map from above.
  const m = segment('S07', 1);
  const mw = b.root('S07b-world', 'world', m.start, m.end);
  counterTop(b, 'S07b', mw, 'wood1');
  b.add(
    'S07b-slab-shadow',
    mw,
    rect(860, 960, tk('void')),
    { x: 16, y: -240, opacity: 0.5 },
    { depth: -60 },
  );
  b.add('S07b-slab', mw, rect(840, 940, tk('stone3')), { y: -260 }, { depth: -59 });
  b.add('S07b-slab-edge', mw, rect(840, 18, tk('stone4')), { y: -720 }, { depth: -58 });
  // Engraved corridors: grooves cut into the slab.
  const grooves: [string, number, number, number, number, boolean][] = [
    ['g1', -260, -560, 60, 300, false],
    ['g2', -60, -420, 400, 60, true],
    ['g3', 150, -280, 60, 300, false],
    ['g4', -150, -120, 280, 60, true],
    ['g5', 220, 10, 300, 60, true],
    ['g6', -300, -40, 60, 260, false],
  ];
  const shiftAt = m.start + 1.55;
  for (const [gid, x, y, w, h, moves] of grooves) {
    const groove = b.add(`S07b-${gid}`, mw, rect(w, h, tk('stone1')), { x, y }, { depth: -57 });
    if (moves && gid !== 'g2') {
      b.track(
        groove,
        'x',
        [
          { time: m.start, value: x },
          { time: shiftAt, value: x, easing: 'easeInOut' },
          { time: shiftAt + 0.6, value: x + (gid === 'g4' ? 120 : -110) },
        ],
        { hold: 2 },
      );
    }
  }
  // The chalk line: three strokes that grow one after another, drawn by the moving stick.
  const route: Pt[] = [
    [-260, -680],
    [-260, -420],
    [150, -420],
    [150, -130],
  ];
  const scratch = shotById('S07').sounds.find((s) => s.cue === 'chalk-scratch');
  const drawStart = scratch?.start ?? m.start + 0.4;
  const drawEnd = scratch?.end ?? m.start + 1.7;
  const lengths = route
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - (route[i] as Pt)[0], p[1] - (route[i] as Pt)[1]));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  let travelled = 0;
  const stickX: Key[] = [{ time: m.start, value: route[0]?.[0] ?? 0 }];
  const stickY: Key[] = [{ time: m.start, value: route[0]?.[1] ?? 0 }];
  route.slice(1).forEach((p, i) => {
    const from = route[i] as Pt;
    const t0 = drawStart + ((drawEnd - drawStart) * travelled) / total;
    travelled += lengths[i] ?? 0;
    const t1 = drawStart + ((drawEnd - drawStart) * travelled) / total;
    const angle = (Math.atan2(p[1] - from[1], p[0] - from[0]) * 180) / Math.PI;
    const holder = b.group(
      `S07b-stroke-${i}`,
      mw,
      { x: from[0], y: from[1], rotation: angle, scaleX: 0.001 },
      -50,
    );
    b.add(
      `S07b-stroke-${i}-line`,
      holder,
      rect(lengths[i] ?? 1, 16, tk('warmIvory')),
      { x: (lengths[i] ?? 0) / 2 },
      { depth: -50 },
    );
    b.track(
      holder,
      'scaleX',
      [
        { time: m.start, value: 0.001 },
        { time: t0, value: 0.001 },
        { time: t1, value: 1 },
      ],
      { hold: 1 },
    );
    stickX.push({ time: t1, value: p[0] });
    stickY.push({ time: t1, value: p[1] });
  });
  const stick = chalk(b, 'S07b-chalk', mw, {
    x: route[0]?.[0] ?? 0,
    y: route[0]?.[1] ?? 0,
    rotation: -35,
    scale: 1.3,
    depth: -40,
  });
  b.track(stick, 'x', [...stickX, { time: m.end, value: 260 }], { hold: 2 });
  b.track(stick, 'y', [...stickY, { time: m.end, value: -40 }], { hold: 2 });
  priceTag(b, mw, 'chalk', 0, -840, priceWindow('S07', 'chalk'));
  return b;
}

/* ------------------------------------------------------------------------------------------------
 * S08 ROPE. The coil on the counter, then a broken stone bridge over the abyss. The rope runs from
 * the near anchor across the gap and is made fast on the far side. Harmonie waits at the near end.
 * ---------------------------------------------------------------------------------------------- */
export function buildS08(): Build {
  const b = new Build();
  const a = segment('S08', 0);
  const aw = b.root('S08a-world', 'world', a.start, a.end);
  counterTop(b, 'S08a', aw, 'wood1');
  ropeCoil(b, 'S08a-rope', aw, { y: -260, scale: 1.25, depth: 0 });
  priceTag(b, aw, 'rope', 0, -720, priceWindow('S08', 'rope'));

  const c = segment('S08', 1);
  const far = b.root('S08b-far', 'far', c.start, c.end);
  const mid = b.root('S08b-mid', 'mid', c.start, c.end);
  const world = b.root('S08b-world', 'world', c.start, c.end);
  backdrop(b, 'S08b-abyss', far, [
    { offset: 0, color: 'stone1' },
    { offset: 0.45, color: 'stone0' },
    { offset: 1, color: 'void' },
  ]);
  b.add('S08b-cold', far, glow(1400, 900, tk('tealGlow'), 0.25), { y: -300 }, { depth: -90 });
  for (const [i, x] of [-420, -150, 260, 470].entries()) {
    pillar(
      b,
      `S08b-far-pillar-${i}`,
      far,
      { x, y: 900, scale: 0.7, depth: -80 },
      { height: 2200, width: 120, tone: 'stone1', carving: false },
    );
  }
  chain(b, 'S08b-chain-1', mid, { x: -300, y: -980, depth: -60 }, 16);
  chain(b, 'S08b-chain-2', mid, { x: 230, y: -980, depth: -60 }, 22);
  fog(b, 'S08b-fog-deep', mid, { y: 500, depth: -50 }, { width: 1800, height: 700, opacity: 0.35 });

  // The two broken halves of the bridge, with ragged ends.
  const deckTop = -60;
  const left: Pt[] = [
    [-1200, deckTop],
    [-120, deckTop],
    [-96, deckTop + 22],
    [-120, deckTop + 40],
    [-90, deckTop + 64],
    [-140, deckTop + 90],
    [-1200, deckTop + 90],
  ];
  const right: Pt[] = [
    [1200, deckTop],
    [110, deckTop],
    [86, deckTop + 26],
    [118, deckTop + 46],
    [92, deckTop + 72],
    [150, deckTop + 90],
    [1200, deckTop + 90],
  ];
  b.add('S08b-deck-l', world, path(poly(left), tk('stone3')), {}, { depth: -10 });
  b.add('S08b-deck-r', world, path(poly(right), tk('stone3')), {}, { depth: -10 });
  b.add(
    'S08b-arch-l',
    world,
    path(
      poly([
        [-700, deckTop + 90],
        [-300, deckTop + 90],
        [-330, deckTop + 220],
        [-420, deckTop + 300],
        [-560, deckTop + 300],
        [-660, deckTop + 220],
      ]),
      tk('stone2'),
    ),
    {},
    { depth: -11 },
  );
  b.add(
    'S08b-arch-r',
    world,
    path(
      poly([
        [300, deckTop + 90],
        [700, deckTop + 90],
        [660, deckTop + 220],
        [560, deckTop + 300],
        [420, deckTop + 300],
        [330, deckTop + 220],
      ]),
      tk('stone2'),
    ),
    {},
    { depth: -11 },
  );
  for (const [side, x] of [
    ['l', -170],
    ['r', 170],
  ] as const) {
    b.add(
      `S08b-anchor-${side}`,
      world,
      path(
        poly([
          [x - 22, deckTop],
          [x + 22, deckTop],
          [x + 16, deckTop - 70],
          [x - 16, deckTop - 70],
        ]),
        tk('stone4'),
      ),
      {},
      { depth: -8 },
    );
    b.add(
      `S08b-anchor-${side}-cap`,
      world,
      ellipse(24, 10, tk('stone4')),
      { x, y: deckTop - 70 },
      { depth: -7.9 },
    );
  }
  // The rope, paid out from the near anchor towards the far one, sagging over the gap.
  const tension = shotById('S08').sounds.find((s) => s.cue === 'rope-tension');
  const reel = b.group('S08b-rope', world, { x: 170, y: deckTop - 60, scaleX: 0.001 }, -7);
  const sag: Pt[] = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    return [-340 * t, 34 * Math.sin(Math.PI * t)];
  });
  b.add('S08b-rope-line', reel, path(strokeLine(sag, 9), tk('rope')), {}, { depth: -7 });
  const ropeStart = tension?.start ?? c.start + 0.8;
  b.track(
    reel,
    'scaleX',
    [
      { time: c.start, value: 0.001 },
      { time: ropeStart - 0.5, value: 0.001, easing: 'easeOut' },
      { time: ropeStart + 0.5, value: 1 },
    ],
    { hold: 2 },
  );
  b.track(
    reel,
    'scaleY',
    [
      { time: c.start, value: 1.6 },
      { time: ropeStart + 0.5, value: 1.6, easing: 'easeOut' },
      { time: (tension?.end ?? ropeStart + 1.5) - 0.2, value: 0.7 },
    ],
    { hold: 2 },
  );
  // Stones crumbling from the broken ends into the dark.
  const random = seeded(61);
  for (const [i, cue] of shotById('S08')
    .sounds.filter((s) => s.cue === 'pebbles')
    .entries()) {
    for (let k = 0; k < 4; k++) {
      const x = (i % 2 ? 100 : -110) + (random() - 0.5) * 40;
      const stone = b.add(
        `S08b-pebble-${i}-${k}`,
        world,
        path(
          poly([
            [-8, -6],
            [7, -8],
            [9, 5],
            [-6, 8],
          ]),
          tk('stone4'),
        ),
        { x, y: deckTop + 80, opacity: 0 },
        { depth: -9 },
      );
      const t0 = cue.start + k * 0.06;
      b.track(
        stone,
        'opacity',
        [
          { time: c.start, value: 0 },
          { time: t0, value: 0, easing: 'step' },
          { time: t0 + 0.01, value: 1 },
          { time: t0 + 1.1, value: 0 },
        ],
        { hold: 1 },
      );
      b.track(
        stone,
        'y',
        [
          { time: c.start, value: deckTop + 80 },
          { time: t0, value: deckTop + 80, easing: 'easeIn' },
          { time: t0 + 1.1, value: deckTop + 760 },
        ],
        { hold: 2 },
      );
      b.track(
        stone,
        'rotation',
        [
          { time: c.start, value: 0 },
          { time: t0, value: 0 },
          { time: t0 + 1.1, value: 200 + random() * 200 },
        ],
        { hold: 2 },
      );
    }
  }
  castHarmonie(b, {
    id: 'S08b-harmonie',
    parent: world,
    view: 'side',
    x: 400,
    groundY: deckTop,
    scale: 0.34,
    depth: 0,
  });
  animateHarmonie(
    b,
    'S08b-harmonie',
    'side',
    [{ time: c.start, spec: { ...NEUTRAL_SPEC, head: -10 } }],
    [],
  );
  fog(b, 'S08b-fog-near', world, { y: 300, depth: 5 }, { width: 1600, height: 500, opacity: 0.25 });
  return b;
}

/* ------------------------------------------------------------------------------------------------
 * S09 EARPLUGS. Two lumps of wax. Whispers wander in as wavering lines; a warning bell pulses in
 * rings. When the wax is chosen, the whispers fall flat, and so, a moment later, does the bell.
 * ---------------------------------------------------------------------------------------------- */
function wave(points: number, width: number, amplitude: number, phase: number): Pt[] {
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const envelope = Math.sin(Math.PI * t);
    return [(t - 0.5) * width, Math.sin(t * Math.PI * 7 + phase) * amplitude * envelope];
  });
}

export function buildS09(): Build {
  const shot = shotById('S09');
  const { start, end } = shot;
  const b = new Build();
  const far = b.root('S09-far', 'far', start, end);
  const world = b.root('S09-world', 'world', start, end);
  counterSide(b, 'S09', far, world, 20);
  const chosen = shot.sounds.find((s) => s.cue === 'muffle')?.start ?? start + 2;
  const muffledBell = shot.sounds.find((s) => s.cue === 'muffled-bell')?.start ?? start + 3.2;
  const plugs = earplugs(b, 'S09-wax', world, { y: 70, scale: 2.2, depth: 0 });
  b.track(
    plugs,
    'y',
    [
      { time: start, value: 70 },
      { time: chosen - 0.2, value: 70, easing: 'easeOut' },
      { time: chosen + 0.1, value: 52, easing: 'easeInOut' },
      { time: chosen + 0.5, value: 62 },
    ],
    { group: 'character' },
  );
  const halo = b.add(
    'S09-chosen',
    world,
    path(ring(220, 90, 4, 64), tk('warmIvory')),
    { y: 110, opacity: 0 },
    { depth: -1 },
  );
  b.track(
    halo,
    'opacity',
    [
      { time: start, value: 0 },
      { time: chosen - 0.05, value: 0, easing: 'easeOut' },
      { time: chosen + 0.2, value: 0.7 },
      { time: end, value: 0.45 },
    ],
    { hold: 1 },
  );

  // Whispers: three wavering lines drifting in from the left.
  for (let i = 0; i < 3; i++) {
    const g = b.group(
      `S09-whisper-${i}`,
      world,
      { x: -60 + i * 40, y: -560 + i * 95, opacity: 0 },
      10,
    );
    b.add(
      `S09-whisper-${i}-a`,
      g,
      path(strokeLine(wave(60, 820, 34 - i * 6, i), 5), tk('mist')),
      {},
      { depth: 10 },
    );
    b.add(
      `S09-whisper-${i}-b`,
      g,
      path(strokeLine(wave(60, 760, 22 - i * 4, i + 2), 3), tk('mist')),
      { y: 14, opacity: 0.6 },
      { depth: 10 },
    );
    b.track(
      g,
      'opacity',
      [
        { time: start, value: 0 },
        { time: start + 0.4 + i * 0.2, value: 0.75 },
        { time: chosen, value: 0.75, easing: 'easeIn' },
        { time: chosen + 0.6, value: 0 },
      ],
      { hold: 1 },
    );
    b.track(
      g,
      'scaleY',
      [
        { time: start, value: 1 },
        { time: chosen, value: 1, easing: 'easeIn' },
        { time: chosen + 0.5, value: 0.02 },
      ],
      { hold: 1 },
    );
    b.track(
      g,
      'x',
      [
        { time: start, value: -160 + i * 40 },
        { time: chosen + 0.6, value: 40 + i * 40 },
      ],
      { hold: 1 },
    );
  }
  // The warning bell: rings pulsing from the upper right, the last one muffled, then gone.
  const pulses = [start + 0.6, start + 1.5, muffledBell];
  pulses.forEach((t0, i) => {
    const muffled = t0 >= chosen;
    const r = b.add(
      `S09-bell-${i}`,
      world,
      path(ring(120, 120, muffled ? 3 : 7, 64), tk('parchment')),
      { x: 250, y: -720, opacity: 0, scaleX: 0.3, scaleY: 0.3 },
      { depth: 9 },
    );
    b.track(
      r,
      'opacity',
      [
        { time: start, value: 0 },
        { time: t0, value: 0, easing: 'step' },
        { time: t0 + 0.01, value: muffled ? 0.25 : 0.7 },
        { time: t0 + 1.1, value: 0 },
      ],
      { hold: 1 },
    );
    b.track(
      r,
      'scaleX',
      [
        { time: start, value: 0.3 },
        { time: t0, value: 0.3 },
        { time: t0 + 1.1, value: muffled ? 1.2 : 2.2 },
      ],
      { hold: 1 },
    );
    b.track(
      r,
      'scaleY',
      [
        { time: start, value: 0.3 },
        { time: t0, value: 0.3 },
        { time: t0 + 1.1, value: muffled ? 1.2 : 2.2 },
      ],
      { hold: 1 },
    );
  });
  const bellMark = b.add(
    'S09-bell-mark',
    world,
    path(
      poly([
        [-14, -34],
        [14, -34],
        [26, 6],
        [40, 20],
        [-40, 20],
        [-26, 6],
      ]),
      tk('parchment'),
    ),
    { x: 250, y: -720, opacity: 0 },
    { depth: 9 },
  );
  b.track(
    bellMark,
    'opacity',
    [
      { time: start, value: 0 },
      { time: start + 0.5, value: 0.8 },
      { time: muffledBell, value: 0.8, easing: 'easeIn' },
      { time: muffledBell + 0.8, value: 0 },
    ],
    { hold: 1 },
  );
  priceTag(b, world, 'earplugs', 0, -250, priceWindow('S09', 'earplugs'));
  return b;
}

/* ------------------------------------------------------------------------------------------------
 * S10 BANDAGES AND DECOY BELL. Recovery on the left, distraction on the right. Linen wraps a
 * forearm; the bronze bell rings and the shadows in the dark lean towards it.
 * ---------------------------------------------------------------------------------------------- */
export function buildS10(): Build {
  const shot = shotById('S10');
  const { start, end } = shot;
  const b = new Build();
  const far = b.root('S10-far', 'far', start, end);
  const world = b.root('S10-world', 'world', start, end);
  backdrop(b, 'S10-back', far, [
    { offset: 0, color: 'stone0' },
    { offset: 1, color: 'void' },
  ]);
  b.add(
    'S10-left-warm',
    far,
    glow(900, 1400, tk('ember'), 0.18),
    { x: -300, y: -250 },
    { depth: -90 },
  );
  b.add(
    'S10-right-cold',
    far,
    glow(900, 1400, tk('tealGlow'), 0.25),
    { x: 300, y: -250 },
    { depth: -90 },
  );
  b.add('S10-divider', world, rect(4, 1000, tk('stone3')), { y: -260 }, { depth: -40 });

  // Left: the forearm and the bandage winding round it.
  const wrap = shot.sounds.find((s) => s.cue === 'cloth');
  const w0 = wrap?.start ?? start + 0.8;
  const w1 = wrap?.end ?? start + 2.3;
  b.add(
    'S10-arm',
    world,
    path(
      strokeLine(
        [
          [-520, -150],
          [-90, -200],
        ],
        110,
      ),
      tk('deepShadow'),
    ),
    {},
    { depth: -20 },
  );
  b.add('S10-hand', world, ellipse(70, 60, tk('deepShadow')), { x: -70, y: -204 }, { depth: -20 });
  for (let i = 0; i < 6; i++) {
    const x = -440 + i * 56;
    const band = b.add(
      `S10-wrap-${i}`,
      world,
      path(
        poly([
          [-18, -64],
          [18, -64],
          [32, 64],
          [-4, 64],
        ]),
        tk('linen'),
      ),
      { x, y: -158 - i * 5.5, opacity: 0, scaleY: 0.2 },
      { depth: -19 },
    );
    const t0 = w0 + ((w1 - w0) * i) / 6;
    b.track(
      band,
      'opacity',
      [
        { time: start, value: 0 },
        { time: t0, value: 0, easing: 'step' },
        { time: t0 + 0.01, value: 1 },
      ],
      { hold: 1 },
    );
    b.track(
      band,
      'scaleY',
      [
        { time: start, value: 0.2 },
        { time: t0, value: 0.2, easing: 'easeOut' },
        { time: t0 + 0.25, value: 1 },
      ],
      { hold: 2 },
    );
  }
  bandageRoll(b, 'S10-roll', world, { x: -280, y: -500, scale: 0.85, depth: -10 });
  const bw = priceWindow('S10', 'bandages');
  priceTag(b, world, 'bandages', -270, -740, bw, 0.86);

  // Right: the decoy bell, its rings, and the watchers it draws.
  const rings = shot.sounds.filter((s) => s.cue === 'decoy-bell').map((s) => s.start);
  const bell = decoyBell(b, 'S10-bell', world, { x: 270, y: -210, scale: 1, depth: -10 });
  b.track(
    bell,
    'rotation',
    [
      { time: start, value: 0 },
      ...rings.flatMap((t) => [
        { time: t - 0.08, value: 0, easing: 'easeOut' as const },
        { time: t, value: -9, easing: 'easeInOut' as const },
        { time: t + 0.18, value: 7, easing: 'easeInOut' as const },
        { time: t + 0.4, value: 0 },
      ]),
    ],
    { hold: 2 },
  );
  rings.forEach((t0, i) => {
    for (let k = 0; k < 2; k++) {
      const r = b.add(
        `S10-ring-${i}-${k}`,
        world,
        path(ring(90, 90, 5, 64), tk('bronze')),
        { x: 270, y: -230, opacity: 0, scaleX: 0.6, scaleY: 0.6 },
        { depth: -11 },
      );
      const t = t0 + k * 0.25;
      b.track(
        r,
        'opacity',
        [
          { time: start, value: 0 },
          { time: t, value: 0, easing: 'step' },
          { time: t + 0.01, value: 0.75 },
          { time: Math.min(end, t + 1.3), value: 0 },
        ],
        { hold: 1 },
      );
      b.track(
        r,
        'scaleX',
        [
          { time: start, value: 0.6 },
          { time: t, value: 0.6 },
          { time: Math.min(end, t + 1.3), value: 3.2 },
        ],
        { hold: 1 },
      );
      b.track(
        r,
        'scaleY',
        [
          { time: start, value: 0.6 },
          { time: t, value: 0.6 },
          { time: Math.min(end, t + 1.3), value: 3.2 },
        ],
        { hold: 1 },
      );
    }
  });
  const first = rings[0] ?? start + 2.9;
  for (const [i, x] of [150, 420].entries()) {
    const w = watcher(b, `S10-watcher-${i}`, world, { x, y: 200, scale: 0.34, depth: -30 });
    const towards = i === 0 ? 1 : -1;
    b.track(
      w.root,
      'rotation',
      [
        { time: start, value: 0 },
        { time: first + 0.3, value: 0, easing: 'easeInOut' },
        { time: end, value: 7 * towards },
      ],
      { hold: 3 },
    );
    b.track(
      w.root,
      'x',
      [
        { time: start, value: x },
        { time: first + 0.3, value: x, easing: 'easeInOut' },
        { time: end, value: x + 40 * towards },
      ],
      { hold: 3 },
    );
  }
  fog(
    b,
    'S10-fog',
    world,
    { x: 290, y: 120, depth: -25 },
    { width: 700, height: 400, opacity: 0.4 },
  );
  priceTag(b, world, 'decoy-bell', 270, -740, priceWindow('S10', 'decoy-bell'), 0.86);
  return b;
}

/* ------------------------------------------------------------------------------------------------
 * S11 THE LAST POSSIBILITY. Rations and a flask on a stone ledge. Past them, the corridor's far
 * end changes direction as the bell sounds, again and again. Harmonie stands small in it.
 * ---------------------------------------------------------------------------------------------- */
export function buildS11(): Build {
  const shot = shotById('S11');
  const { start, end } = shot;
  const b = new Build();
  const far = b.root('S11-far', 'far', start, end);
  const mid = b.root('S11-mid', 'mid', start, end);
  const world = b.root('S11-world', 'world', start, end);
  backdrop(b, 'S11-back', far, [
    { offset: 0, color: 'void' },
    { offset: 1, color: 'stone0' },
  ]);
  const vanish = { x: 30, y: -430 };
  b.add('S11-depth', far, glow(700, 600, tk('tealGlow'), 0.3), vanish, { depth: -90 });
  corridorPerspective(b, 'S11', mid, vanish, 6, -60);
  // The far end: a wall whose opening slides to a new place each time the paths shift.
  const end1 = b.group('S11-endwall', mid, { x: vanish.x, y: vanish.y + 150 }, -70);
  b.add('S11-endwall-stone', end1, rect(700, 420, tk('stone2')), { y: -200 }, { depth: -70 });
  archway(
    b,
    'S11-endwall-opening',
    end1,
    { x: -90, y: 0, scale: 0.16, depth: -69.9 },
    { width: 760, height: 1500, stone: 'stone3', inner: 'void' },
  );
  const shifts = shot.sounds.filter((s) => s.cue === 'stone-move');
  const xs = [vanish.x, vanish.x + 180, vanish.x - 40];
  const keys: Key[] = [{ time: start, value: xs[0] ?? 0 }];
  shifts.forEach((s, i) => {
    keys.push({ time: s.start, value: xs[i] ?? 0, easing: 'easeInOut' });
    keys.push({ time: s.end ?? s.start + 0.7, value: xs[i + 1] ?? 0 });
  });
  b.track(end1, 'x', keys, { hold: 2 });
  for (const [i, s] of shifts.entries()) {
    const dust = b.add(
      `S11-dust-${i}`,
      mid,
      glow(500, 300, tk('mist'), 0.6),
      { x: vanish.x, y: vanish.y + 100, opacity: 0 },
      { depth: -55 },
    );
    b.track(
      dust,
      'opacity',
      [
        { time: start, value: 0 },
        { time: s.start, value: 0, easing: 'easeOut' },
        { time: s.start + 0.3, value: 0.8, easing: 'easeIn' },
        { time: (s.end ?? s.start + 0.7) + 0.6, value: 0 },
      ],
      { hold: 2 },
    );
  }
  castHarmonie(b, {
    id: 'S11-harmonie',
    parent: mid,
    view: 'side',
    x: vanish.x + 40,
    groundY: vanish.y + 150,
    scale: 0.15,
    depth: -58,
  });
  animateHarmonie(
    b,
    'S11-harmonie',
    'side',
    [{ time: start, spec: { ...NEUTRAL_SPEC, head: -6 } }],
    [],
  );
  fog(
    b,
    'S11-fog',
    mid,
    { x: vanish.x, y: vanish.y + 140, depth: -57 },
    { width: 800, height: 260, opacity: 0.35 },
  );

  // The ledge and the supplies, close to us.
  b.add(
    'S11-ledge',
    world,
    vertical(2400, 900, [
      { offset: 0, color: tk('stone3') },
      { offset: 0.08, color: tk('stone2') },
      { offset: 1, color: tk('stone0') },
    ]),
    { y: 590 },
    { depth: 0 },
  );
  b.add('S11-ledge-lip', world, rect(2400, 10, tk('stone4')), { y: 145 }, { depth: 0.1 });
  b.add(
    'S11-ledge-light',
    world,
    glow(900, 360, tk('amberGold'), 0.12),
    { y: 130 },
    { depth: 0.2 },
  );
  rations(b, 'S11-rations', world, { x: 10, y: 40, scale: 1.25, depth: 1 });
  priceTag(b, world, 'rations', -200, -150, priceWindow('S11', 'rations'), 0.84);
  return b;
}

/* ------------------------------------------------------------------------------------------------
 * S12 THE CHOICE. All seven items on the counter, each with its price, and the budget. Harmonie's
 * hand comes in, moves a little closer, and stops short of every one of them.
 * ---------------------------------------------------------------------------------------------- */
const CARD = { width: 450, height: 200, gap: 20 } as const;

type IconFn = (b: Build, id: string, parent: string, place: Place) => string;
const ICONS: Record<string, { draw: IconFn; scale: number; rotation?: number }> = {
  torch: { draw: torch, scale: 0.38, rotation: -20 },
  chalk: { draw: chalk, scale: 0.9, rotation: -25 },
  rope: { draw: ropeCoil, scale: 0.4 },
  earplugs: { draw: earplugs, scale: 0.85 },
  bandages: { draw: bandageRoll, scale: 0.6 },
  'decoy-bell': { draw: decoyBell, scale: 0.5 },
  rations: { draw: rations, scale: 0.42 },
};

export function cardPositions(): { x: number; y: number }[] {
  return Array.from({ length: 8 }, (_, i) => ({
    x: (i % 2 === 0 ? -1 : 1) * (CARD.width / 2 + CARD.gap / 2),
    y: -600 + Math.floor(i / 2) * (CARD.height + CARD.gap + 5),
  }));
}

export function buildS12(): Build {
  const shot = shotById('S12');
  const { start, end } = shot;
  const b = new Build();
  const world = b.root('S12-world', 'world', start, end);
  counterTop(b, 'S12', world, 'wood1');
  const positions = cardPositions();
  const appear = shot.prices?.[0]?.start ?? start + 0.2;
  EPISODE.items.forEach((item, i) => {
    const at = positions[i] ?? { x: 0, y: 0 };
    const card = b.group(`S12-card-${item.id}`, world, { ...at, opacity: 0 }, 10);
    b.add(
      `S12-card-${item.id}-paper`,
      card,
      path(roundedRect(CARD.width, CARD.height, 16), tk('parchment')),
      {},
      { depth: 10 },
    );
    const icon = ICONS[item.id];
    if (icon)
      icon.draw(b, `S12-icon-${item.id}`, card, {
        x: -CARD.width / 2 + 95,
        scale: icon.scale,
        rotation: icon.rotation ?? 0,
        depth: 10.5,
      });
    const left = -CARD.width / 2 + 190;
    b.add(
      `S12-card-${item.id}-th`,
      card,
      text(item.th, 36, tk('deepShadow'), { weight: 600, align: 'left' }),
      { x: left, y: -52 },
      { depth: 11 },
    );
    b.add(
      `S12-card-${item.id}-en`,
      card,
      text(item.en, 30, tk('wood1'), { weight: 500, align: 'left' }),
      { x: left, y: -10 },
      { depth: 11 },
    );
    b.add(
      `S12-card-${item.id}-price`,
      card,
      text(`${item.price} SP`, 50, tk('deepShadow'), { weight: 700, align: 'left' }),
      { x: left, y: 50 },
      { depth: 11 },
    );
    b.track(card, 'opacity', fadeKeys(appear + i * 0.12, end, 0.3), { hold: 1 });
  });
  // The eighth place shows the budget: ten silver pieces.
  const budgetAt = positions[7] ?? { x: 0, y: 0 };
  const budget = b.group('S12-card-budget', world, { ...budgetAt, opacity: 0 }, 10);
  b.add(
    'S12-card-budget-paper',
    budget,
    path(roundedRect(CARD.width, CARD.height, 16), tk('stone1')),
    {},
    { depth: 10 },
  );
  for (let k = 0; k < 10; k++) {
    silverCoin(b, `S12-budget-coin-${k}`, budget, {
      x: -CARD.width / 2 + 60 + (k % 5) * 40,
      y: -28 + Math.floor(k / 5) * 52,
      scale: 0.42,
      depth: 10.5 + k * 0.001,
    });
  }
  b.add(
    'S12-card-budget-label',
    budget,
    text(`${EPISODE.economy.budgetSilver} SP`, 50, tk('warmIvory'), { weight: 700, align: 'left' }),
    { x: 40, y: 0 },
    { depth: 11 },
  );
  b.track(budget, 'opacity', fadeKeys(appear + 0.9, end, 0.3), { hold: 1 });

  // Harmonie's hand, from the lower left: it reaches, edges closer, and stops.
  const reach = shot.sounds.find((s) => s.cue === 'leather');
  const r0 = reach?.start ?? start + 1.4;
  const hand = b.group('S12-hand', world, { x: -560, y: 980, rotation: 28 }, 30);
  b.nodes.push(...gloveNodes({ prefix: 'S12-glove', parent: hand, depth: 30, scale: 1.05 }));
  b.track(
    hand,
    'x',
    [
      { time: start, value: -620 },
      { time: r0, value: -620, easing: 'easeOut' },
      { time: r0 + 1.6, value: -370, easing: 'easeInOut' },
      { time: r0 + 2.2, value: -352, easing: 'easeInOut' },
      { time: r0 + 2.6, value: -360 },
    ],
    { group: 'character' },
  );
  b.track(
    hand,
    'y',
    [
      { time: start, value: 1120 },
      { time: r0, value: 1120, easing: 'easeOut' },
      { time: r0 + 1.6, value: 550, easing: 'easeInOut' },
      { time: r0 + 2.2, value: 528, easing: 'easeInOut' },
      { time: r0 + 2.6, value: 540 },
    ],
    { group: 'character' },
  );
  b.poses['S12-relaxed'] = glovePose('S12-glove', 0.85, 1);
  b.poses['S12-unsure'] = glovePose('S12-glove', 0.6, 0);
  b.poseTracks.push({
    group: 'character',
    keyframes: [
      { time: start, pose: 'S12-relaxed' },
      { time: r0 + 2.2, pose: 'S12-relaxed', easing: 'easeInOut' },
      { time: r0 + 2.7, pose: 'S12-unsure' },
    ],
  });
  // The last toll: the light in the room dims a little, nothing else moves.
  const toll = shot.sounds.find((s) => s.cue === 'bell-toll')?.start ?? end - 1.6;
  const dim = b.add('S12-dim', world, rect(2400, 3000, tk('void')), { opacity: 0 }, { depth: 50 });
  b.track(
    dim,
    'opacity',
    [
      { time: start, value: 0 },
      { time: toll, value: 0, easing: 'easeInOut' },
      { time: end, value: 0.28 },
    ],
    { hold: 1 },
  );
  return b;
}
