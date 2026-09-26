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
cd packages/engine && npm test                    # 25/25 pass
cd kamisado-android-app && ./gradlew :engine:test  # 25/25 pass
```

A fresh, independent adversarial review (a separate agent with no builder
context, given only the specs and the code) additionally fuzz-tested the
engine with its own scratch tests - including a 300-game randomized fuzzer and
a dedicated multi-node deadlock-cycle sweep - and found zero bugs across 10
targeted correctness checks (diagonal-push rejection, S3 turn-sequencing, S6/S8
immunity in multi-piece chains, exact range boundaries, mandatory-move/push,
Quadruple Sumo auto-win, and stale-position regressions).

One data problem was found and fixed along the way: `docs/GAME_RULES_SPECIFICATION.md`
section 1.3's literal board matrix has a transcription bug (column 0 has
YELLOW twice and is missing PURPLE, which breaks the Latin-square property the
doc itself claims). The engine uses a reconstructed board, verified
programmatically to be a valid Latin square with exact 180-degree rotational
symmetry and the correct (and mutually consistent) home rows from that same
section - see the comment in `packages/engine/src/board.ts`.

Two ambiguous corners of the spec required a judgment call, both reviewed and
endorsed by the independent pass: round wins always award a flat +1 point
regardless of the winning tower's Sumo rank (section 5.2's "worth 1/3/7/15
pts" language reads as flavor text paralleling the match-format thresholds,
not a scoring instruction - Test 15 is consistent with this reading), and the
`regroupForNextRound` tower-reseating order (Rules F1-F4, which the spec
doesn't fully pin down) sorts by end-of-round advancement then column.

## Web app (`kamisado-online-webapp-game/`) - built and verified in a real browser

- Vite + React + TypeScript + Tailwind, consuming `@kamisado/engine` directly.
- 8x8 board with 180-degree perspective flip, colorblind symbol assist,
  procedural WebAudio sound effects (no external audio assets).
- Local hotseat play, full match formats (Single/Standard/Long/Marathon) with
  Sumo ring UI and push highlighting, pass/deadlock banners, and the
  regroup-between-rounds flow.
- An AI Dojo with three tiers (Apprentice: biased-random; Ronin: 1-ply greedy;
  Dragon Master: depth-3 alpha-beta minimax).
- A 5-lesson interactive Academy, each lesson backed by a real engine-computed
  board position (not hand-drawn illustrations).
- Real-time multiplayer: a WebSocket room server (`packages/room-server/`,
  reusing the same engine) implementing the `JOIN_ROOM` / `SUBMIT_MOVE` /
  `RESIGN` / `SEND_EMOTE` protocol from `docs/DATA_MODELS_AND_PROTOCOL_SPEC.md`,
  plus room creation, shareable links, spectators, and resignation.

All of this was driven with a real headless Chromium via Playwright, not just
typechecked: the production build (`npm run build`) succeeds, and browser runs
verified moves, Sumo push highlighting, the AI responding automatically over a
color-forced turn, and two separate browser contexts playing the same room
in real time with moves, color-forcing, and seat assignment all propagating
correctly. That process caught two real bugs (both fixed and re-verified): a
React 18 StrictMode double-invocation issue that double-recorded every move,
in both the local-game hook and the room-connection hook independently, from
mutating a ref inside a `setState` functional updater.

**Not built**: ranked ELO matchmaking/ladder, account systems, time-control
enforcement beyond a basic clock field, daily puzzles, replay/analysis
viewer, friends lists, tournaments, spectator theater, and streamer overlays
(Phases 3-5 of `PLAN.md`).

## Android app (`kamisado-android-app/`) - two different verification levels

- `engine/`: pure Kotlin/JVM, fully verified (see above).
- `app/`: a Jetpack Compose UI (touch board, tap-to-select move input, haptic
  feedback via a real `Vibrator`/`VibrationEffect` pattern for placement vs.
  Sumo pushes, a Tabletop-mode 180-degree flip toggle, and a lightweight
  two-tier on-device AI opponent) covering roughly the Phase 1-2 scope of
  `PLAN.md` - **written and hand-reviewed, but not compiled**. Building any
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
npm run test:engine                           # 25/25 TS engine tests
npm run dev:web                                # web app on :5173
npm run dev:room-server                        # room server on :8787
cd kamisado-android-app && ./gradlew :engine:test   # 25/25 Kotlin engine tests
```
