import { useSyncExternalStore } from 'react';
import {
  getStoredMuted,
  getStoredSymbolsEnabled,
  setStoredSymbolsEnabled,
  subscribePreferences,
} from './preferences.js';
import { setMuted } from './sound.js';

/** Colourblind/kanji symbols on the towers - shared by every screen. */
export function useSymbolsEnabled(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribePreferences, getStoredSymbolsEnabled, () => false);
  return [value, setStoredSymbolsEnabled];
}

/** Sound effects muted flag - shared by every screen. */
export function useMuted(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribePreferences, getStoredMuted, () => false);
  return [value, setMuted];
}
