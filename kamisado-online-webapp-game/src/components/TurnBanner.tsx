import { GameState, GameStatus } from '@kamisado/engine';
import { COLOR_HEX, COLOR_KANJI, COLOR_LABEL, getContrastTextColor } from '../lib/theme.js';

/** The colour lock, in words: whose turn it is and which tower they must move. */
export function TurnBanner({ state, activeName, thinking = false }: { state: GameState; activeName: string; thinking?: boolean }) {
  if (state.status !== GameStatus.IN_PROGRESS) return null;
  const required = state.requiredColor;

  return (
    <div className="glass flex w-full items-center justify-between gap-3 px-3.5 py-2" data-testid="turn-banner">
      <span className="min-w-0 truncate text-sm text-stone-200" data-testid={thinking ? 'bot-thinking' : undefined}>
        <span className="font-semibold text-white">{activeName}</span> {thinking ? 'is thinking' : 'to move'}
        {thinking && <span className="ml-0.5 inline-flex gap-0.5 align-middle" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-pulse rounded-full bg-accent" style={{ animationDelay: `${i * 160}ms` }} />)}</span>}
      </span>
      {required ? (
        <span className="flex shrink-0 items-center gap-2" data-testid="required-color" data-color={required}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">must move</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold shadow-sm ring-1 ring-white/25"
            style={{ backgroundColor: COLOR_HEX[required], color: getContrastTextColor(required) }}
          >
            <span className="font-brand text-sm font-black">{COLOR_KANJI[required]}</span>
            {COLOR_LABEL[required]}
          </span>
        </span>
      ) : (
        <span className="chip shrink-0" data-testid="required-color" data-color="any">
          any tower
        </span>
      )}
    </div>
  );
}
