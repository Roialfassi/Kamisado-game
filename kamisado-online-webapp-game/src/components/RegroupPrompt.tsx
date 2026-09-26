import { GameState, GameStatus, PlayerSide } from '@kamisado/engine';

export interface RegroupPromptProps {
  state: GameState;
  blackName: string;
  goldName: string;
  onRegroup: (fillFromLeft: boolean) => void;
  onRestart: () => void;
}

/** Shown between rounds of a multi-round match. Rules F1-F4: the round's
 * winner (the new round's Defender) chooses the fill direction. */
export function RegroupPrompt({ state, blackName, goldName, onRegroup, onRestart }: RegroupPromptProps) {
  if (state.status === GameStatus.MATCH_OVER) {
    const winnerName = state.matchWinner === PlayerSide.BLACK ? blackName : goldName;
    return (
      <div className="flex flex-col items-center gap-3 rounded-md bg-black/40 p-4 text-center">
        <p className="font-display text-lg text-amber-200">{winnerName} wins the match!</p>
        <button onClick={onRestart} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500">
          New Match
        </button>
      </div>
    );
  }
  if (state.status !== GameStatus.ROUND_OVER) return null;

  const winnerName = state.roundWinner === PlayerSide.BLACK ? blackName : goldName;
  return (
    <div className="flex flex-col items-center gap-3 rounded-md bg-black/40 p-4 text-center">
      <p className="font-display text-base text-amber-200">
        {winnerName} takes round {state.currentRound}
        {state.roundOverReason === 'DEADLOCK' ? ' by deadlock' : ''}!
      </p>
      <p className="text-xs text-white/60">As Defender, {winnerName} chooses how both sides regroup for the next round.</p>
      <div className="flex gap-3">
        <button onClick={() => onRegroup(true)} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold hover:bg-amber-500">
          Fill from Left
        </button>
        <button onClick={() => onRegroup(false)} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold hover:bg-amber-500">
          Fill from Right
        </button>
      </div>
    </div>
  );
}
