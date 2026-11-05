import { EPISODE, itemById, priceLabel, subtitleCues, type EpisodeShot } from './episode';
import { Build, fadeKeys, path, poly, rect, text, tk, vertical } from './kit';

/**
 * Burned-in text, on the screen plane so camera moves never touch it. Placement keeps clear of
 * the platform interface: nothing critical below 80% of the height or in the right-hand strip
 * where the like and share buttons sit.
 */

export const SUBTITLE = {
  /** Centre of the subtitle block, in screen units (0 is the middle of the frame). */
  centreY: 430,
  thaiSize: 56,
  englishSize: 34,
  lineHeight: 1.35,
  gap: 16,
  /** Widest a line may render, leaving side margins and the right-hand button strip clear. */
  maxWidth: 900,
} as const;

/** Vertical layout of one bilingual cue: centres of the Thai and English blocks. */
export function subtitleLayout(thaiLines: number, englishLines: number) {
  const thai = thaiLines * SUBTITLE.thaiSize * SUBTITLE.lineHeight;
  const english = englishLines * SUBTITLE.englishSize * SUBTITLE.lineHeight;
  const top = SUBTITLE.centreY - (thai + SUBTITLE.gap + english) / 2;
  return {
    top,
    bottom: top + thai + SUBTITLE.gap + english,
    thaiY: top + thai / 2,
    englishY: top + thai + SUBTITLE.gap + english / 2,
  };
}

function subtitles(build: Build): void {
  const root = build.root('subtitles', 'screen', 0, 60);
  // One soft backing band for the whole film, so text reads over any picture.
  build.add(
    'subtitle-band',
    root,
    vertical(1080, 420, [
      { offset: 0, color: tk('void'), opacity: 0 },
      { offset: 0.35, color: tk('void'), opacity: 0.55 },
      { offset: 0.7, color: tk('void'), opacity: 0.55 },
      { offset: 1, color: tk('void'), opacity: 0 },
    ]),
    { y: SUBTITLE.centreY },
  );
  for (const cue of subtitleCues()) {
    const layout = subtitleLayout(cue.th.length, cue.en.length);
    const th = build.add(
      `subtitle-${cue.index}-th`,
      root,
      text(cue.th.join('\n'), SUBTITLE.thaiSize, tk('warmIvory'), { weight: 600 }),
      { y: layout.thaiY, opacity: 0 },
    );
    const en = build.add(
      `subtitle-${cue.index}-en`,
      root,
      text(cue.en.join('\n'), SUBTITLE.englishSize, tk('warmIvory')),
      { y: layout.englishY, opacity: 0 },
    );
    build.track(th, 'opacity', fadeKeys(cue.start, cue.end, 0.18), { hold: 1 });
    build.track(en, 'opacity', fadeKeys(cue.start, cue.end, 0.18, 0.8), { hold: 1 });
  }
}

/** Where each shot's emphasis text sits. Chosen per shot so it never covers the subject. */
const EMPHASIS_Y: Record<string, number> = {
  S01: -560,
  S02: -640,
  S06: -600,
  S12: -770,
};

function emphasis(build: Build, shot: EpisodeShot): void {
  shot.emphasis.forEach((entry, i) => {
    const root = build.root(`${shot.id}-emphasis-${i}`, 'screen', shot.start, shot.end);
    const y = EMPHASIS_Y[shot.id] ?? -600;
    const size = entry.text.length > 14 ? 48 : 84;
    const label = build.add(
      `${shot.id}-emphasis-${i}-text`,
      root,
      text(entry.text, size, tk('warmIvory'), { weight: 700, spacing: size > 60 ? 8 : 4 }),
      { y, opacity: 0 },
    );
    const rule = build.add(
      `${shot.id}-emphasis-${i}-rule`,
      root,
      rect(size > 60 ? 120 : 90, 4, tk('amberGold')),
      { y: y + size * 0.85, opacity: 0 },
    );
    build.track(label, 'opacity', fadeKeys(entry.start, entry.end, 0.35), { hold: 1 });
    build.track(rule, 'opacity', fadeKeys(entry.start + 0.15, entry.end, 0.35), { hold: 1 });
  });
}

