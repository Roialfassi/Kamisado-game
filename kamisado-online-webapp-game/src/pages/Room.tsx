import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameStatus, PlayerSide } from '@kamisado/engine';
import type { PreferredSide } from '@kamisado/protocol';
import { Board } from '../components/Board.js';
import { EmoteToast, EmoteWheel } from '../components/EmoteWheel.js';
import { MoveHistory } from '../components/MoveHistory.js';
import { PlayerBar, SeatLabel } from '../components/PlayerBar.js';
import { ReplayViewer } from '../components/ReplayViewer.js';
import { RoundModal } from '../components/RoundModal.js';
import { TurnBanner } from '../components/TurnBanner.js';
import { Icon } from '../components/ui/Icon.js';
import { Segmented } from '../components/ui/Segmented.js';
import { copyToClipboard } from '../lib/clipboard.js';
import { FORMAT_LABELS, formatSummary } from '../lib/matchFormats.js';
import { generateRoomSlug } from '../lib/roomSlug.js';
import { useSymbolsEnabled } from '../lib/usePreferences.js';
import { useRoomConnection } from '../multiplayer/useRoomConnection.js';

export default function Room() {
  const { roomId } = useParams();
  if (!roomId) return <CreateRoom />;
  return <JoinRoom roomId={roomId} />;
}

function CreateRoom() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <div className="glass p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
          <Icon name="users" size={26} />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">Play a friend online</h1>
        <p className="mt-2 text-sm text-stone-400">Get a one-click invite link and duel in real time - no account needed.</p>
        <button className="btn btn-primary mt-6 w-full py-3 text-base" onClick={() => navigate(`/room/${generateRoomSlug()}`)} data-testid="create-room">
          Create private room
        </button>
        <p className="mt-4 text-xs text-stone-500">
          Requires the Kamisado room server (<code className="text-stone-400">packages/room-server</code>) to be running.
        </p>
      </div>
    </div>
  );
}

const SIDE_OPTIONS: { value: PreferredSide; label: string }[] = [
  { value: 'RANDOM', label: 'Random' },
  { value: 'BLACK', label: 'Black' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'SPECTATOR', label: 'Watch' },
];

function JoinRoom({ roomId }: { roomId: string }) {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [preferredSide, setPreferredSide] = useState<PreferredSide>('RANDOM');

  if (!joined) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 sm:py-20">
        <div className="glass p-7">
          <p className="eyebrow">Private room</p>
          <h1 className="mt-1 break-all text-xl font-bold text-white">{roomId}</h1>
          <p className="mt-1 text-xs text-stone-500">Share this page&apos;s URL to invite an opponent.</p>
          <label className="eyebrow mt-6 block" htmlFor="player-name">
            Your name
          </label>
          <input
            id="player-name"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
            placeholder="e.g. Hiro"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) setJoined(true);
            }}
          />
          <div className="mt-4">
            <span className="eyebrow mb-2 block">Side</span>
            <Segmented ariaLabel="Preferred side" value={preferredSide} onChange={setPreferredSide} options={SIDE_OPTIONS.map((o) => ({ ...o, testId: `side-${o.value}` }))} />
          </div>
          <button disabled={!name.trim()} onClick={() => setJoined(true)} className="btn btn-primary mt-6 w-full py-3" data-testid="enter-arena">
            Enter the arena
          </button>
        </div>
      </div>
    );
  }

  return <RoomArena roomId={roomId} playerName={name} preferredSide={preferredSide} />;
}

