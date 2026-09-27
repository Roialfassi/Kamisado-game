import { useState } from 'react';
import { MatchFormat } from '@kamisado/engine';
import { BotTier, BOT_LABELS } from '../ai/bot.js';
import { TIME_CONTROLS, TimeControlChoice } from '../lib/timeControl.js';
import { Controller } from '../state/useKamisadoGame.js';

export interface GameSetupValue {
  format: MatchFormat;
  black: Controller;
  gold: Controller;
  timeControl: TimeControlChoice;
}

const FORMAT_LABELS: Record<MatchFormat, string> = {
  [MatchFormat.SINGLE_ROUND]: 'Single Round (1 pt)',
  [MatchFormat.STANDARD]: 'Standard Match (3 pts)',
  [MatchFormat.LONG]: 'Long Match (7 pts)',
  [MatchFormat.MARATHON]: 'Marathon (15 pts)',
};

const BOT_TIERS: BotTier[] = ['APPRENTICE', 'RONIN', 'DRAGON_MASTER'];

export function GameSetup({ mode, onStart }: { mode: 'hotseat' | 'ai'; onStart: (value: GameSetupValue) => void }) {
  const [format, setFormat] = useState<MatchFormat>(MatchFormat.STANDARD);
  const [botTier, setBotTier] = useState<BotTier>('RONIN');
  const [botSide, setBotSide] = useState<'BLACK' | 'GOLD'>('GOLD');
  const [timeControl, setTimeControl] = useState<TimeControlChoice>(null);

  const start = () => {
    if (mode === 'hotseat') {
      onStart({ format, black: 'HUMAN', gold: 'HUMAN', timeControl });
    } else {
      onStart({
        format,
        black: botSide === 'BLACK' ? botTier : 'HUMAN',
        gold: botSide === 'GOLD' ? botTier : 'HUMAN',
        timeControl,
      });
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 rounded-lg bg-black/30 p-6">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">Match Format</label>
        <select
          className="w-full rounded bg-black/40 px-3 py-2 text-sm"
          value={format}
          onChange={(e) => setFormat(e.target.value as MatchFormat)}
        >
          {Object.values(MatchFormat).map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABELS[f]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">Time Control</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTimeControl(null)}
            className={`rounded px-2 py-2 text-sm font-semibold ${timeControl === null ? 'bg-amber-600' : 'bg-black/40 hover:bg-black/60'}`}
          >
            Untimed
          </button>
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.id}
              onClick={() => setTimeControl(tc)}
              className={`rounded px-2 py-2 text-sm font-semibold ${timeControl?.id === tc.id ? 'bg-amber-600' : 'bg-black/40 hover:bg-black/60'}`}
            >
              {tc.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'ai' && (
        <>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">Dojo Bot Difficulty</label>
            <div className="flex gap-2">
              {BOT_TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setBotTier(tier)}
                  className={`flex-1 rounded px-2 py-2 text-sm font-semibold ${
                    botTier === tier ? 'bg-amber-600' : 'bg-black/40 hover:bg-black/60'
                  }`}
                >
                  {BOT_LABELS[tier]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">Bot plays as</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBotSide('BLACK')}
                className={`flex-1 rounded px-2 py-2 text-sm font-semibold ${botSide === 'BLACK' ? 'bg-amber-600' : 'bg-black/40 hover:bg-black/60'}`}
              >
                Black
              </button>
              <button
                onClick={() => setBotSide('GOLD')}
                className={`flex-1 rounded px-2 py-2 text-sm font-semibold ${botSide === 'GOLD' ? 'bg-amber-600' : 'bg-black/40 hover:bg-black/60'}`}
              >
                Gold
              </button>
            </div>
          </div>
        </>
      )}

      <button onClick={start} className="rounded bg-amber-600 px-4 py-2.5 font-display text-sm font-bold hover:bg-amber-500" data-testid="start-game">
        Begin Duel
      </button>
    </div>
  );
}
