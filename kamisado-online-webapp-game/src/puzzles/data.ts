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

type Placement = [Color, number, number];

/** Builds a Black-to-move position: every listed tower is moved off its home
 * square, everything else starts on its home row, and `required` is the
 * colour Black must move (as if Gold had just landed on a square of it). */
function position(black: Placement[], gold: Placement[], required: Color): () => GameState {
  return () => {
    let state = createGame(MatchFormat.SINGLE_ROUND);
    for (const [color, row, col] of black) state = place(state, PlayerSide.BLACK, color, row, col);
    for (const [color, row, col] of gold) state = place(state, PlayerSide.GOLD, color, row, col);
    return { ...state, activePlayer: PlayerSide.BLACK, requiredColor: required };
  };
}

/**
 * Every position here is machine-verified by `puzzles.test.ts` against the
 * rules engine: Black has a forced win in exactly `mateIn` of its own moves
 * (no shorter win exists), the winning first move is unique, and Gold's
 * replies are forced (fully stymied, or exactly one legal move) at every step.
 * This is a small catalogue, not the 50+ stage set from PLAN.md.
 */
export const PUZZLES: Puzzle[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: "Black to move. Find the single move that reaches Gold's home row.",
    mateIn: 1,
    build: position([[Color.BROWN, 5, 4]], [[Color.PURPLE, 1, 7]], Color.BROWN),
  },
  {
    id: 'quiet-step',
    title: 'The Quiet Step',
    description: 'Black to move. The winning move looks tiny - but the colour it lands on hands Gold a tower that cannot save the game.',
    mateIn: 2,
    build: position(
      [[Color.GREEN, 3, 0], [Color.BLUE, 6, 0], [Color.ORANGE, 3, 2]],
      [[Color.PURPLE, 2, 3], [Color.PINK, 1, 4]],
      Color.GREEN,
    ),
  },
  {
    id: 'the-box',
    title: 'The Box',
    description: "Black to move. Gold's Blue tower is nearly boxed in - steer the colour lock so it never gets a useful move.",
    mateIn: 2,
    build: position(
      [[Color.BROWN, 5, 2], [Color.GREEN, 6, 0]],
      [[Color.BLUE, 4, 4], [Color.RED, 5, 4], [Color.BROWN, 5, 3]],
      Color.BROWN,
    ),
  },
  {
    id: 'no-escape',
    title: 'No Escape',
    description: 'Black to move. Gold will have exactly one legal reply each turn - make sure every one walks into your follow-up.',
    mateIn: 2,
    build: position(
      [[Color.GREEN, 6, 0], [Color.BLUE, 2, 4], [Color.ORANGE, 5, 0]],
      [[Color.BLUE, 2, 1]],
      Color.ORANGE,
    ),
  },
  {
    id: 'tempo',
    title: 'Gaining Tempo',
    description: 'Black to move and win in two. Count the squares: the obvious advance is one tempo too slow.',
    mateIn: 2,
    build: position(
      [[Color.RED, 4, 4], [Color.PURPLE, 2, 0]],
      [[Color.BLUE, 2, 3], [Color.PINK, 1, 0]],
      Color.PURPLE,
    ),
  },
  {
    id: 'long-road',
    title: 'The Long Road',
    description: 'Black to move and win in three. Start with the biggest slide - the follow-ups are forced from there.',
    mateIn: 3,
    build: position([[Color.YELLOW, 3, 3], [Color.BLUE, 4, 2]], [[Color.GREEN, 1, 0]], Color.YELLOW),
  },
  {
    id: 'twin-towers',
    title: 'Twin Towers',
    description: 'Black to move and win in three. Two Black towers are in play - only one of them can start the combination.',
    mateIn: 3,
    build: position(
      [[Color.PINK, 3, 4], [Color.PURPLE, 2, 4]],
      [[Color.BLUE, 1, 7], [Color.PINK, 1, 0]],
      Color.PINK,
    ),
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
