/**
 * Round-robin between the AI levels. Every opening (two random plies) is played
 * twice with colours swapped, single-round games, depth-limited so results are
 * reproducible. Usage: npm run tournament -w @kamisado/ai -- [games=40] [seed=1]
 */
import { ALL_COLORS, GameStatus, MatchFormat, Move, PlayerSide, applyMove, createGame, getLegalMoves, handlePassOrDeadlock, GameState } from '@kamisado/engine';
import { BOT_LEVELS, BotLevel, MATE_BOUND, Position, chooseMove, findBestMove } from '../src/index.js';

function makeRng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function step(state: GameState, move: Move): GameState {
  const applied = applyMove(state, move);
  if (!applied.success || !applied.state) throw new Error('illegal bot move ' + JSON.stringify(move));
  let next = applied.state;
  if (next.status === GameStatus.IN_PROGRESS) next = handlePassOrDeadlock(next).state ?? next;
  return next;
}

function opening(rng: () => number, plies: number): GameState {
  // random opening plies; retry if the round happens to end inside the opening
  for (;;) {
    let state = createGame(MatchFormat.SINGLE_ROUND);
    for (let i = 0; i < plies && state.status === GameStatus.IN_PROGRESS; i++) {
      const colors = state.requiredColor ? [state.requiredColor] : ALL_COLORS;
      const moves = colors.flatMap((c) => getLegalMoves(state, c));
      state = step(state, moves[Math.floor(rng() * moves.length)]!);
    }
    if (state.status !== GameStatus.IN_PROGRESS) continue;
    // Only keep openings that are still open: no forced win/loss within 10 plies, so the
    // result depends on play quality rather than on the luck of the random opening.
    const probe = findBestMove(Position.fromState(state), { maxDepth: 10, timeMs: Infinity });
    if (Math.abs(probe.score) < MATE_BOUND) return state;
  }
}

function play(start: GameState, black: BotLevel, gold: BotLevel, rng: () => number): PlayerSide | null {
  let state = start;
  for (let ply = 0; ply < 300 && state.status === GameStatus.IN_PROGRESS; ply++) {
    const level = state.activePlayer === PlayerSide.BLACK ? black : gold;
    // Dragon Master is depth-capped at 12 here (its product cap is 20 within 1.5s) to keep the run short
    const move = chooseMove(state, level, { rng, deterministicDepth: true, override: level === 'DRAGON_MASTER' ? { depth: DRAGON_DEPTH } : undefined });
    if (!move) return null;
    state = step(state, move);
  }
  return state.status === GameStatus.IN_PROGRESS ? null : (state.roundWinner ?? null);
}

/** Lower bound of the 95% Wilson interval for a win rate. */
function wilsonLower(wins: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96;
  const p = wins / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
}

const openings = Number(process.argv[2] ?? 150);
const seed = Number(process.argv[3] ?? 1);
const DRAGON_DEPTH = Number(process.argv[4] ?? 12);
const rows: string[] = [];
let allPass = true;
for (let i = 0; i < BOT_LEVELS.length - 1; i++) {
  const weak = BOT_LEVELS[i]!;
  const strong = BOT_LEVELS[i + 1]!;
  const rng = makeRng(seed * 1000 + i);
  let strongWins = 0;
  let weakWins = 0;
  let unfinished = 0;
  const t0 = Date.now();
  for (let g = 0; g < openings; g++) {
    const start = opening(rng, 2);
    for (const strongIsBlack of [true, false]) {
      const winner = play(start, strongIsBlack ? strong : weak, strongIsBlack ? weak : strong, rng);
      if (winner === null) unfinished++;
      else if ((winner === PlayerSide.BLACK) === strongIsBlack) strongWins++;
      else weakWins++;
    }
  }
  const decided = strongWins + weakWins;
  const rate = decided ? strongWins / decided : 0;
  const lower = wilsonLower(strongWins, decided);
  // every step must be a clear, statistically real improvement (the Apprentice->Student step is huge; the
  // upper steps are smaller because a Kamisado round is short and depth saturates)
  const pass = rate >= 0.58 && lower > 0.5;
  if (!pass) allPass = false;
  rows.push(`${strong.padEnd(14)} beats ${weak.padEnd(13)} ${strongWins}-${weakWins}${unfinished ? ` (+${unfinished} unfinished)` : ''}  win rate ${(rate * 100).toFixed(0)}% (95% lower bound ${(lower * 100).toFixed(0)}%)  ${pass ? 'PASS' : 'FAIL'}  [${((Date.now() - t0) / 1000).toFixed(1)}s]`);
  console.log(rows[rows.length - 1]);
}
console.log(allPass ? '\nLadder gate: every level beats the one below it (win rate >= 58% with a 95% lower bound above 50%).' : '\nLadder gate FAILED.');
process.exit(allPass ? 0 : 1);
