import { BOARD_LAYOUT, GameState, GameStatus, MatchFormat, Move, applyMove, createGame, handlePassOrDeadlock } from '@kamisado/engine';
import { BOT_LEVELS } from '@kamisado/ai/levels';
import type { BotLevel } from '@kamisado/ai/levels';
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

const MAX_SAVED_MOVES = 2000;
const CONTROLLERS: string[] = ['HUMAN', ...BOT_LEVELS];

function isSetup(x: unknown): x is SavedSetup {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    Object.values(MatchFormat).includes(s.format as MatchFormat) &&
    CONTROLLERS.includes(s.black as string) &&
    CONTROLLERS.includes(s.gold as string) &&
    (s.black === 'HUMAN' || s.gold === 'HUMAN') &&
    typeof s.blunderGuard === 'boolean'
  );
}

/** A saved round-start position must be a sane, in-progress state of the real board:
 * anything else is treated as corrupt (the moves are additionally replayed by the engine). */
function isRoundStart(x: unknown, format: MatchFormat): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const s = x as GameState;
  if (s.status !== GameStatus.IN_PROGRESS || s.matchFormat !== format) return false;
  if (typeof s.currentRound !== 'number' || !Number.isInteger(s.currentRound) || s.currentRound < 1) return false;
  if (JSON.stringify(s.boardLayout) !== JSON.stringify(BOARD_LAYOUT)) return false;
  if (s.activePlayer !== 'BLACK' && s.activePlayer !== 'GOLD') return false;
  if (!s.scores || !s.scores.BLACK || !s.scores.GOLD || typeof s.scores.BLACK.points !== 'number' || typeof s.scores.GOLD.points !== 'number') return false;
  const reference = createGame(format).towers;
  const ids = Object.keys(reference);
  if (!s.towers || Object.keys(s.towers).length !== ids.length) return false;
  const cells = new Set<string>();
  for (const id of ids) {
    const t = s.towers[id];
    const r = reference[id]!;
    if (!t || t.side !== r.side || t.color !== r.color || ![0, 1, 2, 3].includes(t.sumoRank)) return false;
    const { row, col } = t.position ?? {};
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) return false;
    cells.add(`${row},${col}`);
  }
  return cells.size === ids.length; // no two towers on one square
}

function isValidSave(x: unknown): x is SavedGame {
  if (!x || typeof x !== 'object') return false;
  const s = x as SavedGame;
  return s.v === 1 && isSetup(s.setup) && Array.isArray(s.moves) && s.moves.length <= MAX_SAVED_MOVES && isRoundStart(s.roundStart, s.setup.format);
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSave(parsed)) {
      clearSavedGame(); // corrupt or foreign data: drop it instead of tripping over it on every visit
      return null;
    }
    return parsed;
  } catch {
    clearSavedGame();
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
    if (!isValidSave(saved)) return null;
    let state = saved.roundStart;
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
