# Kamisado Digital Game Ecosystem

A modern, multi-platform digital adaptation of **Kamisado**, the award-winning abstract strategy board game created by **Peter Burley** in 2008.

```
   ┌─────────────────────────────────────────────────────────────────┐
   │                    KAMISADO DUAL ECOSYSTEM                      │
   │        Zero Luck • Perfect Information • Pure Strategy          │
   └─────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
 [ kamisado-online-webapp-game ]              [ kamisado-android-app ]
 • Instant Zero-Install Browser Play          • Tactile Haptics & Snap Gestures
 • 1-Click Shareable Room Links               • 2-Player Tabletop Pass & Play
 • Ranked ELO Ladder & Clocks                 • Offline "Dragon's Ascent" Story
 • "Kamisado TV" Spectator Theater            • Push-Alert Asynchronous Turns
```

---

## About Kamisado

Kamisado is a deterministic, two-player game played on an 8×8 grid of 64 multicolored squares arranged in a Latin square (each row and column contains each of the 8 colors exactly once: **Brown, Green, Red, Yellow, Pink, Purple, Blue, Orange**).

### Core Rules at a Glance
1. **The Starting Ranks**: Each player commands 8 octagonal Dragon Towers matching the 8 colors. Black towers face Gold/White towers across the board.
2. **Forward Movement Only**: Towers move any distance in a straight line forward or diagonally forward. No backward or sideways moves are permitted, and towers cannot jump or land on occupied squares.
3. **The Color Constraint**: The opening player (Black) chooses any piece. After that, **each player must move the tower whose color matches the color of the square on which the opponent's previous move landed**.
4. **Winning a Round**: The first player to successfully maneuver any tower into the opponent's home row wins the round.
5. **Passes & Deadlocks**: If your designated tower cannot legally move forward, you must pass. If a cyclic chain of passes leaves neither player able to move (deadlock), the player who made the last physical move loses the round.
6. **Sumo Mechanics (Match Play)**: In multi-round matches (Standard: 3 pts, Long: 7 pts, Marathon: 15 pts), victorious towers earn Sumo rings. Sumo towers can push adjacent opponent pieces backward into empty tiles, balanced by restricted forward movement range.

---

## Repository Structure & Documentation

This repository contains two dedicated, standalone projects designed to complement one another:

| Project Directory | Purpose & Platform | Master Blueprint | Autonomous Gauntlet Loop |
| :--- | :--- | :--- | :--- |
| **[`kamisado-online-webapp-game/`](./kamisado-online-webapp-game/)** | Instant-access web arena for browser play, global matchmaking, and live spectating. | [PLAN.md](./kamisado-online-webapp-game/PLAN.md) | [GAUNTLET_LOOP.md](./kamisado-online-webapp-game/GAUNTLET_LOOP.md) |
| **[`kamisado-android-app/`](./kamisado-android-app/)** | Tactile mobile companion with haptic feedback, face-to-face tabletop mode, and offline campaign. | [PLAN.md](./kamisado-android-app/PLAN.md) | [GAUNTLET_LOOP.md](./kamisado-android-app/GAUNTLET_LOOP.md) |

### Core Developer Specifications
To eliminate all ambiguity during implementation, the following foundational specifications are provided at the root:
* 📐 **[`GAME_RULES_SPECIFICATION.md`](./GAME_RULES_SPECIFICATION.md)**: Precise mathematical 8×8 Latin square matrix, movement vectors, Stymie (Pass) state machine, deadlock adjudication, and multi-tier Sumo pushing mechanics.
* 📦 **[`DATA_MODELS_AND_PROTOCOL_SPEC.md`](./DATA_MODELS_AND_PROTOCOL_SPEC.md)**: Shared TypeScript/JSON data models, pure state reducer interface contracts, real-time WebSocket schemas, and game record notation format.
* 🧪 **[`TEST_SUITE_AND_EDGE_CASES.md`](./TEST_SUITE_AND_EDGE_CASES.md)**: Comprehensive 25-case automated test specification covering all movement edge cases, deadlock chains, and Sumo immunity hierarchies.

---

## The Gauntlet Loop Methodology

Both projects feature an autonomous **Gauntlet Loop** specification based on the agentic development methodology popularized by Matt Shumer. 

Instead of manual, incremental prompting, the Gauntlet Loop drives autonomous build-and-critique cycles:
* **The Lead Architect**: Decomposes phases into atomic feature modules.
* **Specialist Builders**: Implement core rules, graphics, haptics, and networking.
* **Harsh Blind Critics**: Evaluate outputs in a fresh, isolated context against real-world benchmarks (e.g., Lichess.org responsiveness, Polytopia tactile feel, 100% strict Burley Games rule fidelity). If any edge case or latency issue is found, the work is rejected and automatically refined.

### How to Run a Gauntlet Loop
1. Navigate to the desired project directory (`kamisado-online-webapp-game/` or `kamisado-android-app/`).
2. Open `GAUNTLET_LOOP.md` and copy the prompt in **Section 5**.
3. Paste the prompt into your AI coding assistant (Claude Code, Antigravity CLI, or IDE agent) to launch the autonomous development and validation cycle.

---

## Shared Values & Player Experience

* **100% Rule Integrity**: Strictly authentic to Peter Burley's official Burley Games tournament ruleset.
* **Universal Accessibility**: Toggleable colorblind symbols (etched Kanji/geometric emblems) across all boards and towers.
* **Zero Pay-to-Win**: Pure strategy and intellectual competition with no energy limits, stat boosts, or locked rulesets.
