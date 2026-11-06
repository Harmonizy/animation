import { HARMONIE_PALETTE } from '../../characters/harmonie/harmonie-palette';

export * from '../shared/build';

/**
 * Environment and prop colors. Harmonie keeps her own five. These are the crypt's: near-black
 * teal stone that lifts towards mist, warm wood and bronze for the merchant's world, and amber
 * kept for flame, gold and her scarf.
 */
export const EPISODE_PALETTE = {
  ...HARMONIE_PALETTE,
  void: '#070B0D',
  stone0: '#0E161A',
  stone1: '#152126',
  stone2: '#1E2F34',
  stone3: '#2A4146',
  stone4: '#3A5559',
  mist: '#7C9C9B',
  tealGlow: '#3F7472',
  torchCore: '#F6E2B0',
  ember: '#C7712C',
  wood0: '#1E1611',
  wood1: '#2E221A',
  wood2: '#433226',
  wood3: '#5A4433',
  bronze: '#9A7443',
  bronzeDark: '#5C4329',
  silver: '#BCC2BD',
  silverDark: '#7D8783',
  parchment: '#CDBF9E',
  parchmentDark: '#9C8E70',
  linen: '#D8CFBA',
  wax: '#D9C68E',
  waxDark: '#A8925A',
  rope: '#A08659',
  ropeDark: '#6E5A3A',
  leather: '#4C3527',
  leatherDark: '#33241B',
  watcher: '#030506',
} as const;

export type PaletteToken = keyof typeof EPISODE_PALETTE;
export const tk = (name: PaletteToken) => `token:${name}`;
