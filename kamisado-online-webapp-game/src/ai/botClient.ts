import { analyze, chooseMove } from '@kamisado/ai';
import type { BotLevel } from '@kamisado/ai';
import type { GameState, Move } from '@kamisado/engine';
import type { BotRequest, BotResponse } from './botWorker.js';

export type { BotLevel };
export { BOT_LEVELS, LEVEL_INFO } from '@kamisado/ai';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (m: Move | null) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./botWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<BotResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if ('error' in event.data) entry.reject(new Error(event.data.error));
      else entry.resolve(event.data.move);
    };
    worker.onerror = () => {
      // the worker died: fail everything in flight so callers can fall back
      for (const entry of pending.values()) entry.reject(new Error('bot worker crashed'));
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

function inline<T>(compute: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    window.setTimeout(() => {
      try {
        resolve(compute());
      } catch (e) {
        reject(e as Error);
      }
    }, 0),
  );
}

type Payload = { kind: 'move'; state: GameState; level: BotLevel } | { kind: 'hint'; state: GameState };

function send(request: Payload, fallback: () => Move | null): Promise<Move | null> {
  const w = getWorker();
  if (!w) return inline(fallback);
  const id = nextId++;
  return new Promise<Move | null>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...request, id } as BotRequest);
  }).catch(() => inline(fallback)); // never leave the game stuck on a worker problem
}

/** The bot's move for the side to move in `state` (runs in a Web Worker when available). */
export function requestBotMove(state: GameState, level: BotLevel): Promise<Move | null> {
  return send({ kind: 'move', state, level }, () => chooseMove(state, level));
}

/** The best move for the side to move (used for hints). */
export function requestHint(state: GameState): Promise<Move | null> {
  return send({ kind: 'hint', state }, () => analyze(state, { maxDepth: 12, timeMs: 400 }).move);
}
