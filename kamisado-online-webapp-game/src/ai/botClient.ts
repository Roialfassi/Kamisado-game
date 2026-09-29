import type { BotLevel } from '@kamisado/ai/levels';
import type { GameState, Move } from '@kamisado/engine';
import type { BotRequest, BotResponse } from './botWorker.js';

// Only the tiny metadata module is imported statically; the search code (and its
// 7 MB transposition table) lives in the worker, and is loaded here lazily only if
// the worker itself cannot be used.
export type { BotLevel };
export { BOT_LEVELS, LEVEL_INFO } from '@kamisado/ai/levels';

const REQUEST_TIMEOUT_MS = 20_000;

interface Pending {
  resolve: (m: Move | null) => void;
  reject: (e: Error) => void;
  timer: number;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(reason: string): void {
  for (const entry of pending.values()) {
    window.clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pending.clear();
}

function killWorker(reason: string): void {
  worker?.terminate();
  worker = null;
  failAll(reason);
}

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    const w = new Worker(new URL('./botWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (event: MessageEvent<BotResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      window.clearTimeout(entry.timer);
      if ('error' in event.data) entry.reject(new Error(event.data.error));
      else entry.resolve(event.data.move);
    };
    // the worker died or its script could not load: drop it so the next request starts a fresh one
    w.onerror = () => killWorker('bot worker crashed');
    worker = w;
    return w;
  } catch {
    return null;
  }
}

type Payload = { kind: 'move'; state: GameState; level: BotLevel } | { kind: 'hint'; state: GameState };

/** Main-thread fallback (worker unavailable / failed). Time-bounded by the search itself. */
async function inline(payload: Payload): Promise<Move | null> {
  const ai = await import('@kamisado/ai');
  return payload.kind === 'move'
    ? ai.chooseMove(payload.state, payload.level)
    : ai.analyze(payload.state, { maxDepth: 12, timeMs: 400 }).move;
}

function send(payload: Payload): Promise<Move | null> {
  const w = getWorker();
  if (!w) return inline(payload);
  const id = nextId++;
  return new Promise<Move | null>((resolve, reject) => {
    const timer = window.setTimeout(() => killWorker('bot worker timed out'), REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      w.postMessage({ ...payload, id } as BotRequest);
    } catch (e) {
      pending.delete(id);
      window.clearTimeout(timer);
      reject(e as Error);
    }
  }).catch(() => inline(payload)); // never leave the game stuck on a worker problem
}

/** The bot's move for the side to move in `state` (runs in a Web Worker when available). */
export function requestBotMove(state: GameState, level: BotLevel): Promise<Move | null> {
  return send({ kind: 'move', state, level });
}

/** The best move for the side to move (used for hints). */
export function requestHint(state: GameState): Promise<Move | null> {
  return send({ kind: 'hint', state });
}
