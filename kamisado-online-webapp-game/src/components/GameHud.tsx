import { GameState, GameStatus, MATCH_FORMAT_POINTS, PlayerSide } from '@kamisado/engine';
import { COLOR_HEX, COLOR_LABEL, COLOR_SYMBOL, COLOR_KANJI, getContrastTextColor } from '../lib/theme.js';

export interface GameHudProps {
  state: GameState;
  blackName: string;
  goldName: string;
  symbolsEnabled: boolean;
  showClock?: boolean;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function PlayerRow({ side, name, state, showClock }: { side: PlayerSide; name: string; state: GameState; showClock: boolean }) {
  const score = state.scores[side];
  const isActive = state.activePlayer === side && state.status === GameStatus.IN_PROGRESS;
  const clockMs = state.clocks[side];
  const lowOnTime = showClock && clockMs < 30_000;
  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 ${isActive ? 'bg-amber-500/20 ring-1 ring-amber-300/60' : 'bg-black/20'}`}>
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${side === PlayerSide.BLACK ? 'bg-neutral-900 border border-amber-100' : 'bg-amber-50 border border-neutral-900'}`} />
        <span className="font-display text-sm">{name}</span>
        {isActive && <span className="text-[10px] uppercase tracking-wide text-amber-300">to move</span>}
      </div>
      <div className="flex items-center gap-3">
        {showClock && (
          <span className={`font-mono text-sm tabular-nums ${lowOnTime ? 'animate-pulse text-red-400' : 'text-white/80'}`} data-testid={`clock-${side}`}>
            {formatClock(clockMs)}
          </span>
        )}
        <span className="text-sm font-semibold tabular-nums">
          {score.points} <span className="text-white/40">pts</span>
        </span>
      </div>
    </div>
  );
}

export function GameHud({ state, blackName, goldName, symbolsEnabled, showClock = false }: GameHudProps) {
  const threshold = MATCH_FORMAT_POINTS[state.matchFormat];
  const required = state.requiredColor;

  return (
    <div className="w-full max-w-xs space-y-3">
      <PlayerRow side={PlayerSide.GOLD} name={goldName} state={state} showClock={showClock} />
      <div className="text-center text-xs text-white/50">Round {state.currentRound} - first to {threshold} pts</div>
      <PlayerRow side={PlayerSide.BLACK} name={blackName} state={state} showClock={showClock} />

      <div className="mt-4 rounded-md bg-black/30 px-3 py-3 text-center">
        {state.status === GameStatus.IN_PROGRESS ? (
          required ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs uppercase tracking-wide text-white/60">Must move</span>
              <span
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold shadow-sm"
                style={{
                  backgroundColor: COLOR_HEX[required],
                  color: getContrastTextColor(required),
                }}
              >
                <span className="font-serif font-black">{COLOR_KANJI[required]}</span>
                <span>{COLOR_LABEL[required]}</span>
              </span>
            </div>
          ) : (
            <span className="text-xs uppercase tracking-wide text-white/60">Opening move - choose any tower</span>
          )
        ) : (
          <span className="text-sm font-display text-amber-200">
            {state.status === GameStatus.MATCH_OVER ? `${state.matchWinner === PlayerSide.BLACK ? blackName : goldName} wins the match!` : `${state.roundWinner === PlayerSide.BLACK ? blackName : goldName} wins the round`}
            {state.roundOverReason === 'DEADLOCK' ? ' (by deadlock)' : ''}
            {state.roundOverReason === 'TIMEOUT' ? ' (on time)' : ''}
            {state.roundOverReason === 'RESIGN' ? ' (by resignation)' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
