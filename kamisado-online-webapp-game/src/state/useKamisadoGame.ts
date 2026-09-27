import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
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
  regroupForNextRound,
  tickClock,
} from '@kamisado/engine';
import { BotTier, chooseBotMove } from '../ai/bot.js';
import { formatMove } from '../lib/notation.js';
import { TimeControlChoice } from '../lib/timeControl.js';
import { playPass, playPlace, playSumoPush, playVictory } from '../lib/sound.js';

export type Controller = 'HUMAN' | BotTier;

export interface HistoryEntry {
  notation: string;
  move: Move;
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
  selected: Coordinate | null;
  legalDestinations: Move[];
  lastEvent: 'PASS' | 'DEADLOCK' | 'ROUND_OVER' | 'MATCH_OVER' | null;
  isHumanTurn: boolean;
  selectSquare: (coord: Coordinate) => void;
  clearSelection: () => void;
  regroup: (fillFromLeft: boolean) => void;
  restart: () => void;
}

function controllerFor(state: GameState, options: UseKamisadoGameOptions): Controller {
  return state.activePlayer === PlayerSide.BLACK ? options.black : options.gold;
}

export function useKamisadoGame(options: UseKamisadoGameOptions): KamisadoGameApi {
  const [state, setState] = useState<GameState>(() => createGame(options.format, options.timeControl?.initialMs ?? 0));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [lastEvent, setLastEvent] = useState<KamisadoGameApi['lastEvent']>(null);
  const moveCounter = useRef(1);

  const restart = useCallback(() => {
    setState(createGame(options.format, options.timeControl?.initialMs ?? 0));
    setHistory([]);
    setSelected(null);
    setLastEvent(null);
    moveCounter.current = 1;
  }, [options.format, options.timeControl]);

  const applyTimeout = useCallback((timedOut: NonNullable<ReturnType<typeof checkTimeout>>) => {
    if (!timedOut.state) return false;
    setState(timedOut.state);
    setLastEvent('ROUND_OVER');
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
      const entries: HistoryEntry[] = [{ move, notation: formatMove(moveCounter.current++, move, next.requiredColor) }];

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

      setHistory((h) => [...h, ...entries]);
      setState(next);
      setSelected(null);
    },
    [state, options.timeControl, applyTimeout],
  );

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

  const clearSelection = useCallback(() => setSelected(null), []);

  const regroup = useCallback(
    (fillFromLeft: boolean) => {
      setState((prev) => regroupForNextRound(prev, fillFromLeft));
      setHistory([]);
      setLastEvent(null);
      moveCounter.current = 1;
    },
    [],
  );

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

  const isHumanTurn = state.status === GameStatus.IN_PROGRESS && controllerFor(state, options) === 'HUMAN';

  return {
    state,
    history,
    selected,
    legalDestinations,
    lastEvent,
    isHumanTurn,
    selectSquare,
    clearSelection,
    regroup,
    restart,
  };
}

export function requiredColorLabel(color: Color | null): string {
  return color ?? 'Any tower';
}
