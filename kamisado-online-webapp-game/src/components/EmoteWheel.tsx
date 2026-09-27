import { useEffect, useState } from 'react';
import type { EmoteBroadcastMessage, EmoteId } from '@kamisado/protocol';

const EMOTES: { id: EmoteId; icon: string; label: string }[] = [
  { id: 'WELL_PLAYED', icon: '\u{1F44F}', label: 'Well Played' },
  { id: 'THINKING', icon: '\u{1F914}', label: 'Thinking...' },
  { id: 'RESPECT', icon: '\u{1F64C}', label: 'Respect' },
  { id: 'BAMBOOZLED', icon: '\u{1F92F}', label: 'Bamboozled' },
];

const EMOTE_TEXT: Record<EmoteId, string> = {
  WELL_PLAYED: 'Well Played',
  THINKING: 'Thinking...',
  RESPECT: 'Respect',
  BAMBOOZLED: 'Bamboozled!',
};

export function EmoteWheel({ onSend }: { onSend: (emoteId: EmoteId) => void }) {
  return (
    <div className="flex gap-1.5" data-testid="emote-wheel">
      {EMOTES.map((e) => (
        <button
          key={e.id}
          onClick={() => onSend(e.id)}
          title={e.label}
          aria-label={e.label}
          className="rounded bg-black/30 px-2 py-1 text-lg hover:bg-black/50"
          data-testid={`emote-${e.id}`}
        >
          {e.icon}
        </button>
      ))}
    </div>
  );
}

/** A brief auto-dismissing toast for an emote another player just sent. */
export function EmoteToast({ emote, senderLabel }: { emote: (EmoteBroadcastMessage & { key: number }) | null; senderLabel: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!emote) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [emote]);

  if (!emote || !visible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm text-amber-200 shadow-lg"
      data-testid="emote-toast"
    >
      {senderLabel}: {EMOTE_TEXT[emote.emoteId]}
    </div>
  );
}
