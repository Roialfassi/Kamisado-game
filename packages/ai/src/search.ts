import { DEFAULT_WEIGHTS, EvalWeights, MATE, MATE_BOUND, evaluate } from './eval.js';
import { Position, goalRow } from './position.js';

export interface SearchOptions {
  /** Iterative deepening stops after this many physical moves (plies). */
  maxDepth: number;
  /** Wall-clock budget in ms (Infinity = depth-limited only, fully deterministic). */
  timeMs: number;
  weights?: EvalWeights;
  /** Return immediately when there is only one legal move (its score is then not computed). */
  skipForced?: boolean;
}

export interface SearchResult {
  /** Best encoded move, or -1 if there is no legal move. */
  move: number;
  /** Score from the side-to-move's point of view (|score| >= MATE_BOUND means a forced win/loss). */
  score: number;
  /** Deepest fully completed iteration. */
  depth: number;
  nodes: number;
}

// ---- transposition table (module level, shared between searches) -----------
const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE).fill(-1);
const ttFlag = new Uint8Array(TT_SIZE); // 0 exact, 1 lower bound, 2 upper bound
const ttScore = new Int32Array(TT_SIZE);
const ttMove = new Int32Array(TT_SIZE);
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

export function clearTranspositionTable(): void {
  ttDepth.fill(-1);
}

const MAX_PLY = 64;
const MAX_MOVES = 160;

class Searcher {
  nodes = 0;
  stopped = false;
  private readonly moveBuf: Int32Array[] = Array.from({ length: MAX_PLY }, () => new Int32Array(MAX_MOVES));
  private readonly scoreBuf: Int32Array[] = Array.from({ length: MAX_PLY }, () => new Int32Array(MAX_MOVES));
  private readonly history = new Int32Array(1 << 13);
  private deadline = Infinity;

  constructor(
    readonly pos: Position,
    readonly weights: EvalWeights,
  ) {}

  setDeadline(timeMs: number): void {
    this.deadline = timeMs === Infinity ? Infinity : performance.now() + timeMs;
  }

  private timeUp(): boolean {
    if (this.deadline !== Infinity && performance.now() >= this.deadline) this.stopped = true;
    return this.stopped;
  }

  /** Orders `moves[0..n)` best-first (insertion sort; n is small). */
  private order(ply: number, n: number, ttBest: number): void {
    const pos = this.pos;
    const moves = this.moveBuf[ply]!;
    const scores = this.scoreBuf[ply]!;
    const side = pos.active;
    const goal = goalRow(side);
    for (let i = 0; i < n; i++) {
      const m = moves[i]!;
      const to = (m >> 6) & 63;
      let s: number;
      if (to >> 3 === goal) {
        s = 1_000_000;
      } else if (m === ttBest) {
        s = 500_000;
      } else {
        s = this.history[m & 0x1fff]!;
        if (((m >> 12) & 1) === 0) {
          // standard move: look at the tower the landing colour forces on the opponent
          const opp = (1 - side) * 8 + pos.colorOf[to]!;
          if (pos.canReachGoal(opp)) s -= 10_000;
          else if (!pos.hasMove(opp)) s += 300;
          const oc = pos.pos[opp]!;
          const nr = (oc >> 3) + (side === 0 ? -1 : 1);
          if (nr >= 0 && nr <= 7) {
            const col = oc & 7;
            let free = 0;
            if (pos.occ[nr * 8 + col] === -1) free++;
            if (col > 0 && pos.occ[nr * 8 + col - 1] === -1) free++;
            if (col < 7 && pos.occ[nr * 8 + col + 1] === -1) free++;
            s += (3 - free) * 40;
          }
          s += Math.abs((to >> 3) - ((m & 63) >> 3)) * 2;
        } else {
          s += 150;
        }
      }
      scores[i] = s;
    }
    for (let i = 1; i < n; i++) {
      const m = moves[i]!;
      const s = scores[i]!;
      let j = i - 1;
      while (j >= 0 && scores[j]! < s) {
        moves[j + 1] = moves[j]!;
        scores[j + 1] = scores[j]!;
        j--;
      }
      moves[j + 1] = m;
      scores[j + 1] = s;
    }
  }

  /** Alpha-beta (negamax with same-side continuation) from the side to move's view. */
  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    if (this.stopped) return 0;
    if ((++this.nodes & 1023) === 0 && this.timeUp()) return 0;
    const pos = this.pos;
    if (depth <= 0 || ply >= MAX_PLY - 1) return evaluate(pos, this.weights);

