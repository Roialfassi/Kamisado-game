/** Light-weight level metadata (no search code), safe to import in the UI thread. */
export type BotLevel = 'APPRENTICE' | 'STUDENT' | 'RONIN' | 'SAMURAI' | 'DRAGON_MASTER';

export const BOT_LEVELS: BotLevel[] = ['APPRENTICE', 'STUDENT', 'RONIN', 'SAMURAI', 'DRAGON_MASTER'];

export interface LevelInfo {
  label: string;
  blurb: string;
  /** 1-5, for the level badge. */
  stars: number;
}

export const LEVEL_INFO: Record<BotLevel, LevelInfo> = {
  APPRENTICE: { label: 'Apprentice', stars: 1, blurb: 'Moves quickly and often without a plan. Perfect for learning the colour lock.' },
  STUDENT: { label: 'Student', stars: 2, blurb: 'Grabs a win when it sees one and avoids handing you one, but does not plan ahead.' },
  RONIN: { label: 'Ronin', stars: 3, blurb: 'Thinks a couple of moves ahead. Makes the occasional human slip.' },
  SAMURAI: { label: 'Samurai', stars: 4, blurb: 'Reads the position several moves deep and rarely errs. Expect real pressure.' },
  DRAGON_MASTER: { label: 'Dragon Master', stars: 5, blurb: 'Searches up to 20 moves ahead and finds every forced sequence within that horizon.' },
};

