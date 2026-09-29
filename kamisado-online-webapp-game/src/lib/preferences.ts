/** Small persisted boolean UI preferences (sound, colorblind symbols). Values
 * live in an in-memory cache (so toggles still work when storage is
 * unavailable, e.g. private browsing) and are mirrored to localStorage
 * defensively. Components subscribe via `subscribePreferences` so the header
 * settings menu and the game screens always agree. */

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribePreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((l) => l());
}

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

let mutedCache: boolean | null = null;
let symbolsCache: boolean | null = null;

export function getStoredMuted(): boolean {
  if (mutedCache === null) mutedCache = readBoolean(MUTED_KEY, false);
  return mutedCache;
}

export function setStoredMuted(value: boolean): void {
  mutedCache = value;
  writeBoolean(MUTED_KEY, value);
  emit();
}

export function getStoredSymbolsEnabled(): boolean {
  if (symbolsCache === null) symbolsCache = readBoolean(SYMBOLS_KEY, false);
  return symbolsCache;
}

export function setStoredSymbolsEnabled(value: boolean): void {
  symbolsCache = value;
  writeBoolean(SYMBOLS_KEY, value);
  emit();
}
