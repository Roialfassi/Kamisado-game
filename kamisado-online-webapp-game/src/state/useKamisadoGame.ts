import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coordinate,
  GameState,
  GameStatus,
  MatchFormat,
  Move,
  MoveType,
  PlayerSide,
  applyClockIncrement,
  applyMove,
  checkTimeout,
  createGame,
  findTowerAt,
  getLegalMoves,
  handlePassOrDeadlock,
  reseatForNextRound,
  tickClock,
} from '@kamisado/engine';
import { BotLevel, requestBotMove, requestHint } from '../ai/botClient.js';
import { formatMove } from '../lib/notation.js';
import { TimeControlChoice } from '../lib/timeControl.js';
import { playPass, playPlace, playSumoPush, playVictory } from '../lib/sound.js';
import { resolveSelection } from '../lib/mustMove.js';
import { allowsImmediateLoss } from '../lib/moveSafety.js';
import { RebuiltGame, clearSavedGame, saveGame } from '../lib/savedGame.js';

export type Controller = 'HUMAN' | BotLevel;

export interface HistoryEntry {
  notation: string;
  move: Move;
  /** The full board state right after this entry (including any
   * auto-resolved pass chain) - lets a replay viewer jump to any ply without
   * re-simulating anything. */
  stateAfter: GameState;
}

export interface UseKamisadoGameOptions {
  format: MatchFormat;
  black: Controller;
  gold: Controller;
  timeControl?: TimeControlChoice;
  /** Ask before a move that hands the opponent an immediate win (single-human games). */
  blunderGuard?: boolean;
}

export interface KamisadoGameApi {
  state: GameState;
  history: HistoryEntry[];
  /** The board position at the start of the current round (ply 0 for the
   * replay viewer) - reset on restart and at the start of each round. */
  roundStartState: GameState;
  /** The square that reads as "clicked": the player's click, or - on a forced
   * turn - the tower the colour lock makes them move. */
  selected: Coordinate | null;
  legalDestinations: Move[];
  lastEvent: 'PASS' | 'DEADLOCK' | 'ROUND_OVER' | 'MATCH_OVER' | null;
  isHumanTurn: boolean;
  /** A bot is currently searching for its move. */
  botThinking: boolean;
  selectSquare: (coord: Coordinate) => void;
  /** Starts the next round - every tower returns to its own colour square. */
  startNextRound: () => void;
  restart: () => void;
  // ---- assists ----
  /** Take back your last move (and the bot's reply to it). Untimed games only. */
  canUndo: boolean;
  undo: () => void;
  /** Ask the engine for the best move (single-human games). */
  canHint: boolean;
  hint: Move | null;
  hintBusy: boolean;
  requestMoveHint: () => void;
  /** A move the blunder guard is holding back until the player confirms. */
  pendingMove: Move | null;
  confirmPendingMove: () => void;
  cancelPendingMove: () => void;
}

function controllerFor(state: GameState, options: UseKamisadoGameOptions): Controller {
  return state.activePlayer === PlayerSide.BLACK ? options.black : options.gold;
}

const BOT_MIN_DELAY_MS = 450;

