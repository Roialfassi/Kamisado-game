import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LEVEL_INFO } from '../ai/botClient.js';
import { GameScreen } from '../components/GameScreen.js';
import { GameSetup, GameSetupValue } from '../components/GameSetup.js';
import { Icon } from '../components/ui/Icon.js';
import { FORMAT_LABELS } from '../lib/matchFormats.js';
import { RebuiltGame, SavedGame, clearSavedGame, loadSavedGame, rebuildSavedGame } from '../lib/savedGame.js';
import { Controller } from '../state/useKamisadoGame.js';

interface ActiveGame {
  setup: GameSetupValue;
  /** Bumped to remount the game (rematch with swapped sides). */
  key: number;
  resume: RebuiltGame | null;
}

function controllerLabel(c: Controller): string {
  return c === 'HUMAN' ? 'you' : LEVEL_INFO[c].label;
}

function describeSaved(saved: SavedGame): string {
  const { setup, roundStart, moves } = saved;
  const vs = setup.black === 'HUMAN' && setup.gold === 'HUMAN' ? 'Hotseat' : `vs ${controllerLabel(setup.black === 'HUMAN' ? setup.gold : setup.black)}`;
  return `${FORMAT_LABELS[setup.format]} · ${vs} · round ${roundStart.currentRound} · ${moves.length} move${moves.length === 1 ? '' : 's'}`;
}

export default function Play() {
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'ai' ? 'ai' : 'hotseat';
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);
  // a save is only offered when it replays cleanly through the engine
  const saved = useMemo(() => {
    void savedVersion;
    const raw = loadSavedGame();
    if (!raw) return null;
    const rebuilt = rebuildSavedGame(raw);
    if (!rebuilt) {
      clearSavedGame(); // moves that don't replay: unusable, so stop offering it
      return null;
    }
    return { raw, rebuilt };
  }, [savedVersion]);

  if (!game) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <div className="mb-6 text-center">
          <p className="eyebrow">{mode === 'ai' ? 'Dojo' : 'Local'}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">{mode === 'ai' ? 'Play the Dojo' : 'Hotseat duel'}</h1>
          <p className="mt-2 text-sm text-stone-400">
            {mode === 'ai' ? 'Pick an opponent and a format.' : 'Two players, one screen.'}{' '}
            <Link to={mode === 'ai' ? '/play?mode=hotseat' : '/play?mode=ai'} className="text-accent hover:underline">
              {mode === 'ai' ? 'Prefer two players?' : 'Prefer a bot?'}
            </Link>
          </p>
        </div>

        {saved && (
          <div className="glass mb-4 flex flex-wrap items-center justify-between gap-3 border-accent/30 p-4" data-testid="resume-card">
            <div className="min-w-0">
              <p className="eyebrow text-accent/80">Unfinished game</p>
              <p className="mt-0.5 text-sm text-stone-200">{describeSaved(saved.raw)}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost"
                data-testid="discard-saved"
                onClick={() => {
                  clearSavedGame();
                  setSavedVersion((v) => v + 1);
                }}
              >
                Discard
              </button>
              <button className="btn btn-primary" data-testid="resume-saved" onClick={() => setGame({ setup: { ...saved.raw.setup, timeControl: null }, key: 0, resume: saved.rebuilt })}>
                <Icon name="play" /> Resume
              </button>
            </div>
          </div>
        )}

        <GameSetup
          key={mode}
          mode={mode}
          onStart={(setup) => {
            clearSavedGame();
            setGame({ setup, key: 0, resume: null });
          }}
        />
      </div>
    );
  }

  return (
    <GameScreen
      key={game.key}
      setup={game.setup}
      resume={game.resume}
      onExitSetup={() => {
        setSavedVersion((v) => v + 1);
        setGame(null);
      }}
      onSwapSides={() => {
        clearSavedGame();
        setGame({ setup: { ...game.setup, black: game.setup.gold, gold: game.setup.black }, key: game.key + 1, resume: null });
      }}
    />
  );
}
