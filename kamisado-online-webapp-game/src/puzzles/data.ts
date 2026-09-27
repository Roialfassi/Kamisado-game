import { Color, GameState, MatchFormat, PlayerSide, SumoRank, createGame, towerId } from '@kamisado/engine';

function place(state: GameState, side: PlayerSide, color: Color, row: number, col: number, sumoRank: SumoRank = SumoRank.NORMAL): GameState {
  const id = towerId(side, color);
  const existing = state.towers[id];
  if (!existing) throw new Error(`missing tower ${id}`);
  return { ...state, towers: { ...state.towers, [id]: { ...existing, position: { row, col }, sumoRank } } };
}

export interface Puzzle {
  id: string;
  title: string;
  description: string;
  /** How many of the SOLVER's own physical moves it takes to win, assuming
   * perfect play (Gold's replies are fully forced in these positions - each
   * has been verified against the real engine to leave Gold either fully
   * stymied or with exactly one legal move at every step). */
  mateIn: number;
  build: () => GameState;
}

/**
 * These three positions (and their full winning sequences) were constructed
 * and verified directly against the rules engine - see
 * scratch verification during development - not hand-waved. This is a small
 * demonstration set, not the 50+ stage puzzle catalog from PLAN.md.
 */
export const PUZZLES: Puzzle[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: "Black to move. Find the single move that reaches Gold's home row.",
    mateIn: 1,
    build: () => {
      let state = createGame(MatchFormat.SINGLE_ROUND);
      state = place(state, PlayerSide.GOLD, Color.PURPLE, 1, 7); // vacates (7,2)
      state = place(state, PlayerSide.BLACK, Color.BROWN, 5, 4);
      return { ...state, activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN };
    },
  },
  {
    id: 'the-box',
    title: 'The Box',
    description:
      "Black to move. Force Gold's tower into a corner with nowhere to go - then finish the job when the turn comes back around.",
    mateIn: 2,
    build: () => {
      let state = createGame(MatchFormat.SINGLE_ROUND);
      state = place(state, PlayerSide.BLACK, Color.RED, 4, 3);
      state = place(state, PlayerSide.GOLD, Color.BLUE, 5, 7); // the tower that will be boxed in
      state = place(state, PlayerSide.BLACK, Color.GREEN, 4, 7);
      state = place(state, PlayerSide.BLACK, Color.YELLOW, 4, 6);
      return { ...state, activePlayer: PlayerSide.BLACK, requiredColor: Color.RED };
    },
  },
  {
    id: 'no-escape',
    title: 'No Escape',
    description: 'Black to move. Gold will have exactly one legal reply - make sure it walks straight into your follow-up.',
    mateIn: 2,
    build: () => {
      let state = createGame(MatchFormat.SINGLE_ROUND);
      state = place(state, PlayerSide.BLACK, Color.YELLOW, 3, 1);
      state = place(state, PlayerSide.BLACK, Color.GREEN, 6, 3);
      state = place(state, PlayerSide.BLACK, Color.RED, 5, 2);
      state = place(state, PlayerSide.BLACK, Color.PINK, 6, 5);
      state = place(state, PlayerSide.GOLD, Color.RED, 0, 7); // vacates (7,5)
      return { ...state, activePlayer: PlayerSide.BLACK, requiredColor: Color.YELLOW };
    },
  },
];

/** Rotates through the demo set by calendar day (UTC), so there's still a
 * different "today's puzzle" each day even with a small catalog. */
export function puzzleForToday(date: Date = new Date()): Puzzle {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  const puzzle = PUZZLES[dayIndex % PUZZLES.length];
  if (!puzzle) throw new Error('PUZZLES must be non-empty');
  return puzzle;
}
