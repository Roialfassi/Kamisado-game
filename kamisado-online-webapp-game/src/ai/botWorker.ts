/// Runs bot searches and game reviews off the main thread so the UI never freezes.
import { analyze, chooseMove, reviewGame } from '@kamisado/ai';
import type { BotLevel, PlyReview } from '@kamisado/ai';
import type { GameState, Move } from '@kamisado/engine';

export type BotRequest =
  | { id: number; kind: 'move'; state: GameState; level: BotLevel }
  | { id: number; kind: 'hint'; state: GameState }
  | { id: number; kind: 'review'; states: GameState[]; moves: Move[] };
export type BotResponse =
  | { id: number; move: Move | null }
  | { id: number; progress: { done: number; total: number } }
  | { id: number; review: PlyReview[] }
  | { id: number; error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BotRequest>) => void) | null;
  postMessage(message: BotResponse): void;
};

scope.onmessage = (event) => {
  const req = event.data;
  try {
    if (req.kind === 'review') {
      const review = reviewGame(req.states, req.moves, {}, (done, total) => scope.postMessage({ id: req.id, progress: { done, total } }));
      scope.postMessage({ id: req.id, review });
      return;
    }
    const move = req.kind === 'move' ? chooseMove(req.state, req.level) : analyze(req.state, { maxDepth: 16, timeMs: 700 }).move;
    scope.postMessage({ id: req.id, move });
  } catch (error) {
    scope.postMessage({ id: req.id, error: String(error) });
  }
};
