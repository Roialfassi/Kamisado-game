/** Ad-hoc A/B between two search configs: tsx scripts/matchup.ts '{"depth":4,"noise":20}' '{"depth":8,"noise":0}' [openings=40] [openingPlies=2] */
import { ALL_COLORS, GameState, GameStatus, MatchFormat, Move, PlayerSide, applyMove, createGame, getLegalMoves, handlePassOrDeadlock } from '@kamisado/engine';
import { MATE_BOUND, Position, chooseMove, findBestMove } from '../src/index.js';
import type { LevelConfig } from '../src/index.js';

function makeRng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function step(state: GameState, move: Move): GameState {
  const applied = applyMove(state, move);
  if (!applied.success || !applied.state) throw new Error('illegal');
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
const [a, b] = [JSON.parse(process.argv[2]!) as Partial<LevelConfig>, JSON.parse(process.argv[3]!) as Partial<LevelConfig>];
const openings = Number(process.argv[4] ?? 40);
const plies = Number(process.argv[5] ?? 2);
const rng = makeRng(12345);
let aw = 0, bw = 0, un = 0, total = 0, games = 0, deadlocks = 0;
const t0 = Date.now();
for (let g = 0; g < openings; g++) {
  const start = opening(rng, plies);
  for (const aBlack of [true, false]) {
    let state = start; let n = 0;
    while (state.status === GameStatus.IN_PROGRESS && n < 300) {
      const isA = (state.activePlayer === PlayerSide.BLACK) === aBlack;
      const level = (isA ? a : b);
      const move = chooseMove(state, 'DRAGON_MASTER', { rng, deterministicDepth: true, override: { depth: 30, noise: 0, ...level } });
      state = step(state, move!); n++;
    }
    total += n; games++;
    if (state.status === GameStatus.IN_PROGRESS) un++;
    else { if (state.roundOverReason === 'DEADLOCK') deadlocks++; if ((state.roundWinner === PlayerSide.BLACK) === aBlack) aw++; else bw++; }
  }
}
const rate = aw / Math.max(1, aw + bw);
console.log(`A ${process.argv[2]} vs B ${process.argv[3]}: A ${aw} - B ${bw}${un ? ` (+${un} unfinished)` : ''}, A wins ${(rate * 100).toFixed(0)}%, avg plies ${(total / games).toFixed(1)}, deadlocks ${deadlocks}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
