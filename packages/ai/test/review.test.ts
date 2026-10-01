import { describe, expect, it } from 'vitest';
import { Color, GameState, GameStatus, MatchFormat, PlayerSide, createGame, getLegalMoves, handlePassOrDeadlock, towerId } from '@kamisado/engine';
import { chooseMove, reviewGame, reviewPly, summarizeReview, winChance } from '../src/index.js';
import { makeRng, refStep } from './helpers.js';

function place(state: GameState, side: PlayerSide, color: Color, row: number, col: number): GameState {
  const id = towerId(side, color);
  return { ...state, towers: { ...state.towers, [id]: { ...state.towers[id]!, position: { row, col } } } };
}

describe('review', () => {
  it('flags a missed forced win and rewards the winning move', () => {
    let s = createGame(MatchFormat.SINGLE_ROUND);
    s = place(s, PlayerSide.BLACK, Color.BROWN, 5, 4);
    s = place(s, PlayerSide.GOLD, Color.PURPLE, 1, 7);
    s = { ...s, activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN };
    const moves = getLegalMoves(s, Color.BROWN);
    const win = moves.find((m) => m.to.row === 7)!;
    const dawdle = moves.find((m) => m.to.row === 6 && m.to.col === 4)!;
    const good = reviewPly(s, win);
    expect(good.verdict).toBe('best');
    expect(good.bestMove).toBeNull();
    expect(good.blackAdvantage).toBe(1);
    const bad = reviewPly(s, dawdle);
    expect(bad.verdict === 'missed-win' || bad.verdict === 'blunder').toBe(true);
    expect(bad.bestMove?.to.row).toBe(7);
    expect(bad.loss).toBeGreaterThan(0.5);
  });

  it('calls a move that hands the opponent a forced win a blunder', () => {
    // Gold GREEN on (1,6) can slide home; landing Black on a GREEN square forces it.
    let s = createGame(MatchFormat.STANDARD);
    s = place(s, PlayerSide.GOLD, Color.GREEN, 1, 6);
    s = place(s, PlayerSide.BLACK, Color.BLUE, 3, 3);
    s = { ...s, activePlayer: PlayerSide.BLACK, requiredColor: Color.RED };
    const moves = getLegalMoves(s, Color.RED);
    const toGreen = moves.find((m) => m.to.row === 3 && m.to.col === 2)!;
    const r = reviewPly(s, toGreen);
    expect(r.verdict).toBe('blunder');
    expect(r.playedScore).toBeLessThan(-29000);
    expect(r.bestMove).not.toBeNull();
    // the suggested alternative is itself reviewed as best
    expect(reviewPly(s, r.bestMove!).verdict).toBe('best');
  });

  it('reviews a whole bot-vs-bot round consistently', () => {
    const rng = makeRng(8);
    let state = createGame(MatchFormat.SINGLE_ROUND);
    const states: GameState[] = [];
    const moves = [];
    for (let i = 0; i < 40 && state.status === GameStatus.IN_PROGRESS; i++) {
      const mv = chooseMove(state, i % 2 === 0 ? 'STUDENT' : 'RONIN', { rng, deterministicDepth: true })!;
      states.push(state);
      moves.push(mv);
      state = refStep(state, mv);
    }
    const progress: number[] = [];
    const reviews = reviewGame(states, moves, {}, (done) => progress.push(done));
    expect(reviews).toHaveLength(moves.length);
    expect(progress).toEqual(moves.map((_, i) => i + 1));
    for (const r of reviews) {
      expect(r.blackAdvantage).toBeGreaterThanOrEqual(-1);
      expect(r.blackAdvantage).toBeLessThanOrEqual(1);
      expect(r.loss).toBeGreaterThanOrEqual(0);
    }
    const sum = summarizeReview(reviews);
    expect(sum.BLACK.moves + sum.GOLD.moves).toBe(moves.length);
    expect(sum.BLACK.accuracy).toBeGreaterThanOrEqual(0);
    expect(sum.BLACK.accuracy).toBeLessThanOrEqual(100);
    void handlePassOrDeadlock;
  });

  it('a search-perfect player scores near-perfect accuracy', () => {
    const rng = makeRng(2);
    let state = createGame(MatchFormat.SINGLE_ROUND);
    // random opening ply for variety
    const first = getLegalMoves(state, state.towers.BLACK_BROWN!.color)[3]!;
    state = refStep(state, first);
    const states: GameState[] = [];
    const moves = [];
    for (let i = 0; i < 30 && state.status === GameStatus.IN_PROGRESS; i++) {
      const mv = chooseMove(state, 'DRAGON_MASTER', { rng, deterministicDepth: true, override: { depth: 8 } })!;
      states.push(state);
      moves.push(mv);
      state = refStep(state, mv);
    }
    const sum = summarizeReview(reviewGame(states, moves, { depth: 8 }));
    expect(sum.BLACK.accuracy).toBeGreaterThan(90);
    expect(sum.GOLD.accuracy).toBeGreaterThan(90);
  });

  it('winChance is monotone and bounded', () => {
    expect(winChance(0)).toBe(0);
    expect(winChance(100)).toBeGreaterThan(winChance(50));
    expect(winChance(1e5)).toBe(1);
    expect(winChance(-1e5)).toBe(-1);
  });
});
