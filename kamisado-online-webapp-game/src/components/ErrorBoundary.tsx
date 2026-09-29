import { Component, ReactNode } from 'react';
import { clearSavedGame } from '../lib/savedGame.js';

/** Last line of defence: a render crash shows a recovery card instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Kamisado crashed while rendering', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="glass p-8">
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm text-stone-400">The page hit an unexpected error. Reloading usually fixes it; if it keeps happening, reset the saved game.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                clearSavedGame();
                window.location.assign('/');
              }}
            >
              Reset saved game
            </button>
          </div>
        </div>
      </div>
    );
  }
}
