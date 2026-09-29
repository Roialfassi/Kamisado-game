import { useEffect, useMemo, useState } from 'react';
import { PlayerSide } from '@kamisado/engine';
import { Board } from '../components/Board.js';
import { Icon } from '../components/ui/Icon.js';
import { getStreak, isSolvedToday, recordSolve } from '../lib/puzzleProgress.js';
import { puzzleForToday } from '../puzzles/data.js';
import { usePuzzle } from '../puzzles/usePuzzle.js';

export default function DailyPuzzle() {
  const puzzle = useMemo(() => puzzleForToday(), []);
  const puzzleGame = usePuzzle(puzzle);
  const [streak, setStreak] = useState(() => getStreak());
  const [alreadySolved, setAlreadySolved] = useState(() => isSolvedToday(puzzle.id));

  // A real effect (not a render-phase call): runs once when `status`
  // actually transitions to SOLVED, not on every render, so the localStorage
  // write happens exactly once per solve.
  useEffect(() => {
    if (puzzleGame.status !== 'SOLVED') return;
    setStreak(recordSolve(puzzle.id));
    setAlreadySolved(true);
  }, [puzzleGame.status, puzzle.id]);

  const lastMove = puzzleGame.state.lastMove;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <p className="eyebrow">日課 · Daily puzzle</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{puzzle.title}</h1>
        <div className="flex items-center gap-2">
          <span className="chip border-accent/40 bg-accent/10 text-accent-soft" data-testid="streak">
            <Icon name="trophy" size={13} /> {streak} day{streak === 1 ? '' : 's'}
          </span>
          {alreadySolved && <span className="chip border-emerald-400/30 bg-emerald-500/10 text-emerald-300">Solved today</span>}
        </div>
      </div>

      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <Board
          state={puzzleGame.state}
          perspective={PlayerSide.BLACK}
          selected={puzzleGame.selected}
          legalDestinations={puzzleGame.legalDestinations}
          symbolsEnabled={false}
          interactive={puzzleGame.status === 'PLAYING'}
          onSquareClick={puzzleGame.selectSquare}
          lastMove={lastMove}
          size="min(calc(100vw - 5.5rem), 520px)"
        />

        <div className="glass w-full max-w-md space-y-4 p-6">
          <p className="text-sm leading-relaxed text-stone-300">{puzzle.description}</p>
          <div className="flex items-center gap-2">
            <span className="chip">Mate in {puzzle.mateIn}</span>
            <span className="chip" data-testid="moves-left">
              {puzzleGame.movesRemaining} move{puzzleGame.movesRemaining === 1 ? '' : 's'} left
            </span>
          </div>

          {puzzleGame.status === 'SOLVED' && (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300" data-testid="puzzle-solved">
              Solved! Black reaches the home row.
            </p>
          )}
          {puzzleGame.status === 'FAILED' && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
              That line doesn&apos;t work out - look for a different move.
            </p>
          )}

          {puzzleGame.status !== 'PLAYING' && (
            <button onClick={puzzleGame.reset} className="btn btn-primary" data-testid="puzzle-retry">
              <Icon name="refresh" /> Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
