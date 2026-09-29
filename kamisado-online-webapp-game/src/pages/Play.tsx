import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GameStatus, PlayerSide } from '@kamisado/engine';
import { LEVEL_INFO } from '../ai/botClient.js';
import { Board } from '../components/Board.js';
import { GameSetup, GameSetupValue } from '../components/GameSetup.js';
import { MoveHistory } from '../components/MoveHistory.js';
import { PlayerBar, SeatLabel } from '../components/PlayerBar.js';
import { ReplayViewer } from '../components/ReplayViewer.js';
import { RoundModal } from '../components/RoundModal.js';
import { TurnBanner } from '../components/TurnBanner.js';
import { Icon } from '../components/ui/Icon.js';
import { FORMAT_LABELS, formatSummary } from '../lib/matchFormats.js';
import { RebuiltGame, SavedGame, clearSavedGame, loadSavedGame, rebuildSavedGame } from '../lib/savedGame.js';
import { useSymbolsEnabled } from '../lib/usePreferences.js';
import { Controller, useKamisadoGame } from '../state/useKamisadoGame.js';

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
    return rebuilt ? { raw, rebuilt } : null;
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

function seatLabel(side: PlayerSide, controller: Controller, bothHuman: boolean): SeatLabel {
  const name = side === PlayerSide.BLACK ? 'Black' : 'Gold';
  if (controller === 'HUMAN') return { name, tag: bothHuman ? (side === PlayerSide.BLACK ? 'Player 1' : 'Player 2') : 'You' };
  return { name, tag: `AI · ${LEVEL_INFO[controller].label}` };
}

function GameScreen({
  setup,
  resume,
  onExitSetup,
  onSwapSides,
}: {
  setup: GameSetupValue;
  resume: RebuiltGame | null;
  onExitSetup: () => void;
  onSwapSides: () => void;
}) {
  const game = useKamisadoGame(setup, resume);
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
  const opponentName = labelFor(game.state.activePlayer === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK).name;

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
            interactive={game.isHumanTurn && !game.pendingMove}
            onSquareClick={game.selectSquare}
            lastMove={lastMove}
            hint={game.hint}
          />
          <RoundModal
            state={game.state}
            blackName={black.name}
            goldName={gold.name}
            onStartNextRound={game.startNextRound}
            onRestart={game.restart}
            onSwapSides={!bothHuman ? onSwapSides : undefined}
            onReplay={game.history.length > 0 ? () => setShowReplay(true) : undefined}
          />
        </div>
        <PlayerBar side={perspective} label={labelFor(perspective)} state={game.state} showClock={!!setup.timeControl} />
        {game.pendingMove ? (
          <div className="glass flex animate-pop-in flex-wrap items-center justify-between gap-x-3 gap-y-2 border-red-400/40 px-3.5 py-2" role="alertdialog" aria-label="Blunder guard" data-testid="blunder-confirm">
            <p className="min-w-0 text-sm text-red-100">
              That lets <strong>{opponentName}</strong> win on their next turn.
            </p>
            <div className="flex gap-2">
              <button className="btn btn-ghost px-3 py-1" onClick={game.cancelPendingMove} data-testid="blunder-cancel">
                Pick another
              </button>
              <button className="btn btn-danger px-3 py-1" onClick={game.confirmPendingMove} data-testid="blunder-play-anyway">
                Play anyway
              </button>
            </div>
          </div>
        ) : (
          <TurnBanner state={game.state} activeName={activeName} thinking={game.botThinking} />
        )}
      </div>

      <aside className="flex w-full max-w-[34rem] flex-col gap-3 lg:w-72" aria-label="Match info">
        {(!setup.timeControl || !bothHuman) && (
          <div className="flex gap-2">
            {!setup.timeControl && (
              <button className="btn btn-ghost flex-1" onClick={game.undo} disabled={!game.canUndo} data-testid="undo">
                <Icon name="undo" /> Undo
              </button>
            )}
            {!bothHuman && (
              <button className="btn btn-ghost flex-1" onClick={game.requestMoveHint} disabled={!game.canHint || game.hintBusy} data-testid="hint">
                <Icon name="lightbulb" /> {game.hintBusy ? 'Thinking…' : 'Hint'}
              </button>
            )}
          </div>
        )}
        <div className="glass p-4">
          <p className="eyebrow">Match</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-white">{FORMAT_LABELS[game.state.matchFormat]}</span>
            <span className="text-sm text-stone-400" data-testid="round-label">
              Round {game.state.currentRound}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-400">{formatSummary(game.state.matchFormat)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {setup.timeControl && (
              <span className="chip">
                <Icon name="clock" size={13} /> {setup.timeControl.label}
              </span>
            )}
            {!bothHuman && <span className="chip">{LEVEL_INFO[setup.black === 'HUMAN' ? (setup.gold as Exclude<Controller, 'HUMAN'>) : (setup.black as Exclude<Controller, 'HUMAN'>)].label}</span>}
            {setup.blunderGuard && !bothHuman && <span className="chip">Blunder guard</span>}
          </div>
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
