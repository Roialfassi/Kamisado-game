import { ReactNode, useEffect } from 'react';

/** Centred glass dialog over a dimmed backdrop. `inset` keeps it inside its
 * positioned parent (e.g. over just the board) instead of the whole viewport. */
export function Modal({
  children,
  label,
  onClose,
  inset = false,
}: {
  children: ReactNode;
  label: string;
  onClose?: () => void;
  inset?: boolean;
}) {
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
      className={`${inset ? 'absolute rounded-[inherit]' : 'fixed'} inset-0 z-40 flex animate-fade-in items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong w-full max-w-sm animate-pop-in p-6">{children}</div>
    </div>
  );
}
