import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home.js';
import Play from './pages/Play.js';
import Academy from './pages/Academy.js';
import Room from './pages/Room.js';
import DailyPuzzle from './pages/DailyPuzzle.js';
import Campaign from './pages/Campaign.js';
import { SettingsMenu } from './components/SettingsMenu.js';
import { Icon, IconName } from './components/ui/Icon.js';

const NAV: { to: string; match: string; label: string; icon: IconName }[] = [
  { to: '/play?mode=ai', match: '/play', label: 'Play', icon: 'play' },
  { to: '/campaign', match: '/campaign', label: 'Campaign', icon: 'trophy' },
  { to: '/academy', match: '/academy', label: 'Learn', icon: 'book' },
  { to: '/puzzle', match: '/puzzle', label: 'Puzzle', icon: 'calendar' },
  { to: '/room', match: '/room', label: 'Online', icon: 'users' },
];

export default function App() {
  const { pathname } = useLocation();
  const isActive = (match: string) => pathname.startsWith(match);

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-900/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-brand text-[15px] font-black tracking-[0.18em] text-accent-soft">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-sm text-accent">神</span>
            KAMISADO
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item.match) ? 'page' : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  isActive(item.match) ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/[0.06] hover:text-stone-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SettingsMenu />
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/campaign" element={<Campaign />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/room" element={<Room />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/puzzle" element={<DailyPuzzle />} />
        </Routes>
      </main>

      {/* Phone tab bar (the header nav is hidden below `sm`). */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/[0.08] bg-ink-900/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive(item.match) ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
              isActive(item.match) ? 'text-accent' : 'text-stone-400'
            }`}
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
