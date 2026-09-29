import { useMemo, useState } from 'react';
import { GameState, PlayerSide } from '@kamisado/engine';
import { copyToClipboard } from '../lib/clipboard.js';
import { HistoryEntry } from '../state/useKamisadoGame.js';
import { Board } from './Board.js';
import { Icon } from './ui/Icon.js';

export interface ReplayViewerProps {
  initialState: GameState;
  history: HistoryEntry[];
  onClose: () => void;
}

/** Step-forward/backward viewer over a finished round's move history, plus
 * notation export - Phase 4's "Replay & Analysis Suite", scoped to stepping
 * through what actually happened (no "play from here against a bot" branch
 * yet). */
export function ReplayViewer({ initialState, history, onClose }: ReplayViewerProps) {
  const [ply, setPly] = useState(history.length);
  const [copied, setCopied] = useState(false);

  const displayState = ply === 0 ? initialState : (history[ply - 1]?.stateAfter ?? initialState);
  const notationText = useMemo(() => history.map((h) => h.notation).join('\n'), [history]);

  const goTo = (next: number) => setPly(Math.max(0, Math.min(history.length, next)));

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Replay viewer">
      <div className="glass-strong flex max-h-full w-full max-w-4xl flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <div className="flex w-full items-center justify-between">
          <div>
            <p className="eyebrow">Replay</p>
            <h2 className="text-lg font-bold text-white">Step through the round</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close replay" data-testid="replay-close">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start">
          <Board
            state={displayState}
            perspective={PlayerSide.BLACK}
            selected={null}
            legalDestinations={[]}
            symbolsEnabled={false}
            interactive={false}
            onSquareClick={() => {}}
            lastMove={ply === 0 ? null : (history[ply - 1]?.move ?? null)}
            size="min(calc(100vw - 8rem), 56vh, 480px)"
          />

          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => goTo(0)} disabled={ply === 0} className="btn btn-ghost px-3" aria-label="First move">
                |&lt;
              </button>
              <button onClick={() => goTo(ply - 1)} disabled={ply === 0} className="btn btn-ghost px-3" aria-label="Previous move">
                &lt;
              </button>
              <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-stone-300" data-testid="replay-ply">
                {ply} / {history.length}
              </span>
              <button onClick={() => goTo(ply + 1)} disabled={ply === history.length} className="btn btn-ghost px-3" aria-label="Next move">
                &gt;
              </button>
              <button onClick={() => goTo(history.length)} disabled={ply === history.length} className="btn btn-ghost px-3" aria-label="Last move">
                &gt;|
              </button>
            </div>

            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl bg-black/25 p-2 text-xs">
              {history.length === 0 && <p className="p-2 text-stone-500">No moves recorded.</p>}
              {history.map((entry, i) => (
                <p
                  key={i}
                  onClick={() => goTo(i + 1)}
                  className={`cursor-pointer rounded-md px-2 py-1 font-mono transition ${
                    i + 1 === ply ? 'bg-accent/15 text-accent-soft' : 'text-stone-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {entry.notation}
                </p>
              ))}
            </div>

            <button
              onClick={async () => {
                if (await copyToClipboard(notationText)) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }
              }}
              className="btn btn-primary w-full"
            >
              {copied ? 'Copied!' : 'Export notation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
