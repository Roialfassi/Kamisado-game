import { Color, GameState, MatchFormat, PlayerSide, SumoRank, createGame, getLegalMoves, towerId } from '@kamisado/engine';

function place(state: GameState, side: PlayerSide, color: Color, row: number, col: number, sumoRank: SumoRank = SumoRank.NORMAL): GameState {
  const id = towerId(side, color);
  const existing = state.towers[id];
  if (!existing) throw new Error(`missing tower ${id}`);
  return { ...state, towers: { ...state.towers, [id]: { ...existing, position: { row, col }, sumoRank } } };
}

function patch(state: GameState, partial: Partial<GameState>): GameState {
  return { ...state, ...partial };
}

/** Lesson 1: The Dragon's Step - one tower, wide open board. */
export function dragonsStepScenario() {
  let state = createGame(MatchFormat.SINGLE_ROUND);
  state = patch(state, { requiredColor: null, activePlayer: PlayerSide.BLACK });
  const legal = getLegalMoves(state, Color.RED);
  return { state, focusColor: Color.RED, legal };
}

/** Lesson 2: The Color Lock - Black just landed on a Green square. */
export function colorLockScenario() {
  let state = createGame(MatchFormat.SINGLE_ROUND);
  state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 2); // (3,2) is GREEN on the board
  state = patch(state, { activePlayer: PlayerSide.GOLD, requiredColor: Color.GREEN });
  const legal = getLegalMoves(state, Color.GREEN);
  return { state, focusColor: Color.GREEN, legal };
}

/** Lesson 3: The Stymie - Gold's Blue tower is fully boxed in. */
export function stymieScenario() {
  let state = createGame(MatchFormat.SINGLE_ROUND);
  state = place(state, PlayerSide.GOLD, Color.BLUE, 4, 4);
  state = place(state, PlayerSide.BLACK, Color.GREEN, 3, 3);
  state = place(state, PlayerSide.BLACK, Color.RED, 3, 4);
  state = place(state, PlayerSide.BLACK, Color.YELLOW, 3, 5);
  state = patch(state, { activePlayer: PlayerSide.GOLD, requiredColor: Color.BLUE });
  const legal = getLegalMoves(state, Color.BLUE);
  return { state, focusColor: Color.BLUE, legal };
}

/** Lesson 4: Deadlock - two towers permanently blocking each other. */
export function deadlockScenario() {
  let state = createGame(MatchFormat.SINGLE_ROUND);
  state = place(state, PlayerSide.GOLD, Color.BLUE, 1, 4); // sits on an ORANGE square
  state = place(state, PlayerSide.BLACK, Color.ORANGE, 2, 4); // sits on a BLUE square
  state = place(state, PlayerSide.GOLD, Color.GREEN, 3, 3);
  state = place(state, PlayerSide.GOLD, Color.RED, 3, 4);
  state = place(state, PlayerSide.GOLD, Color.YELLOW, 3, 5);
  state = patch(state, { activePlayer: PlayerSide.GOLD, requiredColor: Color.BLUE, lastPhysicalMover: PlayerSide.BLACK });
  return { state };
}

/** Lesson 5: The Way of the Sumo - a Single Sumo poised to push. */
export function sumoScenario() {
  let state = createGame(MatchFormat.SINGLE_ROUND);
  state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE);
  state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3);
  state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
  const legal = getLegalMoves(state, Color.BROWN);
  return { state, focusColor: Color.BROWN, legal };
}
