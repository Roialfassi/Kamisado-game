import { useEffect, useMemo, useRef, useState } from 'react';
import { GameState, GameStatus, Move, PlayerSide } from '@kamisado/engine';
import { PlyReview, requestReview } from '../ai/botClient.js';
import { copyToClipboard } from '../lib/clipboard.js';
import { HistoryEntry } from '../state/useKamisadoGame.js';
import { Board } from './Board.js';
import { Icon } from './ui/Icon.js';

export interface ReplayViewerProps {
  initialState: GameState;
  history: HistoryEntry[];
  onClose: () => void;
}

type Verdict = PlyReview['verdict'];

const VERDICT: Record<Verdict, { label: string; mark: string; badge: string }> = {
  best: { label: 'Best move', mark: '✓', badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' },
  good: { label: 'Good', mark: '', badge: 'bg-white/5 text-stone-300 ring-white/10' },
  inaccuracy: { label: 'Inaccuracy', mark: '?!', badge: 'bg-yellow-400/15 text-yellow-200 ring-yellow-300/30' },
  mistake: { label: 'Mistake', mark: '?', badge: 'bg-orange-500/15 text-orange-300 ring-orange-400/30' },
  blunder: { label: 'Blunder', mark: '??', badge: 'bg-red-500/15 text-red-300 ring-red-400/30' },
  'missed-win': { label: 'Missed win', mark: '!?', badge: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30' },
};

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  if (verdict === 'good') return null;
  return (
    <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${v.badge}`} title={v.label}>
      {v.mark}
      <span className="sr-only">{v.label}</span>
    </span>
  );
}

/** Black's advantage over the round (top = Black, bottom = Gold), one point per position. */
function EvalGraph({ points, reviews, ply, onSelect }: { points: number[]; reviews: PlyReview[]; ply: number; onSelect: (ply: number) => void }) {
  const W = 300;
  const H = 84;
  const x = (i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H / 2 - v * (H / 2 - 6);
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H / 2} L${x(0).toFixed(1)},${H / 2} Z`;
  const flagged = (i: number) => {
    const r = reviews[i];
    return r && (r.verdict === 'blunder' || r.verdict === 'mistake' || r.verdict === 'missed-win') ? r.verdict : null;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-black/30" role="img" aria-label="Evaluation graph: higher means better for Black" data-testid="eval-graph">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
      <text x="5" y="11" fontSize="8" fill="rgba(255,255,255,0.45)">
        Black
      </text>
      <text x="5" y={H - 4} fontSize="8" fill="rgba(255,255,255,0.45)">
        Gold
      </text>
      <path d={area} fill="rgba(245,196,81,0.14)" />
      <path d={line} fill="none" stroke="#f5c451" strokeWidth="1.8" strokeLinejoin="round" />
      {points.map((v, i) => {
        const f = i < reviews.length ? flagged(i) : null;
        return (
          <g key={i} onClick={() => onSelect(i)} className="cursor-pointer">
            <circle cx={x(i)} cy={y(v)} r={9} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(v)}
              r={i === ply ? 4 : f ? 3.2 : 1.8}
              fill={f === 'blunder' ? '#f87171' : f === 'missed-win' ? '#e879f9' : f === 'mistake' ? '#fb923c' : i === ply ? '#fff' : '#f5c451'}
              stroke={i === ply ? '#f5c451' : 'none'}
              strokeWidth="1.5"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Step-through viewer over a finished round's history, with a per-move engine review. */
export function ReplayViewer({ initialState, history, onClose }: ReplayViewerProps) {
  const [ply, setPly] = useState(history.length);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [reviews, setReviews] = useState<PlyReview[] | null>(null);
  const [alt, setAlt] = useState<{ ply: number; move: Move } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const displayState = ply === 0 ? initialState : (history[ply - 1]?.stateAfter ?? initialState);
  const notationText = useMemo(() => history.map((h) => h.notation).join('\n'), [history]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // capture phase: the dialog behind must not also close
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const goTo = (next: number) => {
    setPly(Math.max(0, Math.min(history.length, next)));
    setAlt(null);
  };

  const analyze = () => {
    if (status === 'running' || history.length === 0) return;
    setStatus('running');
    setProgress({ done: 0, total: history.length });
    const states = history.map((_, i) => (i === 0 ? initialState : history[i - 1]!.stateAfter));
    const moves = history.map((h) => h.move);
    requestReview(states, moves, (done, total) => {
      if (alive.current) setProgress({ done, total });
    })
      .then((result) => {
        if (!alive.current) return;
        setReviews(result);
        setStatus('done');
      })
      .catch(() => {
        if (alive.current) setStatus('error');
      });
  };

  const summary = useMemo(() => {
    if (!reviews) return null;
    const blank = () => ({ moves: 0, loss: 0, blunders: 0, mistakes: 0, inaccuracies: 0, missed: 0, best: 0 });
    const s = { [PlayerSide.BLACK]: blank(), [PlayerSide.GOLD]: blank() };
    for (const r of reviews) {
      const t = s[r.played.playerSide];
      t.moves++;
      t.loss += r.loss;
      if (r.verdict === 'blunder') t.blunders++;
      else if (r.verdict === 'mistake') t.mistakes++;
      else if (r.verdict === 'inaccuracy') t.inaccuracies++;
      else if (r.verdict === 'missed-win') t.missed++;
      else if (r.verdict === 'best') t.best++;
    }
    const acc = (t: ReturnType<typeof blank>) => (t.moves ? Math.round(100 * Math.exp((-3 * t.loss) / t.moves)) : 100);
    return { black: { ...s[PlayerSide.BLACK], accuracy: acc(s[PlayerSide.BLACK]) }, gold: { ...s[PlayerSide.GOLD], accuracy: acc(s[PlayerSide.GOLD]) } };
  }, [reviews]);

  const graphPoints = useMemo(() => {
    if (!reviews || reviews.length === 0) return [];
    const last = history[history.length - 1]?.stateAfter;
    const final = last && last.status !== GameStatus.IN_PROGRESS ? (last.roundWinner === PlayerSide.BLACK ? 1 : -1) : (reviews[reviews.length - 1]?.blackAdvantage ?? 0);
    return [...reviews.map((r) => r.blackAdvantage), final];
  }, [reviews, history]);

  // the move you are looking at (the one that led to the shown position)
  const focusIndex = ply - 1;
  const focus = reviews && focusIndex >= 0 ? reviews[focusIndex] : null;
  const shownHint = alt && alt.ply === ply ? alt.move : null;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Replay viewer">
      <div className="glass-strong flex max-h-full w-full max-w-4xl flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <div className="flex w-full items-center justify-between">
          <div>
            <p className="eyebrow">Replay</p>
            <h2 className="text-lg font-bold text-white">Step through the round</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close replay" data-testid="replay-close">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start">
          <Board
            state={displayState}
            perspective={PlayerSide.BLACK}
            selected={null}
            legalDestinations={[]}
            symbolsEnabled={false}
            interactive={false}
            onSquareClick={() => {}}
            lastMove={ply === 0 ? null : (history[ply - 1]?.move ?? null)}
            hint={shownHint}
            size="min(calc(100vw - 8rem), 56vh, 480px)"
          />

          <div className="w-full max-w-sm space-y-3">
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => goTo(0)} disabled={ply === 0} className="btn btn-ghost px-3" aria-label="First move">
                |&lt;
              </button>
              <button onClick={() => goTo(ply - 1)} disabled={ply === 0} className="btn btn-ghost px-3" aria-label="Previous move">
                &lt;
              </button>
              <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-stone-300" data-testid="replay-ply">
                {ply} / {history.length}
              </span>
              <button onClick={() => goTo(ply + 1)} disabled={ply === history.length} className="btn btn-ghost px-3" aria-label="Next move">
                &gt;
              </button>
              <button onClick={() => goTo(history.length)} disabled={ply === history.length} className="btn btn-ghost px-3" aria-label="Last move">
                &gt;|
              </button>
            </div>

            {/* ---- engine review ---- */}
            <div className="rounded-xl bg-black/25 p-3" data-testid="analysis-panel">
              {status === 'idle' && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-stone-400">Let the engine grade every move and find the turning points.</p>
                  <button onClick={analyze} disabled={history.length === 0} className="btn btn-primary shrink-0 py-1.5" data-testid="analyze-round">
                    <Icon name="cpu" size={15} /> Analyze
                  </button>
                </div>
              )}
              {status === 'running' && (
                <div data-testid="analysis-progress">
                  <p className="mb-1.5 text-xs text-stone-300">
                    Analyzing move {Math.min(progress.done + 1, progress.total)} of {progress.total}…
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-red-300">Analysis failed.</p>
                  <button onClick={analyze} className="btn btn-ghost py-1.5">
                    Retry
                  </button>
                </div>
              )}
              {status === 'done' && summary && reviews && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-center" data-testid="analysis-summary">
                    {(['black', 'gold'] as const).map((side) => {
                      const t = summary[side];
                      return (
                        <div key={side} className="rounded-lg bg-white/[0.04] px-2 py-2">
                          <p className="eyebrow">{side === 'black' ? 'Black' : 'Gold'}</p>
                          <p className="mt-0.5 text-xl font-bold tabular-nums text-white" data-testid={`accuracy-${side}`}>
                            {t.accuracy}
                            <span className="text-xs font-medium text-stone-500">%</span>
                          </p>
                          <p className="text-[11px] leading-snug text-stone-400">
                            {t.blunders + t.missed} blunder{t.blunders + t.missed === 1 ? '' : 's'} · {t.mistakes} mistake{t.mistakes === 1 ? '' : 's'} · {t.inaccuracies} inacc.
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <EvalGraph points={graphPoints} reviews={reviews} ply={ply} onSelect={(p) => goTo(p)} />
                  {focus ? (
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs" data-testid="move-verdict">
                      <p className="text-stone-200">
                        <span className="font-semibold text-white">{history[focusIndex]?.notation}</span>
                        <span className={`ml-2 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${VERDICT[focus.verdict].badge}`}>{VERDICT[focus.verdict].label}</span>
                      </p>
                      {focus.bestMove && (
                        <button
                          className="mt-1.5 inline-flex items-center gap-1 text-accent hover:underline"
                          onClick={() => {
                            setPly(focusIndex);
                            setAlt({ ply: focusIndex, move: focus.bestMove! });
                          }}
                          data-testid="show-better-move"
                        >
                          <Icon name="lightbulb" size={13} /> Show the better move
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-500">Select a move to see the engine&apos;s verdict.</p>
                  )}
                </div>
              )}
            </div>

            <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-xl bg-black/25 p-2 text-xs">
              {history.length === 0 && <p className="p-2 text-stone-500">No moves recorded.</p>}
              {history.map((entry, i) => (
                <p
                  key={i}
                  onClick={() => goTo(i + 1)}
                  className={`cursor-pointer rounded-md px-2 py-1 font-mono transition ${
                    i + 1 === ply ? 'bg-accent/15 text-accent-soft' : 'text-stone-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {entry.notation}
                  {reviews?.[i] && <VerdictBadge verdict={reviews[i]!.verdict} />}
                </p>
              ))}
            </div>

            <button
              onClick={async () => {
                if (await copyToClipboard(notationText)) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }
              }}
              className="btn btn-ghost w-full"
            >
              {copied ? 'Copied!' : 'Export notation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
