import { gloveNodes, glovePose } from '../../../characters/harmonie/harmonie-hand';
import { shotById } from '../episode';
import {
  Build,
  ellipse,
  glow,
  path,
  poly,
  rect,
  ring,
  seeded,
  tk,
  vertical,
  type Pt,
} from '../kit';

/**
 * S01 THE LAST COIN. Extreme close-up over the merchant's counter in near darkness. A thin amber
 * beam falls from the upper left. Harmonie's gloved hand opens, the coin tilts into the light,
 * slips off her palm and lands flat on the wood.
 */

const COUNTER_TOP = 140;

/** The worn gold coin, face on. Sized so it reads at a third of the frame width. */
export function goldCoin(
  build: Build,
  idPrefix: string,
  parent: string,
  radius: number,
  depth: number,
) {
  const coin = build.group(idPrefix, parent, {}, depth);
  build.add(`${idPrefix}-rim`, coin, ellipse(radius, radius, tk('bronze')), {}, { depth });
  build.add(
    `${idPrefix}-face`,
    coin,
    ellipse(radius * 0.86, radius * 0.86, tk('amberGold')),
    {},
    { depth: depth + 0.01 },
  );
  build.add(
    `${idPrefix}-ring`,
    coin,
    path(ring(radius * 0.7, radius * 0.7, radius * 0.06), tk('bronze')),
    {},
    { depth: depth + 0.02 },
  );
  // A small bell stamped in the middle: the crypt's emblem, worn smooth.
  const r = radius * 0.34;
  const bell: Pt[] = [
    [-r * 0.15, -r * 0.95],
    [r * 0.15, -r * 0.95],
    [r * 0.5, -r * 0.55],
    [r * 0.62, r * 0.45],
    [r * 0.9, r * 0.7],
    [-r * 0.9, r * 0.7],
    [-r * 0.62, r * 0.45],
    [-r * 0.5, -r * 0.55],
  ];
  build.add(`${idPrefix}-bell`, coin, path(poly(bell), tk('bronze')), {}, { depth: depth + 0.03 });
  build.add(
    `${idPrefix}-shine`,
    coin,
    path(
      poly([
        [-radius * 0.6, -radius * 0.2],
        [-radius * 0.2, -radius * 0.62],
        [-radius * 0.08, -radius * 0.5],
        [-radius * 0.5, -radius * 0.08],
      ]),
      tk('torchCore'),
    ),
    { opacity: 0.55 },
    { depth: depth + 0.04 },
  );
  return coin;
}

