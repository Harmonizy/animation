import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { harmonieParts } from '../../src/characters/harmonie/harmonie-geometry';
import { HARMONIE_PALETTE } from '../../src/characters/harmonie/harmonie-palette';
import {
  POSE_SHEET,
  PREVIEW_HOLD,
  pose,
  sheetPose,
  walkCyclePoses,
  type HarmoniePose,
} from '../../src/characters/harmonie/harmonie-poses';
import {
  HARMONIE_RIG,
  HARMONIE_VIEWS,
  pivotOf,
  RIG_NODE_IDS,
  rigOrder,
} from '../../src/characters/harmonie/harmonie-rig';
import {
  figureNodes,
  harmoniePreviewProject,
  nodeId,
} from '../../src/characters/harmonie/harmonie-scene';
import {
  buildCharacterSheet,
  buildRigSvg,
  PANELS,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  sheetFigureBounds,
} from '../../src/characters/harmonie/harmonie-sheet';
import { drawFigures, partsBounds, type Box } from '../../src/characters/harmonie/harmonie-svg';
import { evaluateFrame, evaluateScene } from '../../src/core/evaluate';
import { applyToPoint } from '../../src/core/matrix';
import { parseProject } from '../../src/core/schema';
import { isValidSvgPath } from '../../src/core/svgPath';

const REQUIRED_NODES = [
  'root',
  'pelvis',
  'torso',
  'neck',
  'head',
  'hood',
  'leftUpperArm',
  'leftForearm',
  'leftHand',
  'rightUpperArm',
  'rightForearm',
  'rightHand',
  'leftThigh',
  'leftShin',
  'leftFoot',
  'rightThigh',
  'rightShin',
  'rightFoot',
  'cloak',
  'scarf',
  'satchel',
];

const figureAtRest = (view: (typeof HARMONIE_VIEWS)[number], harmoniePose?: HarmoniePose) =>
  drawFigures([
    {
      id: 'f',
      view,
      x: 0,
      groundY: 800,
      scale: 1,
      ...(harmoniePose ? { pose: harmoniePose } : {}),
    },
  ]);

const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe('Harmonie palette', () => {
  it('uses exactly the five art-directed colors', () => {
    expect(HARMONIE_PALETTE).toEqual({
      deepShadow: '#202732',
      slateBlue: '#405567',
      mistTeal: '#789A9C',
      amberGold: '#E2B66B',
      warmIvory: '#E8E3D8',
    });
  });

  it('never fills the character with the background color', () => {
    for (const view of HARMONIE_VIEWS) {
      for (const part of harmonieParts(view)) expect(part.color).not.toBe('warmIvory');
    }
  });

  it('keeps Amber Gold to the scarf and the single satchel buckle', () => {
    for (const view of HARMONIE_VIEWS) {
      const amber = harmonieParts(view).filter((part) => part.color === 'amberGold');
      expect(amber.every((part) => part.node === 'scarf' || part.id === 'satchel-buckle')).toBe(
        true,
      );
      expect(amber.some((part) => part.node === 'scarf')).toBe(true);
    }
  });
});

describe('Harmonie rig', () => {
  it('has exactly the required nodes, with stable ids', () => {
    expect([...RIG_NODE_IDS]).toEqual(REQUIRED_NODES);
  });

  it('forms one tree rooted at root', () => {
    const roots = RIG_NODE_IDS.filter((node) => HARMONIE_RIG[node].parent === null);
    expect(roots).toEqual(['root']);
    const order = rigOrder();
    expect(order).toHaveLength(RIG_NODE_IDS.length);
    order.forEach((node, index) => {
      const parent = HARMONIE_RIG[node].parent;
      if (parent !== null) expect(order.indexOf(parent)).toBeLessThan(index);
    });
  });

  it('chains each limb from shoulder or hip to hand or foot', () => {
    for (const side of ['left', 'right'] as const) {
      expect(HARMONIE_RIG[`${side}Hand`].parent).toBe(`${side}Forearm`);
      expect(HARMONIE_RIG[`${side}Forearm`].parent).toBe(`${side}UpperArm`);
      expect(HARMONIE_RIG[`${side}UpperArm`].parent).toBe('torso');
      expect(HARMONIE_RIG[`${side}Foot`].parent).toBe(`${side}Shin`);
      expect(HARMONIE_RIG[`${side}Shin`].parent).toBe(`${side}Thigh`);
      expect(HARMONIE_RIG[`${side}Thigh`].parent).toBe('pelvis');
    }
  });

  it('keeps joints in order from head to foot', () => {
    for (const view of HARMONIE_VIEWS) {
      const y = (node: (typeof RIG_NODE_IDS)[number]) => pivotOf(node, view).y;
      expect(y('head')).toBeLessThan(y('neck'));
      expect(y('leftUpperArm')).toBeLessThan(y('leftForearm'));
      expect(y('leftForearm')).toBeLessThan(y('leftHand'));
      expect(y('torso')).toBeLessThan(y('leftThigh'));
      expect(y('leftThigh')).toBeLessThan(y('leftShin'));
      expect(y('leftShin')).toBeLessThan(y('leftFoot'));
      expect(y('leftFoot')).toBeLessThan(y('root'));
    }
  });
});

