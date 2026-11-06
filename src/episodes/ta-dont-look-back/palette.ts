/**
 * The film's palette, from the brief: desaturated night blues, one deep black, and a single faint
 * warm accent kept for the door handle. Subtitle colours are the brief's own.
 */
export const TA_FILM_PALETTE = {
  nightNavy: '#141C2A',
  coldShadow: '#202B3B',
  mutedBlue: '#40566D',
  moonlight: '#849DB5',
  paleLight: '#C7D4DA',
  deepBlack: '#0A0D13',
  warmAccent: '#A9957C',
  subtitleThai: '#E8E3D8',
  subtitleEnglish: '#B7C5CF',
} as const;

export type FilmToken = keyof typeof TA_FILM_PALETTE;
export const tk = (name: FilmToken) => `token:${name}`;