/** The closing question and the budget rule, above the subtitle band in the final seconds. */
function finalQuestion(build: Build): void {
  const shot = EPISODE.shots.find((candidate) => candidate.question);
  if (!shot?.question || !shot.callToAction) return;
  const root = build.root('final-question', 'screen', shot.question.start, 60);
  const cta = shot.callToAction;
  const box = build.add('final-cta', root, { kind: 'group' }, { y: 640, opacity: 0 });
  build.add('final-cta-card', box, path(roundedRect(560, 104, 52), tk('void')), { opacity: 0.72 });
  build.add('final-cta-card-edge', box, path(roundedRectRing(560, 104, 52, 3), tk('amberGold')));
  build.add('final-cta-th', box, text(cta.th, 36, tk('warmIvory'), { weight: 600 }), { y: -16 });
  build.add('final-cta-en', box, text(cta.en, 26, tk('warmIvory')), { y: 26, opacity: 0.8 });
  build.track(box, 'opacity', fadeKeys(shot.question.start + 0.2, 60, 0.4), { hold: 1 });
}

/** A price tag: a card with the label and the Thai name. Shots place these next to items. */
export function priceTag(
  build: Build,
  parent: string,
  itemId: string,
  x: number,
  y: number,
  window: { start: number; end: number },
  scale = 1,
): string {
  const item = itemById(itemId);
  const label = priceLabel(item);
  const width = Math.max(300, label.length * 21 + 70);
  const tag = build.group(
    `tag-${itemId}-${window.start}`,
    parent,
    { x, y, scaleX: scale, scaleY: scale, opacity: 0 },
    900,
  );
  build.add(
    `${tag}-card`,
    tag,
    path(roundedRect(width, 112, 14), tk('parchment')),
    {},
    { depth: 900 },
  );
  build.add(
    `${tag}-hole`,
    tag,
    { kind: 'ellipse', radiusX: 7, radiusY: 7, fill: tk('wood0') },
    { x: -width / 2 + 26 },
    { depth: 901 },
  );
  build.add(
    `${tag}-label`,
    tag,
    text(label, 36, tk('deepShadow'), { weight: 700 }),
    { x: 14, y: -16 },
    { depth: 901 },
  );
  build.add(
    `${tag}-th`,
    tag,
    text(item.th, 26, tk('wood1'), { weight: 500 }),
    { x: 14, y: 28 },
    { depth: 901 },
  );
  build.track(tag, 'opacity', fadeKeys(window.start, window.end, 0.25), { hold: 1 });
  return tag;
}

export function roundedRect(width: number, height: number, radius: number): string {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const k = r * 0.55;
  return [
    `M ${-w + r} ${-h}`,
    `L ${w - r} ${-h}`,
    `C ${w - r + k} ${-h} ${w} ${-h + r - k} ${w} ${-h + r}`,
    `L ${w} ${h - r}`,
    `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `L ${-w + r} ${h}`,
    `C ${-w + r - k} ${h} ${-w} ${h - r + k} ${-w} ${h - r}`,
    `L ${-w} ${-h + r}`,
    `C ${-w} ${-h + r - k} ${-w + r - k} ${-h} ${-w + r} ${-h}`,
    'Z',
  ].join(' ');
}

/** A thin outline of a rounded rectangle, as a band between two outlines. */
export function roundedRectRing(
  width: number,
  height: number,
  radius: number,
  thickness: number,
): string {
  const steps = 12;
  const outline = (w: number, h: number, r: number): [number, number][] => {
    const points: [number, number][] = [];
    const corners: [number, number, number][] = [
      [w - r, -h + r, -Math.PI / 2],
      [w - r, h - r, 0],
      [-w + r, h - r, Math.PI / 2],
      [-w + r, -h + r, Math.PI],
    ];
    for (const [cx, cy, start] of corners) {
      for (let i = 0; i <= steps; i++) {
        const a = start + (i / steps) * (Math.PI / 2);
        points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    }
    return points;
  };
  const outer = outline(width / 2, height / 2, radius);
  const inner = outline(
    width / 2 - thickness,
    height / 2 - thickness,
    radius - thickness,
  ).reverse();
  return poly([...outer, outer[0] as [number, number], ...inner, inner[0] as [number, number]]);
}

export function buildOverlay(): Build {
  const build = new Build();
  subtitles(build);
  for (const shot of EPISODE.shots) emphasis(build, shot);
  finalQuestion(build);
  return build;
}
