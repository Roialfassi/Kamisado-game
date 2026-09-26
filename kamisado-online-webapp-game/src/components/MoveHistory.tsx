import { useEffect, useRef } from 'react';
import { HistoryEntry } from '../state/useKamisadoGame.js';

export function MoveHistory({ history }: { history: HistoryEntry[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [history.length]);

  return (
    <div className="w-full max-w-xs rounded-md bg-black/25 p-3">
      <h3 className="mb-2 font-display text-sm text-white/70">Move History</h3>
      <div ref={listRef} className="max-h-48 space-y-1 overflow-y-auto text-xs text-white/80" data-testid="move-history">
        {history.length === 0 && <p className="text-white/40">No moves yet.</p>}
        {history.map((entry, i) => (
          <p key={i} className="font-mono">
            {entry.notation}
          </p>
        ))}
      </div>
    </div>
  );
}
