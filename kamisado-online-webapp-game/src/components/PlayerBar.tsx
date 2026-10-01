import { GameState, GameStatus, MATCH_FORMAT_POINTS, PlayerSide } from '@kamisado/engine';

export interface SeatLabel {
  name: string;
  /** Small grey line under the name, e.g. "Player 1", "You", "AI · Ronin". */
  tag?: string;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** A small octagonal token in the side's lacquer colour (echoes the towers). */
function SideToken({ side }: { side: PlayerSide }) {
  const black = side === PlayerSide.BLACK;
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" className="shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
      <defs>
        <linearGradient id={`tok-${side}`} x1="15%" y1="10%" x2="85%" y2="90%">
          {black ? (
            <>
              <stop offset="0%" stopColor="#4a4a52" />
              <stop offset="100%" stopColor="#0b0b0d" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#d8c9b2" />
            </>
          )}
        </linearGradient>
      </defs>
      <polygon points="14,2 26,2 38,14 38,26 26,38 14,38 2,26 2,14" fill={`url(#tok-${side})`} stroke="#d4af37" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="15,9 25,9 31,15 31,25 25,31 15,31 9,25 9,15" fill="none" stroke={black ? 'rgba(212,175,55,0.35)' : 'rgba(120,95,60,0.35)'} strokeWidth="1" />
    </svg>
  );
}

function ScorePips({ side, state }: { side: PlayerSide; state: GameState }) {
  const target = MATCH_FORMAT_POINTS[state.matchFormat];
  const points = state.scores[side].points;
  return (
    <div className="flex items-center gap-2" aria-label={`${points} of ${target} points`}>
      {target <= 7 && (
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: target }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full border transition ${
                i < points ? 'border-accent bg-accent shadow-[0_0_8px_rgba(245,196,81,0.7)]' : 'border-white/20 bg-white/[0.06]'
              }`}
            />
          ))}
        </span>
      )}
      <span className="min-w-[2.2rem] text-right text-sm font-bold tabular-nums text-white" data-testid={`score-${side}`}>
        {points}
        {target > 7 && <span className="font-medium text-stone-500">/{target}</span>}
      </span>
    </div>
  );
}

export function PlayerBar({
  side,
  label,
  state,
  showClock,
}: {
  side: PlayerSide;
  label: SeatLabel;
  state: GameState;
  showClock: boolean;
}) {
  const active = state.activePlayer === side && state.status === GameStatus.IN_PROGRESS;
  const clockMs = state.clocks[side];
  const low = showClock && clockMs < 30_000;

  return (
    <div
      className={`glass flex w-full items-center justify-between gap-3 px-3.5 py-2.5 transition-shadow duration-200 ${
        active ? 'border-accent/50 shadow-[0_0_28px_-8px_rgba(245,196,81,0.55)]' : ''
      }`}
      data-testid={`player-${side}`}
      data-active={active ? 'true' : 'false'}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SideToken side={side} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-white">{label.name}</div>
          {label.tag && <div className="truncate text-xs text-stone-400">{label.tag}</div>}
        </div>
        {active && (
          <span className="chip border-accent/40 bg-accent/10 text-accent-soft" data-testid={`turn-chip-${side}`}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            to move
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {showClock && (
          <span
            className={`rounded-lg bg-black/40 px-2 py-1 font-mono text-sm tabular-nums ${low ? 'animate-pulse text-red-300' : 'text-stone-100'}`}
            data-testid={`clock-${side}`}
          >
            {formatClock(clockMs)}
          </span>
        )}
        <ScorePips side={side} state={state} />
      </div>
    </div>
  );
}
