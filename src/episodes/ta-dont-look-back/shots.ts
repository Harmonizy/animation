import { gloveNodes, glovePose } from '../../characters/harmonie/harmonie-hand';
import {
  mergePoses,
  taFigureNodes,
  taLeg,
  taNodeId,
  taScenePose,
  type FootTarget,
  type TaPose,
} from '../../characters/ta/ta-poses';
import type { TaView } from '../../characters/ta/ta-rig';
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
  type Key,
  type Pt,
} from '../shared/build';
import { taShot } from './episode';
import { tk } from './palette';
import { buildRoom, handle, ROOM, ROOM_SCALE } from './room';
import { addShadow, type ShadowKey } from './shadow';

/**
 * Every shot of DON'T LOOK BACK. The bedroom is one set; shots in it are camera framings of that
 * set, so the bed, the window and the door never move. Three close-ups (the phone, Ta's shoulder
 * and the handle) are inserts drawn at a larger size in the same colours and light.
 *
 * Acting follows anticipation, action, reaction, hold. Ta has no face: his state is in his breath,
 * the angle of his head, the height of his shoulders and, at the end, in not moving at all.
 */

type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
interface Timed {
  readonly time: number;
  readonly pose: TaPose;
  readonly easing?: Easing;
}

const window = (id: string) => {
  const shot = taShot(id);
  return { start: shot.startTime, end: shot.endTime };
};

/** Places a Ta figure and keys its body on a character pose track (on twos). */
function ta(
  b: Build,
  id: string,
  parent: string,
  view: TaView,
  place: { x: number; groundY: number; scale?: number; rotation?: number; depth: number },
  keys: readonly Timed[],
): void {
  b.nodes.push(
    ...taFigureNodes({
      id,
      parent,
      view,
      x: place.x,
      groundY: place.groundY,
      scale: place.scale ?? ROOM_SCALE,
      rotation: place.rotation ?? 0,
      depth: place.depth,
      ...(keys[0] ? { pose: keys[0].pose } : {}),
    }),
  );
  if (keys.length < 2) return;
  b.poseTracks.push({
    group: 'character',
    keyframes: keys.map((key, i) => {
      const name = `${id}-pose-${i}`;
      b.poses[name] = taScenePose(id, view, key.pose);
      return { time: key.time, pose: name, easing: key.easing ?? 'linear' };
    }),
  });
}

