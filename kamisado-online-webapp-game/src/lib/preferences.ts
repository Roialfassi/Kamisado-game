/** Small persisted boolean UI preferences (sound, colorblind symbols) - kept
 * separate from puzzleProgress.ts since these are simple flags, not a
 * streak record, but wrapped the same defensive way (private browsing /
 * storage-disabled contexts should degrade to "use the default", not throw). */

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

function writeBoolean(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private browsing / storage disabled - preference just won't persist.
  }
}

const MUTED_KEY = 'kamisado.muted';
const SYMBOLS_KEY = 'kamisado.colorblindSymbols';

export function getStoredMuted(): boolean {
  return readBoolean(MUTED_KEY, false);
}

export function setStoredMuted(value: boolean): void {
  writeBoolean(MUTED_KEY, value);
}

export function getStoredSymbolsEnabled(): boolean {
  return readBoolean(SYMBOLS_KEY, false);
}

export function setStoredSymbolsEnabled(value: boolean): void {
  writeBoolean(SYMBOLS_KEY, value);
}
