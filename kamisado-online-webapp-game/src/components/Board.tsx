import { CSSProperties, KeyboardEvent, useRef, useState } from 'react';
import { Color, Coordinate, GameState, Move, MoveType, PlayerSide, findTowerAt } from '@kamisado/engine';
import { COLOR_HEX, COLOR_KANJI, isDarkSquare } from '../lib/theme.js';
import { getMustMoveTower, getPickableTowers } from '../lib/mustMove.js';
import { TowerPiece } from './TowerPiece.js';

export interface BoardProps {
  state: GameState;
  perspective: PlayerSide;
  selected: Coordinate | null;
  legalDestinations: Move[];
  symbolsEnabled: boolean;
  interactive: boolean;
  onSquareClick: (coord: Coordinate) => void;
  /** The last physical move, tinted on the board. Defaults to `state.lastMove`
   * when that is a real move (passes are not shown). */
  lastMove?: Move | null;
  /** A suggested move (from the hint button), drawn in teal. */
  hint?: Move | null;
  /** Overrides the responsive default board width (any CSS length). */
  size?: string;
}

function visualOrder(perspective: PlayerSide): { rows: number[]; cols: number[] } {
  if (perspective === PlayerSide.BLACK) {
    return { rows: [7, 6, 5, 4, 3, 2, 1, 0], cols: [0, 1, 2, 3, 4, 5, 6, 7] };
  }
  return { rows: [0, 1, 2, 3, 4, 5, 6, 7], cols: [7, 6, 5, 4, 3, 2, 1, 0] };
}

const RAIL = '1.1rem';

function isSelectedTower(selected: Coordinate | null, position: Coordinate): boolean {
  return !!selected && selected.row === position.row && selected.col === position.col;
}

