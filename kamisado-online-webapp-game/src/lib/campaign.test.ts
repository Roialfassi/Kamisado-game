import { beforeEach, describe, expect, it } from 'vitest';
import { STAGES, currentStageIndex, isUnlocked, loadBeaten, markBeaten, resetCampaign } from './campaign.js';

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

describe('campaign progress', () => {
  beforeEach(() => store.clear());

  it('has ten stages with unique ids that climb through every bot level', () => {
    expect(STAGES).toHaveLength(10);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(10);
    const levels = STAGES.map((s) => s.level);
    for (const level of ['APPRENTICE', 'STUDENT', 'RONIN', 'SAMURAI', 'DRAGON_MASTER'] as const) expect(levels).toContain(level);
    // never gets easier
    const order = ['APPRENTICE', 'STUDENT', 'RONIN', 'SAMURAI', 'DRAGON_MASTER'];
    for (let i = 1; i < levels.length; i++) expect(order.indexOf(levels[i]!)).toBeGreaterThanOrEqual(order.indexOf(levels[i - 1]!));
  });

  it('unlocks stages in order', () => {
    expect(isUnlocked([], 0)).toBe(true);
    expect(isUnlocked([], 1)).toBe(false);
    const beaten = markBeaten(STAGES[0]!.id);
    expect(isUnlocked(beaten, 1)).toBe(true);
    expect(isUnlocked(beaten, 2)).toBe(false);
    expect(currentStageIndex(beaten)).toBe(1);
  });

  it('persists, de-duplicates and ignores junk', () => {
    markBeaten('hikari');
    markBeaten('hikari');
    markBeaten('not-a-stage');
    expect(loadBeaten()).toEqual(['hikari']);
    store.set('kamisado.campaign.v1', JSON.stringify(['hikari', 7, 'ghost', 'daichi']));
    expect(loadBeaten()).toEqual(['hikari', 'daichi']);
    store.set('kamisado.campaign.v1', '{oops');
    expect(loadBeaten()).toEqual([]);
    resetCampaign();
    expect(currentStageIndex(loadBeaten())).toBe(0);
  });

  it('reports completion', () => {
    for (const s of STAGES) markBeaten(s.id);
    expect(currentStageIndex(loadBeaten())).toBe(STAGES.length);
  });
});
