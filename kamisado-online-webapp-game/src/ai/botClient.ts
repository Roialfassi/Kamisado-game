import type { BotLevel } from '@kamisado/ai/levels';
import type { PlyReview } from '@kamisado/ai';
import type { GameState, Move } from '@kamisado/engine';
import type { BotRequest, BotResponse } from './botWorker.js';

// Only the tiny metadata module is imported statically; the search code (and its
// 7 MB transposition table) lives in the worker, and is loaded here lazily only if
// the worker itself cannot be used.
export type { BotLevel, PlyReview };
export { BOT_LEVELS, LEVEL_INFO } from '@kamisado/ai/levels';

const MOVE_TIMEOUT_MS = 20_000;
const REVIEW_TIMEOUT_MS = 120_000;

interface Pending {
  resolve: (value: Move | null | PlyReview[]) => void;
  reject: (e: Error) => void;
  timer: number;
  onProgress?: (done: number, total: number) => void;
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
      const data = event.data;
      const entry = pending.get(data.id);
      if (!entry) return;
      if ('progress' in data) {
        entry.onProgress?.(data.progress.done, data.progress.total);
        return;
      }
      pending.delete(data.id);
      window.clearTimeout(entry.timer);
      if ('error' in data) entry.reject(new Error(data.error));
      else if ('review' in data) entry.resolve(data.review);
      else entry.resolve(data.move);
    };
    // the worker died or its script could not load: drop it so the next request starts a fresh one
    w.onerror = () => killWorker('bot worker crashed');
    worker = w;
    return w;
  } catch {
    return null;
  }
}

type Payload =
  | { kind: 'move'; state: GameState; level: BotLevel }
  | { kind: 'hint'; state: GameState }
  | { kind: 'review'; states: GameState[]; moves: Move[] };

/** Main-thread fallback (worker unavailable / failed). */
async function inline(payload: Payload, onProgress?: (done: number, total: number) => void): Promise<Move | null | PlyReview[]> {
  const ai = await import('@kamisado/ai');
  if (payload.kind === 'review') return ai.reviewGame(payload.states, payload.moves, {}, onProgress);
  return payload.kind === 'move' ? ai.chooseMove(payload.state, payload.level) : ai.analyze(payload.state, { maxDepth: 12, timeMs: 400 }).move;
}

function send(payload: Payload, timeoutMs: number, onProgress?: (done: number, total: number) => void): Promise<Move | null | PlyReview[]> {
  const w = getWorker();
  if (!w) return inline(payload, onProgress);
  const id = nextId++;
  return new Promise<Move | null | PlyReview[]>((resolve, reject) => {
    const timer = window.setTimeout(() => killWorker('bot worker timed out'), timeoutMs);
    pending.set(id, { resolve, reject, timer, onProgress });
    try {
      w.postMessage({ ...payload, id } as BotRequest);
    } catch (e) {
      pending.delete(id);
      window.clearTimeout(timer);
      reject(e as Error);
    }
  }).catch(() => inline(payload, onProgress)); // never leave the game stuck on a worker problem
}

/** The bot's move for the side to move in `state` (runs in a Web Worker when available). */
export function requestBotMove(state: GameState, level: BotLevel): Promise<Move | null> {
  return send({ kind: 'move', state, level }, MOVE_TIMEOUT_MS) as Promise<Move | null>;
}

/** The best move for the side to move (used for hints). */
export function requestHint(state: GameState): Promise<Move | null> {
  return send({ kind: 'hint', state }, MOVE_TIMEOUT_MS) as Promise<Move | null>;
}

/** Reviews every move of a round (`states[i]` is the position before `moves[i]`). */
export function requestReview(states: GameState[], moves: Move[], onProgress?: (done: number, total: number) => void): Promise<PlyReview[]> {
  return send({ kind: 'review', states, moves }, REVIEW_TIMEOUT_MS, onProgress) as Promise<PlyReview[]>;
}
