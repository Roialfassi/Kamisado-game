import { Position, goalRow } from './position.js';

/** Score for a mate (win of the round); shorter mates score higher. */
export const MATE = 30000;
/** Any score above this is a forced win/loss found by search. */
export const MATE_BOUND = MATE - 512;
/** Leaf bonus when the side to move already has a winning slide. */
const WIN_NEXT = 9000;

export interface EvalWeights {
  /** Points per tower by rows advanced (0..6). */
  advance: number[];
  /** A tower with a clear line to the goal: whichever colour lands on its square hands over the win. */
  threat: number;
  /** Second and further threats: they shrink the squares the opponent may safely land on. */
  extraThreat: number;
  /** Free forward squares around the towers (freedom of manoeuvre). */
  freedom: number;
}

export const DEFAULT_WEIGHTS: EvalWeights = {
  advance: [0, 3, 8, 16, 28, 44, 66],
  threat: 90,
  extraThreat: 60,
  freedom: 2,
};

function sideScore(pos: Position, side: number, w: EvalWeights): number {
  let score = 0;
  let threats = 0;
  const goal = goalRow(side);
  for (let c = 0; c < 8; c++) {
    const t = side * 8 + c;
    const row = pos.pos[t]! >> 3;
    const adv = Math.abs(goal === 7 ? row : 7 - row);
    score += w.advance[Math.min(adv, 6)]!;
    if (pos.canReachGoal(t)) threats++;
  }
  if (threats > 0) score += w.threat + (threats - 1) * w.extraThreat;
  return score;
}

/** Static evaluation from the point of view of the side to move. */
export function evaluate(pos: Position, w: EvalWeights = DEFAULT_WEIGHTS): number {
  const me = pos.active;
  // The forced tower can already slide home: the round is (about to be) won.
  if (pos.required >= 0 && pos.canReachGoal(me * 8 + pos.required)) return WIN_NEXT;

  let score = sideScore(pos, me, w) - sideScore(pos, 1 - me, w);

  if (w.freedom !== 0) {
    let free = 0;
    for (let s = 0; s < 2; s++) {
      const sign = s === me ? 1 : -1;
      for (let c = 0; c < 8; c++) {
        const t = s * 8 + c;
        const cell = pos.pos[t]!;
        const nr = (cell >> 3) + (s === 0 ? 1 : -1);
        if (nr < 0 || nr > 7) continue;
        const col = cell & 7;
        let n = 0;
        if (pos.occ[nr * 8 + col] === -1) n++;
        if (col > 0 && pos.occ[nr * 8 + col - 1] === -1) n++;
        if (col < 7 && pos.occ[nr * 8 + col + 1] === -1) n++;
        free += sign * n;
      }
    }
    score += free * w.freedom;
  }
  return score;
}
