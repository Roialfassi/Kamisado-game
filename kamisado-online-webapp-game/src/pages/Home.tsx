import { Link } from 'react-router-dom';

const ACTIONS = [
  { to: '/play?mode=hotseat', title: 'Local Hotseat Duel', desc: 'Two players, one screen. Full official rules, no account needed.' },
  { to: '/play?mode=ai', title: 'Practice with the Dojo', desc: 'Face an Apprentice, Ronin, or Dragon Master bot.' },
  { to: '/room', title: 'Create Private Room', desc: 'Get a shareable link and duel a friend online in real time.' },
  { to: '/academy', title: 'The Academy', desc: 'Learn the Dragon\'s Step, the Color Lock, Stymie, Deadlocks, and Sumo.' },
  { to: '/puzzle', title: 'Daily Puzzle', desc: 'A short mate-in-X tactic, backed by the real engine. Keep your streak alive.' },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <h1 className="font-display text-4xl font-black text-amber-200 drop-shadow-lg">Kamisado Online</h1>
      <p className="mx-auto mt-3 max-w-xl text-white/70">
        The deterministic Japanese strategy game of eight dragon towers. Zero luck, perfect information, pure
        strategy - play instantly in your browser.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="rounded-lg bg-black/30 p-5 text-left transition hover:bg-black/45 hover:ring-1 hover:ring-amber-300/50"
          >
            <h2 className="font-display text-lg text-amber-200">{action.title}</h2>
            <p className="mt-1 text-sm text-white/60">{action.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