/** Slow breathing: the torso swells a little, on a long period. `rate` is breaths per second. */
function breathe(base: TaPose, from: number, to: number, rate: number, depth: number): Timed[] {
  const out: Timed[] = [];
  const period = 1 / rate;
  for (let t = from, i = 0; t <= to + 1e-9; t += period / 2, i++) {
    out.push({
      time: Math.round(t * 1000) / 1000,
      easing: 'easeInOut',
      pose: mergePoses(base, { torso: { ...(base.torso ?? {}), scaleY: 1 + (i % 2 ? depth : 0) } }),
    });
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * Poses.
 * ---------------------------------------------------------------------------------------------- */

const LYING: TaPose = {
  torso: { rotation: 0 },
  neck: { rotation: 0 },
  head: { rotation: -4 },
  rightUpperArm: { rotation: 2 },
  rightForearm: { rotation: -2 },
  leftUpperArm: { rotation: 2 },
};
const WOKEN: TaPose = mergePoses(LYING, {
  torso: { rotation: 13 },
  neck: { rotation: 4 },
  head: { rotation: 14 },
  rightUpperArm: { rotation: -2 },
  rightForearm: { rotation: -6 },
});

/** Sitting up in bed, legs straight out under the blanket. */
const SIT_IN_BED: TaPose = {
  pelvis: { dy: 133 },
  torso: { rotation: -8 },
  neck: { rotation: 6 },
  head: { rotation: 12 },
  leftThigh: { rotation: -88 },
  rightThigh: { rotation: -86 },
  leftShin: { rotation: 0 },
  rightShin: { rotation: 0 },
  leftFoot: { rotation: 70 },
  rightFoot: { rotation: 70 },
  leftUpperArm: { rotation: -26 },
  leftForearm: { rotation: -70 },
  rightUpperArm: { rotation: -14 },
  rightForearm: { rotation: -52 },
};

/** Seated on the end of the bed, feet on the floor. */
const SIT_EDGE: TaPose = {
  pelvis: { dx: -158, dy: 158 },
  torso: { rotation: 6 },
  head: { rotation: 8 },
  leftThigh: { rotation: -86 },
  rightThigh: { rotation: -88 },
  leftShin: { rotation: 86 },
  rightShin: { rotation: 88 },
  leftFoot: { rotation: 0 },
  rightFoot: { rotation: 0 },
  leftUpperArm: { rotation: -6 },
  leftForearm: { rotation: -40 },
  rightUpperArm: { rotation: -8 },
  rightForearm: { rotation: -44 },
};

const STAND: TaPose = {
  pelvis: { dx: 0, dy: 0 },
  torso: { rotation: 2, scaleY: 1 },
  neck: { rotation: 0 },
  head: { rotation: 4 },
  leftThigh: { rotation: 0 },
  rightThigh: { rotation: 0 },
  leftShin: { rotation: 0 },
  rightShin: { rotation: 0 },
  leftFoot: { rotation: 0 },
  rightFoot: { rotation: 0 },
  leftUpperArm: { rotation: 4 },
  leftForearm: { rotation: -6 },
  rightUpperArm: { rotation: -2 },
  rightForearm: { rotation: -8 },
};

/* ------------------------------------------------------------------------------------------------
 * The bedroom set, shown in every shot that takes place in it.
 * ---------------------------------------------------------------------------------------------- */

const ROOM_SHOTS = ['S01', 'S02', 'S04', 'S05', 'S06', 'S07', 'S08', 'S11'] as const;

function bedroom(b: Build): string {
  const root = b.rootFor('room', 'world', ROOM_SHOTS.map(window));
  buildRoom(b, root);
  // The phone lies on the bedside table, except while Ta holds it.
  const phone = b.group(
    'room-phone',
    root,
    { x: ROOM.table.right - 40, y: ROOM.table.top - 12 },
    -61.5,
  );
  b.add('room-phone-body', phone, rect(64, 9, tk('deepBlack')), {}, { depth: -61.5 });
  b.add('room-phone-edge', phone, rect(64, 2, tk('mutedBlue')), { y: -4 }, { depth: -61.4 });
  const held = window('S04');
  b.track(
    phone,
    'opacity',
    [
      { time: 0, value: 1, easing: 'step' },
      { time: held.start, value: 0, easing: 'step' },
      { time: 20.3, value: 1, easing: 'step' },
      { time: 60, value: 1 },
    ],
    { hold: 1, group: 'background' },
  );
  // The curtain breathes, barely, as if the window were not quite closed.
  b.track(
    'room-curtain-l',
    'rotation',
    [
      { time: 0, value: 0, easing: 'easeInOut' },
      { time: 6.5, value: 0.5, easing: 'easeInOut' },
      { time: 9.5, value: 0.15, easing: 'easeInOut' },
      { time: 14, value: 0.4 },
    ],
    { hold: 2 },
  );
  return root;
}

/* ------------------------------------------------------------------------------------------------
 * S01 AWAKENING and S02 THE SILENCE.
 * ---------------------------------------------------------------------------------------------- */

function s01(b: Build): void {
  const { start, end } = window('S01');
  const root = b.root('S01-cast', 'world', start, end);
  const wake = (taShot('S01').soundCues.find((c) => c.cue === 'inhale')?.start ?? 0.62) + 0.04;
  ta(b, 'S01-ta', root, 'side', { x: -494, groundY: 290, rotation: -90, depth: 0 }, [
    ...breathe(LYING, start, wake - 0.1, 0.25, 0.012),
    { time: wake - 0.04, pose: LYING, easing: 'easeOut' },
    // Two frames: the jolt of waking.
    { time: wake + 2 / 24, pose: WOKEN, easing: 'easeInOut' },
    { time: wake + 0.6, pose: mergePoses(WOKEN, { head: { rotation: 16 } }), easing: 'easeInOut' },
    ...breathe(mergePoses(WOKEN, { head: { rotation: 16 } }), wake + 1.1, end, 0.4, 0.008),
  ]);
  blanket(b, 'S01', root);
}

/** The blanket over his legs. Drawn over Ta, below his shoulders. */
function blanket(b: Build, prefix: string, parent: string, sitting = false): void {
  const top = sitting ? 220 : 236;
  const points: Pt[] = [
    [-1030, ROOM.bed.top + 6],
    [-1000, top + 14],
    [-880, top - 4],
    [-720, top + 6],
    [-560, top + 2],
    [-450, top + 26],
    [-436, ROOM.bed.top + 40],
    [-1030, ROOM.bed.top + 40],
  ];
  b.add(`${prefix}-blanket`, parent, path(smooth(points), tk('mutedBlue')), {}, { depth: 1 });
  b.add(
    `${prefix}-blanket-fold`,
    parent,
    path(
      smooth([
        [-900, top + 10],
        [-820, top + 20],
        [-700, ROOM.bed.top + 20],
        [-860, ROOM.bed.top + 24],
      ]),
      tk('coldShadow'),
    ),
    { opacity: 0.5 },
    { depth: 1.01 },
  );
  b.add(
    `${prefix}-blanket-edge`,
    parent,
    rect(600, 6, tk('moonlight')),
    { x: -740, y: top + 4, opacity: 0.35 },
    { depth: 1.02 },
  );
}

/* ------------------------------------------------------------------------------------------------
 * S03 THE PHONE: an insert at the bedside table.
 * ---------------------------------------------------------------------------------------------- */

function s03(b: Build): void {
  const shot = taShot('S03');
  const { start, end } = window('S03');
  const root = b.root('S03-world', 'world', start, end);
  b.add(
    'S03-wall',
    root,
    vertical(2200, 2400, [
      { offset: 0, color: tk('deepBlack') },
      { offset: 0.5, color: tk('nightNavy') },
      { offset: 1, color: tk('coldShadow') },
    ]),
    {},
    { depth: -100 },
  );
  b.add(
    'S03-moon',
    root,
    glow(1400, 1100, tk('mutedBlue'), 0.3),
    { x: -360, y: -420 },
    { depth: -99 },
  );
  b.add(
    'S03-table',
    root,
    vertical(2200, 900, [
      { offset: 0, color: tk('mutedBlue') },
      { offset: 0.04, color: tk('coldShadow') },
      { offset: 1, color: tk('deepBlack') },
    ]),
    { y: 650 },
    { depth: -80 },
  );
  const presses = shot.soundCues.filter((c) => c.cue === 'button').map((c) => c.start);
  const lift = start + 1.3;
  // The phone: lying on the table, then lifted to face the camera.
  const phone = b.group('S03-phone', root, { x: 60, y: 230, scaleY: 0.18, rotation: -4 }, 0);
  b.add('S03-phone-body', phone, path(roundedBox(250, 480, 34), tk('deepBlack')), {}, { depth: 0 });
  b.add(
    'S03-phone-edge',
    phone,
    path(roundedBox(262, 492, 38), tk('mutedBlue')),
    {},
    { depth: -0.1 },
  );
  b.add(
    'S03-phone-glass',
    phone,
    path(
      poly([
        [-110, -150],
        [-40, -220],
        [-10, -220],
        [-90, -140],
      ]),
      tk('paleLight'),
    ),
    { opacity: 0.06 },
    { depth: 0.1 },
  );
  b.add(
    'S03-phone-button',
    phone,
    rect(8, 70, tk('mutedBlue')),
    { x: 130, y: -90 },
    { depth: -0.2 },
  );
  b.track(
    phone,
    'y',
    [
      { time: start, value: 230 },
      { time: lift, value: 230, easing: 'easeInOut' },
      { time: lift + 0.9, value: -40 },
    ],
    { group: 'character' },
  );
  b.track(
    phone,
    'scaleY',
    [
      { time: start, value: 0.18 },
      { time: lift, value: 0.18, easing: 'easeInOut' },
      { time: lift + 0.9, value: 1 },
    ],
    { group: 'character' },
  );
  b.track(
    phone,
    'rotation',
    [
      { time: start, value: -4 },
      { time: lift, value: -4, easing: 'easeInOut' },
      { time: lift + 0.9, value: 3 },
    ],
    { group: 'character' },
  );
  // The cable, plugged into the phone, trailing off the table.
  b.add(
    'S03-cable',
    root,
    path(
      strokeLine(
        [
          [60, 470],
          [80, 560],
          [40, 700],
          [-60, 980],
        ],
        9,
      ),
      tk('deepBlack'),
    ),
    { opacity: 0 },
    { depth: -1 },
  );
  b.track(
    'S03-cable',
    'opacity',
    [
      { time: start, value: 0 },
      { time: lift + 0.5, value: 0, easing: 'easeOut' },
      { time: lift + 0.9, value: 1 },
    ],
    { hold: 1 },
  );
  // His hand: reaches in from the lower left, then holds the phone from behind.
  const hand = b.group('S03-hand', root, { x: -620, y: 760, rotation: 40 }, -0.5);
  b.nodes.push(
    ...gloveNodes({
      prefix: 'S03-glove',
      parent: hand,
      skin: tk('mutedBlue'),
      sleeve: tk('mutedBlue'),
      cloak: null,
      scale: 1.25,
      depth: -0.5,
    }),
  );
  b.track(
    hand,
    'x',
    [
      { time: start, value: -760 },
      { time: start + 0.3, value: -760, easing: 'easeOut' },
      { time: lift - 0.1, value: -140, easing: 'easeInOut' },
      { time: lift + 0.9, value: -70 },
    ],
    { group: 'character' },
  );
  b.track(
    hand,
    'y',
    [
      { time: start, value: 820 },
      { time: start + 0.3, value: 820, easing: 'easeOut' },
      { time: lift - 0.1, value: 520, easing: 'easeInOut' },
      { time: lift + 0.9, value: 360 },
    ],
    { group: 'character' },
  );
  b.track(
    hand,
    'rotation',
    [
      { time: start, value: 50 },
      { time: lift - 0.1, value: 62, easing: 'easeInOut' },
      { time: lift + 0.9, value: 28 },
    ],
    { group: 'character' },
  );
  b.poses['S03-reach'] = glovePose('S03-glove', 0.9, 2);
  b.poses['S03-grip'] = glovePose('S03-glove', 0.25, 0);
  b.poseTracks.push({
    group: 'character',
    keyframes: [
      { time: start, pose: 'S03-reach' },
      { time: lift - 0.25, pose: 'S03-reach', easing: 'easeIn' },
      { time: lift, pose: 'S03-grip' },
    ],
  });
  // His thumb, in front of the phone at the side button. It presses twice; nothing happens.
  // It rises from the hand along the phone's right edge, its tip on the button.
  const thumb = b.group('S03-thumb', root, { x: 196, y: 150, rotation: -12, opacity: 0 }, 1);
  b.add(
    'S03-thumb-shape',
    thumb,
    path(
      smooth([
        [-22, 0],
        [22, 0],
        [20, -60],
        [10, -96],
        [-10, -96],
        [-20, -60],
      ]),
      tk('mutedBlue'),
    ),
    {},
    { depth: 1 },
  );
  b.add(
    'S03-thumb-nail',
    thumb,
    path(
      smooth([
        [-10, -64],
        [10, -64],
        [8, -88],
        [-8, -88],
      ]),
      tk('moonlight'),
    ),
    { opacity: 0.35 },
    { depth: 1.01 },
  );
  b.track(
    thumb,
    'opacity',
    [
      { time: start, value: 0 },
      { time: lift + 0.7, value: 0, easing: 'step' },
      { time: lift + 0.8, value: 1 },
    ],
    { hold: 1 },
  );
  const thumbX: Key[] = [{ time: start, value: 196 }];
  for (const t of presses) {
    thumbX.push(
      { time: t - 0.18, value: 196, easing: 'easeIn' },
      { time: t, value: 184, easing: 'easeOut' },
      { time: t + 0.25, value: 196 },
    );
  }
  thumbX.push({ time: end, value: 196 });
  b.track(thumb, 'x', thumbX, { group: 'character' });
  void ellipse;
}

/** A rounded box centred on the origin. */
function roundedBox(width: number, height: number, radius: number): string {
  const w = width / 2;
  const h = height / 2;
  const r = radius;
  return smooth([
    [-w + r * 0.3, -h],
    [w - r * 0.3, -h],
    [w, -h + r * 0.3],
    [w, h - r * 0.3],
    [w - r * 0.3, h],
    [-w + r * 0.3, h],
    [-w, h - r * 0.3],
    [-w, -h + r * 0.3],
  ]);
}

/* ------------------------------------------------------------------------------------------------
 * S04 A SIMPLE EXPLANATION.
 * ---------------------------------------------------------------------------------------------- */

function s04(b: Build): void {
  const shot = taShot('S04');
  const { start, end } = window('S04');
  const root = b.root('S04-cast', 'world', start, end);
  const look = SIT_IN_BED;
  const atCable = mergePoses(look, { head: { rotation: 22 }, neck: { rotation: 10 } });
  const scratchUp = mergePoses(atCable, {
    head: { rotation: 14 },
    rightUpperArm: { rotation: -150 },
    rightForearm: { rotation: -105 },
    rightHand: { rotation: -20 },
  });
  const scratch = (d: number) => mergePoses(scratchUp, { rightForearm: { rotation: -105 + d } });
  const relaxed = mergePoses(look, {
    pelvis: { dy: 137 },
    torso: { rotation: -4, scaleY: 0.99 },
    head: { rotation: 8 },
  });
  const reachTable = mergePoses(relaxed, {
    torso: { rotation: -14 },
    leftUpperArm: { rotation: 44 },
    leftForearm: { rotation: -4 },
    head: { rotation: -6 },
  });
  const scratchCue = shot.soundCues.find((c) => c.cue === 'scratch');
  const s0 = scratchCue?.start ?? 18.4;
  const s1 = scratchCue?.end ?? 19.4;
  const keys: Timed[] = [
    { time: start, pose: look, easing: 'easeInOut' },
    { time: start + 0.6, pose: atCable, easing: 'easeInOut' },
    { time: s0 - 0.8, pose: atCable, easing: 'easeInOut' },
    { time: s0 - 0.1, pose: scratch(0), easing: 'linear' },
  ];
  for (let t = s0, i = 0; t < s1; t += 0.17, i++)
    keys.push({ time: t, pose: scratch(i % 2 ? 9 : -6), easing: 'easeInOut' });
  keys.push(
    { time: s1 + 0.1, pose: scratch(0), easing: 'easeInOut' },
    { time: s1 + 0.5, pose: relaxed, easing: 'easeInOut' },
    { time: 19.98, pose: relaxed, easing: 'easeInOut' },
    { time: 20.32, pose: reachTable, easing: 'easeInOut' },
    { time: 20.75, pose: relaxed },
  );
  ta(b, 'S04-ta', root, 'side', { x: -1185, groundY: 500, depth: 0 }, keys);
  blanket(b, 'S04', root, true);
  // The phone in his left hand, until he sets it on the table.
  const hand = taNodeId('S04-ta', 'leftHand');
  const held = b.group('S04-phone', hand, { x: 4, y: 52, rotation: -70 }, 0.005);
  b.add('S04-phone-body', held, rect(36, 70, tk('deepBlack')), {}, { depth: 0.005 });
  b.add('S04-phone-edge', held, rect(40, 74, tk('mutedBlue')), {}, { depth: 0.004 });
  b.track(
    held,
    'opacity',
    [
      { time: start, value: 1, easing: 'step' },
      { time: 20.3, value: 0 },
    ],
    { hold: 1 },
  );
  // The cable from the phone to the table, which he looks at.
  const lap: Pt[] = [
    [-1340, ROOM.table.top - 4],
    [-1290, 250],
    [-1220, 300],
    [-1120, 280],
    [-1095, 240],
  ];
  const down: Pt[] = [
    [-1340, ROOM.table.top - 4],
    [-1336, 302],
    [-1332, 306],
    [-1328, 302],
    [-1326, 296],
  ];
  b.add('S04-cable', root, path(strokeLine(lap, 5), tk('deepBlack')), {}, { depth: 0.5 });
  b.shapeTracks.push({
    target: 'S04-cable',
    group: 'character',
    keyframes: [
      { time: start, d: strokeLine(lap, 5), easing: 'linear' },
      { time: 20.0, d: strokeLine(lap, 5), easing: 'easeInOut' },
      { time: 20.35, d: strokeLine(down, 5), easing: 'linear' },
    ],
  });
  void end;
}

/* ------------------------------------------------------------------------------------------------
 * S05 GETTING UP: sit, feet down, rise, stretch, walk.
 * ---------------------------------------------------------------------------------------------- */

const WALK = { keysPerStep: 4, lift: [0, 34, 42, 14] as const, bob: [12, 18, 6, 2] as const };

function walkPose(key: number, stride: number): TaPose {
  const foot = (k: number): FootTarget => {
    const m = ((k % 8) + 8) % 8;
    if (m < 4) return { forward: stride / 2 - (stride * m) / 4, toe: m === 0 ? -8 : 0 };
    const s = m - 4;
    return {
      forward: -stride / 2 + (stride * s) / 4,
      lift: WALK.lift[s] ?? 0,
      toe: s === 0 ? 18 : 0,
    };
  };
  const right = foot(key);
  const left = foot(key + 4);
  const swing = right.forward / (stride / 2);
  const pelvis = { dy: WALK.bob[key % 4] ?? 0 };
  return mergePoses(
    STAND,
    {
      pelvis,
      torso: { rotation: 4 },
      head: { rotation: 3 },
      rightUpperArm: { rotation: 18 * swing },
      rightForearm: { rotation: -12 },
      leftUpperArm: { rotation: -18 * swing },
      leftForearm: { rotation: -12 },
    },
    taLeg('right', pelvis, right),
    taLeg('left', pelvis, left),
  );
}

function s05(b: Build): void {
  const shot = taShot('S05');
  const { start, end } = window('S05');
  const root = b.root('S05-cast', 'world', start, end);
  const steps = shot.soundCues.find((c) => c.cue === 'footsteps');
  const walkStart = steps?.start ?? 24;
  const stepTime = steps?.interval ?? 0.5;
  const feetDown = shot.soundCues.find((c) => c.cue === 'feet-down')?.start ?? 22.1;
  const x0 = -330;
  const speed = 300;
  const stride = (speed * stepTime) / ROOM_SCALE;
  const legsUp = mergePoses(SIT_EDGE, {
    leftShin: { rotation: 64 },
    rightShin: { rotation: 70 },
    leftFoot: { rotation: 20 },
    rightFoot: { rotation: 16 },
  });
  const lean = mergePoses(SIT_EDGE, {
    torso: { rotation: 30 },
    head: { rotation: -4 },
    pelvis: { dx: -150, dy: 150 },
  });
  const stretch = mergePoses(STAND, {
    torso: { rotation: -6 },
    head: { rotation: -10 },
    rightUpperArm: { rotation: -40 },
    leftUpperArm: { rotation: -34 },
    rightForearm: { rotation: -30 },
    leftForearm: { rotation: -30 },
  });
  const keys: Timed[] = [
    { time: start, pose: legsUp, easing: 'easeInOut' },
    { time: feetDown - 0.35, pose: legsUp, easing: 'easeIn' },
    { time: feetDown, pose: SIT_EDGE, easing: 'easeInOut' },
    { time: feetDown + 0.45, pose: lean, easing: 'easeInOut' },
    { time: feetDown + 1.15, pose: STAND, easing: 'easeInOut' },
    { time: feetDown + 1.65, pose: stretch, easing: 'easeInOut' },
    { time: walkStart - 0.15, pose: STAND, easing: 'easeInOut' },
  ];
  const keyTime = stepTime / WALK.keysPerStep;
  for (let k = 0; walkStart + k * keyTime <= end + 1e-9; k++) {
    keys.push({
      time: Math.round((walkStart + k * keyTime) * 1000) / 1000,
      pose: walkPose(k, stride),
    });
  }
  ta(b, 'S05-ta', root, 'side', { x: x0, groundY: 515, depth: 0 }, keys);
  b.track(
    taNodeId('S05-ta', 'root'),
    'x',
    [
      { time: start, value: x0 },
      { time: walkStart, value: x0 },
      { time: end, value: x0 + speed * (end - walkStart) },
    ],
    { group: 'character' },
  );
  b.track(
    taNodeId('S05-ta', 'root'),
    'y',
    [
      { time: start, value: 515 },
      { time: walkStart, value: 515, easing: 'easeInOut' },
      { time: end, value: 545 },
    ],
    { group: 'character' },
  );
  b.track(
    taNodeId('S05-ta', 'root'),
    'scaleX',
    [
      { time: start, value: ROOM_SCALE },
      { time: walkStart, value: ROOM_SCALE },
      { time: end, value: ROOM_SCALE * 1.03 },
    ],
    { group: 'character' },
  );
  b.track(
    taNodeId('S05-ta', 'root'),
    'scaleY',
    [
      { time: start, value: ROOM_SCALE },
      { time: walkStart, value: ROOM_SCALE },
      { time: end, value: ROOM_SCALE * 1.03 },
    ],
    { group: 'character' },
  );
}

/* ------------------------------------------------------------------------------------------------
 * The door: S06 to S08 and S11 share Ta's back-view figure, frozen with his hand near the handle.
 * ---------------------------------------------------------------------------------------------- */

/** Just above the lever's tip, never on it. */
const HAND_TARGET = { x: 716, y: -4 };

/** Back-view pose with the left hand raised towards the handle, the arm foreshortened. */
function reachPose(amount: number): TaPose {
  const scale = ROOM_SCALE;
  const shoulder = {
    x: ROOM.taAtDoor.x - 80 * scale,
    y: ROOM.taAtDoor.groundY + (206 - 800) * scale,
  };
  const dx = HAND_TARGET.x - shoulder.x;
  const dy = HAND_TARGET.y - shoulder.y;
  const angle = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const reach = Math.hypot(dx, dy) / (272 * scale);
  const lerp = (a: number, z: number) => a + (z - a) * amount;
  return mergePoses(STAND, {
    leftUpperArm: { rotation: lerp(4, angle + 4), scaleY: lerp(1, reach * 0.9) },
    leftForearm: { rotation: lerp(-6, -8), scaleY: lerp(1, reach * 1.1) },
    leftHand: { rotation: lerp(0, 40), scaleY: lerp(1, 0.75), scaleX: lerp(1, 0.9) },
    head: { rotation: lerp(0, -2) },
    rightUpperArm: { rotation: -2 },
  });
}

function doorTa(b: Build): void {
  const shots = ['S06', 'S07', 'S08', 'S11'].map(window);
  const root = b.rootFor('door-cast', 'world', shots);
  const s6 = window('S06');
  const voice = taShot('S08').dialogue?.start ?? 39;
  const reachStart = s6.start + 1.5;
  const reached = s6.start + 3.6;
  const ready = reachPose(1);
  const tense = mergePoses(ready, {
    neck: { dy: 5 },
    leftUpperArm: { ...(ready.leftUpperArm ?? {}), dy: -4 },
    rightUpperArm: { rotation: -2, dy: -6 },
    torso: { rotation: 0, scaleY: 1 },
  });
  const step = (up: 'left' | 'right'): TaPose =>
    mergePoses(STAND, {
      [`${up}Shin`]: { scaleY: 0.86 },
      [`${up}Foot`]: { dy: -18 },
      pelvis: { dy: 6 },
    } as TaPose);
  const keys: Timed[] = [
    { time: s6.start, pose: step('right'), easing: 'easeInOut' },
    { time: s6.start + 0.3, pose: STAND, easing: 'easeInOut' },
    { time: s6.start + 0.6, pose: step('left'), easing: 'easeInOut' },
    { time: s6.start + 0.9, pose: STAND, easing: 'easeInOut' },
    { time: reachStart, pose: STAND, easing: 'easeInOut' },
    // Anticipation: a small lift of the shoulder before the arm moves.
    {
      time: reachStart + 0.4,
      pose: mergePoses(reachPose(0.15), { leftUpperArm: { rotation: 8, dy: -3 } }),
      easing: 'easeInOut',
    },
    { time: reached, pose: ready, easing: 'easeOut' },
    // Waiting at the door, breathing normally, until the shadow and the voice.
    ...breathe(ready, reached + 0.3, voice - 0.4, 0.3, 0.008).map((k) => ({ ...k, time: k.time })),
    { time: voice - 0.1, pose: ready, easing: 'easeOut' },
    // The warning: he locks. From here he does not move.
    { time: voice + 0.25, pose: tense },
    { time: 60, pose: tense },
  ];
  ta(
    b,
    'door-ta',
    root,
    'back',
    { x: ROOM.taAtDoor.x, groundY: ROOM.taAtDoor.groundY, depth: 0 },
    keys,
  );
  b.track(
    taNodeId('door-ta', 'root'),
    'y',
    [
      { time: s6.start, value: ROOM.taAtDoor.groundY + 50 },
      { time: s6.start + 0.95, value: ROOM.taAtDoor.groundY },
    ],
    { group: 'character' },
  );
  b.track(
    taNodeId('door-ta', 'root'),
    'scaleX',
    [
      { time: s6.start, value: ROOM_SCALE * 1.05 },
      { time: s6.start + 0.95, value: ROOM_SCALE },
    ],
    { group: 'character' },
  );
  b.track(
    taNodeId('door-ta', 'root'),
    'scaleY',
    [
      { time: s6.start, value: ROOM_SCALE * 1.05 },
      { time: s6.start + 0.95, value: ROOM_SCALE },
    ],
    { group: 'character' },
  );
  // His own shadow, from the moonlight on the left, falls to the right across the floor and door.
  b.add(
    'door-ta-shadow',
    root,
    path(
      smooth([
        [820, 568],
        [900, 560],
        [1060, 520],
        [1180, 470],
        [1200, 490],
        [1090, 550],
        [920, 580],
      ]),
      tk('deepBlack'),
    ),
    { opacity: 0.5 },
    { depth: -0.5 },
  );
}

function theShadow(b: Build): void {
  const shots = ['S07', 'S08', 'S11'].map(window);
  const root = b.rootFor('shadow-wall', 'world', shots);
  const s7 = window('S07');
  const s11 = window('S11');
  const keys: ShadowKey[] = [
    { time: s7.start, extent: 0 },
    { time: s7.start + 0.4, extent: 0, easing: 'easeIn' },
    { time: s7.start + 1.8, extent: 0.35, lean: -24, easing: 'linear' },
    { time: s7.start + 3.2, extent: 0.8, lean: 22, easing: 'easeInOut' },
    // It settles, then stops completely before the voice.
    { time: s7.start + 4.4, extent: 1, lean: 0, easing: 'easeOut' },
    { time: s11.start + 0.4, extent: 1, lean: 0, easing: 'easeInOut' },
    { time: s11.end, extent: 1, lean: 16, grow: 1.12 },
  ];

  addShadow(b, 'shadow', root, keys, -75);
  // The final light falls slowly, in the room only; the text above it stays clear.
  const dim = b.add(
    'room-dim',
    root,
    rect(5000, 5000, tk('deepBlack')),
    { opacity: 0 },
    { depth: 40 },
  );
  b.track(
    dim,
    'opacity',
    [
      { time: 0, value: 0 },
      { time: s11.start + 0.5, value: 0, easing: 'easeIn' },
      { time: s11.end, value: 0.5 },
    ],
    { hold: 1 },
  );
}

/* ------------------------------------------------------------------------------------------------
 * S09 THE IMPOSSIBLE PRESENCE: close on his shoulder and neck.
 * ---------------------------------------------------------------------------------------------- */

function s09(b: Build): void {
  const { start, end } = window('S09');
  const root = b.root('S09-world', 'world', start, end);
  // Behind him: the door on the right, the wall on the left where the shadow's edge falls.
  b.add('S09-wall', root, rect(2400, 3000, tk('coldShadow')), {}, { depth: -100 });
  b.add('S09-door', root, rect(900, 3000, tk('mutedBlue')), { x: 560 }, { depth: -99 });
  b.add('S09-door-frame', root, rect(70, 3000, tk('nightNavy')), { x: 110 }, { depth: -98 });
  b.add(
    'S09-bounce',
    root,
    glow(1800, 1800, tk('mutedBlue'), 0.25),
    { x: -200, y: -200 },
    { depth: -97 },
  );
  b.add(
    'S09-shadow-edge',
    root,
    path(
      smooth([
        [-1200, -1400],
        [-260, -1400],
        [-190, -900],
        [-240, -400],
        [-160, 100],
        [-220, 600],
        [-180, 1400],
        [-1200, 1400],
      ]),
      tk('deepBlack'),
    ),
    { opacity: 0.85 },
    { depth: -96 },
  );
  b.add(
    'S09-shadow-soft',
    root,
    path(
      smooth([
        [-1200, -1400],
        [-200, -1400],
        [-130, -900],
        [-180, -400],
        [-100, 100],
        [-160, 600],
        [-120, 1400],
        [-1200, 1400],
      ]),
      tk('deepBlack'),
    ),
    { opacity: 0.35 },
    { depth: -96.1 },
  );
  const ready = reachPose(1);
  const tense = mergePoses(ready, {
    neck: { dy: 5 },
    leftUpperArm: { ...(ready.leftUpperArm ?? {}), dy: -4 },
    rightUpperArm: { rotation: -2, dy: -6 },
  });
  const tighter = mergePoses(tense, {
    neck: { dy: 12 },
    leftUpperArm: { ...(ready.leftUpperArm ?? {}), dy: -11 },
    rightUpperArm: { rotation: -1, dy: -14 },
  });
  const keys: Timed[] = [
    { time: start, pose: tense, easing: 'easeInOut' },
    { time: start + 1.4, pose: tighter, easing: 'easeInOut' },
    // Shallow, quick breaths: the shirt barely rises.
    ...breathe(tighter, start + 1.6, end, 1.4, 0.006),
  ];
  ta(b, 'S09-ta', root, 'back', { x: 40, groundY: 1580, scale: 2.7, depth: 0 }, keys);
}

/* ------------------------------------------------------------------------------------------------
 * S10 PARALYSIS: the hand and the handle, in extreme close-up.
 * ---------------------------------------------------------------------------------------------- */

function s10(b: Build): void {
  const { start, end } = window('S10');
  const root = b.root('S10-world', 'world', start, end);
  b.add(
    'S10-door',
    root,
    vertical(2400, 3000, [
      { offset: 0, color: tk('coldShadow') },
      { offset: 0.5, color: tk('mutedBlue') },
      { offset: 1, color: tk('coldShadow') },
    ]),
    {},
    { depth: -100 },
  );
  b.add(
    'S10-panel',
    root,
    path(
      poly([
        [260, -1300],
        [1300, -1300],
        [1300, -420],
        [260, -420],
      ]),
      tk('coldShadow'),
    ),
    { opacity: 0.55 },
    { depth: -99 },
  );
  // The shadow, soft and out of focus, behind his arm.
  b.add(
    'S10-shadow',
    root,
    glow(1500, 2000, tk('deepBlack'), 0.9),
    { x: -560, y: -300 },
    { depth: -98 },
  );
  handle(b, 'S10-handle', root, 150, -200, 4.2, -50);
  const hand = b.group('S10-hand', root, { x: -430, y: 20, rotation: 76 }, 0);
  b.nodes.push(
    ...gloveNodes({
      prefix: 'S10-glove',
      parent: hand,
      skin: tk('mutedBlue'),
      sleeve: tk('mutedBlue'),
      cloak: null,
      scale: 1.55,
      depth: 0,
    }),
  );
  b.poses['S10-hover'] = glovePose('S10-glove', 0.4, 1);
  b.poseTracks.push({ group: 'character', keyframes: [{ time: start, pose: 'S10-hover' }] });
  // The tremor: small, fast and smooth, from two summed waves keyed on twos. Never random.
  const xs: Key[] = [];
  const ys: Key[] = [];
  const rs: Key[] = [];
  for (let t = start; t <= end + 1e-9; t += 1 / 12) {
    const u = t - start;
    const grow = Math.min(1, 0.4 + u / 3);
    xs.push({
      time: t,
      value:
        -470 +
        grow *
          (1.4 * Math.sin(u * 2 * Math.PI * 5.3) + 0.8 * Math.sin(u * 2 * Math.PI * 8.9 + 1.1)),
    });
    ys.push({
      time: t,
      value:
        330 +
        grow *
          (1.1 * Math.sin(u * 2 * Math.PI * 6.1 + 0.4) + 0.6 * Math.sin(u * 2 * Math.PI * 9.7)),
    });
    rs.push({ time: t, value: 76 + grow * 0.35 * Math.sin(u * 2 * Math.PI * 4.7 + 2.1) });
  }
  b.track(hand, 'x', xs, { hold: 2 });
  b.track(hand, 'y', ys, { hold: 2 });
  b.track(hand, 'rotation', rs, { hold: 2 });
  b.track(
    'S10-glove-index-tip',
    'rotation',
    ys.map((k, i) => ({ time: k.time, value: Math.sin(i * 1.7) * 1.5 })),
    { hold: 2 },
  );
  void ellipse;
}

export function buildShots(): Build {
  const b = new Build();
  bedroom(b);
  s01(b);
  s03(b);
  s04(b);
  s05(b);
  doorTa(b);
  theShadow(b);
  s09(b);
  s10(b);
  return b;
}
