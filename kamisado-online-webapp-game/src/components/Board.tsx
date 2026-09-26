import { Color, Coordinate, GameState, Move, MoveType, PlayerSide, findTowerAt } from '@kamisado/engine';
import { COLOR_HEX, COLOR_SYMBOL, isDarkSquare } from '../lib/theme.js';
import { TowerPiece } from './TowerPiece.js';

export interface BoardProps {
  state: GameState;
  perspective: PlayerSide;
  selected: Coordinate | null;
  legalDestinations: Move[];
  symbolsEnabled: boolean;
  interactive: boolean;
  onSquareClick: (coord: Coordinate) => void;
}

function visualOrder(perspective: PlayerSide): { rows: number[]; cols: number[] } {
  if (perspective === PlayerSide.BLACK) {
    return { rows: [7, 6, 5, 4, 3, 2, 1, 0], cols: [0, 1, 2, 3, 4, 5, 6, 7] };
  }
  return { rows: [0, 1, 2, 3, 4, 5, 6, 7], cols: [7, 6, 5, 4, 3, 2, 1, 0] };
}

export function Board({ state, perspective, selected, legalDestinations, symbolsEnabled, interactive, onSquareClick }: BoardProps) {
  const { rows, cols } = visualOrder(perspective);
  const destinationSet = new Map(legalDestinations.map((m) => [`${m.to.row},${m.to.col}`, m]));

  return (
    <div
      className="grid select-none rounded-lg border-4 border-amber-900/60 shadow-2xl overflow-hidden"
      style={{ gridTemplateColumns: 'repeat(8, minmax(0,1fr))', width: 'min(92vw, 560px)', aspectRatio: '1 / 1' }}
      role="grid"
      aria-label="Kamisado board"
    >
      {rows.map((row) =>
        cols.map((col) => {
          const color: Color = state.boardLayout[row]![col]!;
          const tower = findTowerAt(state, row, col);
          const key = `${row},${col}`;
          const isSelected = selected?.row === row && selected?.col === col;
          const destMove = destinationSet.get(key);
          const isDestination = !!destMove;
          const isPushTarget = destMove?.type === MoveType.SUMO_PUSH;

          return (
            <button
              type="button"
              key={key}
              role="gridcell"
              aria-label={`${color} square, ${tower ? `${tower.side} ${tower.color} tower` : 'empty'}`}
              data-testid="square"
              data-row={row}
              data-col={col}
              disabled={!interactive}
              onClick={() => onSquareClick({ row, col })}
              className={`relative flex items-center justify-center aspect-square focus:outline-none ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{ backgroundColor: COLOR_HEX[color] }}
            >
              {symbolsEnabled && (
                <span
                  className="absolute top-0.5 left-0.5 text-[10px] opacity-60"
                  style={{ color: isDarkSquare(color) ? '#f5e6c8' : '#1a1208' }}
                >
                  {COLOR_SYMBOL[color]}
                </span>
              )}
              {isDestination && (
                <span
                  className={`absolute rounded-full ${isPushTarget ? 'bg-red-500/50 w-full h-full' : 'bg-amber-200/60'} `}
                  style={!isPushTarget ? { width: '32%', height: '32%' } : undefined}
                />
              )}
              {isSelected && <span className="absolute inset-0 ring-4 ring-amber-200/80 ring-inset" />}
              {tower && <TowerPiece side={tower.side} color={tower.color} sumoRank={tower.sumoRank} selected={isSelected} symbolsEnabled={symbolsEnabled} />}
            </button>
          );
        }),
      )}
    </div>
  );
}
