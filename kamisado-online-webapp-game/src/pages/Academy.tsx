import { useState } from 'react';
import { Icon } from '../components/ui/Icon.js';
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <p className="eyebrow">寺院 · Academy</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Learn Kamisado</h1>
        <p className="mt-2 text-sm text-stone-400">Five short lessons, each running on the real rules engine.</p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2" role="tablist" aria-label="Lessons">
        {LESSONS.map((l, i) => (
          <button
            key={l.title}
            role="tab"
            aria-selected={i === index}
            aria-label={l.title}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-accent' : i < index ? 'w-2 bg-accent/50' : 'w-2 bg-white/20 hover:bg-white/40'}`}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <LessonBoard state={state} legal={legal} />
        <div className="glass w-full max-w-md space-y-3 p-6" data-testid="lesson-card">
          <p className="eyebrow">
            Lesson {index + 1} of {LESSONS.length}
          </p>
          <h2 className="text-xl font-bold text-white">{lesson.title.replace(/^\d+\.\s*/, '')}</h2>
          {lesson.body.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-stone-300">
              {p}
            </p>
          ))}
          <div className="flex items-center justify-between pt-3">
            <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="btn btn-ghost">
              <Icon name="arrowLeft" /> Previous
            </button>
            <button onClick={() => setIndex((i) => Math.min(LESSONS.length - 1, i + 1))} disabled={index === LESSONS.length - 1} className="btn btn-primary">
              Next lesson <Icon name="chevronRight" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
