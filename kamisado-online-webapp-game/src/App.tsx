import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.js';
import Play from './pages/Play.js';
import Academy from './pages/Academy.js';
import Room from './pages/Room.js';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-center border-b border-white/10 py-3">
        <Link to="/" className="font-display text-sm font-bold tracking-widest text-amber-200">
          神 KAMISADO
        </Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/room" element={<Room />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </main>
    </div>
  );
}
