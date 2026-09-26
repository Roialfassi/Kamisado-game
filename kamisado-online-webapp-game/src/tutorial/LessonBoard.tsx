import { GameState, Move, PlayerSide } from '@kamisado/engine';
import { Board } from '../components/Board.js';

export function LessonBoard({ state, legal = [] }: { state: GameState; legal?: Move[] }) {
  return (
    <div className="flex justify-center">
      <div className="pointer-events-none">
        <Board
          state={state}
          perspective={PlayerSide.BLACK}
          selected={null}
          legalDestinations={legal}
          symbolsEnabled={false}
          interactive={false}
          onSquareClick={() => {}}
        />
      </div>
    </div>
  );
}
