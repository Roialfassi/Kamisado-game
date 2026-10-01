import { describe, expect, it } from 'vitest';
import { Color, GameStatus, MatchFormat, MoveType, PlayerSide, applyMove, createGame, getLegalMoves } from '@kamisado/engine';
import { announceState, describeMove } from './announce.js';

describe('screen-reader announcements', () => {
  const start = createGame(MatchFormat.STANDARD);
  const move = getLegalMoves(start, Color.RED).find((m) => m.to.row === 3 && m.to.col === 2)!;
  const after = applyMove(start, move).state!;
  const names = { black: 'Black', gold: 'Gold' };

  it('describes a move by tower colour and squares', () => {
    expect(describeMove(move)).toBe("Black's Red tower moved from c1 to c4.");
  });

  it('says whose turn it is and which tower is forced', () => {
    expect(announceState(after, move, names)).toBe("Black's Red tower moved from c1 to c4. Gold to move. Move the Green tower.");
    expect(announceState(after, move, { ...names, you: PlayerSide.GOLD })).toContain('Your turn. Move the Green tower.');
    expect(announceState(after, move, names, true)).toContain('Gold is thinking');
  });

  it('announces a stymied tower passing (the pass is the engine\'s last move, not in the history)', () => {
    const pass = { ...move, type: MoveType.PASS, playerSide: PlayerSide.GOLD, towerColor: Color.GREEN };
    const text = announceState({ ...after, lastMove: pass }, move, names);
    expect(text).toContain("Black's Red tower moved from c1 to c4. Gold's Green tower was blocked and passed.");
    // the same pass is not read twice when it is already the move being described
    expect(announceState({ ...after, lastMove: pass }, pass, names).match(/blocked and passed/g)).toHaveLength(1);
  });

  it('announces a free choice and the end of a round / match', () => {
    expect(announceState(start, null, names)).toBe('Black to move. Choose any tower.');
    expect(announceState({ ...after, status: GameStatus.ROUND_OVER, roundWinner: PlayerSide.GOLD }, move, names)).toContain('Round 1 over. Gold wins the round.');
    expect(announceState({ ...after, status: GameStatus.MATCH_OVER, matchWinner: PlayerSide.BLACK }, null, names)).toBe('Match over. Black wins the match.');
  });
});
