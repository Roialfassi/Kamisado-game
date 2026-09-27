import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GameStatus, PlayerSide } from '@kamisado/engine';
import { Board } from '../components/Board.js';
import { GameHud } from '../components/GameHud.js';
import { MoveHistory } from '../components/MoveHistory.js';
import { RegroupPrompt } from '../components/RegroupPrompt.js';
import { ReplayViewer } from '../components/ReplayViewer.js';
import { GameSetup, GameSetupValue } from '../components/GameSetup.js';
import { useKamisadoGame } from '../state/useKamisadoGame.js';
import { isMuted, setMuted } from '../lib/sound.js';

export default function Play() {
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'ai' ? 'ai' : 'hotseat';
  const [setup, setSetup] = useState<GameSetupValue | null>(null);
  const [symbolsEnabled, setSymbolsEnabled] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  if (!setup) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="mb-6 text-center font-display text-2xl text-amber-200">
          {mode === 'ai' ? 'Practice with the Dojo' : 'Local Hotseat Duel'}
        </h1>
        <GameSetup mode={mode} onStart={setSetup} />
      </div>
    );
  }

  return (
    <GameScreen
      setup={setup}
      symbolsEnabled={symbolsEnabled}
      onToggleSymbols={() => setSymbolsEnabled((v) => !v)}
      muted={muted}
      onToggleMuted={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
      onExitSetup={() => setSetup(null)}
    />
  );
}

function GameScreen({
  setup,
  symbolsEnabled,
  onToggleSymbols,
  muted,
  onToggleMuted,
  onExitSetup,
}: {
  setup: GameSetupValue;
  symbolsEnabled: boolean;
  onToggleSymbols: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  onExitSetup: () => void;
}) {
  const game = useKamisadoGame(setup);
  const [showReplay, setShowReplay] = useState(false);
  const bothHuman = setup.black === 'HUMAN' && setup.gold === 'HUMAN';
  const blackName = setup.black === 'HUMAN' ? (bothHuman ? 'Black (Player 1)' : 'Black (You)') : `Black (${setup.black})`;
  const goldName = setup.gold === 'HUMAN' ? (bothHuman ? 'Gold (Player 2)' : 'Gold (You)') : `Gold (${setup.gold})`;
  const perspective = setup.black === 'HUMAN' ? PlayerSide.BLACK : setup.gold === 'HUMAN' ? PlayerSide.GOLD : PlayerSide.BLACK;

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      <div className="flex w-full max-w-4xl items-center justify-between text-sm text-white/60">
        <button onClick={onExitSetup} className="hover:text-white">
          &larr; New Setup
        </button>
        <div className="flex gap-4">
          <button onClick={onToggleSymbols} className="hover:text-white" data-testid="toggle-symbols">
            Colorblind Symbols: {symbolsEnabled ? 'On' : 'Off'}
          </button>
          <button onClick={onToggleMuted} className="hover:text-white">
            Sound: {muted ? 'Off' : 'On'}
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
        <div className="order-2 lg:order-1">
          <GameHud state={game.state} blackName={blackName} goldName={goldName} symbolsEnabled={symbolsEnabled} showClock={!!setup.timeControl} />
        </div>

        <div className="order-1 flex flex-col items-center gap-4 lg:order-2">
          <Board
            state={game.state}
            perspective={perspective}
            selected={game.selected}
            legalDestinations={game.legalDestinations}
            symbolsEnabled={symbolsEnabled}
            interactive={game.isHumanTurn}
            onSquareClick={game.selectSquare}
          />
          <RegroupPrompt state={game.state} blackName={blackName} goldName={goldName} onRegroup={game.regroup} onRestart={game.restart} />
          {game.state.status !== GameStatus.IN_PROGRESS && game.history.length > 0 && (
            <button
              onClick={() => setShowReplay(true)}
              className="rounded bg-black/30 px-4 py-2 text-sm font-semibold hover:bg-black/50"
              data-testid="view-replay"
            >
              View Replay
            </button>
          )}
        </div>

        <div className="order-3">
          <MoveHistory history={game.history} />
        </div>
      </div>

      {showReplay && (
        <ReplayViewer initialState={game.roundStartState} history={game.history} onClose={() => setShowReplay(false)} />
      )}
    </div>
  );
}
