import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_COLORS, GameStatus, MatchFormat, applyMove, createGame, getLegalMoves, handlePassOrDeadlock } from '@kamisado/engine';
import type { HistoryEntry } from '../state/useKamisadoGame.js';
import { clearSavedGame, loadSavedGame, rebuildSavedGame, saveGame } from './savedGame.js';
import { formatMove } from './notation.js';

// minimal localStorage for the node test environment
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

function playSome(plies: number) {
  const start = createGame(MatchFormat.STANDARD);
  let state = start;
  const history: HistoryEntry[] = [];
  for (let i = 0; i < plies && state.status === GameStatus.IN_PROGRESS; i++) {
    const colors = state.requiredColor ? [state.requiredColor] : ALL_COLORS;
    const move = colors.flatMap((c) => getLegalMoves(state, c))[0]!;
    let next = applyMove(state, move).state!;
    if (next.status === GameStatus.IN_PROGRESS) next = handlePassOrDeadlock(next).state ?? next;
    history.push({ move, notation: formatMove(i + 1, move, next.requiredColor), stateAfter: next });
    state = next;
  }
  return { start, state, history };
}

describe('saved game', () => {
  beforeEach(() => store.clear());
  const setup = { format: MatchFormat.STANDARD, black: 'HUMAN' as const, gold: 'RONIN' as const, blunderGuard: true };

  it('round-trips: replaying the saved moves reproduces the exact position and history', () => {
    const { start, state, history } = playSome(6);
    saveGame(setup, start, history);
    const loaded = loadSavedGame()!;
    expect(loaded.setup).toEqual(setup);
    const rebuilt = rebuildSavedGame(loaded)!;
    expect(rebuilt.state.towers).toEqual(state.towers);
    expect(rebuilt.state.requiredColor).toBe(state.requiredColor);
    expect(rebuilt.state.activePlayer).toBe(state.activePlayer);
    expect(rebuilt.history.map((h) => h.notation)).toEqual(history.map((h) => h.notation));
  });

  it('rejects a save containing an illegal move', () => {
    const { start, history } = playSome(4);
    saveGame(setup, start, history);
    const loaded = loadSavedGame()!;
    loaded.moves[1] = { ...loaded.moves[1]!, to: { row: 0, col: 0 } };
    expect(rebuildSavedGame(loaded)).toBeNull();
  });

  it('ignores garbage and can be cleared', () => {
    store.set('kamisado.savedGame.v1', '{not json');
    expect(loadSavedGame()).toBeNull();
    store.set('kamisado.savedGame.v1', JSON.stringify({ v: 2 }));
    expect(loadSavedGame()).toBeNull();
    const { start, history } = playSome(2);
    saveGame(setup, start, history);
    expect(loadSavedGame()).not.toBeNull();
    clearSavedGame();
    expect(loadSavedGame()).toBeNull();
  });
});
