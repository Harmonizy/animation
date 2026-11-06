import {
  Build,
  fadeKeys,
  path,
  roundedRect,
  roundedRectRing,
  text,
  vertical,
} from '../shared/build';
import { TA_EPISODE, taSubtitleCues } from './episode';
import { tk } from './palette';

/**
 * Burned-in text on the screen plane: bilingual subtitles in a fixed band clear of the platform
 * interface, and the closing choice, set apart from the subtitles at the top of the frame.
 */

export const TA_SUBTITLE = {
  centreY: 440,
  thaiSize: 56,
  englishSize: 34,
  lineHeight: 1.35,
  gap: 14,
  maxWidth: 900,
} as const;

export function taSubtitleLayout(thaiLines: number, englishLines: number) {
  const thai = thaiLines * TA_SUBTITLE.thaiSize * TA_SUBTITLE.lineHeight;
  const english = englishLines * TA_SUBTITLE.englishSize * TA_SUBTITLE.lineHeight;
  const top = TA_SUBTITLE.centreY - (thai + TA_SUBTITLE.gap + english) / 2;
  return { thaiY: top + thai / 2, englishY: top + thai + TA_SUBTITLE.gap + english / 2 };
}

function subtitles(b: Build): void {
  const root = b.root('subtitles', 'screen', 0, 60);
  b.add(
    'subtitle-band',
    root,
    vertical(1080, 400, [
      { offset: 0, color: tk('deepBlack'), opacity: 0 },
      { offset: 0.35, color: tk('deepBlack'), opacity: 0.5 },
      { offset: 0.7, color: tk('deepBlack'), opacity: 0.5 },
      { offset: 1, color: tk('deepBlack'), opacity: 0 },
    ]),
    { y: TA_SUBTITLE.centreY },
    { depth: 0 },
  );
  for (const cue of taSubtitleCues()) {
    const layout = taSubtitleLayout(cue.th.length, cue.en.length);
    const th = b.add(
      `sub-${cue.index}-th`,
      root,
      text(cue.th.join('\n'), TA_SUBTITLE.thaiSize, tk('subtitleThai'), { weight: 600 }),
      { y: layout.thaiY, opacity: 0 },
      { depth: 1 },
    );
    const en = b.add(
      `sub-${cue.index}-en`,
      root,
      text(cue.en.join('\n'), TA_SUBTITLE.englishSize, tk('subtitleEnglish'), { font: 'latin' }),
      { y: layout.englishY, opacity: 0 },
      { depth: 1 },
    );
    b.track(th, 'opacity', fadeKeys(cue.start, cue.end, 0.15), { hold: 1 });
    b.track(en, 'opacity', fadeKeys(cue.start, cue.end, 0.15), { hold: 1 });
  }
}

export const CHOICE = { width: 440, height: 196, gap: 40, y: -660 } as const;

/** The two options, identical in size, weight and colour, so neither reads as the answer. */
function choices(b: Build): void {
  const start = TA_EPISODE.choicesStart;
  const root = b.root('choices', 'screen', start, 60);
  TA_EPISODE.choices.forEach((choice, i) => {
    const x = (i === 0 ? -1 : 1) * (CHOICE.width / 2 + CHOICE.gap / 2);
    const card = b.group(`choice-${choice.id}`, root, { x, y: CHOICE.y, opacity: 0 }, 2);
    b.add(
      `choice-${choice.id}-back`,
      card,
      path(roundedRect(CHOICE.width, CHOICE.height, 22), tk('deepBlack')),
      { opacity: 0.72 },
      { depth: 2 },
    );
    b.add(
      `choice-${choice.id}-edge`,
      card,
      path(roundedRectRing(CHOICE.width, CHOICE.height, 22, 2.5), tk('moonlight')),
      {},
      { depth: 2.1 },
    );
    b.add(
      `choice-${choice.id}-letter`,
      card,
      text(choice.id, 30, tk('moonlight'), { weight: 600, font: 'latin' }),
      { y: -62 },
      { depth: 2.2 },
    );
    b.add(
      `choice-${choice.id}-th`,
      card,
      text(choice.th, 50, tk('subtitleThai'), { weight: 600 }),
      { y: -6 },
      { depth: 2.2 },
    );
    b.add(
      `choice-${choice.id}-en`,
      card,
      text(choice.en, 30, tk('subtitleEnglish'), { spacing: 2, font: 'latin' }),
      { y: 52 },
      { depth: 2.2 },
    );
    // Both appear together, with the same fade.
    b.track(card, 'opacity', fadeKeys(start, 60, 0.6), { hold: 1 });
  });
}

export function buildTaOverlay(): Build {
  const b = new Build();
  subtitles(b);
  choices(b);
  return b;
}
