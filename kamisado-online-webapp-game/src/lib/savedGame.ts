import { GameState, GameStatus, MatchFormat, Move, applyMove, handlePassOrDeadlock } from '@kamisado/engine';
import type { BotLevel } from '@kamisado/ai';
import { formatMove } from './notation.js';
import type { HistoryEntry } from '../state/useKamisadoGame.js';

/** Autosave of an in-progress (untimed) game so a refresh or a break doesn't lose it.
 * Only the round-start position and the moves are stored; the rest is replayed
 * through the real engine on load, so a corrupt or tampered save is rejected
 * rather than trusted. */
export interface SavedSetup {
  format: MatchFormat;
  black: 'HUMAN' | BotLevel;
  gold: 'HUMAN' | BotLevel;
  blunderGuard: boolean;
}

export interface SavedGame {
  v: 1;
  savedAt: number;
  setup: SavedSetup;
  roundStart: GameState;
  moves: Move[];
}

const KEY = 'kamisado.savedGame.v1';

export function saveGame(setup: SavedSetup, roundStart: GameState, history: HistoryEntry[]): void {
  try {
    const payload: SavedGame = { v: 1, savedAt: Date.now(), setup, roundStart, moves: history.map((h) => h.move) };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // private browsing / quota: the game just won't be resumable
  }
}

export function clearSavedGame(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGame;
    if (parsed?.v !== 1 || !parsed.setup || !parsed.roundStart || !Array.isArray(parsed.moves)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface RebuiltGame {
  state: GameState;
  roundStartState: GameState;
  history: HistoryEntry[];
}

/** Replays the saved moves through the engine. Returns null if any move is illegal. */
export function rebuildSavedGame(saved: SavedGame): RebuiltGame | null {
  try {
    let state = saved.roundStart;
    if (state.status !== GameStatus.IN_PROGRESS) return null;
    const history: HistoryEntry[] = [];
    for (const move of saved.moves) {
      const applied = applyMove(state, move);
      if (!applied.success || !applied.state) return null;
      let next = applied.state;
      if (next.status === GameStatus.IN_PROGRESS) next = handlePassOrDeadlock(next).state ?? next;
      history.push({ move, notation: formatMove(history.length + 1, move, next.requiredColor), stateAfter: next });
      state = next;
    }
    return { state, roundStartState: saved.roundStart, history };
  } catch {
    return null;
  }
}
