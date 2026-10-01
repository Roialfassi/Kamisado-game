import { describe, expect, it } from 'vitest';
import { GameStatus, MatchFormat, Move, PlayerSide, createGame, GameState } from '@kamisado/engine';
import { BOT_LEVELS, BotLevel, analyze, chooseMove } from '../src/index.js';
import { densePosition, makeRng, pushPosition, randomPosition, refMoves, refStep } from './helpers.js';
import { handlePassOrDeadlock } from '@kamisado/engine';

function resolved(state: GameState): GameState | null {
  const r = handlePassOrDeadlock(state);
  const s = r.state ?? state;
  return s.status === GameStatus.IN_PROGRESS ? s : null;
}

describe('bot levels', () => {
  it('every level always returns a legal move (opening, random, push-heavy and dense positions)', () => {
    const rng = makeRng(77);
    const states: GameState[] = [createGame(MatchFormat.STANDARD)];
    for (let i = 0; i < 40; i++) {
      const s = resolved(i % 3 === 0 ? densePosition(rng) : i % 3 === 1 ? pushPosition(rng) : randomPosition(rng, { sumo: true }));
      if (s) states.push(s);
    }
    for (const state of states) {
      const legal = refMoves(state);
      for (const level of BOT_LEVELS) {
        const move = chooseMove(state, level, { rng, deterministicDepth: true, strict: true, override: level === 'DRAGON_MASTER' ? { depth: 6 } : undefined });
        expect(move, level).not.toBeNull();
        expect(legal.some((m) => m.from.row === move!.from.row && m.from.col === move!.from.col && m.to.row === move!.to.row && m.to.col === move!.to.col && m.type === move!.type)).toBe(true);
      }
    }
  });

  it('is reproducible for a given random seed', () => {
    const state = resolved(randomPosition(makeRng(3)))!;
    for (const level of BOT_LEVELS) {
      const a = chooseMove(state, level, { rng: makeRng(9), deterministicDepth: true, strict: true, override: { depth: Math.min(6, level === 'APPRENTICE' ? 6 : 6) } });
      const b = chooseMove(state, level, { rng: makeRng(9), deterministicDepth: true, strict: true, override: { depth: 6 } });
      expect(a).toEqual(b);
    }
  });

  it('every level except the Apprentice reliably takes a win in one', () => {
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
    const rng = makeRng(1);
    for (const level of BOT_LEVELS.filter((l) => l !== 'APPRENTICE')) {
      for (let i = 0; i < 20; i++) {
        const m = chooseMove(state, level, { rng, deterministicDepth: true, strict: true, override: level === 'DRAGON_MASTER' ? { depth: 4 } : undefined })!;
        expect(m.to.row, level).toBe(7);
      }
    }
  });

  it('never walks into a loss in one when a safe move exists (Student and above)', () => {
    const rng = makeRng(31);
    let checked = 0;
    for (let i = 0; i < 400 && checked < 60; i++) {
      const state = resolved(randomPosition(rng));
      if (!state) continue;
      const moves = refMoves(state);
      // moves after which the opponent can win at once
      const losing = (m: Move) => {
        const next = refStep(state, m);
        if (next.status !== GameStatus.IN_PROGRESS) return next.roundWinner !== state.activePlayer;
        if (next.activePlayer === state.activePlayer) return false; // opponent was stymied: I move again
        return refMoves(next).some((r) => {
          const after = refStep(next, r);
          return after.status !== GameStatus.IN_PROGRESS && after.roundWinner === next.activePlayer;
        });
      };
      const safe = moves.filter((m) => !losing(m));
      if (safe.length === 0 || safe.length === moves.length) continue;
      checked++;
      for (const level of ['STUDENT', 'RONIN', 'SAMURAI'] as BotLevel[]) {
        const chosen = chooseMove(state, level, { rng, deterministicDepth: true, strict: true })!;
        expect(losing(chosen), `${level} blundered a loss in one`).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('analyze() returns the best move and a mate score for a forced win', () => {
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
    const a = analyze(state, { maxDepth: 4, timeMs: 200 });
    expect(a.move?.to.row).toBe(7);
    expect(a.score).toBeGreaterThan(29000);
  });
});