export function buildS01(): Build {
  const shot = shotById('S01');
  const { start, end } = shot;
  const b = new Build();
  const far = b.root('S01-far', 'far', start, end);
  const world = b.root('S01-world', 'world', start, end);

  // Darkness, with the faintest warmth where the beam lands.
  b.add('S01-dark', far, rect(2400, 3400, tk('void')));
  b.add('S01-warmth', far, glow(1600, 1500, tk('ember'), 0.16), { x: 60, y: 120 });

  // The counter: a band of worn wood running away from us, lit from the left.
  b.add(
    'S01-counter',
    world,
    vertical(2000, 1400, [
      { offset: 0, color: tk('wood0') },
      { offset: 0.25, color: tk('wood1') },
      { offset: 1, color: tk('wood0') },
    ]),
    { y: COUNTER_TOP + 700 },
    { depth: 1 },
  );
  b.add('S01-counter-edge', world, rect(2000, 10, tk('wood3')), { y: COUNTER_TOP }, { depth: 2 });
  for (let i = 0; i < 6; i++) {
    const y = COUNTER_TOP + 90 + i * i * 34;
    b.add(
      `S01-plank-${i}`,
      world,
      rect(2000, 3 + i, tk('void')),
      { y, opacity: 0.55 },
      { depth: 2 },
    );
  }
  b.add(
    'S01-pool',
    world,
    glow(900, 360, tk('amberGold'), 0.22),
    { x: -10, y: COUNTER_TOP + 230 },
    { depth: 3 },
  );

  // The beam: a soft amber shaft from the upper left, behind the hand so the glove reads as a
  // clean silhouette against it. Two widths make it feel like a cone of light, not a bar.
  const beam = b.group('S01-beam', world, { x: -300, y: -560, rotation: -24 }, 5);
  b.add(
    'S01-beam-wide',
    beam,
    vertical(420, 2000, [
      { offset: 0, color: tk('amberGold'), opacity: 0 },
      { offset: 0.4, color: tk('amberGold'), opacity: 0.07 },
      { offset: 0.8, color: tk('amberGold'), opacity: 0.05 },
      { offset: 1, color: tk('amberGold'), opacity: 0 },
    ]),
    { y: 700 },
    { depth: 5 },
  );
  b.add(
    'S01-beam-core',
    beam,
    vertical(170, 2000, [
      { offset: 0, color: tk('torchCore'), opacity: 0 },
      { offset: 0.4, color: tk('amberGold'), opacity: 0.16 },
      { offset: 0.8, color: tk('amberGold'), opacity: 0.1 },
      { offset: 1, color: tk('amberGold'), opacity: 0 },
    ]),
    { y: 700 },
    { depth: 5.1 },
  );
  b.add(
    'S01-hotspot',
    world,
    glow(700, 420, tk('amberGold'), 0.3),
    { x: 40, y: -40 },
    { depth: 4 },
  );
  b.track(
    beam,
    'opacity',
    [
      { time: 0, value: 0.55, easing: 'easeInOut' },
      { time: 1.6, value: 1, easing: 'easeInOut' },
      { time: 4, value: 0.85 },
    ],
    { hold: 1 },
  );
  // Dust hanging in the light, drifting slowly. Positions come from a fixed seed.
  const random = seeded(11);
  for (let i = 0; i < 14; i++) {
    const along = -700 + random() * 1300;
    const across = (random() - 0.5) * 220;
    const mote = b.add(
      `S01-mote-${i}`,
      beam,
      ellipse(2 + random() * 2.5, 2 + random() * 2.5, tk('torchCore')),
      { x: across, y: along + 700, opacity: 0.25 + random() * 0.4 },
      { depth: 6 },
    );
    const drift = 20 + random() * 40;
    b.track(
      mote,
      'y',
      [
        { time: 0, value: along + 700 },
        { time: 4, value: along + 700 + drift },
      ],
      { hold: 2 },
    );
  }

  // The hand enters from the lower right, palm up, holding the coin.
  const hand = b.group(
    'S01-hand',
    world,
    { x: 70, y: 90, rotation: -24, scaleX: 1.25, scaleY: 1.25 },
    20,
  );
  b.nodes.push(
    ...gloveNodes({ prefix: 'S01-glove', parent: hand, palmLight: tk('wood3'), depth: 20 }),
  );
  b.track(
    hand,
    'y',
    [
      { time: 0, value: 130, easing: 'easeOut' },
      { time: 1.2, value: 90, easing: 'easeInOut' },
      { time: 4, value: 82 },
    ],
    { group: 'character' },
  );

  // Openness: curled, opening slowly, then the slight tilt that lets the coin go.
  const open = (o: number, spread = 0) => glovePose('S01-glove', o, spread);
  b.poses['S01-closed'] = open(0.15);
  b.poses['S01-half'] = open(0.6, 1);
  b.poses['S01-open'] = open(1, 2.5);
  b.poseTracks.push({
    group: 'character',
    keyframes: [
      { time: 0, pose: 'S01-closed', easing: 'easeInOut' },
      { time: 0.35, pose: 'S01-closed', easing: 'easeInOut' },
      { time: 1.1, pose: 'S01-half', easing: 'easeOut' },
      { time: 1.7, pose: 'S01-open' },
    ],
  });
  // The wrist tips when the coin slides: anticipation of the drop.
  const wrist = 'S01-glove-wrist';
  b.track(
    wrist,
    'rotation',
    [
      { time: 0, value: 0 },
      { time: 2.05, value: 0, easing: 'easeIn' },
      { time: 2.35, value: -12, easing: 'easeOut' },
      { time: 3.2, value: -8 },
    ],
    { group: 'character' },
  );

  // The coin: on the palm, tilting into the light, then falling to the counter.
  const coin = b.group('S01-coin', world, { x: 14, y: -40 }, 30);
  goldCoin(b, 'S01-coin-art', coin, 66, 30);
  b.add(
    'S01-glint',
    coin,
    glow(220, 220, tk('torchCore'), 0.9),
    { x: -24, y: -28, opacity: 0 },
    { depth: 31 },
  );
  b.track(
    'S01-glint',
    'opacity',
    [
      { time: 0, value: 0 },
      { time: 1.5, value: 0, easing: 'easeOut' },
      { time: 1.75, value: 1, easing: 'easeIn' },
      { time: 2.2, value: 0 },
    ],
    { hold: 1 },
  );
  b.track(
    coin,
    'scaleX',
    [
      { time: 0, value: 0.9, easing: 'easeInOut' },
      { time: 1.0, value: 0.72, easing: 'easeInOut' },
      { time: 1.75, value: 1, easing: 'easeInOut' },
      { time: 2.2, value: 0.95, easing: 'easeIn' },
      { time: 2.75, value: 1.05, easing: 'easeOut' },
      { time: 3.0, value: 1 },
    ],
    { group: 'character' },
  );
  b.track(
    coin,
    'scaleY',
    [
      { time: 0, value: 0.62 },
      { time: 2.2, value: 0.62, easing: 'easeIn' },
      // Lying flat on the counter, seen at a low angle.
      { time: 2.75, value: 0.3, easing: 'easeOut' },
      { time: 2.85, value: 0.36, easing: 'easeIn' },
      { time: 3.0, value: 0.32 },
    ],
    { group: 'character' },
  );
  b.track(
    coin,
    'x',
    [
      { time: 0, value: 40 },
      { time: 2.2, value: 46, easing: 'easeIn' },
      { time: 2.75, value: -190 },
    ],
    { group: 'character' },
  );
  b.track(
    coin,
    'y',
    [
      { time: 0, value: -96, easing: 'easeOut' },
      { time: 1.2, value: -136 },
      { time: 2.2, value: -138, easing: 'easeIn' },
      { time: 2.75, value: 232, easing: 'easeOut' },
      { time: 2.86, value: 216, easing: 'easeIn' },
      { time: 3.0, value: 232 },
    ],
    { group: 'character' },
  );
  b.track(
    coin,
    'rotation',
    [
      { time: 0, value: -8 },
      { time: 2.2, value: -4, easing: 'easeIn' },
      { time: 2.75, value: -14, easing: 'easeOut' },
      { time: 3.0, value: -8 },
    ],
    { group: 'character' },
  );
  // The coin's shadow on the counter appears as it lands.
  b.add(
    'S01-coin-shadow',
    world,
    ellipse(80, 16, tk('void')),
    { x: -180, y: 252, opacity: 0 },
    { depth: 4 },
  );
  b.track(
    'S01-coin-shadow',
    'opacity',
    [
      { time: 0, value: 0 },
      { time: 2.45, value: 0, easing: 'easeIn' },
      { time: 2.75, value: 0.7 },
    ],
    { group: 'character' },
  );
  return b;
}
