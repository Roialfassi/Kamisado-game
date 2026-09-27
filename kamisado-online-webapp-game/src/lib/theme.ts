import { Color } from '@kamisado/engine';

export const COLOR_HEX: Record<Color, string> = {
  [Color.BROWN]: '#572600',
  [Color.GREEN]: '#009157',
  [Color.RED]: '#d23339',
  [Color.YELLOW]: '#e3c301',
  [Color.PINK]: '#d2719e',
  [Color.PURPLE]: '#6f3787',
  [Color.BLUE]: '#006bab',
  [Color.ORANGE]: '#d77522',
};

/** Authentic Japanese / Chinese Kanji characters used in official Kamisado */
export const COLOR_KANJI: Record<Color, string> = {
  [Color.BROWN]: '褐',
  [Color.GREEN]: '綠',
  [Color.RED]: '紅',
  [Color.YELLOW]: '黃',
  [Color.PINK]: '桃',
  [Color.PURPLE]: '紫',
  [Color.BLUE]: '藍',
  [Color.ORANGE]: '橙',
};

/** High-contrast accessibility glyphs / colorblind assistance symbols */
export const COLOR_SYMBOL: Record<Color, string> = {
  [Color.BROWN]: '褐', // Authentic Kanji
  [Color.GREEN]: '綠',
  [Color.RED]: '紅',
  [Color.YELLOW]: '黃',
  [Color.PINK]: '桃',
  [Color.PURPLE]: '紫',
  [Color.BLUE]: '藍',
  [Color.ORANGE]: '橙',
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

/** Whether a color tile has dark tone and needs light/gold text for contrast */
export function isDarkSquare(color: Color): boolean {
  return (
    color === Color.BROWN ||
    color === Color.PURPLE ||
    color === Color.BLUE ||
    color === Color.GREEN ||
    color === Color.RED
  );
}

/** Contrast text color for foreground indicators on this color */
export function getContrastTextColor(color: Color): string {
  return isDarkSquare(color) ? '#fbf4e2' : '#221208';
}
