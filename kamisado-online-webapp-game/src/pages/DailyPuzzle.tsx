import { useEffect, useMemo, useState } from 'react';
import { PlayerSide } from '@kamisado/engine';
import { Board } from '../components/Board.js';
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-2xl text-amber-200">Daily Puzzle</h1>
        <p className="text-xs text-white/50">
          Streak: <span className="font-semibold text-amber-300">{streak}</span> day{streak === 1 ? '' : 's'}
          {alreadySolved && <span className="ml-2 text-emerald-400">Solved today</span>}
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
        <Board
          state={puzzleGame.state}
          perspective={PlayerSide.BLACK}
          selected={puzzleGame.selected}
          legalDestinations={puzzleGame.legalDestinations}
          symbolsEnabled={false}
          interactive={puzzleGame.status === 'PLAYING'}
          onSquareClick={puzzleGame.selectSquare}
        />

        <div className="max-w-sm space-y-3">
          <h2 className="font-display text-lg text-amber-200">{puzzle.title}</h2>
          <p className="text-sm text-white/75">{puzzle.description}</p>
          <p className="text-xs uppercase tracking-wide text-white/50">
            Mate in {puzzle.mateIn} - {puzzleGame.movesRemaining} move{puzzleGame.movesRemaining === 1 ? '' : 's'} left
          </p>

          {puzzleGame.status === 'SOLVED' && (
            <p className="rounded-md bg-emerald-900/40 px-3 py-2 text-sm font-semibold text-emerald-300" data-testid="puzzle-solved">
              Solved! Black reaches the home row.
            </p>
          )}
          {puzzleGame.status === 'FAILED' && (
            <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm font-semibold text-red-300">
              That line doesn't work out - Gold's reply is forced, so look for a different move.
            </p>
          )}

          {puzzleGame.status !== 'PLAYING' && (
            <button onClick={puzzleGame.reset} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500">
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
