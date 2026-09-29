import { ALL_COLORS, GameStatus, MatchFormat, applyMove, createGame, getLegalMoves, handlePassOrDeadlock } from '@kamisado/engine';
import { MATE_BOUND, Position, clearTranspositionTable, findBestMove } from '../src/index.js';

function makeRng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function opening(seed: number, plies: number) {
  const rng = makeRng(seed);
  let state = createGame(MatchFormat.STANDARD);
  for (let i = 0; i < plies; i++) {
    const colors = state.requiredColor ? [state.requiredColor] : ALL_COLORS;
    const moves = colors.flatMap((c) => getLegalMoves(state, c));
    // prefer short steps so the round doesn't end quickly
    moves.sort((a, b) => Math.abs(a.to.row - a.from.row) - Math.abs(b.to.row - b.from.row));
    const applied = applyMove(state, moves[Math.floor(rng() * Math.min(4, moves.length))]!);
    state = applied.state!;
    if (state.status === GameStatus.IN_PROGRESS) state = handlePassOrDeadlock(state).state ?? state;
    if (state.status !== GameStatus.IN_PROGRESS) return null;
  }
  return state;
}

const depths = [12, 16, 20, 24];
const totals = new Map<number, { nodes: number; ms: number; n: number; reached: number }>();
let used = 0;
for (let seed = 1; seed < 60 && used < 8; seed++) {
  const state = opening(seed, 8);
  if (!state) continue;
  const probe = findBestMove(Position.fromState(state), { maxDepth: 6, timeMs: 5000 });
  if (Math.abs(probe.score) >= MATE_BOUND) continue; // skip already-decided positions
  used++;
  for (const depth of depths) {
    clearTranspositionTable();
    const t0 = performance.now();
    const r = findBestMove(Position.fromState(state), { maxDepth: depth, timeMs: 15000 });
    const ms = performance.now() - t0;
    const tot = totals.get(depth) ?? { nodes: 0, ms: 0, n: 0, reached: 0 };
    tot.nodes += r.nodes; tot.ms += ms; tot.n++; tot.reached += r.depth;
    totals.set(depth, tot);
  }
}
console.log(`averaged over ${used} undecided middlegame positions`);
for (const depth of depths) {
  const t = totals.get(depth)!;
  console.log(`maxDepth ${String(depth).padStart(2)}: avg ${(t.ms / t.n).toFixed(0).padStart(6)} ms, ${(t.nodes / t.n).toFixed(0).padStart(9)} nodes, ${(t.nodes / t.ms / 1000).toFixed(2)} Mnodes/s (reached ${(t.reached / t.n).toFixed(1)})`);
}
