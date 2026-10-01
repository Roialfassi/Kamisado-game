import { useState } from 'react';
import { MatchFormat } from '@kamisado/engine';
import { BOT_LEVELS, BotLevel, LEVEL_INFO } from '../ai/botClient.js';
import { FORMAT_LABELS, formatSummary } from '../lib/matchFormats.js';
import { TIME_CONTROLS, TimeControlChoice } from '../lib/timeControl.js';
import { Controller } from '../state/useKamisadoGame.js';
import { Icon } from './ui/Icon.js';
import { Segmented } from './ui/Segmented.js';

export interface GameSetupValue {
  format: MatchFormat;
  black: Controller;
  gold: Controller;
  timeControl: TimeControlChoice;
  /** Warn before a move that lets the opponent win at once (vs-bot games). */
  blunderGuard: boolean;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        {hint && <span className="text-xs text-stone-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function GameSetup({ mode, onStart }: { mode: 'hotseat' | 'ai'; onStart: (value: GameSetupValue) => void }) {
  const [format, setFormat] = useState<MatchFormat>(MatchFormat.STANDARD);
  const [botTier, setBotTier] = useState<BotLevel>('RONIN');
  const [blunderGuard, setBlunderGuard] = useState(false);
  const [botSide, setBotSide] = useState<'BLACK' | 'GOLD'>('GOLD');
  const [timeId, setTimeId] = useState<string>('untimed');
  const timeControl: TimeControlChoice = TIME_CONTROLS.find((tc) => tc.id === timeId) ?? null;

  const start = () => {
    if (mode === 'hotseat') {
      onStart({ format, black: 'HUMAN', gold: 'HUMAN', timeControl, blunderGuard: false });
    } else {
      onStart({
        format,
        black: botSide === 'BLACK' ? botTier : 'HUMAN',
        gold: botSide === 'GOLD' ? botTier : 'HUMAN',
        timeControl,
        blunderGuard,
      });
    }
  };

  return (
    <div className="glass mx-auto flex max-w-lg flex-col gap-6 p-4 sm:p-7">
      <Field label="Match format" hint={formatSummary(format)}>
        <Segmented
          ariaLabel="Match format"
          value={format}
          onChange={setFormat}
          options={Object.values(MatchFormat).map((f) => ({ value: f, label: FORMAT_LABELS[f], testId: `format-${f}` }))}
        />
      </Field>

      <Field label="Clock">
        <Segmented
          ariaLabel="Time control"
          value={timeId}
          onChange={setTimeId}
          options={[
            { value: 'untimed', label: 'Untimed', testId: 'time-untimed' },
            ...TIME_CONTROLS.map((tc) => ({ value: tc.id, label: tc.label.split(' ')[0]!, testId: `time-${tc.id}` })),
          ]}
        />
        {timeControl && <p className="mt-2 text-xs text-stone-500">{timeControl.label}</p>}
      </Field>

      {mode === 'ai' && (
        <>
          <Field label="Opponent">
            <div className="grid gap-2" role="radiogroup" aria-label="Bot difficulty">
              {BOT_LEVELS.map((tier) => {
                const { label, blurb, stars } = LEVEL_INFO[tier];
                const on = botTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setBotTier(tier)}
                    data-testid={`bot-${tier}`}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                      on ? 'border-accent/60 bg-accent/10 shadow-[0_0_24px_-10px_rgba(245,196,81,0.7)]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="flex w-16 shrink-0 gap-0.5 text-[11px] text-accent" aria-label={`${stars} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={n <= stars ? 'opacity-100' : 'opacity-20'} aria-hidden="true">
                          ◆
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{label}</span>
                      <span className="block text-xs leading-snug text-stone-400">{blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="You play">
            <Segmented
              ariaLabel="Your side"
              value={botSide === 'GOLD' ? 'BLACK' : 'GOLD'}
              onChange={(mine) => setBotSide(mine === 'BLACK' ? 'GOLD' : 'BLACK')}
              options={[
                { value: 'BLACK', label: 'Black (moves first)', testId: 'side-black' },
                { value: 'GOLD', label: 'Gold', testId: 'side-gold' },
              ]}
            />
          </Field>

          <Field label="Assist">
            <button
              type="button"
              role="switch"
              aria-checked={blunderGuard}
              onClick={() => setBlunderGuard((v) => !v)}
              data-testid="toggle-blunder-guard"
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:bg-white/[0.07]"
            >
              <span>
                <span className="block text-sm font-semibold text-white">Blunder guard</span>
                <span className="block text-xs text-stone-400">Ask before a move that lets the bot win on its very next turn.</span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full border transition ${blunderGuard ? 'border-accent/60 bg-accent/90' : 'border-white/15 bg-white/10'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${blunderGuard ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>
            <p className="mt-2 text-xs text-stone-500">Hints and undo are always available in untimed games against a bot.</p>
          </Field>
        </>
      )}

      <button onClick={start} className="btn btn-primary w-full py-3 text-base" data-testid="start-game">
        <Icon name="play" /> Begin duel
      </button>
    </div>
  );
}
