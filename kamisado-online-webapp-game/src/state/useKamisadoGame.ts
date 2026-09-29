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
import { BotTier, chooseBotMove } from '../ai/bot.js';
import { formatMove } from '../lib/notation.js';
import { TimeControlChoice } from '../lib/timeControl.js';
import { playPass, playPlace, playSumoPush, playVictory } from '../lib/sound.js';
import { resolveSelection } from '../lib/mustMove.js';

export type Controller = 'HUMAN' | BotTier;

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
  selectSquare: (coord: Coordinate) => void;
  /** Starts the next round - every tower returns to its own colour square. */
  startNextRound: () => void;
  restart: () => void;
}

function controllerFor(state: GameState, options: UseKamisadoGameOptions): Controller {
  return state.activePlayer === PlayerSide.BLACK ? options.black : options.gold;
}

export function useKamisadoGame(options: UseKamisadoGameOptions): KamisadoGameApi {
  const [state, setState] = useState<GameState>(() => createGame(options.format, options.timeControl?.initialMs ?? 0));
  const [roundStartState, setRoundStartState] = useState<GameState>(state);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Only the player's explicit click; the forced tower is auto-selected on top
  // of this (see `selected` below) so the colour lock is visible without a click.
  const [explicitSelected, setSelected] = useState<Coordinate | null>(null);
  const [lastEvent, setLastEvent] = useState<KamisadoGameApi['lastEvent']>(null);
  const moveCounter = useRef(1);

  const restart = useCallback(() => {
    const fresh = createGame(options.format, options.timeControl?.initialMs ?? 0);
    setState(fresh);
    setRoundStartState(fresh);
    setHistory([]);
    setSelected(null);
    setLastEvent(null);
    moveCounter.current = 1;
  }, [options.format, options.timeControl]);

  const applyTimeout = useCallback((timedOut: NonNullable<ReturnType<typeof checkTimeout>>) => {
    if (!timedOut.state) return false;
    setState(timedOut.state);
    setSelected(null);
    setLastEvent(timedOut.state.status === GameStatus.MATCH_OVER ? 'MATCH_OVER' : 'ROUND_OVER');
    playVictory();
    return true;
  }, []);

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
      setSelected(null);
    },
    [state, options.timeControl, applyTimeout],
  );

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
      if (state.status !== GameStatus.IN_PROGRESS) return;
      const controller = controllerFor(state, options);
      if (controller !== 'HUMAN') return;

      if (selected) {
        const match = legalDestinations.find((m) => m.to.row === coord.row && m.to.col === coord.col);
        if (match) {
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
    [state, selected, legalDestinations, commitMove, options],
  );

  const startNextRound = useCallback(() => {
    // Ignore double-clicks: only a finished (non-final) round can be restarted.
    if (state.status !== GameStatus.ROUND_OVER) return;
    // Timed games: every round gets a fresh clock, so a player who flagged
    // doesn't open the next round with 0:00 and lose it instantly.
    const next = reseatForNextRound(state, options.timeControl?.initialMs);
    setState(next);
    setRoundStartState(next);
    setHistory([]);
    setSelected(null);
    setLastEvent(null);
    moveCounter.current = 1;
  }, [state, options.timeControl]);

  // Autonomous bot turns.
  useEffect(() => {
    if (state.status !== GameStatus.IN_PROGRESS) return;
    const controller = controllerFor(state, options);
    if (controller === 'HUMAN') return;
    const timer = window.setTimeout(() => {
      const move = chooseBotMove(state, state.activePlayer, controller);
      if (move) commitMove(move);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [state, options, commitMove]);

  // Live clock: ticks the display every 500ms and independently detects a
  // timeout even if the flagged player never submits another move.
  useEffect(() => {
    if (!options.timeControl || state.status !== GameStatus.IN_PROGRESS) return;
    const interval = window.setInterval(() => {
      const timedOut = checkTimeout(state, Date.now());
      if (timedOut) {
        applyTimeout(timedOut);
        return;
      }
      setState(tickClock(state, Date.now()));
    }, 500);
    return () => window.clearInterval(interval);
  }, [state, options.timeControl, applyTimeout]);

  const isHumanTurn = canAct;

  return {
    state,
    history,
    roundStartState,
    selected,
    legalDestinations,
    lastEvent,
    isHumanTurn,
    selectSquare,
    startNextRound,
    restart,
  };
}
