import { GameState, GameStatus, PlayerSide } from '@kamisado/engine';

export interface RegroupPromptProps {
  state: GameState;
  blackName: string;
  goldName: string;
  onStartNextRound: () => void;
  onRestart: () => void;
}

/** Shown between rounds of a multi-round match. */
export function RegroupPrompt({ state, blackName, goldName, onStartNextRound, onRestart }: RegroupPromptProps) {
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
      <p className="text-xs text-white/60">Every tower returns to its own colour square for the next round.</p>
      <button onClick={onStartNextRound} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500" data-testid="start-next-round">
        Start round {state.currentRound + 1}
      </button>
    </div>
  );
}
