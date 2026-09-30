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
cd kamisado-android-app && ./gradlew :engine:test  # 43 tests: the 25 spec cases + next-round + deadlock scoring (30) and the Kotlin AI port vs the Kotlin engine (13)
npm test -w @kamisado/ai                           # 21 tests: fast search core vs the reference engine + bot levels + game review
npm test -w kamisado-online-webapp-game            # 48 tests: puzzle catalogue, must-move, blunder guard, saved games, campaign, screen-reader text, service worker
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
  incremental hashes - including push-heavy positions, 30,000 dense positions
  that produce ~50 deadlock adjudications, and a hand-built deadlock), and
  by checking that its forced-win/forced-loss detection equals brute force on
  300 random positions.
- **Levels combine depth and evaluation noise**: Student (depth 2, heavy
  noise), Ronin (4, medium), Samurai (6, light), Dragon Master (up to 20 within
  1.5 s, no noise); noise never blurs a forced win/loss inside the horizon.
  Every decision starts from a cold transposition table (an earlier version
  shared one table between all searches, so a hint - or the other side in a
  bot-vs-bot test - leaked deeper knowledge into weaker levels and made the
  ladder look flatter than it is; a blind review caught this). With that fixed,
  noise-free depth matters a lot: depth 8 beats depth 2 93%, depth 6 beats 4
  76%, depth 12 beats 6 75%; evaluation weights matter little (variants within
  +-4% of the default).
  `npm run tournament -w @kamisado/ai` (300 games per step from openings that
  are still undecided at 10 plies, Dragon depth-capped at 12 for
  reproducibility) gives: Student over Apprentice 97%, Ronin over Student 84%,
  Samurai over Ronin 83%, Dragon Master over Samurai 79% (95% lower bounds
  94/80/78/74%).
- **Game review** (`review.ts`): every ply of a finished round is re-searched
  (depth 8, 6 in very wide positions) and classified best / good / inaccuracy /
  mistake / blunder / missed-win from the drop in win chance
  (`tanh(score/180)`, +-1 for forced results); each side gets an accuracy score.
  Tests cover a planted missed win and blunder, whole-game consistency and
  near-perfect accuracy for search-perfect play.
- **Kotlin port for Android** (`kamisado-android-app/engine/.../com/kamisado/ai/`:
  `Position`, `Eval`, `Search`, `Levels`): same encoding, hashing, search and
  five levels. 13 JUnit tests check it against the *Kotlin* reference engine the
  same way the TS suite does (legal moves and per-tower `hasMove`/`canReachGoal`
  on random, push-heavy and dense positions; every move's resulting state, pass
  chains, deadlock winner, winners and incremental hashes; whole random
  playouts; a hand-built deadlock; forced-win detection equal to a brute-force
  solver; level legality/reproducibility/take-a-win-in-one; a depth-8 side
  beating a depth-2 side). Mutation-checked: inverting the deadlock loser,
  loosening the push capacity, or dropping the `lastMover` restore in `unmake`
  each make several of them fail. (One test runs 24 decisions on 24 threads and
  compares them with the sequential answers; it passed with the lock removed
  too, so it is a smoke test of the serialised table, not proof of it.) The
  Kotlin port has no review/analysis and its
  strength ladder was not re-measured (it is the same algorithm, not the same
  binary; the TS ladder above is the measured one).

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
  position plus moves; a save is validated - setup, real board, 16 distinct
  towers - and replayed through the engine on load, and anything that fails is
  discarded; an error boundary shows a recovery card instead of a blank page).
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
- **Post-game analysis**: "Analyze" in the replay viewer runs the review in the
  worker with a progress bar and shows per-side accuracy, an evaluation graph,
  a verdict badge on every move, and draws the engine's better move on the
  board for any non-best move.
- **Campaign - The Dragon's Ascent** (`/campaign`): ten named opponents that
  climb Apprentice -> Dragon Master, alternating your colour and match length,
  each unlocked by beating the last; progress persists in localStorage; assists
  (undo, hint) and autosave are off; win/lose dialogs offer next opponent /
  try again. (Ten stages, not the 50+ of the plan.)
- **Keyboard and screen readers**: the board is one tab stop (roving tabindex;
  arrows, Home/End, PageUp/PageDown, Enter/Space), squares announce colour,
  occupant, selected / legal move / legal push / suggested, and a polite live
  region announces every move, whose turn it is and which tower must move.
- **Installable and offline** (PWA): manifest + icons, a build-generated service
  worker (network-first navigations, cache-first hashed assets, the bot worker
  precached), an Offline chip in the header. Verified against the production
  build: offline reloads of /play, /campaign, /puzzle and /academy, and a bot
  reply while offline. Online rooms obviously still need the network.
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
followed by "rematch, swap sides"; and no horizontal overflow at 390px.

