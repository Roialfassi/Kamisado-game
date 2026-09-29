import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GameStatus, PlayerSide } from '@kamisado/engine';
import { BOT_LABELS } from '../ai/bot.js';
import { Board } from '../components/Board.js';
import { GameSetup, GameSetupValue } from '../components/GameSetup.js';
import { MoveHistory } from '../components/MoveHistory.js';
import { PlayerBar, SeatLabel } from '../components/PlayerBar.js';
import { ReplayViewer } from '../components/ReplayViewer.js';
import { RoundModal } from '../components/RoundModal.js';
import { TurnBanner } from '../components/TurnBanner.js';
import { Icon } from '../components/ui/Icon.js';
import { FORMAT_LABELS, formatSummary } from '../lib/matchFormats.js';
import { useSymbolsEnabled } from '../lib/usePreferences.js';
import { Controller, useKamisadoGame } from '../state/useKamisadoGame.js';

export default function Play() {
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'ai' ? 'ai' : 'hotseat';
  const [setup, setSetup] = useState<GameSetupValue | null>(null);

  if (!setup) {
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
        <GameSetup key={mode} mode={mode} onStart={setSetup} />
      </div>
    );
  }

  return <GameScreen setup={setup} onExitSetup={() => setSetup(null)} />;
}

function seatLabel(side: PlayerSide, controller: Controller, bothHuman: boolean): SeatLabel {
  const name = side === PlayerSide.BLACK ? 'Black' : 'Gold';
  if (controller === 'HUMAN') return { name, tag: bothHuman ? (side === PlayerSide.BLACK ? 'Player 1' : 'Player 2') : 'You' };
  return { name, tag: `AI · ${BOT_LABELS[controller]}` };
}

function GameScreen({ setup, onExitSetup }: { setup: GameSetupValue; onExitSetup: () => void }) {
  const game = useKamisadoGame(setup);
  const [symbolsEnabled] = useSymbolsEnabled();
  const [showReplay, setShowReplay] = useState(false);

  const bothHuman = setup.black === 'HUMAN' && setup.gold === 'HUMAN';
  const black = seatLabel(PlayerSide.BLACK, setup.black, bothHuman);
  const gold = seatLabel(PlayerSide.GOLD, setup.gold, bothHuman);
  const perspective = setup.black === 'HUMAN' ? PlayerSide.BLACK : setup.gold === 'HUMAN' ? PlayerSide.GOLD : PlayerSide.BLACK;
  const top = perspective === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK;
  const labelFor = (side: PlayerSide) => (side === PlayerSide.BLACK ? black : gold);
  const activeController = game.state.activePlayer === PlayerSide.BLACK ? setup.black : setup.gold;
  const activeName = !bothHuman && activeController === 'HUMAN' ? 'You' : labelFor(game.state.activePlayer).name;
  const lastMove = game.history[game.history.length - 1]?.move ?? null;
  const finished = game.state.status !== GameStatus.IN_PROGRESS;

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-4 sm:py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
      <div className="inline-flex flex-col items-stretch gap-2.5">
        <PlayerBar side={top} label={labelFor(top)} state={game.state} showClock={!!setup.timeControl} />
        <div className="relative self-center">
          <Board
            state={game.state}
            perspective={perspective}
            selected={game.selected}
            legalDestinations={game.legalDestinations}
            symbolsEnabled={symbolsEnabled}
            interactive={game.isHumanTurn}
            onSquareClick={game.selectSquare}
            lastMove={lastMove}
          />
          <RoundModal
            state={game.state}
            blackName={black.name}
            goldName={gold.name}
            onStartNextRound={game.startNextRound}
            onRestart={game.restart}
            onReplay={game.history.length > 0 ? () => setShowReplay(true) : undefined}
          />
        </div>
        <PlayerBar side={perspective} label={labelFor(perspective)} state={game.state} showClock={!!setup.timeControl} />
        <TurnBanner state={game.state} activeName={activeName} />
      </div>

      <aside className="flex w-full max-w-[34rem] flex-col gap-3 lg:w-72" aria-label="Match info">
        <div className="glass p-4">
          <p className="eyebrow">Match</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-white">{FORMAT_LABELS[game.state.matchFormat]}</span>
            <span className="text-sm text-stone-400" data-testid="round-label">
              Round {game.state.currentRound}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-400">{formatSummary(game.state.matchFormat)}</p>
          {setup.timeControl && (
            <span className="chip mt-3">
              <Icon name="clock" size={13} /> {setup.timeControl.label}
            </span>
          )}
        </div>
        <MoveHistory history={game.history} />
        <div className="flex gap-2">
          <button onClick={onExitSetup} className="btn btn-ghost flex-1">
            <Icon name="arrowLeft" /> New setup
          </button>
          {finished && game.history.length > 0 && (
            <button onClick={() => setShowReplay(true)} className="btn btn-ghost" aria-label="View replay" data-testid="view-replay-aside">
              <Icon name="list" />
            </button>
          )}
        </div>
      </aside>

      {showReplay && <ReplayViewer initialState={game.roundStartState} history={game.history} onClose={() => setShowReplay(false)} />}
    </div>
  );
}