export function Board({
  state,
  perspective,
  selected,
  legalDestinations,
  symbolsEnabled,
  interactive,
  onSquareClick,
  lastMove,
  hint,
  size,
}: BoardProps) {
  const { rows, cols } = visualOrder(perspective);

  // The colour lock's forced tower is always ringed (whoever's turn it is), and
  // on a free-choice turn every movable tower of a player who can act is ringed.
  const mustMoveId = getMustMoveTower(state)?.id ?? null;
  const pickableIds = new Set(interactive ? getPickableTowers(state).map((t) => t.id) : []);
  const destinationSet = new Map(legalDestinations.map((m) => [`${m.to.row},${m.to.col}`, m]));

  const shownLastMove = lastMove !== undefined ? lastMove : state.lastMove;
  const trail = shownLastMove && shownLastMove.type !== MoveType.PASS ? shownLastMove : null;

  const frameVars = { ...(size ? { '--board-size': size } : {}) } as CSSProperties;

  // Keyboard: a roving tabindex (one tab stop) moved with the arrow keys; Enter/Space click the focused square.
  const [cursor, setCursor] = useState<Coordinate | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const fallback: Coordinate = selected ?? getMustMoveTower(state)?.position ?? { row: rows[7]!, col: cols[0]! };
  const cur = cursor ?? fallback;
  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return; // browser shortcuts (Alt+Left = back, Ctrl+Home...) stay theirs
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-testid=square]');
    if (!target) return;
    let vr = rows.indexOf(Number(target.dataset.row));
    let vc = cols.indexOf(Number(target.dataset.col));
    switch (e.key) {
      case 'ArrowUp':
        vr = Math.max(0, vr - 1);
        break;
      case 'ArrowDown':
        vr = Math.min(7, vr + 1);
        break;
      case 'ArrowLeft':
        vc = Math.max(0, vc - 1);
        break;
      case 'ArrowRight':
        vc = Math.min(7, vc + 1);
        break;
      case 'Home':
        vc = 0;
        break;
      case 'End':
        vc = 7;
        break;
      case 'PageUp':
        vr = 0;
        break;
      case 'PageDown':
        vr = 7;
        break;
      default:
        return;
    }
    e.preventDefault();
    const next = { row: rows[vr]!, col: cols[vc]! };
    setCursor(next);
    buttons.current.get(`${next.row},${next.col}`)?.focus();
  };

  return (
    <div
      className="relative inline-block select-none rounded-[22px] p-2 sm:p-3.5"
      style={{
        ...frameVars,
        background: 'radial-gradient(ellipse at 50% 20%, #3b2113 0%, #24120a 55%, #150a05 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow:
          '0 30px 70px -24px rgba(0,0,0,0.95), 0 0 0 4px rgba(90,53,30,0.55), inset 0 1px 1px rgba(255,255,255,0.16)',
      }}
    >
      <div
        className="grid text-center font-mono text-[10px] font-semibold text-[#e8c565]/70 sm:text-xs"
        style={{
          gridTemplateColumns: `${RAIL} var(--board-size) ${RAIL}`,
          gridTemplateRows: `${RAIL} var(--board-size) ${RAIL}`,
        }}
      >
        <span />
        <div className="grid grid-cols-8 items-center">
          {cols.map((col) => (
            <span key={`top-${col}`}>{String.fromCharCode(97 + col)}</span>
          ))}
        </div>
        <span />

        <div className="grid grid-rows-8 items-center">
          {rows.map((row) => (
            <span key={`left-${row}`}>{row + 1}</span>
          ))}
        </div>

        {/* 8x8 goban: exact 1/8 cells so the rails and the tower layer line up. */}
        <div
          className="relative overflow-hidden rounded-md bg-[#120803] shadow-[inset_0_2px_10px_rgba(0,0,0,0.85),0_0_0_1px_rgba(0,0,0,0.6)]"
          role="grid"
          aria-label="Kamisado board. Use the arrow keys to move between squares and Enter to select."
          aria-rowcount={8}
          aria-colcount={8}
          onKeyDown={onGridKeyDown}
        >
          <div className="grid h-full w-full grid-cols-8 grid-rows-8">
            {rows.map((row) => (
              <div key={`row-${row}`} role="row" className="contents">
                {cols.map((col) => {
                const color: Color = state.boardLayout[row]![col]!;
                const tower = findTowerAt(state, row, col);
                const key = `${row},${col}`;
                const isSelected = selected?.row === row && selected?.col === col;
                const destMove = destinationSet.get(key);
                const isDestination = !!destMove;
                const isPushTarget = destMove?.type === MoveType.SUMO_PUSH;
                const isMustMove = !!tower && tower.id === mustMoveId;
                const isPickable = !!tower && pickableIds.has(tower.id);
                const isTrailFrom = trail?.from.row === row && trail.from.col === col;
                const isTrailTo = trail?.to.row === row && trail.to.col === col;
                const isHintFrom = hint?.from.row === row && hint.from.col === col;
                const isHintTo = hint?.to.row === row && hint.to.col === col;
                const dark = isDarkSquare(color);

                return (
                  <button
                    type="button"
                    key={key}
                    role="gridcell"
                    ref={(el) => {
                      if (el) buttons.current.set(key, el);
                      else buttons.current.delete(key);
                    }}
                    aria-selected={isSelected}
                    aria-label={`${String.fromCharCode(97 + col)}${row + 1}, ${color} square, ${
                      tower ? `${tower.side} ${tower.color} tower${isMustMove ? ', must move this turn' : ''}` : 'empty'
                    }${isSelected ? ', selected' : ''}${isDestination ? (isPushTarget ? ', legal push' : ', legal move') : ''}${isHintFrom ? ', suggested move from here' : ''}${isHintTo ? ', suggested destination' : ''}`}
                    data-testid="square"
                    data-row={row}
                    data-col={col}
                    data-tower-side={tower?.side}
                    data-tower-color={tower?.color}
                    data-must-move={isMustMove ? 'true' : undefined}
                    aria-disabled={!interactive}
                    tabIndex={cur.row === row && cur.col === col ? 0 : -1}
                    onFocus={() => setCursor({ row, col })}
                    onClick={() => {
                      if (interactive) onSquareClick({ row, col });
                    }}
                    className={`group relative flex aspect-square items-center justify-center overflow-hidden focus:outline-none focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${
                      interactive ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    style={{
                      backgroundColor: COLOR_HEX[color],
                      boxShadow: isSelected
                        ? 'inset 0 0 0 2px #16110a, inset 0 0 0 5px #fff3b0, 0 0 15px rgba(255,215,0,0.8)'
                        : 'inset 1px 1px 1px rgba(255,255,255,0.22), inset -1px -1px 2px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(0,0,0,0.28)',
                    }}
                  >
                    {/* lacquer sheen */}
                    <span
                      className="pointer-events-none absolute inset-0 opacity-40"
                      style={{ background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18) 0%, transparent 70%)' }}
                    />

                    {/* kanji inscription (hidden under a tower) */}
                    {!tower && !isDestination && (
                      <span
                        className={`pointer-events-none absolute font-brand leading-none ${
                          symbolsEnabled ? 'text-base font-black opacity-80 sm:text-xl' : 'text-sm font-bold opacity-40 sm:text-lg'
                        }`}
                        style={{
                          color: dark ? '#fff3d1' : '#1c0f08',
                          textShadow: dark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 1px rgba(255,255,255,0.5)',
                        }}
                      >
                        {COLOR_KANJI[color]}
                      </span>
                    )}

                    {/* last-move trail */}
                    {(isTrailFrom || isTrailTo) && (
                      <span
                        data-testid={isTrailTo ? 'last-move-to' : 'last-move-from'}
                        className={`pointer-events-none absolute inset-0 ${
                          isTrailTo ? 'bg-amber-200/30 ring-2 ring-inset ring-amber-200/70' : 'bg-amber-200/15 ring-1 ring-inset ring-amber-200/40'
                        }`}
                      />
                    )}

                    {/* legal destination: a dot that stays readable on light and dark tiles */}
                    {isDestination && !isPushTarget && (
                      <span
                        data-testid="legal-destination"
                        className="pointer-events-none absolute z-10 flex h-[34%] w-[34%] items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-125"
                        style={{
                          backgroundColor: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.62)',
                          boxShadow: dark
                            ? '0 0 0 4px rgba(255,255,255,0.28), 0 0 12px rgba(255,255,255,0.55)'
                            : '0 0 0 4px rgba(0,0,0,0.22), 0 0 10px rgba(255,255,255,0.35)',
                        }}
                      />
                    )}

                    {/* sumo push target */}
                    {isDestination && isPushTarget && (
                      <span
                        data-testid="legal-destination"
                        className="pointer-events-none absolute inset-0 z-[26] flex animate-pulse items-center justify-center bg-red-600/35 ring-4 ring-inset ring-red-500"
                      >
                        <span className="rounded bg-red-700/90 px-1 font-mono text-[10px] font-bold tracking-tight text-white shadow">PUSH</span>
                      </span>
                    )}

                    {isHintFrom && <span className="hint-from" data-testid="hint-from" />}
                    {isHintTo && <span className="hint-to" data-testid="hint-to" />}
                    {isMustMove && <span className="must-move-halo" data-testid="must-move-halo" />}
                    {isPickable && <span className="pickable-ring" data-testid="pickable-ring" />}
                  </button>
                );
                })}
              </div>
            ))}
          </div>

          {/* Tower layer: each piece keeps its DOM node (keyed by id) and is moved
              with a transform, so a move renders as a smooth slide. */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {Object.values(state.towers).map((tower) => {
              const vRow = rows.indexOf(tower.position.row);
              const vCol = cols.indexOf(tower.position.col);
              const lifted = isSelectedTower(selected, tower.position);
              return (
                <div
                  key={tower.id}
                  className="tower-slot"
                  data-testid="tower-slot"
                  data-tower-id={tower.id}
                  style={{ transform: `translate(${vCol * 100}%, ${vRow * 100}%)`, zIndex: lifted ? 30 : 20 }}
                >
                  <TowerPiece
                    side={tower.side}
                    color={tower.color}
                    sumoRank={tower.sumoRank}
                    selected={lifted}
                    symbolsEnabled={symbolsEnabled}
                    size="88%"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-rows-8 items-center">
          {rows.map((row) => (
            <span key={`right-${row}`}>{row + 1}</span>
          ))}
        </div>

        <span />
        <div className="grid grid-cols-8 items-center">
          {cols.map((col) => (
            <span key={`bottom-${col}`}>{String.fromCharCode(97 + col)}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}
