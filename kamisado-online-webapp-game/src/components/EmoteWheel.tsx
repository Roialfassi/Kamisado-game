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
    <div className="flex gap-1" data-testid="emote-wheel">
      {EMOTES.map((e) => (
        <button
          key={e.id}
          onClick={() => onSend(e.id)}
          title={e.label}
          aria-label={e.label}
          className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-base transition hover:scale-110 hover:bg-white/[0.12] active:scale-95"
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
      className="glass-strong pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-pop-in rounded-full px-5 py-2 text-sm font-medium text-accent-soft sm:bottom-8"
      data-testid="emote-toast"
    >
      {senderLabel}: {EMOTE_TEXT[emote.emoteId]}
    </div>
  );
}
