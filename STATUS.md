# Build Status (as of this session)

This documents what was actually built and verified in this pass, versus what
remains on the roadmap from `README.md`, `kamisado-online-webapp-game/PLAN.md`,
and `kamisado-android-app/PLAN.md`. The full five-phase roadmap for both
platforms (ranked ladders, tournaments, a 50+ stage campaign, push
notifications, Google Play Games sync, a Play Store release, etc.) is a
multi-week undertaking; this pass prioritized a deep, correct, tested
foundation over shallow coverage of every bullet in both plans.

## Shared rules engine - done, verified

`packages/engine/` (TypeScript) and `kamisado-android-app/engine/` (Kotlin,
mirrored line-for-line) both implement `IKamisadoEngine` and pass all 25 cases
from `docs/TEST_SUITE_AND_EDGE_CASES.md`:

```
npm test -w @kamisado/engine                       # 40 tests: the 25 spec cases + clocks + next-round + non-baseline scoring
cd kamisado-android-app && ./gradlew :engine:test  # 30 tests: the 25 spec cases + next-round + deadlock scoring
npm test -w @kamisado/ai                           # 15 tests: fast search core vs the reference engine + bot levels
npm test -w kamisado-online-webapp-game            # 34 tests: puzzle catalogue, must-move, blunder guard, saved games
npm test -w @kamisado/room-server                  # 6 tests: resignation + next-round validation
```

A fresh, independent adversarial review (a separate agent with no builder
context, given only the specs and the code) additionally fuzz-tested the
engine with its own scratch tests - including a 300-game randomized fuzzer and
a dedicated multi-node deadlock-cycle sweep - and found zero bugs across 10
targeted correctness checks (diagonal-push rejection, S3 turn-sequencing, S6/S8
immunity in multi-piece chains, exact range boundaries, mandatory-move/push,
Quadruple Sumo auto-win, and stale-position regressions).

The 8x8 colour matrix in `packages/engine/src/board.ts` (and its Kotlin twin
`Board.kt`) is the authentic Kamisado board, supplied by the project owner:
every row and every column contains each of the eight colours exactly once,
and the two home rows are mirror images. (`docs/GAME_RULES_SPECIFICATION.md`
section 1.3's literal matrix had a transcription bug in two rows; the owner's
correction supersedes it.) Every fixture in the engine tests, the Academy
scenarios and the puzzles is verified against this board.

