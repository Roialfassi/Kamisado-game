import { Link } from 'react-router-dom';
import { Color } from '@kamisado/engine';
import { Icon, IconName } from '../components/ui/Icon.js';
import { COLOR_HEX, COLOR_KANJI, COLOR_LABEL, isDarkSquare } from '../lib/theme.js';

const PALETTE: Color[] = [Color.BROWN, Color.GREEN, Color.RED, Color.YELLOW, Color.PINK, Color.PURPLE, Color.BLUE, Color.ORANGE];

interface Card {
  to: string;
  kanji: string;
  icon: IconName;
  title: string;
  desc: string;
  badge: string;
  span: string;
  featured?: boolean;
}

const CARDS: Card[] = [
  {
    to: '/play?mode=ai',
    kanji: '道場',
    icon: 'cpu',
    title: 'Play the Dojo',
    desc: 'Face the Apprentice, the tactical Ronin or the deep-searching Dragon Master. Pick your side, your format and an optional clock.',
    badge: 'vs AI',
    span: 'sm:col-span-4',
    featured: true,
  },
  {
    to: '/puzzle',
    kanji: '日課',
    icon: 'calendar',
    title: 'Daily puzzle',
    desc: 'A fresh forced-win puzzle every day, verified by the rules engine. Keep your streak alive.',
    badge: 'Daily',
    span: 'sm:col-span-2',
  },
  {
    to: '/play?mode=hotseat',
    kanji: '対局',
    icon: 'sword',
    title: 'Hotseat duel',
    desc: 'Two players, one screen. No sign-up.',
    badge: 'Local',
    span: 'sm:col-span-2',
  },
  {
    to: '/room',
    kanji: '部屋',
    icon: 'users',
    title: 'Play a friend',
    desc: 'Create a private room and share the link.',
    badge: 'Online',
    span: 'sm:col-span-2',
  },
  {
    to: '/academy',
    kanji: '寺院',
    icon: 'book',
    title: 'The Academy',
    desc: 'Five short lessons: colour lock, stymie, deadlock, sumo.',
    badge: 'Learn',
    span: 'sm:col-span-2',
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:pt-16">
      <section className="text-center">
        <p className="eyebrow text-accent/80">神 · 竜 · 塔 &nbsp;The eight-tower strategy game</p>
        <h1 className="mt-3 font-brand text-5xl font-black tracking-[0.14em] text-white drop-shadow-[0_6px_30px_rgba(245,196,81,0.25)] sm:text-7xl">
          KAMISADO
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone-300 sm:text-lg">
          Zero luck, perfect information. Every move you make decides which tower your opponent must move next.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/play?mode=ai" className="btn btn-primary px-6 py-3 text-base" data-testid="cta-play">
            <Icon name="play" /> Play now
          </Link>
          <Link to="/academy" className="btn btn-ghost px-6 py-3 text-base">
            <Icon name="book" /> Learn the rules
          </Link>
        </div>

        <div className="mx-auto mt-9 flex max-w-fit flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur">
          {PALETTE.map((color) => (
            <div
              key={color}
              title={`${COLOR_LABEL[color]} · ${COLOR_KANJI[color]}`}
              className="grid h-9 w-9 place-items-center rounded-lg font-brand text-sm font-black shadow-md transition-transform hover:-translate-y-0.5 sm:h-10 sm:w-10"
              style={{
                backgroundColor: COLOR_HEX[color],
                color: isDarkSquare(color) ? '#fff3d1' : '#1c0f08',
                boxShadow: 'inset 1px 1px 1px rgba(255,255,255,0.25), inset -1px -1px 2px rgba(0,0,0,0.4)',
              }}
            >
              {COLOR_KANJI[color]}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-6" aria-label="Game modes">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={`glass group relative flex flex-col justify-between overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_18px_40px_-16px_rgba(245,196,81,0.35)] ${card.span} ${
              card.featured ? 'sm:min-h-[11rem] sm:p-7' : ''
            }`}
          >
            {card.featured && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-6 -top-10 select-none font-brand text-[11rem] font-black leading-none text-white/[0.04]"
              >
                {card.kanji}
              </span>
            )}
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/[0.12] text-accent ring-1 ring-accent/25 transition group-hover:bg-accent/20">
                <Icon name={card.icon} size={22} />
              </span>
              <span className="chip">{card.badge}</span>
            </div>
            <div className="mt-6">
              <h2 className={`font-bold text-white ${card.featured ? 'text-2xl' : 'text-lg'}`}>{card.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{card.desc}</p>
            </div>
            <Icon name="chevronRight" className="absolute bottom-5 right-5 text-stone-500 transition group-hover:translate-x-1 group-hover:text-accent" />
          </Link>
        ))}
      </section>

      <p className="mt-12 text-center text-xs text-stone-500">Peter Burley&apos;s Kamisado · verified rules engine (TypeScript + Kotlin) · real-time online play</p>
    </div>
  );
}
