import { useMemo, useState } from 'react';
import { GameState, PlayerSide } from '@kamisado/engine';
import { copyToClipboard } from '../lib/clipboard.js';
import { HistoryEntry } from '../state/useKamisadoGame.js';
import { Board } from './Board.js';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label="Replay viewer">
      <div className="flex max-h-full w-full max-w-4xl flex-col items-center gap-4 overflow-y-auto rounded-lg bg-[#241209] p-6">
        <div className="flex w-full items-center justify-between">
          <h2 className="font-display text-lg text-amber-200">Replay</h2>
          <button onClick={onClose} className="rounded bg-black/30 px-3 py-1 text-sm hover:bg-black/50">
            Close
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Board
            state={displayState}
            perspective={PlayerSide.BLACK}
            selected={null}
            legalDestinations={[]}
            symbolsEnabled={false}
            interactive={false}
            onSquareClick={() => {}}
          />

          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => goTo(0)} disabled={ply === 0} className="rounded bg-black/30 px-2 py-1 text-sm disabled:opacity-30">
                |&lt;
              </button>
              <button onClick={() => goTo(ply - 1)} disabled={ply === 0} className="rounded bg-black/30 px-2 py-1 text-sm disabled:opacity-30">
                &lt;
              </button>
              <span className="min-w-[4rem] text-center text-xs text-white/60" data-testid="replay-ply">
                {ply} / {history.length}
              </span>
              <button
                onClick={() => goTo(ply + 1)}
                disabled={ply === history.length}
                className="rounded bg-black/30 px-2 py-1 text-sm disabled:opacity-30"
              >
                &gt;
              </button>
              <button
                onClick={() => goTo(history.length)}
                disabled={ply === history.length}
                className="rounded bg-black/30 px-2 py-1 text-sm disabled:opacity-30"
              >
                &gt;|
              </button>
            </div>

            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md bg-black/25 p-3 text-xs">
              {history.length === 0 && <p className="text-white/40">No moves recorded.</p>}
              {history.map((entry, i) => (
                <p
                  key={i}
                  onClick={() => goTo(i + 1)}
                  className={`cursor-pointer font-mono ${i + 1 === ply ? 'text-amber-300' : 'text-white/70 hover:text-white'}`}
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
              className="w-full rounded bg-amber-600 px-3 py-2 text-sm font-semibold hover:bg-amber-500"
            >
              {copied ? 'Copied!' : 'Export Notation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