Two ambiguous corners of the spec required a judgment call, both reviewed and
endorsed by the independent pass: round wins always award a flat +1 point
regardless of the winning tower's Sumo rank (section 5.2's "worth 1/3/7/15
pts" language reads as flavor text paralleling the match-format thresholds,
not a scoring instruction - Test 15 is consistent with this reading; rounds
won by deadlock, timeout or resignation likewise score a flat +1 with no Sumo
promotion, via `awardRoundWin`, so matches can end that way), and the
official `regroupForNextRound` tower-reseating order (Rules F1-F4, which the
spec doesn't fully pin down) sorts by end-of-round advancement then column.

**House rule (owner's decision):** the shipped UIs do *not* use the official
fill-from-left/right regroup. Every round after the first restarts with each
tower back on the home square of its own colour - the same arrangement every
round - via `reseatForNextRound` (TS and Kotlin, tested). Sumo ranks persist,
scores carry over and the loser of the previous round opens. The official
`regroupForNextRound` is still implemented and tested if the rule is ever
switched back.

## AI (`packages/ai/`) - built, tested against the reference engine

- `Position` is a mutable, allocation-free twin of the engine rules built for
  search (moves, Sumo pushes, colour lock, stymie chains, deadlock
  adjudication, Zobrist hashing). Iterative-deepening alpha-beta with a
  transposition table, move ordering and history heuristic; about 0.5-1 M
  nodes/s and depth 12 in ~35 ms on typical middlegames (measured with
  `npm run bench -w @kamisado/ai`).
- Verified by differential fuzzing against the reference engine (legal moves,
  and for every move the resulting state, pass chains, deadlocks, pushes and
  incremental hashes - including push-heavy and deadlock-heavy positions), and
  by checking that its forced-win/forced-loss detection equals brute force on
  300 random positions.
- **Strength is graded mostly by evaluation noise, not depth**: measured
  bot-vs-bot, extra depth beyond ~4-6 plies adds surprisingly little because a
  Kamisado round is short and largely a tempo race (depth 8 vs depth 2 only
  57%, and evaluation weights barely matter). Student (depth 2, heavy noise),
  Ronin (4, medium), Samurai (6, light), Dragon Master (up to 20 within 1.5 s,
  no noise); noise never blurs a forced win/loss inside the horizon.
  `npm run tournament -w @kamisado/ai` (300 games per step from openings that
  are still undecided at 10 plies, Dragon depth-capped at 12 for
  reproducibility) gave: Student over Apprentice 99%, Ronin over Student 76%,
  Samurai over Ronin 67%, Dragon Master over Samurai 60% (95% lower bound 55%).
  The top step is small by nature; Dragon Master is essentially a flawless
  tactician, not a stronger "strategist".
- Not done: a Kotlin port of this search for the Android app (which still uses
  its own simple on-device bot).

## Web app (`kamisado-online-webapp-game/`) - built and verified in a real browser

- Vite + React + TypeScript + Tailwind, consuming `@kamisado/engine` directly.
- 8x8 board with 180-degree perspective flip, colorblind symbol assist
  (toggleable and persisted in both hotseat/AI and room play, sharing one
  preference), procedural WebAudio sound effects (no external audio assets,
  mute preference also persisted).
- Local hotseat play, full match formats (Single/Standard/Long/Marathon) with
  Sumo ring UI and push highlighting, pass/deadlock handling, and a
  round-over modal with a single "Start round N" action.
- **Colour-lock feedback:** the tower the colour lock forces the active player
  to move is auto-selected (legal moves shown without a click) and ringed with
  a pulsing halo, in hotseat, vs-AI, online and puzzle play; on a free-choice
  opening move every movable tower gets a dashed ring; the turn banner names
  the forced colour. Last-move trail on the board.
- **Modern dark-glass UI:** design tokens and primitives (glass surfaces, pill
  buttons, segmented controls, modal, icon set), sticky header nav plus a phone
  tab bar, a shared settings menu, player bars with score pips and clocks, a
  board sized by one CSS variable so it fits the viewport (no horizontal
  overflow at 390px on any page), towers that slide between squares
  (`prefers-reduced-motion` disables it), contrast-aware legal-move dots.
- An AI Dojo with **five levels** (Apprentice, Student, Ronin, Samurai, Dragon
  Master), powered by `packages/ai` and run in a Web Worker so the page never
  freezes (see "AI" below). Vs-bot games also have **Undo** (takes back your
  move and the bot's reply; untimed games), a **Hint** button (best move drawn
  in teal), an optional **Blunder guard** (asks before a move that lets the bot
  win on its very next turn), **Rematch / Rematch with swapped sides**, and
  **autosave/resume** of unfinished untimed games (stored as the round-start
  position plus moves and replayed through the engine on load, so a corrupt
  save is rejected).
- A 5-lesson interactive Academy, each lesson backed by a real engine-computed
  board position (not hand-drawn illustrations).
- Real-time multiplayer: a WebSocket room server (`packages/room-server/`,
  reusing the same engine) implementing the `JOIN_ROOM` / `SUBMIT_MOVE` /
  `RESIGN` / `SEND_EMOTE` protocol from `docs/DATA_MODELS_AND_PROTOCOL_SPEC.md`,
  plus room creation, shareable links, spectators, resignation, a civil
  4-emote reaction wheel with a toast for the incoming side, and a 60s
  disconnect-grace period (reconnecting with the same browser cancels the
  forfeiture countdown; failing to reconnect in time forfeits the round).
- Real time controls (Blitz 1+2 / Rapid 5+5 / Classical 15+0, or untimed),
  with a live per-player countdown, Fischer increments, and server/engine-
  enforced timeout adjudication (`tickClock` / `checkTimeout` in the engine).
- A Daily Puzzle mode: an engine-verified mate-in-X catalog
  (23 puzzles: mate in 1-3, rotating by calendar day; `puzzles.test.ts`
  proves each is a unique forced win in exactly N moves with Gold's replies
  forced, using the solver in `src/puzzles/solver.ts`) with move validation, a
  "Gold's reply is forced" auto-play for the opponent's turns, and a
  localStorage-backed solve streak.
- A Replay/Analysis viewer for a just-finished round (local hotseat/AI or a
  room game): step forward/backward through every ply (each snapshot is the
  real post-move `GameState`, not re-simulated), click any notation line to
  jump to it, and export the full notation text.

All of this was driven with a real headless Chromium via Playwright, not just
typechecked: the production build (`npm run build`) succeeds, and browser runs
verified moves, Sumo push highlighting, the AI responding automatically over a
color-forced turn, two separate browser contexts playing the same room
in real time with moves/color-forcing/seat assignment propagating correctly,
a live Blitz clock counting down and correctly timing a player out after the
real 60 seconds elapsed, a disconnect/reconnect cycle correctly cancelling a
pending forfeiture while an unanswered one actually forfeits the round after
the grace period, the daily puzzle solving correctly (plus the wrong-move
path), and a genuine 5-move win from the true initial position
(found and verified directly against the engine first) replayed step-by-step
through the viewer, confirming ply 0 is the full 16-tower starting position
and each step matches. That process caught four real bugs (all fixed and
re-verified): a React 18 StrictMode double-invocation issue that
double-recorded every move, independently in the local-game hook and the
room-connection hook, and again in the puzzle page's streak-recording logic
- each time from calling an impure function (a ref mutation or a localStorage
write) inside a `setState` functional updater or directly during render,
instead of a plain event handler or `useEffect` - and an unhandled promise
rejection when `navigator.clipboard.writeText` is denied permission (now a
`copyToClipboard` helper that fails closed instead of throwing).

The latest round of changes (colour-lock halo, per-round reset, UI redesign)
was additionally verified with scripted Playwright runs against the real
engine: a full random hotseat round where the UI's tower positions were
compared to the engine after every ply and the forced tower was auto-selected
on every forced turn; round 2's arrangement compared identical to round 1's;
the replay viewer and round modal; a three-browser online room (Black, Gold,
spectator) including a server-side rejection of a spectator's next-round
request; vs-AI with a Blitz clock; settings persistence; solving today's
puzzle through the UI; a vs-Dragon-Master game (reply in ~1.5 s while the page
kept rendering at 30+ fps), hint, two undos back to the opening position,
reload + resume, the blunder guard's cancel / play-anyway, and a finished match
followed by "rematch, swap sides"; and no horizontal overflow at 390px. Those scripts live
outside the repo (scratch directory) - only the vitest/JUnit suites above are
committed.

**Not built**: ranked ELO matchmaking/ladder, account systems, a 50+ stage puzzle campaign (23 puzzles exist), post-game blunder analysis, PWA/offline install, "play from
this position against a bot" branching in the replay viewer, friends lists,
tournaments, spectator theater, streamer overlays, and the other ~47 puzzle
stages a real "50+ stage" catalog would need (Phases 3-5 of `PLAN.md`).

## Android app (`kamisado-android-app/`) - two different verification levels

- `engine/`: pure Kotlin/JVM, fully verified (see above).
- `app/`: a Jetpack Compose UI (touch board, tap-to-select move input, haptic
  feedback via a real `Vibrator`/`VibrationEffect` pattern for placement vs.
  Sumo pushes, a Tabletop-mode 180-degree flip toggle, and a lightweight
  two-tier on-device AI opponent) covering roughly the Phase 1-2 scope of
  `PLAN.md` - **written and hand-reviewed, but not compiled**. (Its call sites
  were switched to the new per-round reset but that edit is likewise
  uncompiled; its UI still predates the web app's redesign.) Building any
  Android module requires the Android Gradle Plugin and SDK artifacts from
  Google's Maven repository, which was unreachable from this project's build
  sandbox (see `kamisado-android-app/README.md` for exact repro and how to
  build it for real on a machine with normal network access). One real bug
  was caught during manual review (a `Color` type collision between the
  engine's enum and Compose's `Color` class) and fixed, but treat this module
  as unverified until it has actually been compiled once.

**Not built**: The Dragon's Ascent campaign, daily puzzles, Bluetooth/Wi-Fi
Direct play, Google Play Games auth and cloud sync, push notifications, the
Dragon Vault cosmetic system, and the Play Store release (Phases 3-5).

## How to run things

```bash
npm install                                   # from repo root (npm workspaces)
npm run test:engine                           # 40/40 TS engine tests
npm test -w @kamisado/ai                       # 15/15 AI tests (vitest)
npm test -w kamisado-online-webapp-game        # 34/34 web unit tests (vitest)
npm test -w @kamisado/room-server              # 6/6 room-server tests (vitest)
npm run dev:web                                # web app on :5173
npm run dev:room-server                        # room server on :8787
cd kamisado-android-app && ./gradlew :engine:test   # 30/30 Kotlin engine tests
```
