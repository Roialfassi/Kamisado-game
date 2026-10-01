import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { GameStatus, PlayerSide } from '@kamisado/engine';
import { LEVEL_INFO } from '../ai/botClient.js';
import { Board } from './Board.js';
import { GameSetupValue } from './GameSetup.js';
import { MoveHistory } from './MoveHistory.js';
import { PlayerBar, SeatLabel } from './PlayerBar.js';
import { ReplayViewer } from './ReplayViewer.js';
import { RoundModal } from './RoundModal.js';
import { TurnBanner } from './TurnBanner.js';
import { Icon } from './ui/Icon.js';
import { announceState } from '../lib/announce.js';
import { FORMAT_LABELS, formatSummary } from '../lib/matchFormats.js';
import { RebuiltGame } from '../lib/savedGame.js';
import { useSymbolsEnabled } from '../lib/usePreferences.js';
import { Controller, useKamisadoGame } from '../state/useKamisadoGame.js';

function seatLabel(side: PlayerSide, controller: Controller, bothHuman: boolean): SeatLabel {
  const name = side === PlayerSide.BLACK ? 'Black' : 'Gold';
  if (controller === 'HUMAN') return { name, tag: bothHuman ? (side === PlayerSide.BLACK ? 'Player 1' : 'Player 2') : 'You' };
  return { name, tag: `AI · ${LEVEL_INFO[controller].label}` };
}

export interface CampaignHooks {
  /** Called once when the match ends; `won` = the human won it. */
  onMatchEnd: (won: boolean) => void;
  /** Buttons shown in the match-over dialog (and the compact bar) instead of Rematch / swap sides. */
  matchActions: (won: boolean, compact: boolean) => ReactNode;
  /** A line of flavour under the match result. */
  matchNote: (won: boolean) => string;
}

export function GameScreen({
  setup,
  resume = null,
  onExitSetup,
  onSwapSides,
  campaign,
  exitLabel = 'New setup',
}: {
  setup: GameSetupValue;
  resume?: RebuiltGame | null;
  onExitSetup: () => void;
  onSwapSides?: () => void;
  campaign?: CampaignHooks;
  exitLabel?: string;
}) {
  const game = useKamisadoGame({ ...setup, assists: !campaign, autosave: !campaign }, resume);
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
  const humanSide = setup.black === 'HUMAN' ? PlayerSide.BLACK : PlayerSide.GOLD;
  const matchWon = game.state.status === GameStatus.MATCH_OVER && game.state.matchWinner === humanSide;
  const ended = useRef(false);
  useEffect(() => {
    if (!campaign) return;
    if (game.state.status !== GameStatus.MATCH_OVER) {
      ended.current = false;
      return;
    }
    if (ended.current) return;
    ended.current = true;
    campaign.onMatchEnd(game.state.matchWinner === humanSide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.state.status, game.state.matchWinner]);
  // "is thinking" depends only on whose turn it is, not on the moment the search starts: a text that
  // flipped when the worker started would make screen readers read the whole move out a second time
  const botToMove = !bothHuman && game.state.status === GameStatus.IN_PROGRESS && game.state.activePlayer !== humanSide;
  const announcement = useMemo(
    () => announceState(game.state, lastMove, { black: black.name, gold: gold.name, you: bothHuman ? null : humanSide }, botToMove),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.state.status, game.state.activePlayer, game.state.requiredColor, game.state.currentRound, game.history.length, botToMove],
  );
  const opponentName = labelFor(game.state.activePlayer === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK).name;

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-4 sm:py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
      <div className="sr-only" role="status" aria-live="polite" data-testid="announcer">
        {announcement}
      </div>
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
            onSwapSides={!bothHuman && !campaign ? onSwapSides : undefined}
            matchActions={campaign ? (compact) => campaign.matchActions(matchWon, compact) : undefined}
            matchNote={campaign ? campaign.matchNote(matchWon) : undefined}
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
        {!campaign && (!setup.timeControl || !bothHuman) && (
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
            <Icon name="arrowLeft" /> {exitLabel}
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
