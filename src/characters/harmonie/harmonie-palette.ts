/**
 * Harmonie (CHR-001) character palette. These five values are fixed by the art direction in
 * docs/creative/harmonie.md. Geometry refers to them only through these token names.
 */
export const HARMONIE_PALETTE = {
  deepShadow: '#202732',
  slateBlue: '#405567',
  mistTeal: '#789A9C',
  amberGold: '#E2B66B',
  warmIvory: '#E8E3D8',
} as const;

export type HarmonieColor = keyof typeof HARMONIE_PALETTE;

/** Colors that may fill a part of the character. Warm Ivory is reserved for the sheet background. */
export type HarmonieMaterialColor = Exclude<HarmonieColor, 'warmIvory'>;

export interface PaletteEntry {
  readonly token: HarmonieColor;
  readonly name: string;
  readonly materials: readonly string[];
}

/** What each color is used for, in the order the color guide shows them. */
export const HARMONIE_COLOR_GUIDE: readonly PaletteEntry[] = [
  {
    token: 'deepShadow',
    name: 'Deep Shadow',
    materials: ['Face and inner hood', 'Undersleeves, gloves, trousers', 'Boots, belt and satchel'],
  },
  {
    token: 'slateBlue',
    name: 'Slate Blue',
    materials: ['Hood shell', 'Cloak and shoulder mantle'],
  },
  {
    token: 'mistTeal',
    name: 'Mist Teal',
    materials: ['Inner tunic: body and skirt'],
  },
  {
    token: 'amberGold',
    name: 'Amber Gold',
    materials: ['Signature scarf', 'Satchel buckle (only other accent)'],
  },
  {
    token: 'warmIvory',
    name: 'Warm Ivory',
    materials: ['Sheet and preview background', 'Never used on the character'],
  },
];

/** The single fill the silhouette test uses for every part. */
export const SILHOUETTE_COLOR = HARMONIE_PALETTE.deepShadow;
