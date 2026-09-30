import { useState } from 'react';
import { MatchFormat } from '@kamisado/engine';
import { LEVEL_INFO } from '../ai/botClient.js';
import { GameScreen } from '../components/GameScreen.js';
import { GameSetupValue } from '../components/GameSetup.js';
import { Icon } from '../components/ui/Icon.js';
import { STAGES, Stage, currentStageIndex, isUnlocked, loadBeaten, markBeaten, resetCampaign } from '../lib/campaign.js';
import { FORMAT_LABELS } from '../lib/matchFormats.js';

function setupFor(stage: Stage): GameSetupValue {
  const human = stage.humanSide === 'BLACK';
  return {
    format: stage.format,
    black: human ? 'HUMAN' : stage.level,
    gold: human ? stage.level : 'HUMAN',
    timeControl: null,
    blunderGuard: false,
  };
}

export default function Campaign() {
  const [beaten, setBeaten] = useState(loadBeaten);
  const [playing, setPlaying] = useState<{ index: number; attempt: number } | null>(null);
  const current = currentStageIndex(beaten);
  const finished = current >= STAGES.length;

  if (playing) {
    const stage = STAGES[playing.index]!;
    const next = STAGES[playing.index + 1];
    return (
      <GameScreen
        key={`${stage.id}-${playing.attempt}`}
        setup={setupFor(stage)}
        exitLabel="Back to the ladder"
        onExitSetup={() => setPlaying(null)}
        campaign={{
          onMatchEnd: (won) => {
            if (won) setBeaten(markBeaten(stage.id));
          },
          matchNote: (won) => `${stage.name}: “${won ? stage.win : stage.lose}”`,
          matchActions: (won, compact) => (
            <>
              {won && next ? (
                <button className={`btn btn-primary ${compact ? 'py-1.5' : 'w-full'}`} onClick={() => setPlaying({ index: playing.index + 1, attempt: 0 })} data-testid="next-opponent">
                  <Icon name="sword" /> Next: {next.name}
                </button>
              ) : !won ? (
                <button className={`btn btn-primary ${compact ? 'py-1.5' : 'w-full'}`} onClick={() => setPlaying({ index: playing.index, attempt: playing.attempt + 1 })} data-testid="try-again">
                  <Icon name="refresh" /> Try again
                </button>
              ) : null}
              <button className={`btn btn-ghost ${compact ? 'py-1.5' : 'w-full'}`} onClick={() => setPlaying(null)} data-testid="back-to-ladder">
                <Icon name="arrowLeft" /> Back to the ladder
              </button>
            </>
          ),
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <p className="eyebrow">昇竜 · Campaign</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">The Dragon&apos;s Ascent</h1>
        <p className="mt-2 text-sm text-stone-400">Ten opponents, each stronger than the last. Beat one to unlock the next.</p>
        <div className="mx-auto mt-4 max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={STAGES.length} aria-valuenow={beaten.length} aria-label="Campaign progress">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(beaten.length / STAGES.length) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-stone-400" data-testid="campaign-progress">
            {beaten.length} of {STAGES.length} defeated
          </p>
        </div>
        {finished && (
          <p className="glass mx-auto mt-4 max-w-sm border-accent/40 px-4 py-3 text-sm font-semibold text-accent-soft" data-testid="campaign-complete">
            神 You are the Dragon Master.
          </p>
        )}
      </div>

      <ol className="space-y-3">
        {STAGES.map((stage, i) => {
          const done = beaten.includes(stage.id);
          const open = isUnlocked(beaten, i);
          const isCurrent = i === current;
          return (
            <li key={stage.id}>
              <div
                className={`glass flex flex-wrap items-center gap-x-4 gap-y-3 p-4 transition sm:flex-nowrap ${isCurrent ? 'border-accent/50 shadow-[0_0_28px_-10px_rgba(245,196,81,0.6)]' : ''} ${open ? '' : 'opacity-55'}`}
                data-testid={`stage-${stage.id}`}
                data-state={done ? 'beaten' : open ? 'open' : 'locked'}
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-bold ring-1 ${
                    done ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/40' : open ? 'bg-accent/15 text-accent ring-accent/40' : 'bg-white/5 text-stone-500 ring-white/10'
                  }`}
                  aria-hidden="true"
                >
                  {done ? '✓' : open ? i + 1 : <Icon name="close" size={14} />}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h2 className="text-base font-bold text-white">{stage.name}</h2>
                    <span className="text-xs text-stone-400">{stage.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-stone-400">{open ? stage.blurb : `Defeat ${STAGES[i - 1]!.name} to unlock.`}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip">{LEVEL_INFO[stage.level].label}</span>
                    <span className="chip">{stage.format === MatchFormat.SINGLE_ROUND ? 'Single round' : FORMAT_LABELS[stage.format]}</span>
                    <span className="chip">You: {stage.humanSide === 'BLACK' ? 'Black' : 'Gold'}</span>
                  </div>
                </div>
                {open && (
                  <button className={`btn ${isCurrent ? 'btn-primary' : 'btn-ghost'} w-full shrink-0 sm:w-auto`} onClick={() => setPlaying({ index: i, attempt: 0 })} data-testid={`play-${stage.id}`}>
                    {done ? 'Replay' : 'Challenge'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {beaten.length > 0 && (
        <div className="mt-8 text-center">
          <button
            className="text-xs text-stone-500 underline-offset-2 hover:text-stone-300 hover:underline"
            onClick={() => {
              if (window.confirm('Reset your campaign progress?')) {
                resetCampaign();
                setBeaten([]);
              }
            }}
            data-testid="reset-campaign"
          >
            Reset progress
          </button>
        </div>
      )}
    </div>
  );
}
