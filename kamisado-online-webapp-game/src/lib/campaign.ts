import { MatchFormat } from '@kamisado/engine';
import type { BotLevel } from '@kamisado/ai/levels';

/** "The Dragon's Ascent": ten opponents, each unlocked by beating the one before. */
export interface Stage {
  id: string;
  name: string;
  title: string;
  level: BotLevel;
  format: MatchFormat;
  /** Which side you play (alternates so both colours get practice). */
  humanSide: 'BLACK' | 'GOLD';
  blurb: string;
  win: string;
  lose: string;
}

export const STAGES: Stage[] = [
  { id: 'hikari', name: 'Hikari', title: 'The Temple Novice', level: 'APPRENTICE', format: MatchFormat.SINGLE_ROUND, humanSide: 'BLACK', blurb: 'Sweeps the courtyard by day, plays towers by night.', win: 'You move like the wind! I have so much to learn.', lose: "The colour lock is tricky, isn't it? Let's go again." },
  { id: 'daichi', name: 'Daichi', title: 'The Gatekeeper', level: 'APPRENTICE', format: MatchFormat.STANDARD, humanSide: 'GOLD', blurb: 'Guards the first gate. First to three rounds passes.', win: 'The gate is yours. Do not look back.', lose: 'The gate stays shut. Study the colours and return.' },
  { id: 'sora', name: 'Sora', title: 'The Wandering Student', level: 'STUDENT', format: MatchFormat.SINGLE_ROUND, humanSide: 'BLACK', blurb: 'Never hands you an easy win - but does not plan far.', win: 'A single round, cleanly taken. Well played.', lose: 'One slip is all it takes. Again?' },
  { id: 'akira', name: 'Akira', title: 'The Quick Hand', level: 'STUDENT', format: MatchFormat.STANDARD, humanSide: 'GOLD', blurb: 'Fast, sharp and just a little careless.', win: 'You saw it before I did. Impressive.', lose: 'Too slow! Speed is a weapon.' },
  { id: 'ren', name: 'Ren', title: 'The Masterless Ronin', level: 'RONIN', format: MatchFormat.SINGLE_ROUND, humanSide: 'BLACK', blurb: 'Thinks a couple of moves ahead. Punishes hasty play.', win: 'Even without a master, you found the line. Respect.', lose: 'You gave me a colour I could use. Never do that.' },
  { id: 'yuki', name: 'Yuki', title: 'The Snow Strategist', level: 'RONIN', format: MatchFormat.STANDARD, humanSide: 'GOLD', blurb: 'Patient as winter. Waits for your first mistake.', win: 'The snow melts. You are stronger than I thought.', lose: 'Winter is long. Try again in spring.' },
  { id: 'takeshi', name: 'Takeshi', title: 'The Samurai', level: 'SAMURAI', format: MatchFormat.SINGLE_ROUND, humanSide: 'BLACK', blurb: 'Reads the board several moves deep and rarely errs.', win: 'A worthy blade. I bow to you.', lose: 'The board does not forgive. Sharpen your eye.' },
  { id: 'hana', name: 'Hana', title: 'The Blade Dancer', level: 'SAMURAI', format: MatchFormat.STANDARD, humanSide: 'GOLD', blurb: 'Every move a flourish, every flourish a trap.', win: 'You danced better than I did.', lose: 'The last trap was the best one. Come back.' },
  { id: 'ryu', name: 'Ryu', title: 'Heir of the Dragon', level: 'DRAGON_MASTER', format: MatchFormat.SINGLE_ROUND, humanSide: 'BLACK', blurb: 'Trained by the Dragon itself. Sees forced lines far ahead.', win: 'Impossible... You have earned an audience with the Dragon.', lose: 'A forced line, and you walked into it. Think further.' },
  { id: 'dragon', name: 'The Dragon', title: 'Dragon Master', level: 'DRAGON_MASTER', format: MatchFormat.STANDARD, humanSide: 'BLACK', blurb: 'The final guardian. It calculates every forced sequence to the end.', win: 'After a thousand years, a new Dragon Master rises.', lose: 'Not yet, little tower. Not yet.' },
];

const KEY = 'kamisado.campaign.v1';

export function loadBeaten(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = new Set(STAGES.map((s) => s.id));
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string' && known.has(x)))];
  } catch {
    return [];
  }
}

export function markBeaten(id: string): string[] {
  const beaten = loadBeaten();
  if (!STAGES.some((s) => s.id === id) || beaten.includes(id)) return beaten;
  const next = [...beaten, id];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: progress just won't persist
  }
  return next;
}

export function resetCampaign(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** A stage is open once the stage before it has been beaten (the first is always open). */
export function isUnlocked(beaten: string[], index: number): boolean {
  return index === 0 || beaten.includes(STAGES[index - 1]!.id);
}

/** Index of the first stage that is unlocked but not yet beaten (STAGES.length when everything is beaten). */
export function currentStageIndex(beaten: string[]): number {
  const i = STAGES.findIndex((s) => !beaten.includes(s.id));
  return i === -1 ? STAGES.length : i;
}
