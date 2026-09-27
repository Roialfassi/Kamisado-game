import { useState } from 'react';
import { LessonBoard } from '../tutorial/LessonBoard.js';
import {
  colorLockScenario,
  deadlockScenario,
  dragonsStepScenario,
  stymieScenario,
  sumoScenario,
} from '../tutorial/scenarios.js';

interface Lesson {
  title: string;
  body: string[];
  board: () => { state: ReturnType<typeof dragonsStepScenario>['state']; legal?: ReturnType<typeof dragonsStepScenario>['legal'] };
}

const LESSONS: Lesson[] = [
  {
    title: "1. The Dragon's Step",
    body: [
      'Every tower moves any distance in a straight line: forward, or diagonally forward-left / forward-right.',
      'Backward and sideways moves are never legal, and towers cannot jump over other pieces.',
      'Below, the Red tower\'s three open lines are highlighted - watch how each stops the moment a square is occupied.',
    ],
    board: dragonsStepScenario,
  },
  {
    title: '2. The Color Lock',
    body: [
      "After the opening move, you don't choose which tower to move - the color of the square your opponent just landed on decides for you.",
      'Black just slid a tower onto a Green square, so Gold must move the Green tower now (its only legal options are highlighted).',
      'If that tower has no legal move at all, that is the Stymie rule, covered next.',
    ],
    board: colorLockScenario,
  },
  {
    title: '3. The Stymie (Pass)',
    body: [
      "Gold's Blue tower is boxed in on all three forward lines - it has zero legal moves.",
      'When that happens the turn is automatically forfeited: the tower stays put, and Black immediately moves again.',
      "Black's next tower is decided by the color of the square the stuck Blue tower is standing on - not by free choice.",
    ],
    board: stymieScenario,
  },
  {
    title: '4. Deadlocks',
    body: [
      'Sometimes a chain of forced passes loops forever: Gold cannot move, so Black is forced by the Color Lock into a tower that also cannot move, which points right back at Gold.',
      'When the same impasse repeats, the round ends immediately in a deadlock.',
      'The player who made the LAST real, physical move before the loop started is judged to have caused it, and loses the round.',
    ],
    board: deadlockScenario,
  },
  {
    title: '5. The Way of the Sumo',
    body: [
      'Reach the opponent\'s home row and your tower earns a Sumo Ring, gaining the power to push - at the cost of a shorter movement range (Single: 5 squares, Double: 3, Triple: just 1).',
      "Below, Black's Single Sumo can shove the Gold tower directly ahead of it straight back by one square, as long as the square behind it is empty.",
      'A Sumo can never push diagonally, never push a piece off its own home row, and never push an equal-or-higher-ranked Sumo.',
    ],
    board: sumoScenario,
  },
];

export default function Academy() {
  const [index, setIndex] = useState(0);
  const lesson = LESSONS[index]!;
  const { state, legal } = lesson.board();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-center font-display text-2xl text-amber-200">The Academy</h1>
      <p className="mb-8 text-center text-sm text-white/50">Five short lessons, each backed by the real rules engine.</p>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
        <LessonBoard state={state} legal={legal} />
        <div className="max-w-sm space-y-3">
          <h2 className="font-display text-lg text-amber-200">{lesson.title}</h2>
          {lesson.body.map((p, i) => (
            <p key={i} className="text-sm text-white/75">
              {p}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded bg-black/30 px-4 py-2 text-sm disabled:opacity-30"
        >
          Previous
        </button>
        <span className="self-center text-xs text-white/50">
          {index + 1} / {LESSONS.length}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(LESSONS.length - 1, i + 1))}
          disabled={index === LESSONS.length - 1}
          className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold disabled:opacity-30"
        >
          Next Lesson
        </button>
      </div>
    </div>
  );
}
