import { describe, expect, it } from 'vitest';
import { Color, GameStatus, MatchFormat, PlayerSide, getLegalMoves, towerId } from '@kamisado/engine';
import { applyResignation, applyRoomMove, applyRoomRegroup, getOrCreateRoom } from './rooms.js';

let counter = 0;
const freshRoom = (format: MatchFormat = MatchFormat.STANDARD) => getOrCreateRoom(`test-room-${counter++}`, format);

describe('room resignation', () => {
  it('awards the opponent a point and ends the round', () => {
    const room = freshRoom();
    const outcome = applyResignation(room, PlayerSide.BLACK);
    expect('error' in outcome).toBe(false);
    expect(room.gameState.status).toBe(GameStatus.ROUND_OVER);
    expect(room.gameState.roundWinner).toBe(PlayerSide.GOLD);
    expect(room.gameState.scores[PlayerSide.GOLD].points).toBe(1);
  });

  it('ends a single-round match outright', () => {
    const room = freshRoom(MatchFormat.SINGLE_ROUND);
    applyResignation(room, PlayerSide.GOLD);
    expect(room.gameState.status).toBe(GameStatus.MATCH_OVER);
    expect(room.gameState.matchWinner).toBe(PlayerSide.BLACK);
  });

  it('refuses to resign a finished round or match (no free points, no reopened match)', () => {
    const room = freshRoom(MatchFormat.SINGLE_ROUND);
    applyResignation(room, PlayerSide.GOLD); // Black wins the match
    const before = JSON.stringify(room.gameState);
    const again = applyResignation(room, PlayerSide.BLACK);
    expect(again).toEqual({ error: 'Only a round in progress can be resigned' });
    expect(JSON.stringify(room.gameState)).toBe(before);

    const round = freshRoom();
    applyResignation(round, PlayerSide.BLACK);
    const points = round.gameState.scores[PlayerSide.GOLD].points;
    expect('error' in applyResignation(round, PlayerSide.GOLD)).toBe(true);
    expect(round.gameState.scores[PlayerSide.GOLD].points).toBe(points);
    expect(round.gameState.roundWinner).toBe(PlayerSide.GOLD);
  });
});

describe('room next-round (REGROUP)', () => {
  it('only works between rounds', () => {
    const room = freshRoom();
    expect(applyRoomRegroup(room)).toBe(false); // in progress
    applyResignation(room, PlayerSide.BLACK);
    expect(applyRoomRegroup(room)).toBe(true);
    expect(room.gameState.currentRound).toBe(2);
    expect(room.gameState.status).toBe(GameStatus.IN_PROGRESS);
    expect(applyRoomRegroup(room)).toBe(false); // a duplicate request must not skip round 3
    expect(room.gameState.currentRound).toBe(2);
  });

  it('is refused once the match is over', () => {
    const room = freshRoom(MatchFormat.SINGLE_ROUND);
    applyResignation(room, PlayerSide.GOLD);
    expect(applyRoomRegroup(room)).toBe(false);
    expect(room.gameState.status).toBe(GameStatus.MATCH_OVER);
  });

  it('puts every tower back on its own colour square and keeps scores', () => {
    const room = freshRoom();
    const move = getLegalMoves(room.gameState, Color.RED).find((m) => m.to.row === 3)!;
    const played = applyRoomMove(room, move);
    expect('error' in played).toBe(false);
    applyResignation(room, PlayerSide.GOLD);
    applyRoomRegroup(room);
    expect(room.gameState.towers[towerId(PlayerSide.BLACK, Color.RED)]!.position).toEqual({ row: 0, col: 2 });
    expect(room.gameState.scores[PlayerSide.BLACK].points).toBe(1);
    expect(room.gameState.activePlayer).toBe(PlayerSide.GOLD); // loser (Gold) opens
  });
});
