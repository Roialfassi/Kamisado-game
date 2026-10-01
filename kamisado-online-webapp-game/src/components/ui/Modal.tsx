import { ReactNode, useEffect, useRef } from 'react';
import { useDialogFocus } from './useDialogFocus.js';

/** Centred glass dialog over a dimmed, scrollable backdrop. Moves focus into
 * the dialog, keeps Tab inside it, closes on Escape / backdrop click and
 * restores focus afterwards. */
export function Modal({ children, label, onClose }: { children: ReactNode; label: string; onClose?: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(panelRef);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex animate-fade-in items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className="glass-strong my-auto w-full max-w-sm animate-pop-in p-6 outline-none">
        {children}
      </div>
    </div>
  );
}
