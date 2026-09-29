import { useEffect, useRef } from 'react';
import { HistoryEntry } from '../state/useKamisadoGame.js';

export function MoveHistory({ history }: { history: HistoryEntry[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [history.length]);

  return (
    <div className="glass w-full p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="eyebrow">Moves</h3>
        <span className="chip">{history.length}</span>
      </div>
      <div ref={listRef} className="max-h-48 space-y-0.5 overflow-y-auto pr-1 text-xs text-stone-300 lg:max-h-72" data-testid="move-history">
        {history.length === 0 && <p className="text-stone-500">No moves yet.</p>}
        {history.map((entry, i) => (
          <p key={i} className={`rounded-md px-2 py-1 font-mono ${i === history.length - 1 ? 'bg-white/[0.07] text-white' : ''}`}>
            {entry.notation}
          </p>
        ))}
      </div>
    </div>
  );
}
