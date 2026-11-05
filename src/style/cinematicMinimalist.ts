/**
 * Palette tokens for the Cinematic Minimalist Silhouette style. Values are neutral test colors
 * for the laboratories, not final art direction. See docs/creative/visual-style.md.
 */
export const STYLE_TOKENS = [
  'sky',
  'atmosphere',
  'far',
  'mid',
  'near',
  'foreground',
  'subject',
  'subjectFar',
  'accent',
] as const;
export type StyleToken = (typeof STYLE_TOKENS)[number];
export type StylePalette = Readonly<Record<StyleToken, string>>;

export const STYLE_PALETTES = {
  warm: {
    sky: '#efc6a0',
    atmosphere: '#f5dcc2',
    far: '#cf9f90',
    mid: '#94707c',
    near: '#4b3c54',
    foreground: '#1f1826',
    subject: '#1a1521',
    subjectFar: '#322838',
    accent: '#d9482b',
  },
  cool: {
    sky: '#cddce3',
    atmosphere: '#e6eff1',
    far: '#a0b7c1',
    mid: '#658290',
    near: '#34495a',
    foreground: '#16222c',
    subject: '#0f1921',
    subjectFar: '#253642',
    accent: '#cf8f2e',
  },
  inverted: {
    sky: '#12141d',
    atmosphere: '#2b3242',
    far: '#1d212c',
    mid: '#2a303d',
    near: '#090a0f',
    foreground: '#040508',
    subject: '#ece6d9',
    subjectFar: '#a8a498',
    accent: '#e8603c',
  },
} as const satisfies Record<string, StylePalette>;

export type StylePaletteName = keyof typeof STYLE_PALETTES;