A blind critic reviewed the final round's diff without seeing the author's
notes. Its own 60,000-position fuzz of the Kotlin `Position` against the Kotlin
engine found no mismatch, and it found nothing wrong in the review/worker,
campaign or hook logic. It did find, and these were fixed and re-verified:
(1) **the Android `:app` sources did not compile** - eight cross-module
smart-cast errors (`state.requiredColor`, `applied.state`), reproduced in a
scratch Gradle project that builds `Bot.kt` and `GameViewModel.kt` against
`:engine` as a separate module, and now compiling clean there (the Compose
files themselves still cannot be built here); (2) the service worker cached
*any* navigation response as the offline shell, so a 502 could poison it, and
`caches.match` could serve an older build's shell - now only good same-origin
pages are cached, the current cache is consulted first and the newest previous
generation is kept so an open old tab can still load its worker script (5 unit
tests run the real script against a stubbed Cache Storage; two fail on the old
behaviour); (3) the replay dialog opened from the round-over dialog was
unreachable by keyboard (focus stayed behind it) - a shared `useDialogFocus`
hook now traps focus, restores it on close, and a keyboard-only Playwright run
fails without it and passes with it; (4) the Android hub could not scroll in
landscape with eight buttons; (5) the board swallowed Alt/Ctrl/Cmd+arrow
browser shortcuts; (6) the announcer read a human move twice once the bot
started thinking, and never announced stymie passes; (7) the Kotlin
`chooseMove` could throw instead of falling back, and its shared transposition
table is now serialised.

The final round (analysis, campaign, keyboard/screen reader, PWA, Kotlin AI) was
verified the same way, and every earlier browser script was re-run against the
new UI: all pass. New checks: analysis completes with accuracy, graph and a
drawn better move; a full campaign win unlocks the next stage, survives a
reload and leaves no stray Dojo save; a move played with the keyboard only plus
the exact announcer text; the service worker controls the page and everything
works offline; a keyboard-only pass through the replay dialog and a check that no announcement repeats the previous move; and a sweep of seven pages at 320 / 360 / 390 px, which found and
fixed a real 19 px horizontal overflow on the home page at 320 px. Those scripts
live outside the repo (scratch directory) - only the vitest/JUnit suites above
are committed.

**Not built**: ranked ELO matchmaking/ladder, account systems, "play from this
position against a bot" branching in the replay viewer, friends lists,
tournaments, spectator theater, streamer overlays, cloud sync of campaign
progress (it lives in one browser's localStorage), and the roughly 27 further
puzzle stages a real "50+ stage" catalog would need (23 exist; 10 campaign
stages; Phases 3-5 of `PLAN.md`).

## Android app (`kamisado-android-app/`) - two different verification levels

- `engine/`: pure Kotlin/JVM, fully verified (see above).
- `app/`: a Jetpack Compose UI (touch board, tap-to-select move input, haptic
  feedback via a real `Vibrator`/`VibrationEffect` pattern for placement vs.
  Sumo pushes, a Tabletop-mode 180-degree flip toggle, and a lightweight
  five-level on-device AI opponent) covering roughly the Phase 1-2 scope of
  `PLAN.md` - **written and hand-reviewed, but not compiled**. (Its call sites
  were switched to the new per-round reset and to the shared Kotlin AI - the hub
  now lists all five opponents and searches run on `Dispatchers.Default` - but
  those edits are likewise uncompiled: only `ai/Bot.kt` was compile-checked, by
  temporarily building it inside `:engine`; its UI still predates the web app's
  redesign.) The `:engine` module now emits Java 17 bytecode (it is still
  compiled by JDK 21) because the app module targets JVM 17 and could not read
  newer class files; the tests were re-run after that change. Building any
  Android module requires the Android Gradle Plugin and SDK artifacts from
  Google's Maven repository, which was unreachable from this project's build
  sandbox (see `kamisado-android-app/README.md` for exact repro and how to
  build it for real on a machine with normal network access). One real bug
  was caught during manual review (a `Color` type collision between the
  engine's enum and Compose's `Color` class) and fixed, but treat this module
  as unverified until it has actually been compiled once.

**Not built** on Android: The Dragon's Ascent campaign (web only), daily puzzles, game review, Bluetooth/Wi-Fi
Direct play, Google Play Games auth and cloud sync, push notifications, the
Dragon Vault cosmetic system, and the Play Store release (Phases 3-5).

## How to run things

```bash
npm install                                   # from repo root (npm workspaces)
npm run test:engine                           # 40/40 TS engine tests
npm test -w @kamisado/ai                       # 21/21 AI tests (vitest)
npm test -w kamisado-online-webapp-game        # 48/48 web unit tests (vitest)
npm test -w @kamisado/room-server              # 6/6 room-server tests (vitest)
npm run dev:web                                # web app on :5173
npm run dev:room-server                        # room server on :8787
cd kamisado-android-app && ./gradlew :engine:test   # 43/43 Kotlin tests (engine 30 + AI port 13)
```