    const keyHi = pos.hashHi;
    const idx = pos.hashLo & TT_MASK;
    let best = 0;
    if (ttDepth[idx]! >= 0 && ttKey[idx] === keyHi) {
      best = ttMove[idx]!;
      if (ttDepth[idx]! >= depth) {
        let s = ttScore[idx]!;
        if (s > MATE_BOUND) s -= ply;
        else if (s < -MATE_BOUND) s += ply;
        const flag = ttFlag[idx]!;
        if (flag === EXACT) return s;
        if (flag === LOWER && s > alpha) alpha = s;
        else if (flag === UPPER && s < beta) beta = s;
        if (alpha >= beta) return s;
      }
    }

    const moves = this.moveBuf[ply]!;
    const n = pos.genMoves(moves);
    if (n === 0) return 0;
    this.order(ply, n, best);

    const side = pos.active;
    const alpha0 = alpha;
    let bestScore = -Infinity;
    let bestMove = moves[0]!;
    for (let i = 0; i < n; i++) {
      const m = moves[i]!;
      const winner = pos.make(m);
      let score: number;
      if (winner >= 0) {
        score = winner === side ? MATE - ply - 1 : -(MATE - ply - 1);
      } else if (pos.active === side) {
        score = this.negamax(depth - 1, alpha, beta, ply + 1);
      } else {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
        if (score > alpha) alpha = score;
        if (alpha >= beta) {
          this.history[m & 0x1fff]! += depth * depth;
          break;
        }
      }
    }

    // store
    let stored = bestScore;
    if (stored > MATE_BOUND) stored += ply;
    else if (stored < -MATE_BOUND) stored -= ply;
    if (ttDepth[idx]! < 0 || ttKey[idx] !== keyHi || depth >= ttDepth[idx]!) {
      ttKey[idx] = keyHi;
      ttDepth[idx] = depth;
      ttScore[idx] = stored;
      ttMove[idx] = bestMove;
      ttFlag[idx] = bestScore <= alpha0 ? UPPER : bestScore >= beta ? LOWER : EXACT;
    }
    return bestScore;
  }

  /** Score of playing `m` at the root, from the root side's view (full window unless given). */
  scoreRootMove(m: number, depth: number, alpha = -Infinity, beta = Infinity): number {
    const pos = this.pos;
    const side = pos.active;
    const winner = pos.make(m);
    let score: number;
    if (winner >= 0) {
      score = winner === side ? MATE - 1 : -(MATE - 1);
    } else if (pos.active === side) {
      score = this.negamax(depth - 1, alpha, beta, 1);
    } else {
      score = -this.negamax(depth - 1, -beta, -alpha, 1);
    }
    pos.unmake();
    return score;
  }
}

/** Iterative-deepening alpha-beta from `pos` (side to move = pos.active). */
export function findBestMove(pos: Position, opts: SearchOptions): SearchResult {
  const searcher = new Searcher(pos, opts.weights ?? DEFAULT_WEIGHTS);
  searcher.setDeadline(opts.timeMs);
  const rootMoves = new Int32Array(MAX_MOVES);
  const n = pos.genMoves(rootMoves);
  if (n === 0) return { move: -1, score: 0, depth: 0, nodes: 0 };
  const moves = Array.from(rootMoves.subarray(0, n));
  if (n === 1 && opts.skipForced) return { move: moves[0]!, score: 0, depth: 0, nodes: 0 };

  let bestMove = moves[0]!;
  let bestScore = 0;
  let completed = 0;
  for (let depth = 1; depth <= opts.maxDepth; depth++) {
    let iterBest = moves[0]!;
    let iterScore = -Infinity;
    let alpha = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      const score = searcher.scoreRootMove(moves[i]!, depth, alpha, Infinity);
      if (searcher.stopped) break;
      if (score > iterScore) {
        iterScore = score;
        iterBest = moves[i]!;
        if (score > alpha) alpha = score;
      }
    }
    if (searcher.stopped) break;
    bestMove = iterBest;
    bestScore = iterScore;
    completed = depth;
    // principal move first next iteration
    const at = moves.indexOf(iterBest);
    if (at > 0) {
      moves.splice(at, 1);
      moves.unshift(iterBest);
    }
    if (Math.abs(iterScore) >= MATE_BOUND) break;
  }
  return { move: bestMove, score: bestScore, depth: completed, nodes: searcher.nodes };
}

/** Exact (full-window) score of every root move at a fixed depth - used by the noisy, human-like levels. */
export function scoreRootMoves(pos: Position, depth: number, weights: EvalWeights = DEFAULT_WEIGHTS): { move: number; score: number }[] {
  const searcher = new Searcher(pos, weights);
  const buf = new Int32Array(MAX_MOVES);
  const n = pos.genMoves(buf);
  const out: { move: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    const move = buf[i]!;
    out.push({ move, score: searcher.scoreRootMove(move, depth) });
  }
  return out;
}