export function useKamisadoGame(options: UseKamisadoGameOptions, resume?: RebuiltGame | null): KamisadoGameApi {
  const [state, setState] = useState<GameState>(() => resume?.state ?? createGame(options.format, options.timeControl?.initialMs ?? 0));
  const [roundStartState, setRoundStartState] = useState<GameState>(() => resume?.roundStartState ?? state);
  const [history, setHistory] = useState<HistoryEntry[]>(() => resume?.history ?? []);
  // Only the player's explicit click; the forced tower is auto-selected on top
  // of this (see `selected` below) so the colour lock is visible without a click.
  const [explicitSelected, setSelected] = useState<Coordinate | null>(null);
  const [lastEvent, setLastEvent] = useState<KamisadoGameApi['lastEvent']>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [hint, setHint] = useState<Move | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [pendingMove, setPendingMove] = useState<Move | null>(null);
  const moveCounter = useRef((resume?.history.length ?? 0) + 1);

  const bothHuman = options.black === 'HUMAN' && options.gold === 'HUMAN';
  const humanSides = useMemo(
    () => [options.black === 'HUMAN' ? PlayerSide.BLACK : null, options.gold === 'HUMAN' ? PlayerSide.GOLD : null].filter((s): s is PlayerSide => s !== null),
    [options.black, options.gold],
  );

  /** Everything that changes when the *position* changes (but not when only the clocks tick). */
  const positionKey = `${state.currentRound}|${history.length}|${state.status}|${state.activePlayer}|${state.requiredColor}`;

  const clearTransient = useCallback(() => {
    setSelected(null);
    setHint(null);
    setPendingMove(null);
  }, []);

  const restart = useCallback(() => {
    const fresh = createGame(options.format, options.timeControl?.initialMs ?? 0);
    setState(fresh);
    setRoundStartState(fresh);
    setHistory([]);
    clearTransient();
    setLastEvent(null);
    moveCounter.current = 1;
    clearSavedGame();
  }, [options.format, options.timeControl, clearTransient]);

  const applyTimeout = useCallback(
    (timedOut: NonNullable<ReturnType<typeof checkTimeout>>) => {
      if (!timedOut.state) return false;
      setState(timedOut.state);
      clearTransient();
      setLastEvent(timedOut.state.status === GameStatus.MATCH_OVER ? 'MATCH_OVER' : 'ROUND_OVER');
      playVictory();
      return true;
    },
    [clearTransient],
  );

  const commitMove = useCallback(
    (move: Move) => {
      // Deliberately not a setState functional-updater: this reads `state`
      // from the render closure and performs real side effects (sound,
      // history, ref-counter mutation) exactly once per call. Doing that
      // inside a setState(prev => ...) updater is unsafe - React 18
      // StrictMode invokes updaters twice in development to check purity,
      // which previously double-recorded every move.
      let before = state;
      if (options.timeControl) {
        const timedOut = checkTimeout(before, Date.now());
        if (timedOut) {
          applyTimeout(timedOut);
          return;
        }
        before = tickClock(before, Date.now());
      }

      const applied = applyMove(before, move);
      if (!applied.success || !applied.state) return;

      let next = applied.state;
      if (options.timeControl && options.timeControl.incrementMs > 0 && next.status === GameStatus.IN_PROGRESS) {
        next = applyClockIncrement(next, move.playerSide, options.timeControl.incrementMs);
      }

      if (move.type === MoveType.SUMO_PUSH) playSumoPush();
      else playPlace();

      if (next.status === GameStatus.IN_PROGRESS) {
        const resolved = handlePassOrDeadlock(next);
        if (resolved.state) {
          if (resolved.state.lastMove && resolved.state.lastMove.type === MoveType.PASS && resolved.state.lastMove !== next.lastMove) {
            playPass();
          }
          next = resolved.state;
          if (resolved.isRoundOver) {
            setLastEvent(next.roundOverReason === 'DEADLOCK' ? 'DEADLOCK' : 'ROUND_OVER');
            playVictory();
          }
        }
      } else {
        setLastEvent(next.status === GameStatus.MATCH_OVER ? 'MATCH_OVER' : 'ROUND_OVER');
        playVictory();
      }

      const entries: HistoryEntry[] = [{ move, notation: formatMove(moveCounter.current++, move, next.requiredColor), stateAfter: next }];
      setHistory((h) => [...h, ...entries]);
      setState(next);
      clearTransient();
    },
    [state, options.timeControl, applyTimeout, clearTransient],
  );

  // The bot effect must call the *latest* commitMove without re-running whenever it changes.
  const commitRef = useRef(commitMove);
  commitRef.current = commitMove;
  const stateRef = useRef(state);
  stateRef.current = state;
  const positionKeyRef = useRef(positionKey);
  positionKeyRef.current = positionKey;

  const canAct = state.status === GameStatus.IN_PROGRESS && controllerFor(state, options) === 'HUMAN';
  const selected = useMemo(() => resolveSelection(state, explicitSelected, canAct), [state, explicitSelected, canAct]);

  const legalDestinations = useMemo<Move[]>(() => {
    if (!selected) return [];
    const tower = findTowerAt(state, selected.row, selected.col);
    if (!tower || tower.side !== state.activePlayer) return [];
    return getLegalMoves(state, tower.color);
  }, [state, selected]);

  const selectSquare = useCallback(
    (coord: Coordinate) => {
      if (state.status !== GameStatus.IN_PROGRESS || pendingMove) return;
      const controller = controllerFor(state, options);
      if (controller !== 'HUMAN') return;

      if (selected) {
        const match = legalDestinations.find((m) => m.to.row === coord.row && m.to.col === coord.col);
        if (match) {
          if (options.blunderGuard && !bothHuman && allowsImmediateLoss(state, match)) {
            setHint(null);
            setPendingMove(match);
            return;
          }
          commitMove(match);
          return;
        }
      }

      const tower = findTowerAt(state, coord.row, coord.col);
      if (!tower || tower.side !== state.activePlayer) {
        setSelected(null);
        return;
      }
      if (state.requiredColor !== null && tower.color !== state.requiredColor) {
        setSelected(null);
        return;
      }
      setSelected(coord);
    },
    [state, selected, legalDestinations, commitMove, options, pendingMove, bothHuman],
  );

  const confirmPendingMove = useCallback(() => {
    if (pendingMove) commitMove(pendingMove);
  }, [pendingMove, commitMove]);
  const cancelPendingMove = useCallback(() => setPendingMove(null), []);

  const startNextRound = useCallback(() => {
    // Ignore double-clicks: only a finished (non-final) round can be restarted.
    if (state.status !== GameStatus.ROUND_OVER) return;
    // Timed games: every round gets a fresh clock, so a player who flagged
    // doesn't open the next round with 0:00 and lose it instantly.
    const next = reseatForNextRound(state, options.timeControl?.initialMs);
    setState(next);
    setRoundStartState(next);
    setHistory([]);
    clearTransient();
    setLastEvent(null);
    moveCounter.current = 1;
  }, [state, options.timeControl, clearTransient]);

  // ---- undo ----------------------------------------------------------
  const undoTarget = useMemo(() => {
    if (options.timeControl || history.length === 0 || humanSides.length === 0) return null;
    let i = history.length;
    if (!bothHuman) {
      // drop the bot's reply(ies), then the human's own last move
      while (i > 0 && !humanSides.includes(history[i - 1]!.move.playerSide)) i--;
      if (i === 0) return null; // the human hasn't moved yet this round
    }
    return i - 1; // keep history[0 .. i-2]
  }, [history, humanSides, bothHuman, options.timeControl]);

  const canUndo = undoTarget !== null && !botThinking;

  const undo = useCallback(() => {
    if (undoTarget === null || botThinking) return;
    const kept = history.slice(0, undoTarget);
    const restored = kept.length > 0 ? kept[kept.length - 1]!.stateAfter : roundStartState;
    setHistory(kept);
    setState({ ...restored, lastClockUpdate: Date.now() });
    clearTransient();
    setLastEvent(null);
    moveCounter.current = kept.length + 1;
  }, [undoTarget, botThinking, history, roundStartState, clearTransient]);

  // ---- hint ----------------------------------------------------------
  const canHint = canAct && !bothHuman && !pendingMove;
  const requestMoveHint = useCallback(() => {
    if (!canHint || hintBusy) return;
    const askedAt = positionKey;
    setHintBusy(true);
    requestHint(state)
      .then((move) => {
        // ignore the answer if the position moved on (a move, an undo...) while it was thinking
        if (positionKeyRef.current === askedAt) setHint(move);
      })
      .finally(() => setHintBusy(false));
  }, [canHint, hintBusy, state, positionKey]);

  // a hint / pending confirmation is only valid for the position it was made in
  useEffect(() => {
    setHint(null);
    setPendingMove(null);
  }, [positionKey]);

  // ---- autonomous bot turns -----------------------------------------
  useEffect(() => {
    const current = stateRef.current;
    if (current.status !== GameStatus.IN_PROGRESS) {
      setBotThinking(false);
      return;
    }
    const controller = controllerFor(current, options);
    if (controller === 'HUMAN') {
      setBotThinking(false);
      return;
    }
    let cancelled = false;
    setBotThinking(true);
    const started = performance.now();
    requestBotMove(current, controller)
      .then(async (move) => {
        const wait = BOT_MIN_DELAY_MS - (performance.now() - started);
        if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
        if (cancelled) return;
        setBotThinking(false);
        if (move) commitRef.current(move);
      })
      .catch(() => {
        if (!cancelled) setBotThinking(false);
      });
    return () => {
      cancelled = true;
    };
    // The position key covers every state change that matters (clock ticks must not restart a search).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionKey, options.black, options.gold]);

  // ---- live clock ----------------------------------------------------
  // Ticks the display every 500ms and independently detects a timeout even if
  // the flagged player never submits another move.
  useEffect(() => {
    if (!options.timeControl || state.status !== GameStatus.IN_PROGRESS) return;
    const interval = window.setInterval(() => {
      const timedOut = checkTimeout(stateRef.current, Date.now());
      if (timedOut) {
        applyTimeout(timedOut);
        return;
      }
      setState(tickClock(stateRef.current, Date.now()));
    }, 500);
    return () => window.clearInterval(interval);
  }, [state.status, options.timeControl, applyTimeout]);

  // ---- autosave (untimed games only) --------------------------------
  useEffect(() => {
    if (options.timeControl) return;
    if (state.status === GameStatus.MATCH_OVER) {
      clearSavedGame();
      return;
    }
    if (history.length === 0 && state.currentRound === 1) return;
    saveGame({ format: options.format, black: options.black, gold: options.gold, blunderGuard: !!options.blunderGuard }, roundStartState, history);
  }, [history, roundStartState, state.status, state.currentRound, options.format, options.black, options.gold, options.blunderGuard, options.timeControl]);

  return {
    state,
    history,
    roundStartState,
    selected,
    legalDestinations,
    lastEvent,
    isHumanTurn: canAct,
    botThinking,
    selectSquare,
    startNextRound,
    restart,
    canUndo,
    undo,
    canHint,
    hint,
    hintBusy,
    requestMoveHint,
    pendingMove,
    confirmPendingMove,
    cancelPendingMove,
  };
}
