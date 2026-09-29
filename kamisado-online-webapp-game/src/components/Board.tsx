import { Color, Coordinate, GameState, Move, MoveType, PlayerSide, findTowerAt } from '@kamisado/engine';
import { COLOR_HEX, COLOR_KANJI, isDarkSquare } from '../lib/theme.js';
import { TowerPiece } from './TowerPiece.js';
import { getMustMoveTower, getPickableTowers } from '../lib/mustMove.js';

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

export function Board({
  state,
  perspective,
  selected,
  legalDestinations,
  symbolsEnabled,
  interactive,
  onSquareClick,
}: BoardProps) {
  const { rows, cols } = visualOrder(perspective);
  // The colour lock's forced tower is always ringed (whoever's turn it is), and
  // on a free-choice turn every movable tower of a player who can act is ringed.
  const mustMoveId = getMustMoveTower(state)?.id ?? null;
  const pickableIds = new Set(interactive ? getPickableTowers(state).map((t) => t.id) : []);
  const destinationSet = new Map(legalDestinations.map((m) => [`${m.to.row},${m.to.col}`, m]));

  return (
    <div
      className="relative select-none p-3 sm:p-4 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_2px_rgba(255,255,255,0.18)]"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #3a2014 0%, #201008 60%, #130804 100%)',
        border: '3px solid #5a351e',
        maxWidth: '100vw',
      }}
    >
      {/* Top File Coordinate Markers (a-h) */}
      <div className="grid pl-6 pr-6 pb-1 text-center font-mono text-xs font-semibold tracking-wider text-[#d4af37]/75" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
        {cols.map((col) => (
          <span key={`top-${col}`}>{String.fromCharCode(97 + col)}</span>
        ))}
      </div>

      <div className="flex items-center">
        {/* Left Rank Coordinate Markers (1-8) */}
        <div className="flex flex-col justify-around pr-2 text-center font-mono text-xs font-semibold text-[#d4af37]/75" style={{ height: 'min(86vw, 540px)', width: '1.25rem' }}>
          {rows.map((row) => (
            <span key={`left-${row}`}>{row + 1}</span>
          ))}
        </div>

        {/* 8x8 Goban Tile Inlay Grid */}
        <div
          className="grid gap-[2px] p-[2px] rounded-lg shadow-[inset_0_3px_8px_rgba(0,0,0,0.85)] bg-[#120803]"
          style={{
            gridTemplateColumns: 'repeat(8, minmax(0,1fr))',
            width: 'min(86vw, 540px)',
            aspectRatio: '1 / 1',
          }}
          role="grid"
          aria-label="Kamisado board"
        >
          {rows.map((row) =>
            cols.map((col) => {
              const color: Color = state.boardLayout[row]![col]!;
              const tower = findTowerAt(state, row, col);
              const key = `${row},${col}`;
              const isSelected = selected?.row === row && selected?.col === col;
              const isMustMove = !!tower && tower.id === mustMoveId;
              const isPickable = !!tower && pickableIds.has(tower.id);
              const destMove = destinationSet.get(key);
              const isDestination = !!destMove;
              const isPushTarget = destMove?.type === MoveType.SUMO_PUSH;
              const kanji = COLOR_KANJI[color];
              const dark = isDarkSquare(color);

              return (
                <button
                  type="button"
                  key={key}
                  role="gridcell"
                  aria-label={`${color} square, ${tower ? `${tower.side} ${tower.color} tower${isMustMove ? ', must move this turn' : ''}` : 'empty'}`}
                  data-must-move={isMustMove ? 'true' : undefined}
                  data-testid="square"
                  data-row={row}
                  data-col={col}
                  disabled={!interactive}
                  onClick={() => onSquareClick({ row, col })}
                  className={`group relative flex items-center justify-center aspect-square focus:outline-none transition-all duration-150 overflow-hidden ${
                    interactive ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  style={{
                    backgroundColor: COLOR_HEX[color],
                    boxShadow: isSelected
                      ? 'inset 0 0 0 3px #ffd700, 0 0 15px rgba(255,215,0,0.8)'
                      : 'inset 1px 1px 1px rgba(255,255,255,0.22), inset -1px -1px 2px rgba(0,0,0,0.38)',
                  }}
                >
                  {/* Subtle Japanese Lacquer Tile Surface Sheen */}
                  <span
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{
                      background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18) 0%, transparent 70%)',
                    }}
                  />

                  {/* Authentic Japanese Kanji Tile Watermark / Inscription */}
                  <span
                    className={`pointer-events-none absolute font-serif select-none transition-opacity duration-200 leading-none ${
                      symbolsEnabled ? 'opacity-70 text-sm sm:text-base font-bold' : 'opacity-20 text-xs sm:text-sm'
                    }`}
                    style={{
                      color: dark ? '#fff3d1' : '#1c0f08',
                      textShadow: dark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 1px rgba(255,255,255,0.6)',
                    }}
                  >
                    {!tower && kanji}
                  </span>

                  {/* Legal Destination Highlight (Glowing Golden Lotus Circle) */}
                  {isDestination && !isPushTarget && (
                    <span data-testid="legal-destination" className="pointer-events-none absolute z-15 flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-amber-200 bg-amber-300/40 backdrop-blur-[0.5px] shadow-[0_0_12px_rgba(252,211,77,0.85)] animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-amber-100 shadow-sm" />
                    </span>
                  )}

                  {/* Sumo Push Target Highlight (Combat Dragon Reticle) */}
                  {isDestination && isPushTarget && (
                    <span data-testid="legal-destination" className="pointer-events-none absolute inset-0 z-15 flex items-center justify-center border-4 border-red-500 bg-red-600/35 shadow-[0_0_20px_rgba(239,68,68,0.9)] animate-pulse">
                      <span className="text-white text-xs font-bold font-mono tracking-tighter bg-red-700/80 px-1 rounded shadow">
                        PUSH
                      </span>
                    </span>
                  )}

                  {/* Selected Tower Tile Glowing Ring */}
                  {isSelected && (
                    <span className="pointer-events-none absolute inset-0 ring-4 ring-amber-300/90 ring-inset shadow-[0_0_16px_rgba(251,191,36,0.9)] z-20" />
                  )}

                  {isMustMove && <span className="must-move-halo" data-testid="must-move-halo" />}
                  {isPickable && <span className="pickable-ring" data-testid="pickable-ring" />}

                  {/* 3D Pagoda Dragon Tower Piece */}
                  {tower && (
                    <TowerPiece
                      side={tower.side}
                      color={tower.color}
                      sumoRank={tower.sumoRank}
                      selected={isSelected}
                      symbolsEnabled={symbolsEnabled}
                      size={46}
                    />
                  )}
                </button>
              );
            }),
          )}
        </div>

        {/* Right Rank Coordinate Markers (1-8) */}
        <div className="flex flex-col justify-around pl-2 text-center font-mono text-xs font-semibold text-[#d4af37]/75" style={{ height: 'min(86vw, 540px)', width: '1.25rem' }}>
          {rows.map((row) => (
            <span key={`right-${row}`}>{row + 1}</span>
          ))}
        </div>
      </div>

      {/* Bottom File Coordinate Markers (a-h) */}
      <div className="grid pl-6 pr-6 pt-1 text-center font-mono text-xs font-semibold tracking-wider text-[#d4af37]/75" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
        {cols.map((col) => (
          <span key={`bottom-${col}`}>{String.fromCharCode(97 + col)}</span>
        ))}
      </div>
    </div>
  );
}
