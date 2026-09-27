import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlayerSide } from '@kamisado/engine';
import { Board } from '../components/Board.js';
import { GameHud } from '../components/GameHud.js';
import { MoveHistory } from '../components/MoveHistory.js';
import { generateRoomSlug } from '../lib/roomSlug.js';
import { useRoomConnection } from '../multiplayer/useRoomConnection.js';
import type { PreferredSide } from '@kamisado/protocol';

export default function Room() {
  const { roomId } = useParams();
  if (!roomId) return <CreateRoom />;
  return <JoinRoom roomId={roomId} />;
}

function CreateRoom() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-2xl text-amber-200">Create a Private Room</h1>
      <p className="mt-3 text-sm text-white/60">Get a 1-click shareable link and duel a friend online in real time.</p>
      <button
        className="mt-6 rounded bg-amber-600 px-5 py-3 font-display font-bold hover:bg-amber-500"
        onClick={() => navigate(`/room/${generateRoomSlug()}`)}
      >
        Generate Room Link
      </button>
      <p className="mt-4 text-xs text-white/40">
        Requires the Kamisado room server (see <code>packages/room-server</code>) to be running.
      </p>
    </div>
  );
}

function JoinRoom({ roomId }: { roomId: string }) {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [preferredSide, setPreferredSide] = useState<PreferredSide>('RANDOM');

  if (!joined) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <h1 className="font-display text-xl text-amber-200">Room: {roomId}</h1>
        <p className="mt-2 text-xs text-white/50">Share this page's URL to invite an opponent.</p>
        <input
          className="mt-6 w-full rounded bg-black/40 px-3 py-2 text-sm"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          {(['RANDOM', 'BLACK', 'GOLD', 'SPECTATOR'] as PreferredSide[]).map((side) => (
            <button
              key={side}
              onClick={() => setPreferredSide(side)}
              className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold ${preferredSide === side ? 'bg-amber-600' : 'bg-black/40'}`}
            >
              {side}
            </button>
          ))}
        </div>
        <button
          disabled={!name.trim()}
          onClick={() => setJoined(true)}
          className="mt-4 w-full rounded bg-amber-600 px-4 py-2.5 font-display text-sm font-bold hover:bg-amber-500 disabled:opacity-40"
        >
          Enter the Arena
        </button>
      </div>
    );
  }

  return <RoomArena roomId={roomId} playerName={name} preferredSide={preferredSide} />;
}

function RoomArena({ roomId, playerName, preferredSide }: { roomId: string; playerName: string; preferredSide: PreferredSide }) {
  const conn = useRoomConnection(roomId, playerName, preferredSide);
  const [copied, setCopied] = useState(false);

  if (conn.status === 'CLOSED') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-white/70">
        <p>Lost connection to the room server.</p>
        <p className="mt-2 text-xs text-white/40">
          Make sure the room server is running (<code>npm run dev -w @kamisado/room-server</code>), then reload.
        </p>
      </div>
    );
  }
  if (!conn.roomState) {
    return <div className="px-4 py-16 text-center text-white/60">Connecting to room {roomId}...</div>;
  }

  const { gameState, blackPlayer, goldPlayer, spectatorCount, yourSide } = conn.roomState;
  const blackName = blackPlayer?.name ?? 'Waiting for Black...';
  const goldName = goldPlayer?.name ?? 'Waiting for Gold...';
  const perspective = yourSide === PlayerSide.GOLD ? PlayerSide.GOLD : PlayerSide.BLACK;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const disconnectedName =
    gameState.status === 'IN_PROGRESS' && blackPlayer && !blackPlayer.connected
      ? blackName
      : gameState.status === 'IN_PROGRESS' && goldPlayer && !goldPlayer.connected
        ? goldName
        : null;

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 text-sm text-white/60">
        <span>
          Room <strong className="text-amber-200">{roomId}</strong> - {spectatorCount} spectator{spectatorCount === 1 ? '' : 's'}
        </span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded bg-black/30 px-3 py-1 hover:bg-black/50"
        >
          {copied ? 'Copied!' : 'Copy Invite Link'}
        </button>
        {yourSide !== 'SPECTATOR' && (
          <button onClick={() => conn.resign(yourSide)} className="rounded bg-red-900/60 px-3 py-1 hover:bg-red-800/70">
            Resign
          </button>
        )}
      </div>

      {disconnectedName && (
        <div className="w-full max-w-4xl rounded-md bg-amber-900/30 px-4 py-2 text-center text-sm text-amber-200">
          {disconnectedName} disconnected - waiting up to 60s for them to reconnect before the round is forfeited.
        </div>
      )}

      <div className="flex w-full max-w-4xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
        <GameHud state={gameState} blackName={blackName} goldName={goldName} symbolsEnabled={false} />

        <div className="flex flex-col items-center gap-4">
          <Board
            state={gameState}
            perspective={perspective}
            selected={conn.selected}
            legalDestinations={conn.legalDestinations}
            symbolsEnabled={false}
            interactive={yourSide !== 'SPECTATOR' && gameState.activePlayer === yourSide}
            onSquareClick={conn.selectSquare}
          />
          {gameState.status !== 'IN_PROGRESS' && gameState.roundWinner && (
            <div className="rounded-md bg-black/40 px-4 py-3 text-center">
              <p className="font-display text-amber-200">
                {(gameState.roundWinner === PlayerSide.BLACK ? blackName : goldName)} wins the{' '}
                {gameState.status === 'MATCH_OVER' ? 'match' : `round (${gameState.roundOverReason?.toLowerCase()})`}!
              </p>
              {gameState.status === 'ROUND_OVER' && gameState.roundWinner === yourSide && (
                <div className="mt-3 flex justify-center gap-2">
                  <button onClick={() => conn.regroup(true)} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold">
                    Fill from Left
                  </button>
                  <button onClick={() => conn.regroup(false)} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold">
                    Fill from Right
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <MoveHistory history={conn.history} />
      </div>
      {conn.lastError && <p className="text-xs text-red-400">{conn.lastError}</p>}
    </div>
  );
}
