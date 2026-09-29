/// Runs bot searches off the main thread so the UI never freezes while a strong level thinks.
import { analyze, chooseMove } from '@kamisado/ai';
import type { BotLevel } from '@kamisado/ai';
import type { GameState, Move } from '@kamisado/engine';

export type BotRequest =
  | { id: number; kind: 'move'; state: GameState; level: BotLevel }
  | { id: number; kind: 'hint'; state: GameState };
export type BotResponse = { id: number; move: Move | null } | { id: number; error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BotRequest>) => void) | null;
  postMessage(message: BotResponse): void;
};

scope.onmessage = (event) => {
  const req = event.data;
  try {
    const move = req.kind === 'move' ? chooseMove(req.state, req.level) : analyze(req.state, { maxDepth: 16, timeMs: 700 }).move;
    scope.postMessage({ id: req.id, move });
  } catch (error) {
    scope.postMessage({ id: req.id, error: String(error) });
  }
};