describe('Harmonie geometry', () => {
  it.each(HARMONIE_VIEWS)('%s: every part is valid, unique and on a rig node', (view) => {
    const parts = harmonieParts(view);
    expect(new Set(parts.map((part) => part.id)).size).toBe(parts.length);
    for (const part of parts) {
      expect(isValidSvgPath(part.d)).toBe(true);
      expect(RIG_NODE_IDS).toContain(part.node);
    }
  });

  it.each(HARMONIE_VIEWS)('%s: is 800 units tall, from hood tip to sole', (view) => {
    const bounds = partsBounds(figureAtRest(view));
    expect(bounds.y).toBeGreaterThanOrEqual(18);
    expect(bounds.y).toBeLessThanOrEqual(30);
    expect(bounds.y + bounds.height).toBeCloseTo(800, 0);
    expect(Math.abs(bounds.x + bounds.width / 2)).toBeLessThan(30);
  });

  it.each(HARMONIE_VIEWS)('%s: has the signature costume pieces', (view) => {
    const ids = harmonieParts(view).map((part) => part.id);
    // The belt and tunic are under the cloak in the back view, but still part of the rig.
    for (const piece of ['hood-shell', 'cloak-back', 'scarf-wrap', 'satchel-bag', 'tunic-body']) {
      expect(ids).toContain(piece);
    }
    // Only the back view hides the face.
    expect(ids.includes('face')).toBe(view !== 'back');
  });

  it('has a longer right hem than left, seen from front and back', () => {
    /** Lowest point of the cloak on one half of the figure, in character space. */
    const hemAt = (view: 'front' | 'back', side: 1 | -1) => {
      const cloak = harmonieParts(view).find((part) => part.id === 'cloak-back');
      if (!cloak) throw new Error('missing cloak');
      let lowest = 0;
      for (const p of cloak.d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
        if (Math.sign(Number(p[1])) === side) lowest = Math.max(lowest, Number(p[2]));
      }
      return lowest;
    };
    // Her right is screen left from the front, and screen right from the back.
    expect(hemAt('front', -1)).toBeGreaterThan(hemAt('front', 1) + 30);
    expect(hemAt('back', 1)).toBeGreaterThan(hemAt('back', -1) + 30);
  });
});

/** World position of a rig node's pivot for a pose, on the side-view rig. */
function jointAt(node: string, harmoniePose: HarmoniePose) {
  const scene = parseProject({
    schemaVersion: 3,
    id: 't',
    name: 't',
    kind: 'technical-demo',
    scenes: [
      {
        id: 's',
        duration: 1,
        fps: 24,
        exportFps: 24,
        background: '#000000',
        palette: { ...HARMONIE_PALETTE },
        safeArea: { x: 0, y: 0, width: 1, height: 1 },
        nodes: figureNodes({
          id: 'f',
          view: 'side',
          x: 0,
          groundY: 800,
          scale: 1,
          pose: harmoniePose,
        }),
        shots: [{ id: 'a', start: 0, duration: 1 }],
      },
    ],
  }).scenes[0];
  if (!scene) throw new Error('missing scene');
  const found = evaluateFrame(scene, 0).nodes.find((n) => n.id === nodeId('f', node));
  if (!found) throw new Error(`missing ${node}`);
  return applyToPoint(found.worldMatrix, { x: 0, y: 0 });
}

describe('Harmonie poses', () => {
  it('places each ankle exactly where the leg IK was asked to', () => {
    const ankleRest = pivotOf('leftFoot', 'side');
    const cases = [
      { pelvisDy: 20, forward: 30, lift: 0 },
      { pelvisDy: 60, forward: -50, lift: 20 },
      { pelvisDy: 150, pelvisTilt: 40, forward: 66, lift: 0 },
    ];
    for (const c of cases) {
      const p = pose({
        pelvisDy: c.pelvisDy,
        ...(c.pelvisTilt === undefined ? {} : { pelvisTilt: c.pelvisTilt }),
        leftFoot: { forward: c.forward, lift: c.lift },
        rightFoot: { forward: 0 },
      });
      const ankle = jointAt('leftFoot', p);
      expect(ankle.x).toBeCloseTo(ankleRest.x - c.forward, 1);
      expect(ankle.y).toBeCloseTo(ankleRest.y - c.lift, 1);
    }
  });

  it('sets every node except the root in every sheet pose', () => {
    for (const entry of POSE_SHEET) {
      const keys = Object.keys(sheetPose(entry.id)).sort();
      expect(keys).toEqual(RIG_NODE_IDS.filter((node) => node !== 'root').sort());
    }
  });

  it.each(POSE_SHEET.filter((entry) => entry.id !== 'running').map((entry) => entry.id))(
    '%s stands on the ground',
    (id) => {
      const bounds = partsBounds(figureAtRest('side', sheetPose(id)));
      expect(bounds.y + bounds.height).toBeGreaterThan(795);
      expect(bounds.y + bounds.height).toBeLessThan(806);
    },
  );

  it('walks with a boot on the ground on every key, never floating or sinking', () => {
    for (const keyPose of walkCyclePoses()) {
      const bounds = partsBounds(figureAtRest('side', keyPose));
      expect(bounds.y + bounds.height).toBeGreaterThan(799);
      expect(bounds.y + bounds.height).toBeLessThan(801);
    }
  });
});

