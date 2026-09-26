import {
  ALL_COLORS,
  GameState,
  GameStatus,
  Move,
  PlayerSide,
  Tower,
  applyMove,
  getLegalMoves,
  handlePassOrDeadlock,
  opponentHomeRow,
  otherSide,
} from '@kamisado/engine';

export type BotTier = 'APPRENTICE' | 'RONIN' | 'DRAGON_MASTER';

export const BOT_LABELS: Record<BotTier, string> = {
  APPRENTICE: 'Apprentice',
  RONIN: 'Ronin',
  DRAGON_MASTER: 'Dragon Master',
};

/** All legal moves the active player could choose from right now (across all
 * their towers on a free-choice turn, or just the single required tower). */
export function enumerateChoices(state: GameState): Move[] {
  if (state.requiredColor !== null) {
    return getLegalMoves(state, state.requiredColor);
  }
  const moves: Move[] = [];
  for (const color of ALL_COLORS) {
    moves.push(...getLegalMoves(state, color));
  }
  return moves;
}

/** Applies a move and auto-resolves any resulting forced-pass/deadlock chain. */
function step(state: GameState, move: Move): GameState {
  const applied = applyMove(state, move);
  if (!applied.success || !applied.state) return state;
  if (applied.state.status !== GameStatus.IN_PROGRESS) return applied.state;
  const resolved = handlePassOrDeadlock(applied.state);
  return resolved.state ?? applied.state;
}

function towerAdvancement(tower: Tower): number {
  return tower.side === PlayerSide.BLACK ? tower.position.row : 7 - tower.position.row;
}

function evaluate(state: GameState, side: PlayerSide): number {
  if (state.status === GameStatus.ROUND_OVER || state.status === GameStatus.MATCH_OVER) {
    if (state.roundWinner === side) return 100000;
    if (state.roundWinner === otherSide(side)) return -100000;
  }
  let score = 0;
  for (const tower of Object.values(state.towers)) {
    const sign = tower.side === side ? 1 : -1;
    const advancement = towerAdvancement(tower);
    score += sign * (advancement * 3 + tower.sumoRank * 6);
    const distToGoal = opponentHomeRow(tower.side) - tower.position.row;
    if (tower.side === side && Math.abs(distToGoal) <= 1) score += sign * 20;
  }
  return score;
}

function alphaBeta(state: GameState, depth: number, alpha: number, beta: number, side: PlayerSide): number {
  if (depth === 0 || state.status !== GameStatus.IN_PROGRESS) {
    return evaluate(state, side);
  }
  const choices = enumerateChoices(state);
  if (choices.length === 0) {
    const resolved = handlePassOrDeadlock(state);
    if (resolved.state && resolved.state.status !== GameStatus.IN_PROGRESS) {
      return evaluate(resolved.state, side);
    }
    return evaluate(state, side);
  }

  const maximizing = state.activePlayer === side;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of choices) {
    const next = step(state, move);
    const value = alphaBeta(next, depth - 1, alpha, beta, side);
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break;
  }
  return best;
}

function pickRandom<T>(items: T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pickRandom called with empty array');
  return item;
}

function pickApprentice(choices: Move[]): Move {
  // Mostly random, with a mild bias toward forward progress so it doesn't
  // look actively self-destructive.
  const scored = choices.map((move) => ({ move, score: move.to.row - move.from.row + Math.random() * 3 }));
  scored.sort((a, b) => b.score - a.score);
  const topSlice = scored.slice(0, Math.max(1, Math.ceil(scored.length / 2)));
  return pickRandom(topSlice).move;
}

function pickRonin(state: GameState, choices: Move[], side: PlayerSide): Move {
  let bestScore = -Infinity;
  let best: Move[] = [];
  for (const move of choices) {
    const next = step(state, move);
    const score = evaluate(next, side) + Math.random() * 2;
    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }
  return pickRandom(best);
}

function pickDragonMaster(state: GameState, choices: Move[], side: PlayerSide): Move {
  const depth = 3;
  let bestScore = -Infinity;
  let best: Move = choices[0]!;
  for (const move of choices) {
    const next = step(state, move);
    const score = alphaBeta(next, depth, -Infinity, Infinity, side);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

/** Chooses a move for `side` given the current state, per the bot's tier. */
export function chooseBotMove(state: GameState, side: PlayerSide, tier: BotTier): Move | null {
  const choices = enumerateChoices(state);
  if (choices.length === 0) return null;
  switch (tier) {
    case 'APPRENTICE':
      return pickApprentice(choices);
    case 'RONIN':
      return pickRonin(state, choices, side);
    case 'DRAGON_MASTER':
      return pickDragonMaster(state, choices, side);
  }
}
