import { describe, expect, it } from 'vitest';
import { GameState, GameStatus, MoveType, PlayerSide, findTower, getLegalMoves, handlePassOrDeadlock, ALL_COLORS } from '@kamisado/engine';
import { Color, MatchFormat, createGame } from '@kamisado/engine';
import { COLOR_INDEX, Position, sideIndex } from '../src/index.js';
import { densePosition, makeRng, pushPosition, randomPosition, refMoves, refStep, towerId } from './helpers.js';

const enc = (m: { from: { row: number; col: number }; to: { row: number; col: number }; type: MoveType }) =>
  m.from.row * 8 + m.from.col + ((m.to.row * 8 + m.to.col) << 6) + (m.type === MoveType.SUMO_PUSH ? 1 << 12 : 0);

function snapshot(p: Position) {
  return JSON.stringify([Array.from(p.occ), Array.from(p.pos), p.active, p.required, p.lastMover, p.hashLo, p.hashHi]);
}

describe('fast Position agrees with the reference engine', () => {
  for (const sumo of [false, true]) {
    it(`legal moves, hasMove and canReachGoal on 600 random positions (sumo=${sumo})`, () => {
      const rng = makeRng(sumo ? 7 : 3);
      for (let i = 0; i < 600; i++) {
        const state = randomPosition(rng, { sumo });
        const pos = Position.fromState(state);
        // move lists (as sets)
        const buf = new Int32Array(160);
        const n = pos.genMoves(buf);
        const fast = Array.from(buf.subarray(0, n)).sort((a, b) => a - b);
        const ref = refMoves(state).map(enc).sort((a, b) => a - b);
        expect(fast).toEqual(ref);
        // per-tower, both sides
        for (const side of [PlayerSide.BLACK, PlayerSide.GOLD]) {
          const asActive: GameState = { ...state, activePlayer: side };
          for (const color of ALL_COLORS) {
            const t = sideIndex(side) * 8 + COLOR_INDEX[color];
            const legal = getLegalMoves(asActive, color);
            expect(pos.hasMove(t)).toBe(legal.length > 0);
            const goal = side === PlayerSide.BLACK ? 7 : 0;
            const tower = findTower(state, side, color)!;
            const refReach = legal.some((m) => m.type === MoveType.STANDARD && m.to.row === goal) && tower.position.row !== goal;
            expect(pos.canReachGoal(t)).toBe(refReach);
          }
        }
      }
    });

    it(`every move: resulting state, pass chains, deadlocks, winners and hashes match (sumo=${sumo})`, () => {
      const rng = makeRng(sumo ? 21 : 11);
      let terminals = 0;
      let deadlocks = 0;
      let pushes = 0;
      let passes = 0;
      for (let i = 0; i < 600; i++) {
        const state = i % 3 === 0 ? densePosition(rng) : sumo && i % 2 === 0 ? pushPosition(rng) : randomPosition(rng, { sumo });
        const pos = Position.fromState(state);
        const before = snapshot(pos);
        const buf = new Int32Array(160);
        const n = pos.genMoves(buf);
        const moves = Array.from(buf.subarray(0, n));
        const ref = refMoves(state);
        for (const m of moves) {
          const refMove = ref.find((r) => enc(r) === m)!;
          const next = refStep(state, refMove);
          if (refMove.type === MoveType.SUMO_PUSH) pushes++;
          const winner = pos.make(m);
          if (next.status !== GameStatus.IN_PROGRESS) {
            terminals++;
            if (next.roundOverReason === 'DEADLOCK') deadlocks++;
            expect(winner).toBe(sideIndex(next.roundWinner!));
          } else {
            expect(winner).toBe(-1);
            expect(pos.active).toBe(sideIndex(next.activePlayer));
            expect(pos.required).toBe(next.requiredColor === null ? -1 : COLOR_INDEX[next.requiredColor]);
            if (next.lastMove?.type === MoveType.PASS) passes++;
            // full equivalence incl. incremental hash
            const rebuilt = Position.fromState(next);
            expect(Array.from(pos.occ)).toEqual(Array.from(rebuilt.occ));
            expect(Array.from(pos.pos)).toEqual(Array.from(rebuilt.pos));
            expect(pos.lastMover).toBe(rebuilt.lastMover);
            expect(pos.hashLo).toBe(rebuilt.hashLo);
            expect(pos.hashHi).toBe(rebuilt.hashHi);
          }
          pos.unmake();
          expect(snapshot(pos)).toBe(before);
        }
      }
      // the fuzz must actually exercise the interesting rules
      expect(terminals).toBeGreaterThan(50);
      expect(passes).toBeGreaterThan(20);
      if (sumo) expect(pushes).toBeGreaterThan(50);
      console.log(`  [sumo=${sumo}] terminals=${terminals} deadlocks=${deadlocks} pushes=${pushes} passes=${passes}`);
    });
  }

  it('random playouts from the opening stay in lock-step for whole rounds', () => {
    const rng = makeRng(99);
    for (let g = 0; g < 60; g++) {
      let state = g % 3 === 0 ? pushPosition(rng) : randomPosition(rng, { sumo: g % 2 === 0 });
      const resolved = handlePassOrDeadlock(state);
      if (resolved.state) state = resolved.state;
      if (state.status !== GameStatus.IN_PROGRESS) continue;
      const pos = Position.fromState(state);
      for (let ply = 0; ply < 80 && state.status === GameStatus.IN_PROGRESS; ply++) {
        const ref = refMoves(state);
        expect(ref.length).toBeGreaterThan(0);
        const buf = new Int32Array(160);
        const n = pos.genMoves(buf);
        expect(Array.from(buf.subarray(0, n)).sort((a, b) => a - b)).toEqual(ref.map(enc).sort((a, b) => a - b));
        const pick = ref[Math.floor(rng() * ref.length)]!;
        const winner = pos.make(enc(pick));
        state = refStep(state, pick);
        if (state.status !== GameStatus.IN_PROGRESS) {
          expect(winner).toBe(sideIndex(state.roundWinner!));
        } else {
          expect(winner).toBe(-1);
          expect(pos.hashLo).toBe(Position.fromState(state).hashLo);
        }
      }
    }
  });

  it('a move that walks into a deadlock is adjudicated the same way (loser = last physical mover)', () => {
    // Engine Test 12's interlock, with Black to move freely: landing any Black tower on a BLUE
    // square forces Gold's boxed-in BLUE tower, whose square forces Black's boxed-in ORANGE tower,
    // whose square is BLUE again - a repeated impasse.
    let state = createGame(MatchFormat.STANDARD);
    const put = (side: PlayerSide, color: Color, row: number, col: number) => {
      const id = towerId(side, color);
      state = { ...state, towers: { ...state.towers, [id]: { ...state.towers[id]!, position: { row, col } } } };
    };
    put(PlayerSide.GOLD, Color.BLUE, 3, 4);
    put(PlayerSide.BLACK, Color.ORANGE, 2, 0);
    put(PlayerSide.GOLD, Color.GREEN, 2, 3);
    put(PlayerSide.GOLD, Color.RED, 2, 4);
    put(PlayerSide.GOLD, Color.YELLOW, 2, 5);
    put(PlayerSide.BLACK, Color.PINK, 3, 0);
    put(PlayerSide.BLACK, Color.PURPLE, 3, 1);
    state = { ...state, activePlayer: PlayerSide.BLACK, requiredColor: null, lastPhysicalMover: PlayerSide.GOLD };

    const pos = Position.fromState(state);
    const buf = new Int32Array(160);
    const n = pos.genMoves(buf);
    const ref = refMoves(state);
    let deadlocks = 0;
    for (let i = 0; i < n; i++) {
      const m = buf[i]!;
      const next = refStep(state, ref.find((r) => enc(r) === m)!);
      const winner = pos.make(m);
      if (next.roundOverReason === 'DEADLOCK') {
        deadlocks++;
        expect(next.roundWinner).toBe(PlayerSide.GOLD); // Black made the last physical move, so Black loses
        expect(winner).toBe(1);
      } else if (next.status === GameStatus.IN_PROGRESS) {
        expect(winner).toBe(-1);
      }
      pos.unmake();
    }
    expect(deadlocks).toBeGreaterThan(0);
  });

  it('deadlock adjudication matches the engine across 30,000 dense positions', () => {
    const rng = makeRng(424242);
    let deadlocks = 0;
    let terminals = 0;
    for (let i = 0; i < 30000; i++) {
      const state = densePosition(rng);
      const pos = Position.fromState(state);
      const buf = new Int32Array(160);
      const n = pos.genMoves(buf);
      if (n === 0) continue;
      const ref = refMoves(state);
      for (let k = 0; k < n; k++) {
        const m = buf[k]!;
        const next = refStep(state, ref.find((r) => enc(r) === m)!);
        const winner = pos.make(m);
        if (next.status !== GameStatus.IN_PROGRESS) {
          terminals++;
          if (next.roundOverReason === 'DEADLOCK') deadlocks++;
          expect(winner).toBe(sideIndex(next.roundWinner!));
        } else {
          expect(winner).toBe(-1);
          expect(pos.active).toBe(sideIndex(next.activePlayer));
        }
        pos.unmake();
      }
    }
    expect(deadlocks).toBeGreaterThan(15);
    console.log(`  dense fuzz: terminals=${terminals} deadlocks=${deadlocks}`);
  });
});
