import { Color } from '@kamisado/engine';

export const COLOR_HEX: Record<Color, string> = {
  [Color.BROWN]: '#5D4037',
  [Color.GREEN]: '#2E7D32',
  [Color.RED]: '#C62828',
  [Color.YELLOW]: '#FBC02D',
  [Color.PINK]: '#EC407A',
  [Color.PURPLE]: '#7B1FA2',
  [Color.BLUE]: '#1565C0',
  [Color.ORANGE]: '#EF6C00',
};

/** Colorblind-assist glyphs, one distinct symbol per color (accessibility mode). */
export const COLOR_SYMBOL: Record<Color, string> = {
  [Color.BROWN]: '⛰', // mountain
  [Color.GREEN]: '☘', // clover / wood
  [Color.RED]: '▲', // fire (triangle)
  [Color.YELLOW]: '☀', // sun
  [Color.PINK]: '❀', // blossom
  [Color.PURPLE]: '◆', // shadow diamond
  [Color.BLUE]: '≈', // water
  [Color.ORANGE]: '✱', // dragon burst
};

export const COLOR_LABEL: Record<Color, string> = {
  [Color.BROWN]: 'Brown',
  [Color.GREEN]: 'Green',
  [Color.RED]: 'Red',
  [Color.YELLOW]: 'Yellow',
  [Color.PINK]: 'Pink',
  [Color.PURPLE]: 'Purple',
  [Color.BLUE]: 'Blue',
  [Color.ORANGE]: 'Orange',
};

/** Whether a color should render with light or dark text/symbol on top for contrast. */
export function isDarkSquare(color: Color): boolean {
  return color === Color.BROWN || color === Color.PURPLE || color === Color.BLUE || color === Color.GREEN;
}
