import { COLOR_LABEL } from './theme.js';
import { GameState, GameStatus, Move, MoveType, PlayerSide } from '@kamisado/engine';

const sideName = (side: PlayerSide) => (side === PlayerSide.BLACK ? 'Black' : 'Gold');
const square = (c: { row: number; col: number }) => `${String.fromCharCode(97 + c.col)}${c.row + 1}`;

/** "Gold moved the Green tower from g8 to g4." */
export function describeMove(move: Move): string {
  const tower = `${sideName(move.playerSide)}'s ${COLOR_LABEL[move.towerColor]} tower`;
  if (move.type === MoveType.SUMO_PUSH) return `${tower} pushed forward from ${square(move.from)}.`;
  if (move.type === MoveType.PASS) return `${tower} was blocked and passed.`;
  return `${tower} moved from ${square(move.from)} to ${square(move.to)}.`;
}

export interface AnnounceNames {
  black: string;
  gold: string;
  /** Which side this listener plays, if any (the announcement then says "Your turn"). */
  you?: PlayerSide | null;
}

/** One screen-reader sentence describing where the game stands after a move. `thinking` = the side to move is a computer. */
export function announceState(state: GameState, lastMove: Move | null, names: AnnounceNames, thinking = false): string {
  const parts: string[] = [];
  if (lastMove) parts.push(describeMove(lastMove));
  // a stymied tower's pass is not in the move history but is the engine's last move
  if (state.lastMove?.type === MoveType.PASS && state.lastMove !== lastMove) parts.push(describeMove(state.lastMove));
  if (state.status === GameStatus.MATCH_OVER) {
    parts.push(`Match over. ${state.matchWinner === PlayerSide.BLACK ? names.black : names.gold} wins the match.`);
    return parts.join(' ');
  }
  if (state.status === GameStatus.ROUND_OVER) {
    parts.push(`Round ${state.currentRound} over. ${state.roundWinner === PlayerSide.BLACK ? names.black : names.gold} wins the round.`);
    return parts.join(' ');
  }
  const active = state.activePlayer === PlayerSide.BLACK ? names.black : names.gold;
  const mine = names.you && names.you === state.activePlayer;
  const who = mine ? 'Your turn' : thinking ? `${active} is thinking` : `${active} to move`;
  const what = state.requiredColor ? `Move the ${COLOR_LABEL[state.requiredColor]} tower.` : 'Choose any tower.';
  parts.push(`${who}. ${mine || !thinking ? what : ''}`.trim());
  return parts.join(' ');
}
