import { describe, expect, it } from 'vitest';
import { GameStatus, PlayerSide } from '@kamisado/engine';
import { PUZZLES, puzzleForToday } from './data.js';
import { shortestForcedWin, winningFirstMoves } from './solver.js';

describe('puzzle catalogue is machine-verified against the engine', () => {
  for (const puzzle of PUZZLES) {
    it(`${puzzle.id}: forced win in exactly ${puzzle.mateIn} with a unique first move`, () => {
      const state = puzzle.build();
      expect(state.status).toBe(GameStatus.IN_PROGRESS);
      expect(state.activePlayer).toBe(PlayerSide.BLACK);
      expect(shortestForcedWin(state, puzzle.mateIn)).toBe(puzzle.mateIn);
      expect(winningFirstMoves(state, puzzle.mateIn)).toHaveLength(1);
    });
  }

  it('ids are unique and today\'s puzzle always resolves', () => {
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    expect(PUZZLES).toContain(puzzleForToday(new Date('2026-09-29T12:00:00Z')));
  });
});
