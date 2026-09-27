export interface TimeControl {
  id: string;
  label: string;
  initialMs: number;
  incrementMs: number;
}

/** null = untimed (no clock at all). */
export type TimeControlChoice = TimeControl | null;

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'blitz', label: 'Blitz (1m +2s)', initialMs: 60_000, incrementMs: 2_000 },
  { id: 'rapid', label: 'Rapid (5m +5s)', initialMs: 5 * 60_000, incrementMs: 5_000 },
  { id: 'classical', label: 'Classical (15m)', initialMs: 15 * 60_000, incrementMs: 0 },
];