function RoomArena({ roomId, playerName, preferredSide }: { roomId: string; playerName: string; preferredSide: PreferredSide }) {
  const conn = useRoomConnection(roomId, playerName, preferredSide);
  const [copied, setCopied] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [symbolsEnabled] = useSymbolsEnabled();

  if (conn.status === 'CLOSED') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="glass p-8">
          <p className="font-semibold text-white">Lost connection to the room server.</p>
          <p className="mt-2 text-xs text-stone-400">
            Make sure the room server is running (<code>npm run dev -w @kamisado/room-server</code>), then reload.
          </p>
          <button className="btn btn-primary mt-5" onClick={() => window.location.reload()}>
            <Icon name="refresh" /> Reload
          </button>
        </div>
      </div>
    );
  }
  if (!conn.roomState) {
    return <div className="px-4 py-20 text-center text-stone-400">Connecting to room {roomId}…</div>;
  }

  const { gameState, blackPlayer, goldPlayer, spectatorCount, yourSide } = conn.roomState;
  const spectator = yourSide === 'SPECTATOR';
  const blackName = blackPlayer?.name ?? 'Waiting for Black…';
  const goldName = goldPlayer?.name ?? 'Waiting for Gold…';
  const perspective = yourSide === PlayerSide.GOLD ? PlayerSide.GOLD : PlayerSide.BLACK;
  const top = perspective === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const labelFor = (side: PlayerSide): SeatLabel => {
    const seat = side === PlayerSide.BLACK ? blackPlayer : goldPlayer;
    const name = side === PlayerSide.BLACK ? blackName : goldName;
    const tags = [side === yourSide ? 'You' : null, seat && !seat.connected ? 'disconnected' : null].filter(Boolean);
    return { name, tag: tags.length ? tags.join(' · ') : undefined };
  };

  const disconnectedName =
    gameState.status === GameStatus.IN_PROGRESS && blackPlayer && !blackPlayer.connected
      ? blackName
      : gameState.status === GameStatus.IN_PROGRESS && goldPlayer && !goldPlayer.connected
        ? goldName
        : null;

  const emoteSenderLabel = (() => {
    if (!conn.lastEmote) return '';
    if (conn.lastEmote.playerSide === PlayerSide.BLACK) return blackName;
    if (conn.lastEmote.playerSide === PlayerSide.GOLD) return goldName;
    return 'A spectator';
  })();

  const activeName = gameState.activePlayer === PlayerSide.BLACK ? blackName : goldName;
  const lastMove = conn.history[conn.history.length - 1]?.move ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-4 sm:py-6">
      <div className="glass flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-stone-300">
        <span className="flex items-center gap-2">
          <span className="chip">Room</span>
          <strong className="text-white">{roomId}</strong>
          <span className="text-xs text-stone-500">
            {spectatorCount} spectator{spectatorCount === 1 ? '' : 's'}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {!spectator && <EmoteWheel onSend={conn.sendEmote} />}
          <button
            onClick={async () => {
              if (await copyToClipboard(shareUrl)) {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }
            }}
            className="btn btn-ghost py-1.5"
          >
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
          {!spectator && (
            <button onClick={() => conn.resign(yourSide as PlayerSide)} className="btn btn-danger py-1.5" data-testid="resign">
              <Icon name="flag" size={15} /> Resign
            </button>
          )}
        </span>
      </div>
      <EmoteToast emote={conn.lastEmote} senderLabel={emoteSenderLabel} />

      {disconnectedName && (
        <div className="w-full rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
          {disconnectedName} disconnected - waiting up to 60s for them to reconnect before the round is forfeited.
        </div>
      )}

      <div className="flex w-full flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
        <div className="inline-flex flex-col items-stretch gap-2.5">
          <PlayerBar side={top} label={labelFor(top)} state={gameState} showClock={false} />
          <div className="relative self-center">
            <Board
              state={gameState}
              perspective={perspective}
              selected={conn.selected}
              legalDestinations={conn.legalDestinations}
              symbolsEnabled={symbolsEnabled}
              interactive={!spectator && gameState.activePlayer === yourSide}
              onSquareClick={conn.selectSquare}
              lastMove={lastMove}
            />
            <RoundModal
              state={gameState}
              blackName={blackName}
              goldName={goldName}
              onStartNextRound={!spectator ? conn.startNextRound : undefined}
              waitingText={spectator ? 'Waiting for a player to start the next round…' : undefined}
              onReplay={conn.history.length > 0 ? () => setShowReplay(true) : undefined}
            />
          </div>
          <PlayerBar side={perspective} label={labelFor(perspective)} state={gameState} showClock={false} />
          <TurnBanner state={gameState} activeName={activeName} />
        </div>

        <aside className="flex w-full max-w-[34rem] flex-col gap-3 lg:w-72" aria-label="Match info">
          <div className="glass p-4">
            <p className="eyebrow">Match</p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-bold text-white">{FORMAT_LABELS[gameState.matchFormat]}</span>
              <span className="text-sm text-stone-400">Round {gameState.currentRound}</span>
            </div>
            <p className="mt-0.5 text-xs text-stone-400">{formatSummary(gameState.matchFormat)}</p>
          </div>
          <MoveHistory history={conn.history} />
        </aside>
      </div>
      {conn.lastError && <p className="text-xs text-red-400">{conn.lastError}</p>}

      {showReplay && conn.roundStartState && (
        <ReplayViewer initialState={conn.roundStartState} history={conn.history} onClose={() => setShowReplay(false)} />
      )}
    </div>
  );
}
