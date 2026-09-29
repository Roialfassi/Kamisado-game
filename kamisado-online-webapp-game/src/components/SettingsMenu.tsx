import { useEffect, useRef, useState } from 'react';
import { useMuted, useSymbolsEnabled } from '../lib/usePreferences.js';
import { Icon } from './ui/Icon.js';

function Toggle({ label, hint, on, onChange, testId }: { label: string; hint: string; on: boolean; onChange: (next: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      data-testid={testId}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
    >
      <span>
        <span className="block text-sm font-semibold text-stone-100">{label}</span>
        <span className="block text-xs text-stone-400">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full border transition ${on ? 'border-accent/60 bg-accent/90' : 'border-white/15 bg-white/10'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/** Header settings popover: sound + colourblind symbols, shared app-wide. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useMuted();
  const [symbols, setSymbols] = useSymbolsEnabled();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" className="icon-btn" aria-label="Settings" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="settings-button">
        <Icon name="gear" />
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-12 z-50 w-72 animate-pop-in p-2" role="menu" aria-label="Settings">
          <Toggle label="Sound effects" hint={muted ? 'Muted' : 'On'} on={!muted} onChange={(next) => setMuted(!next)} testId="toggle-sound" />
          <Toggle
            label="Colourblind symbols"
            hint="Kanji on towers"
            on={symbols}
            onChange={setSymbols}
            testId="toggle-symbols"
          />
        </div>
      )}
    </div>
  );
}
