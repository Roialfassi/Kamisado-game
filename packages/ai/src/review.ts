import { ALL_COLORS, GameState, Move, MoveType, PlayerSide, getLegalMoves } from '@kamisado/engine';
import { MATE_BOUND } from './eval.js';
import { Position } from './position.js';
import { clearTranspositionTable, scoreRootMoves } from './search.js';

export type Verdict = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'missed-win';

export interface PlyReview {
  played: Move;
  /** The engine's preferred move, or null when the played move was (one of) the best. */
  bestMove: Move | null;
  /** Scores from the mover's point of view at the review depth (|score| >= MATE_BOUND = forced result). */
  playedScore: number;
  bestScore: number;
  /** How much winning chance the move gave away: 0 (none) .. 2 (a forced win turned into a forced loss). */
  loss: number;
  verdict: Verdict;
  /** Black's advantage after best play from this position, in [-1, 1] (a forced win = +-1). */
  blackAdvantage: number;
}

/** Maps an evaluation to a win-probability-like value in [-1, 1]. */
export function winChance(score: number): number {
  if (score > MATE_BOUND) return 1;
  if (score < -MATE_BOUND) return -1;
  return Math.tanh(score / 180);
}

function classify(bestScore: number, playedScore: number, loss: number): Verdict {
  if (bestScore > MATE_BOUND && playedScore <= MATE_BOUND) return 'missed-win';
  if (playedScore < -MATE_BOUND && bestScore >= -MATE_BOUND) return 'blunder';
  if (playedScore === bestScore || loss < 0.02) return 'best';
  if (loss < 0.12) return 'good';
  if (loss < 0.3) return 'inaccuracy';
  if (loss < 0.6) return 'mistake';
  return 'blunder';
}

function encode(m: Move): number {
  return m.from.row * 8 + m.from.col + ((m.to.row * 8 + m.to.col) << 6) + (m.type === MoveType.SUMO_PUSH ? 1 << 12 : 0);
}

export interface ReviewOptions {
  /** Search depth for scoring every candidate move (physical moves). */
  depth?: number;
}

/** Reviews one move: how good was `played` compared with the best alternative from `before`? */
export function reviewPly(before: GameState, played: Move, opts: ReviewOptions = {}): PlyReview {
  const colors = before.requiredColor ? [before.requiredColor] : ALL_COLORS;
  const legal = colors.flatMap((c) => getLegalMoves(before, c));
  const pos = Position.fromState(before);
  // free-choice openings have ~100 candidate moves: search a little shallower there
  const depth = opts.depth ?? (legal.length > 40 ? 6 : 8);
  clearTranspositionTable();
  const scored = scoreRootMoves(pos, depth);
  let best = scored[0]!;
  for (const s of scored) if (s.score > best.score) best = s;
  const playedEnc = encode(played);
  const playedEntry = scored.find((s) => s.move === playedEnc) ?? best;
  const loss = Math.max(0, winChance(best.score) - winChance(playedEntry.score));
  const verdict = classify(best.score, playedEntry.score, loss);
  const bestMove = best.move === playedEnc || playedEntry.score === best.score ? null : (pos.toEngineMove(best.move, legal) ?? null);
  const advantage = winChance(best.score);
  return {
    played,
    bestMove,
    playedScore: playedEntry.score,
    bestScore: best.score,
    loss,
    verdict,
    blackAdvantage: before.activePlayer === PlayerSide.BLACK ? advantage : -advantage,
  };
}

/**
 * Reviews a whole round. `states[i]` is the position before `moves[i]`
 * (states[0] = the round's start position).
 */
export function reviewGame(states: GameState[], moves: Move[], opts: ReviewOptions = {}, onProgress?: (done: number, total: number) => void): PlyReview[] {
  const out: PlyReview[] = [];
  for (let i = 0; i < moves.length; i++) {
    out.push(reviewPly(states[i]!, moves[i]!, opts));
    onProgress?.(i + 1, moves.length);
  }
  return out;
}

export interface SideSummary {
  moves: number;
  best: number;
  good: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  missedWins: number;
  /** 0-100, higher is cleaner play. */
  accuracy: number;
}

/** Per-side counts and an accuracy score (100 = never gave anything away). */
export function summarizeReview(reviews: PlyReview[]): Record<PlayerSide, SideSummary> {
  const blank = (): SideSummary & { lossSum: number } => ({ moves: 0, best: 0, good: 0, inaccuracies: 0, mistakes: 0, blunders: 0, missedWins: 0, accuracy: 100, lossSum: 0 });
  const acc = { [PlayerSide.BLACK]: blank(), [PlayerSide.GOLD]: blank() };
  for (const r of reviews) {
    const s = acc[r.played.playerSide];
    s.moves++;
    s.lossSum += r.loss;
    if (r.verdict === 'best') s.best++;
    else if (r.verdict === 'good') s.good++;
    else if (r.verdict === 'inaccuracy') s.inaccuracies++;
    else if (r.verdict === 'mistake') s.mistakes++;
    else if (r.verdict === 'blunder') s.blunders++;
    else s.missedWins++;
  }
  const finish = (s: SideSummary & { lossSum: number }): SideSummary => {
    const { lossSum, ...rest } = s;
    return { ...rest, accuracy: s.moves === 0 ? 100 : Math.round(100 * Math.exp((-3 * lossSum) / s.moves)) };
  };
  return { [PlayerSide.BLACK]: finish(acc[PlayerSide.BLACK]), [PlayerSide.GOLD]: finish(acc[PlayerSide.GOLD]) };
}
