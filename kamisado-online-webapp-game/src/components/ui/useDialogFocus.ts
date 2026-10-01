import { RefObject, useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Focus management for a modal dialog: moves focus into the panel on mount, keeps Tab / Shift+Tab inside
 * it, and gives focus back to whatever had it before when the dialog goes away. The panel needs
 * `tabIndex={-1}` so it can hold focus itself.
 */
export function useDialogFocus(panelRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus?.();
  }, [panelRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!panel.contains(active)) {
        // focus is outside this dialog (e.g. another dialog is stacked on top): leave it to that one
        return;
      }
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelRef]);
}
