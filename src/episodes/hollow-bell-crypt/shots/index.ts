import type { Build } from '../kit';
import { buildS01 } from './s01';
import { buildS02, buildS03, buildS04, buildS05, buildS06 } from './s02-s06';
import { buildS07, buildS08, buildS09, buildS10, buildS11, buildS12 } from './s07-s12';

/** Shot builders by shot id. */
export const SHOT_BUILDERS: Readonly<Record<string, () => Build>> = {
  S01: buildS01,
  S02: buildS02,
  S03: buildS03,
  S04: buildS04,
  S05: buildS05,
  S06: buildS06,
  S07: buildS07,
  S08: buildS08,
  S09: buildS09,
  S10: buildS10,
  S11: buildS11,
  S12: buildS12,
};