describe('Harmonie motion preview', () => {
  const project = parseProject(harmoniePreviewProject());
  const scene = project.scenes[0];
  if (!scene) throw new Error('missing scene');

  it('runs at 24 fps with the character and cloth on twos', () => {
    expect(scene.fps).toBe(24);
    expect(scene.exposure.character).toBe(PREVIEW_HOLD);
    expect(scene.exposure.secondary).toBe(2);
    expect(scene.poseTracks.map((track) => track.group)).toEqual(['character', 'secondary']);
  });

  it('has one shot per clip: idle, walk, reach and cloth', () => {
    expect(scene.shots.map((shot) => shot.id)).toEqual(['idle', 'walk', 'reach', 'cloth']);
  });

  it('gives the same picture for the same time, in any order of evaluation', () => {
    const times = [0.5, 5.3, 9.1, 12.7, 14.9];
    const first = times.map((t) => evaluateScene(scene, t));
    const reversed = [...times].reverse().map((t) => evaluateScene(scene, t));
    expect(reversed.reverse()).toEqual(first);
  });

  it('holds each drawing for two frames', () => {
    for (let frame = 96; frame < 192; frame += 2) {
      expect(evaluateFrame(scene, frame + 1).nodes).toEqual(evaluateFrame(scene, frame).nodes);
    }
    expect(evaluateFrame(scene, 98).nodes).not.toEqual(evaluateFrame(scene, 96).nodes);
  });

  it('lets the cloak keep moving after the body has stopped', () => {
    const rotationOf = (id: string, t: number) => {
      const node = evaluateScene(scene, t).nodes.find((n) => n.id === id);
      if (!node) throw new Error(`missing ${id}`);
      return Math.atan2(node.worldMatrix[1], node.worldMatrix[0]);
    };
    // The cloth test starts at 11.5 s. The body holds its lean from 12.1 s to 13.3 s.
    const torso = [12.2, 12.5, 12.8].map((t) => rotationOf('harmonie-part-tunic-body', t));
    const cloak = [12.2, 12.5, 12.8].map((t) => rotationOf('harmonie-part-cloak-back', t));
    expect(Math.max(...torso) - Math.min(...torso)).toBeLessThan(1e-9);
    expect(Math.max(...cloak) - Math.min(...cloak)).toBeGreaterThan(0.1);
  });
});

describe('Harmonie character sheet', () => {
  const sheet = buildCharacterSheet();

  it('uses the landscape master viewBox', () => {
    expect(sheet).toContain(`viewBox="0 0 2560 1800"`);
    expect(SHEET_WIDTH).toBe(2560);
    expect(SHEET_HEIGHT).toBe(1800);
  });

  it('uses only palette colors', () => {
    const palette = new Set(Object.values(HARMONIE_PALETTE).map((hex) => hex.toUpperCase()));
    const used = [...sheet.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map((m) =>
      (m[1] ?? '').toUpperCase(),
    );
    expect(used.length).toBeGreaterThan(100);
    for (const color of used) expect(palette).toContain(color);
  });

  it('keeps panels on the sheet and apart', () => {
    const page = { x: 0, y: 0, width: SHEET_WIDTH, height: SHEET_HEIGHT };
    PANELS.forEach((a, i) => {
      expect(inside(a, page)).toBe(true);
      PANELS.slice(i + 1).forEach((b) => {
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      });
    });
  });

  it('fits every figure inside its own cell, unclipped', () => {
    for (const { id, cell, bounds } of sheetFigureBounds()) {
      expect(inside(bounds, cell), `${id} leaves its cell`).toBe(true);
    }
  });
});

describe('committed SVG files', () => {
  const read = (name: string) =>
    readFileSync(`assets/characters/harmonie/${name}`, 'utf8').replace(/\r\n/g, '\n');

  it('are up to date with the geometry. Run npm run build:harmonie if this fails', () => {
    expect(read('harmonie-character-sheet.svg')).toBe(buildCharacterSheet());
    expect(read('harmonie-rig.svg')).toBe(buildRigSvg());
  });

  it('name every rig node in every view of the rig file', () => {
    const rig = buildRigSvg();
    for (const view of HARMONIE_VIEWS) {
      for (const node of RIG_NODE_IDS) expect(rig).toContain(`id="${view}-pivot-${node}"`);
    }
  });
});
