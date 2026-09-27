const STORAGE_KEY = 'kamisado.puzzleProgress';

interface StoredProgress {
  lastSolvedDay: number | null; // days since epoch (UTC)
  streak: number;
  solvedPuzzleIds: string[];
}

function dayIndex(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 86_400_000);
}

function load(): StoredProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastSolvedDay: null, streak: 0, solvedPuzzleIds: [] };
    return JSON.parse(raw) as StoredProgress;
  } catch {
    return { lastSolvedDay: null, streak: 0, solvedPuzzleIds: [] };
  }
}

function save(progress: StoredProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing / storage disabled - streak just won't persist.
  }
}

export function getStreak(): number {
  const progress = load();
  const today = dayIndex();
  // A streak only "counts" as current if the last solve was today or
  // yesterday; otherwise it's stale (the player missed a day).
  if (progress.lastSolvedDay !== null && today - progress.lastSolvedDay > 1) return 0;
  return progress.streak;
}

export function isSolvedToday(puzzleId: string): boolean {
  const progress = load();
  return progress.lastSolvedDay === dayIndex() && progress.solvedPuzzleIds.includes(puzzleId);
}

export function recordSolve(puzzleId: string): number {
  const progress = load();
  const today = dayIndex();
  if (progress.lastSolvedDay === today) {
    if (!progress.solvedPuzzleIds.includes(puzzleId)) progress.solvedPuzzleIds.push(puzzleId);
  } else {
    const continuesStreak = progress.lastSolvedDay !== null && today - progress.lastSolvedDay === 1;
    progress.streak = continuesStreak ? progress.streak + 1 : 1;
    progress.lastSolvedDay = today;
    progress.solvedPuzzleIds = [puzzleId];
  }
  save(progress);
  return progress.streak;
}
