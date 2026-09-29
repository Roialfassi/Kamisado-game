import { GameState, Move, getLegalMoves, ALL_COLORS } from '@kamisado/engine';
import { EvalWeights, MATE_BOUND } from './eval.js';
import { Position } from './position.js';
import { findBestMove, scoreRootMoves } from './search.js';

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
  DRAGON_MASTER: { label: 'Dragon Master', stars: 5, blurb: 'Searches the game far ahead. Every forced sequence is found.' },
};

export interface LevelConfig {
  /** Search depth in physical moves (plies). */
  depth: number;
  /** Product time budget (ms); the tournament runs depth-limited instead. */
  timeMs: number;
  /** Std-dev of the evaluation noise added to each root move (0 = none): the human-like slips. */
  noise: number;
  /** Evaluation weights (tuning hook; defaults to DEFAULT_WEIGHTS). */
  weights?: EvalWeights;
}

// Strength is tuned mainly through `noise`: measured bot-vs-bot, extra depth alone
// separates levels very little (a Kamisado round is short and largely a tempo
// race), whereas graded evaluation noise - the way engines implement "skill
// levels" - gives clean, human-feeling steps. Forced results found inside the
// horizon (a win/loss in one, two...) are never blurred by the noise.
const CONFIG: Record<Exclude<BotLevel, 'APPRENTICE'>, LevelConfig> = {
  STUDENT: { depth: 2, timeMs: 200, noise: 160 },
  RONIN: { depth: 4, timeMs: 300, noise: 95 },
  SAMURAI: { depth: 6, timeMs: 500, noise: 55 },
  DRAGON_MASTER: { depth: 20, timeMs: 1500, noise: 0 },
};

export interface ChooseOptions {
  /** Tuning/testing hook: override the level's depth/noise/time. */
  override?: Partial<LevelConfig>;
  /** Random source in [0,1). Defaults to Math.random. */
  rng?: () => number;
  /** Depth-limited only (ignore the wall-clock budget) - reproducible, used by tests and the tournament. */
  deterministicDepth?: boolean;
}

function legalMoves(state: GameState): Move[] {
  const colors = state.requiredColor ? [state.requiredColor] : ALL_COLORS;
  return colors.flatMap((c) => getLegalMoves(state, c));
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickApprentice(state: GameState, moves: Move[], rng: () => number): Move {
  // Takes a winning slide about half the time it sees one, otherwise wanders
  // forward more or less at random.
  const goal = state.activePlayer === 'BLACK' ? 7 : 0;
  const winning = moves.filter((m) => m.to.row === goal);
  if (winning.length > 0 && rng() < 0.5) return winning[Math.floor(rng() * winning.length)]!;
  const dir = state.activePlayer === 'BLACK' ? 1 : -1;
  const scored = moves.map((move) => ({ move, score: (move.to.row - move.from.row) * dir + rng() * 3 }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(1, Math.ceil(scored.length / 2)));
  return top[Math.floor(rng() * top.length)]!.move;
}

/** Picks a move for the side to move in `state`. Returns null if there is no legal move. */
export function chooseMove(state: GameState, level: BotLevel, opts: ChooseOptions = {}): Move | null {
  const rng = opts.rng ?? Math.random;
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0]!;
  if (level === 'APPRENTICE') return pickApprentice(state, moves, rng);

  const cfg = { ...CONFIG[level], ...opts.override };
  const pos = Position.fromState(state);
  let encoded: number;
  if (cfg.noise > 0) {
    // exact per-move scores at a fixed shallow depth, then human-like noise
    const scored = scoreRootMoves(pos, cfg.depth, cfg.weights);
    let best = scored[0]!;
    let bestValue = -Infinity;
    for (const s of scored) {
      // forced results (win in one / loss in one) are never blurred - a real
      // beginner does see those
      const value = Math.abs(s.score) >= MATE_BOUND ? s.score : s.score + gaussian(rng) * cfg.noise;
      if (value > bestValue) {
        bestValue = value;
        best = s;
      }
    }
    encoded = best.move;
  } else {
    const result = findBestMove(pos, {
      maxDepth: cfg.depth,
      timeMs: opts.deterministicDepth ? Infinity : cfg.timeMs,
      weights: cfg.weights,
      skipForced: true,
    });
    encoded = result.move;
  }
  return pos.toEngineMove(encoded, moves) ?? moves[0]!;
}

/** Best move and score for the side to move (used for hints and analysis). */
export function analyze(state: GameState, opts: { maxDepth?: number; timeMs?: number } = {}): { move: Move | null; score: number; depth: number } {
  const moves = legalMoves(state);
  if (moves.length === 0) return { move: null, score: 0, depth: 0 };
  const pos = Position.fromState(state);
  const r = findBestMove(pos, { maxDepth: opts.maxDepth ?? 12, timeMs: opts.timeMs ?? 400 });
  return { move: pos.toEngineMove(r.move, moves) ?? moves[0]!, score: r.score, depth: r.depth };
}
