import { Link } from 'react-router-dom';
import { Color } from '@kamisado/engine';
import { COLOR_HEX, COLOR_KANJI, isDarkSquare } from '../lib/theme.js';

const PALETTE: Color[] = [
  Color.BROWN,
  Color.GREEN,
  Color.RED,
  Color.YELLOW,
  Color.PINK,
  Color.PURPLE,
  Color.BLUE,
  Color.ORANGE,
];

const ACTIONS = [
  {
    to: '/play?mode=hotseat',
    kanji: '対局',
    title: 'Local Hotseat Duel',
    desc: 'Two players, one screen. Full official Peter Burley rules, no registration required.',
    badge: '1v1 Local',
  },
  {
    to: '/play?mode=ai',
    kanji: '道場',
    title: 'Practice with the Dojo',
    desc: 'Challenge the Dojo bots: Apprentice, tactical Ronin, or deep-searching Dragon Master.',
    badge: 'AI Battle',
  },
  {
    to: '/room',
    kanji: '部屋',
    title: 'Create Private Room',
    desc: 'Generate a shareable room code and challenge a friend online in real-time WebSockets.',
    badge: 'Online',
  },
  {
    to: '/academy',
    kanji: '寺院',
    title: 'The Academy',
    desc: 'Interactive guided masterclass: Dragon\'s Step, Color Lock, Stymie, Deadlocks, and Sumo pushes.',
    badge: 'Tutorial',
  },
  {
    to: '/puzzle',
    kanji: '日課',
    title: 'Daily Puzzle',
    desc: 'Tactical mate-in-X puzzles backed by the verified game engine. Keep your daily streak unbroken.',
    badge: 'Daily Streak',
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14 text-center">
      {/* Decorative Traditional Japanese Title */}
      <div className="mb-2 text-xs font-serif font-semibold tracking-widest text-[#d4af37]/80 uppercase">
        神・竜・塔 &bull; The Octagonal Temple Towers of Kamisado
      </div>

      <h1 className="font-display text-4xl sm:text-5xl font-black text-amber-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] tracking-wide">
        KAMISADO
      </h1>

      <p className="mx-auto mt-3 max-w-2xl text-base sm:text-lg text-stone-300 font-light leading-relaxed">
        The deterministic Japanese strategy game of eight dragon towers. Zero luck, perfect information, pure
        tactical mastery &mdash; play instantly in your browser.
      </p>

      {/* Showcase of the 8 Authentic Kamisado Dragon Medallions */}
      <div className="mt-8 flex items-center justify-center gap-2 sm:gap-3 flex-wrap py-3 px-4 rounded-xl bg-black/40 border border-[#d4af37]/20 shadow-inner max-w-fit mx-auto">
        {PALETTE.map((color) => {
          const dark = isDarkSquare(color);
          return (
            <div
              key={color}
              className="flex flex-col items-center gap-1 group transition-transform hover:scale-110"
              title={`${color}: ${COLOR_KANJI[color]}`}
            >
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-serif font-black text-sm sm:text-base shadow-md transition-shadow group-hover:shadow-[0_0_10px_rgba(255,215,0,0.6)]"
                style={{
                  backgroundColor: COLOR_HEX[color],
                  color: dark ? '#fff3d1' : '#1c0f08',
                  boxShadow: 'inset 1px 1px 1px rgba(255,255,255,0.25), inset -1px -1px 2px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(212,175,55,0.3)',
                }}
              >
                {COLOR_KANJI[color]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Mode Navigation Cards */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group relative overflow-hidden rounded-xl border border-[#522f18]/60 bg-gradient-to-br from-[#26130a]/80 via-[#180a04]/90 to-[#0e0502] p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d4af37]/60 hover:shadow-[0_8px_25px_rgba(0,0,0,0.7),0_0_15px_rgba(212,175,55,0.2)]"
          >
            {/* Top Bar with Japanese Kanji and Badge */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif text-xs font-bold tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/20">
                {action.kanji}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 group-hover:text-amber-300 transition-colors">
                {action.badge} &rarr;
              </span>
            </div>

            <h2 className="font-display text-lg font-bold text-amber-100 group-hover:text-amber-200 transition-colors">
              {action.title}
            </h2>
            <p className="mt-1 text-sm text-stone-300/80 leading-relaxed font-light">
              {action.desc}
            </p>
          </Link>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-xs text-stone-400/60 font-mono">
        Authentic Peter Burley Rules &bull; Latin-Square Board &bull; Dual-Language Kanji &bull; Zero Lag Engine
      </div>
    </div>
  );
}
