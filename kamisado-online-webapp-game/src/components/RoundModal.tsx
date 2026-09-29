import { useEffect, useState } from 'react';
import { GameState, GameStatus, MATCH_FORMAT_POINTS, PlayerSide } from '@kamisado/engine';
import { Icon } from './ui/Icon.js';
import { Modal } from './ui/Modal.js';

const REASON_LABEL: Record<string, string> = {
  BASELINE_REACHED: 'reached the home row',
  DEADLOCK: 'won by deadlock',
  TIMEOUT: 'won on time',
  RESIGN: 'won by resignation',
};

export interface RoundModalProps {
  state: GameState;
  blackName: string;
  goldName: string;
  /** Start the next round (round over, match still going). Omit to hide the button. */
  onStartNextRound?: () => void;
  /** Shown instead of the button when the viewer can't start the round. */
  waitingText?: string;
  /** Match over: play again. */
  onRestart?: () => void;
  onReplay?: () => void;
}

/** Round / match result dialog. Dismissible so the final position can be
 * inspected; a compact bar under the board keeps the primary action reachable. */
export function RoundModal({ state, blackName, goldName, onStartNextRound, waitingText, onRestart, onReplay }: RoundModalProps) {
  const over = state.status === GameStatus.ROUND_OVER || state.status === GameStatus.MATCH_OVER;
  const key = `${state.currentRound}-${state.status}`;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!over) setDismissedKey(null);
  }, [over]);

  if (!over || !state.roundWinner) return null;

  const matchOver = state.status === GameStatus.MATCH_OVER;
  const winnerName = state.roundWinner === PlayerSide.BLACK ? blackName : goldName;
  const reason = state.roundOverReason ? REASON_LABEL[state.roundOverReason] : undefined;
  const target = MATCH_FORMAT_POINTS[state.matchFormat];
  const dismissed = dismissedKey === key;

  const primary = matchOver ? (
    onRestart && (
      <button className="btn btn-primary w-full" onClick={onRestart} data-testid="new-match">
        <Icon name="refresh" /> Play again
      </button>
    )
  ) : onStartNextRound ? (
    <button className="btn btn-primary w-full" onClick={onStartNextRound} data-testid="start-next-round">
      <Icon name="play" /> Start round {state.currentRound + 1}
    </button>
  ) : (
    waitingText && <p className="text-center text-sm text-stone-400">{waitingText}</p>
  );

  if (dismissed) {
    return (
      <div className="glass mt-2.5 flex w-full animate-pop-in items-center justify-between gap-3 px-4 py-3" data-testid="round-bar">
        <span className="min-w-0 truncate text-sm font-semibold text-white">
          {winnerName} {matchOver ? 'wins the match' : `takes round ${state.currentRound}`}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {primary}
          {onReplay && (
            <button className="icon-btn" onClick={onReplay} title="View replay" aria-label="View replay" data-testid="view-replay">
              <Icon name="list" />
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <Modal label={matchOver ? 'Match over' : 'Round over'} onClose={() => setDismissedKey(key)}>
      <div className="flex flex-col items-center gap-4 text-center" data-testid="round-modal">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/40">
          <Icon name="trophy" size={28} />
        </span>
        <div>
          <p className="eyebrow">{matchOver ? 'Match over' : `Round ${state.currentRound} complete`}</p>
          <h2 className="mt-1 text-xl font-bold text-white">
            {winnerName} {matchOver ? 'wins the match!' : 'takes the round'}
          </h2>
          {reason && !matchOver && <p className="mt-1 text-sm text-stone-400">{reason}</p>}
        </div>

        <div className="flex w-full items-center justify-center gap-4 rounded-xl bg-black/30 px-4 py-3 text-sm">
          <span className="truncate text-stone-300">{blackName}</span>
          <span className="text-lg font-bold tabular-nums text-white" data-testid="modal-score">
            {state.scores[PlayerSide.BLACK].points} <span className="text-stone-500">–</span> {state.scores[PlayerSide.GOLD].points}
          </span>
          <span className="truncate text-stone-300">{goldName}</span>
        </div>
        {!matchOver && <p className="text-xs text-stone-500">First to {target} · every tower returns to its own colour square</p>}

        <div className="flex w-full flex-col gap-2">
          {primary}
          {onReplay && (
            <button className="btn btn-ghost w-full" onClick={onReplay} data-testid="view-replay">
              <Icon name="list" /> View replay
            </button>
          )}
          <button className="btn btn-ghost w-full" onClick={() => setDismissedKey(key)} data-testid="dismiss-round-modal">
            Look at the board
          </button>
        </div>
      </div>
    </Modal>
  );
}
