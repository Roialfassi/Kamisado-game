import { describe, expect, it } from 'vitest';
import { GameState, GameStatus, MatchFormat, PlayerSide, createGame, handlePassOrDeadlock } from '@kamisado/engine';
import { MATE_BOUND, Position, clearTranspositionTable, findBestMove, sideIndex } from '../src/index.js';
import { densePosition, makeRng, pushPosition, randomPosition, refMoves, refStep } from './helpers.js';

const enc = (m: { from: { row: number; col: number }; to: { row: number; col: number }; type: string }) =>
  m.from.row * 8 + m.from.col + ((m.to.row * 8 + m.to.col) << 6) + (m.type === 'SUMO_PUSH' ? 1 << 12 : 0);

/** Reference brute force: can `attacker` force a round win within `k` physical moves? */
function forcedWin(state: GameState, k: number, attacker: PlayerSide): boolean {
  const moves = refMoves(state);
  const attackerToMove = state.activePlayer === attacker;
  if (moves.length === 0) return false;
  for (const m of moves) {
    const next = refStep(state, m);
    let result: boolean;
    if (next.status !== GameStatus.IN_PROGRESS) result = next.roundWinner === attacker;
    else result = k > 1 && forcedWin(next, k - 1, attacker);
    if (attackerToMove && result) return true;
    if (!attackerToMove && !result) return false;
  }
  return !attackerToMove;
}

function resolved(state: GameState): GameState | null {
  const r = handlePassOrDeadlock(state);
  const s = r.state ?? state;
  return s.status === GameStatus.IN_PROGRESS ? s : null;
}

describe('search', () => {
  it('finds a forced win/loss within N plies exactly when brute force does (300 random positions, depth 1-4)', () => {
    const rng = makeRng(2024);
    let wins = 0;
    let losses = 0;
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const raw = i % 3 === 0 ? densePosition(rng) : i % 3 === 1 ? pushPosition(rng) : randomPosition(rng, { sumo: i % 2 === 0 });
      const state = resolved(raw);
      if (!state) continue;
      const depth = 1 + (i % 4);
      clearTranspositionTable();
      const pos = Position.fromState(state);
      const result = findBestMove(pos, { maxDepth: depth, timeMs: Infinity });
      const me = state.activePlayer;
      const opp = me === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK;
      const refWin = forcedWin(state, depth, me);
      const refLoss = !refWin && forcedWin(state, depth, opp);
      if (result.move === -1) continue;
      checked++;
      // search only *stops early* on a win, so a win/loss score at maxDepth must match exactly
      expect(result.score > MATE_BOUND, `win mismatch @${i} depth ${depth}`).toBe(refWin);
      if (!refWin) expect(result.score < -MATE_BOUND, `loss mismatch @${i} depth ${depth}`).toBe(refLoss);
      if (refWin) wins++;
      if (refLoss) losses++;
      if (refWin) {
        // the recommended move must really be a winning move: after it, the attacker still forces the win
        const legal = refMoves(state);
        const chosen = legal.find((m) => enc(m) === result.move)!;
        const next = refStep(state, chosen);
        const ok = next.status !== GameStatus.IN_PROGRESS ? next.roundWinner === me : forcedWin(next, depth - 1, me);
        expect(ok, `recommended move does not win @${i}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(wins).toBeGreaterThan(20);
    expect(losses).toBeGreaterThan(5);
    console.log(`  checked=${checked} forced wins=${wins} forced losses=${losses}`);
  });

  it('transposition table does not change results (same position, TT warm vs cold)', () => {
    const rng = makeRng(5);
    for (let i = 0; i < 40; i++) {
      const state = resolved(randomPosition(rng, { sumo: i % 2 === 0 }));
      if (!state) continue;
      clearTranspositionTable();
      const cold = findBestMove(Position.fromState(state), { maxDepth: 5, timeMs: Infinity });
      const warm = findBestMove(Position.fromState(state), { maxDepth: 5, timeMs: Infinity }); // table now full
      expect(warm.score).toBe(cold.score);
    }
  });

  it('takes a win in one and dodges a loss in one', () => {
    // Black BROWN is on (5,4) with a clear slide to row 7: winning move must be chosen at any depth.
    let state = createGame(MatchFormat.SINGLE_ROUND);
    state = {
      ...state,
      towers: {
        ...state.towers,
        BLACK_BROWN: { ...state.towers.BLACK_BROWN!, position: { row: 5, col: 4 } },
        GOLD_PURPLE: { ...state.towers.GOLD_PURPLE!, position: { row: 1, col: 7 } },
      },
      activePlayer: PlayerSide.BLACK,
      requiredColor: state.towers.BLACK_BROWN!.color,
    };
    for (const depth of [1, 3, 6]) {
      const r = findBestMove(Position.fromState(state), { maxDepth: depth, timeMs: Infinity });
      expect(r.score).toBeGreaterThan(MATE_BOUND);
      expect((r.move >> 6 & 63) >> 3).toBe(7);
    }
  });

  it('respects the time budget', () => {
    const state = createGame(MatchFormat.STANDARD);
    const t0 = performance.now();
    const r = findBestMove(Position.fromState(state), { maxDepth: 40, timeMs: 150 });
    const took = performance.now() - t0;
    expect(took).toBeLessThan(600);
    expect(r.move).toBeGreaterThanOrEqual(0);
    expect(r.depth).toBeGreaterThanOrEqual(1);
    void sideIndex;
  });
});
