import type { Build } from '../kit';
import { buildS01 } from './s01';

/** Shot builders by shot id. A shot without a builder renders as darkness. */
export const SHOT_BUILDERS: Readonly<Record<string, () => Build>> = {
  S01: buildS01,
};
