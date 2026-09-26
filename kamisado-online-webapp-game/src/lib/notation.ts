import { Color, Coordinate, Move, MoveType, PlayerSide } from '@kamisado/engine';

export function squareName(coord: Coordinate): string {
  const file = String.fromCharCode(97 + coord.col);
  const rank = coord.row + 1;
  return `${file}${rank}`;
}

export function formatMove(moveNumber: number, move: Move, nextColor: Color | null): string {
  const player = move.playerSide === PlayerSide.BLACK ? 'Black' : 'Gold';
  const colorLabel = move.towerColor;
  const nextLabel = nextColor ? ` (${nextColor})` : '';

  if (move.type === MoveType.PASS) {
    return `${moveNumber}. ${player} ${colorLabel} PASS${nextLabel}`;
  }
  if (move.type === MoveType.SUMO_PUSH) {
    const pushed = move.pushedTowers?.[move.pushedTowers.length - 1];
    const pushedFrom = squareName(move.to); // contact cell before the chain shifted, approximated by push target
    const pushedTo = pushed ? squareName(pushed.position) : '';
    return `${moveNumber}. ${player} ${colorLabel} ${squareName(move.from)} PUSH ${pushedFrom}->${pushedTo}${nextLabel}`;
  }
  return `${moveNumber}. ${player} ${colorLabel} ${squareName(move.from)}-${squareName(move.to)}${nextLabel}`;
}
