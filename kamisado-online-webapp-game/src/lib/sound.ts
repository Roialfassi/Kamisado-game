/**
 * Tiny procedural sound effects via WebAudio - no external audio assets to
 * fetch or license. Each effect is a short synthesized click/thud/chime.
 */

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function tone(freq: number, durationMs: number, type: OscillatorType, gainPeak: number, delayMs = 0): void {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = audio.currentTime + delayMs / 1000;
  const end = start + durationMs / 1000;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** Wooden click as a piece is picked up / hovers a valid tile. */
export function playTick(): void {
  tone(720, 40, 'square', 0.05);
}

/** Crisp slide-and-clack when a piece lands on its destination. */
export function playPlace(): void {
  tone(180, 70, 'triangle', 0.18);
  tone(420, 50, 'square', 0.08, 25);
}

/** Heavy dual pulse for a Sumo push. */
export function playSumoPush(): void {
  tone(90, 140, 'sawtooth', 0.22);
  tone(70, 160, 'sawtooth', 0.2, 90);
}

/** Ceremonial chime on round/match victory. */
export function playVictory(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 260, 'sine', 0.12, i * 90));
}

/** Soft blocked/pass notification. */
export function playPass(): void {
  tone(260, 90, 'sine', 0.08);
}
