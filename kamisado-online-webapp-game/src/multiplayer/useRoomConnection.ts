import { useCallback, useEffect, useRef, useState } from 'react';
import { Coordinate, GameState, Move, PlayerSide, findTowerAt, getLegalMoves } from '@kamisado/engine';
import type { ClientMessage, EmoteBroadcastMessage, EmoteId, PreferredSide, RoomStateMessage, RoundFinishedMessage, ServerMessage } from '@kamisado/protocol';
import { formatMove } from '../lib/notation.js';
import { resolveSelection } from '../lib/mustMove.js';
import type { HistoryEntry } from '../state/useKamisadoGame.js';

function wsUrl(): string {
  const override = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ROOM_SERVER_URL;
  if (override) return override;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:8787`;
}

function getOrCreatePlayerId(): string {
  const key = 'kamisado.playerId';
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

export type ConnectionStatus = 'CONNECTING' | 'OPEN' | 'CLOSED';

export function useRoomConnection(roomId: string, playerName: string, preferredSide: PreferredSide) {
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
  const [roomState, setRoomState] = useState<RoomStateMessage | null>(null);
  const [lastFinished, setLastFinished] = useState<RoundFinishedMessage | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [explicitSelected, setSelected] = useState<Coordinate | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [roundStartState, setRoundStartState] = useState<GameState | null>(null);
  const [lastEmote, setLastEmote] = useState<(EmoteBroadcastMessage & { key: number }) | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const playerId = useRef(getOrCreatePlayerId()).current;
  const moveCounter = useRef(1);
  const lastSeenRound = useRef<number | null>(null);

  useEffect(() => {
    setStatus('CONNECTING');
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('OPEN');
      const join: ClientMessage = { type: 'JOIN_ROOM', roomId, playerId, playerName, preferredSide };
      ws.send(JSON.stringify(join));
    };
    ws.onclose = () => setStatus('CLOSED');
    ws.onerror = () => setStatus('CLOSED');
    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'ROOM_STATE') {
        if (lastSeenRound.current !== msg.gameState.currentRound) {
          lastSeenRound.current = msg.gameState.currentRound;
          moveCounter.current = 1;
          setHistory([]);
          setRoundStartState(msg.gameState);
        }
        setRoomState(msg);
      } else if (msg.type === 'MOVE_BROADCAST') {
        // Compute the notation and advance the counter here, in the plain
        // event handler - NOT inside a setState functional updater, which
        // React 18 StrictMode invokes twice in development to check for
        // impurity and would otherwise double-advance this ref.
        const entry: HistoryEntry = {
          move: msg.move,
          notation: formatMove(moveCounter.current, msg.move, msg.gameState.requiredColor),
          stateAfter: msg.gameState,
        };
        moveCounter.current += 1;
        setRoomState((prev) => (prev ? { ...prev, gameState: msg.gameState } : prev));
        setHistory((h) => [...h, entry]);
        setSelected(null);
      } else if (msg.type === 'ROUND_FINISHED') {
        setLastFinished(msg);
        setRoomState((prev) => (prev ? { ...prev, gameState: msg.gameState } : prev));
      } else if (msg.type === 'EMOTE_BROADCAST') {
        setLastEmote({ ...msg, key: Date.now() });
      } else if (msg.type === 'ERROR') {
        setLastError(msg.message);
      }
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(message));
  }, []);

  const submitMove = useCallback((move: Move) => send({ type: 'SUBMIT_MOVE', roomId, move }), [send, roomId]);
  const resign = useCallback((playerSide: PlayerSide) => send({ type: 'RESIGN', roomId, playerSide }), [send, roomId]);
  const startNextRound = useCallback(() => send({ type: 'REGROUP', roomId }), [send, roomId]);
  const sendEmote = useCallback((emoteId: EmoteId) => send({ type: 'SEND_EMOTE', roomId, emoteId }), [send, roomId]);

  const canAct = !!roomState && roomState.yourSide !== 'SPECTATOR' && roomState.gameState.activePlayer === roomState.yourSide;
  const selected = roomState ? resolveSelection(roomState.gameState, explicitSelected, canAct) : null;

  const legalDestinations: Move[] = (() => {
    if (!roomState || !selected) return [];
    const state = roomState.gameState;
    const tower = findTowerAt(state, selected.row, selected.col);
    if (!tower || tower.side !== state.activePlayer) return [];
    return getLegalMoves(state, tower.color);
  })();

  const selectSquare = useCallback(
    (coord: Coordinate) => {
      if (!roomState) return;
      const state = roomState.gameState;
      const mySide = roomState.yourSide;
      if (mySide === 'SPECTATOR' || state.activePlayer !== mySide) {
        setSelected(null);
        return;
      }
      if (selected) {
        const match = legalDestinations.find((m) => m.to.row === coord.row && m.to.col === coord.col);
        if (match) {
          submitMove(match);
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
    [roomState, selected, legalDestinations, submitMove],
  );

  return {
    status,
    roomState,
    lastFinished,
    lastError,
    lastEmote,
    selected,
    legalDestinations,
    history,
    roundStartState,
    selectSquare,
    submitMove,
    resign,
    startNextRound,
    sendEmote,
    playerId,
  };
}
