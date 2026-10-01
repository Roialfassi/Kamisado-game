import { ALL_COLORS, Color, GameState, Move, MoveType, PlayerSide, SumoRank } from '@kamisado/engine';

/**
 * A mutable, allocation-free twin of the engine's rules, built for search.
 * It re-implements exactly the reference engine's move generation (standard
 * moves + the single Sumo push), turn flow (colour lock, Sumo extra turn,
 * stymie pass chains, deadlock adjudication) and terminal detection - and is
 * checked against the reference engine by `test/differential.test.ts`.
 *
 * Encoding: cells are `row * 8 + col`; towers are `side * 8 + colourIndex`
 * (side 0 = BLACK, 1 = GOLD; colourIndex = index in ALL_COLORS); a move is
 * `from | to << 6 | push << 12`.
 */

export const NO_TOWER = -1;
const RANGE = [7, 5, 3, 1];
const CAPACITY = [0, 1, 2, 3];

export const COLOR_INDEX: Record<Color, number> = Object.fromEntries(ALL_COLORS.map((c, i) => [c, i])) as Record<Color, number>;

export function sideIndex(side: PlayerSide): number {
  return side === PlayerSide.BLACK ? 0 : 1;
}
export function sideOf(index: number): PlayerSide {
  return index === 0 ? PlayerSide.BLACK : PlayerSide.GOLD;
}
/** +1 for Black (row increases), -1 for Gold. */
export function dirOf(side: number): number {
  return side === 0 ? 1 : -1;
}
export function goalRow(side: number): number {
  return side === 0 ? 7 : 0;
}

// ---- Zobrist hashing (two independent 32-bit halves), fixed seed ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
}
const rng = mulberry32(0x4b414d49);
const Z_TOWER_LO = new Int32Array(16 * 64);
const Z_TOWER_HI = new Int32Array(16 * 64);
const Z_RANK_LO = new Int32Array(16 * 4);
const Z_RANK_HI = new Int32Array(16 * 4);
const Z_ACTIVE_LO = new Int32Array(2);
const Z_ACTIVE_HI = new Int32Array(2);
const Z_REQ_LO = new Int32Array(9);
const Z_REQ_HI = new Int32Array(9);
const Z_LAST_LO = new Int32Array(3);
const Z_LAST_HI = new Int32Array(3);
for (const arr of [Z_TOWER_LO, Z_TOWER_HI, Z_RANK_LO, Z_RANK_HI, Z_ACTIVE_LO, Z_ACTIVE_HI, Z_REQ_LO, Z_REQ_HI, Z_LAST_LO, Z_LAST_HI]) {
  for (let i = 0; i < arr.length; i++) arr[i] = rng() | 0;
}

const MAX_PLY = 256;

export class Position {
  readonly occ = new Int8Array(64).fill(NO_TOWER);
  readonly pos = new Int8Array(16);
  readonly rank = new Uint8Array(16);
  readonly colorOf = new Uint8Array(64);
  active = 0;
  /** Colour index the active side must move, or -1 on a free-choice turn. */
  required = -1;
  /** Side that made the last physical move (-1 if none yet this round). */
  lastMover = -1;
  private towerHashLo = 0;
  private towerHashHi = 0;

  // undo stack
  private sp = 0;
  private readonly uActive = new Int8Array(MAX_PLY);
  private readonly uRequired = new Int8Array(MAX_PLY);
  private readonly uLast = new Int8Array(MAX_PLY);
  private readonly uMove = new Int32Array(MAX_PLY);
  private readonly uChain = new Int8Array(MAX_PLY);
  private readonly uHashLo = new Int32Array(MAX_PLY);
  private readonly uHashHi = new Int32Array(MAX_PLY);

  static fromState(state: GameState): Position {
    const p = new Position();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) p.colorOf[r * 8 + c] = COLOR_INDEX[state.boardLayout[r]![c]!];
    }
    for (const t of Object.values(state.towers)) {
      const idx = sideIndex(t.side) * 8 + COLOR_INDEX[t.color];
      const cell = t.position.row * 8 + t.position.col;
      p.pos[idx] = cell;
      p.rank[idx] = t.sumoRank;
      p.occ[cell] = idx;
    }
    p.active = sideIndex(state.activePlayer);
    p.required = state.requiredColor === null ? -1 : COLOR_INDEX[state.requiredColor];
    p.lastMover = state.lastPhysicalMover === null ? -1 : sideIndex(state.lastPhysicalMover);
    p.rehash();
    return p;
  }

  private rehash(): void {
    let lo = 0;
    let hi = 0;
    for (let t = 0; t < 16; t++) {
      const k = t * 64 + this.pos[t]!;
      lo ^= Z_TOWER_LO[k]! ^ Z_RANK_LO[t * 4 + this.rank[t]!]!;
      hi ^= Z_TOWER_HI[k]! ^ Z_RANK_HI[t * 4 + this.rank[t]!]!;
    }
    this.towerHashLo = lo;
    this.towerHashHi = hi;
  }

  get hashLo(): number {
    return this.towerHashLo ^ Z_ACTIVE_LO[this.active]! ^ Z_REQ_LO[this.required + 1]! ^ Z_LAST_LO[this.lastMover + 1]!;
  }
  get hashHi(): number {
    return this.towerHashHi ^ Z_ACTIVE_HI[this.active]! ^ Z_REQ_HI[this.required + 1]! ^ Z_LAST_HI[this.lastMover + 1]!;
  }

  // ---- move generation ------------------------------------------------

  /** True if the tower has at least one legal move (cheap: first steps + push). */
  hasMove(t: number): boolean {
    const cell = this.pos[t]!;
    const row = cell >> 3;
    const col = cell & 7;
    const dr = dirOf(t >> 3);
    const nr = row + dr;
    if (nr >= 0 && nr <= 7) {
      const base = nr * 8;
      if (this.occ[base + col] === NO_TOWER) return true;
      if (col > 0 && this.occ[base + col - 1] === NO_TOWER) return true;
      if (col < 7 && this.occ[base + col + 1] === NO_TOWER) return true;
    }
    return this.pushChain(t) > 0;
  }

  /** Length of the chain the tower could push (>0 means a legal push), else 0. */
  pushChain(t: number): number {
    const rank = this.rank[t]!;
    if (rank === 0) return 0;
    const side = t >> 3;
    const cell = this.pos[t]!;
    const dr = dirOf(side);
    const col = cell & 7;
    let r = (cell >> 3) + dr;
    if (r < 0 || r > 7) return 0;
    const first = this.occ[r * 8 + col]!;
    if (first === NO_TOWER || first >> 3 === side) return 0;
    const capacity = CAPACITY[rank]!;
    let n = 0;
    while (true) {
      const o = this.occ[r * 8 + col]!;
      if (o === NO_TOWER) return n;
      if (o >> 3 === side) return 0;
      if (this.rank[o]! >= rank) return 0;
      n++;
      if (n > capacity) return 0;
      r += dr;
      if (r < 0 || r > 7) return 0;
    }
  }

  /** Appends the tower's legal moves to `out` (engine order: straight, left, right; then the push). */
  genTowerMoves(t: number, out: Int32Array, n: number): number {
    const cell = this.pos[t]!;
    const row = cell >> 3;
    const col = cell & 7;
    const dr = dirOf(t >> 3);
    const range = RANGE[this.rank[t]!]!;
    for (let v = 0; v < 3; v++) {
      const dc = v === 0 ? 0 : v === 1 ? -1 : 1;
      let r = row;
      let c = col;
      for (let k = 1; k <= range; k++) {
        r += dr;
        c += dc;
        if (r < 0 || r > 7 || c < 0 || c > 7) break;
        const to = r * 8 + c;
        if (this.occ[to] !== NO_TOWER) break;
        out[n++] = cell | (to << 6);
      }
    }
    if (this.pushChain(t) > 0) out[n++] = cell | (((row + dr) * 8 + col) << 6) | (1 << 12);
    return n;
  }

  /** All legal moves for the side to move (the forced tower, or any tower on a free-choice turn). */
  genMoves(out: Int32Array): number {
    if (this.required >= 0) return this.genTowerMoves(this.active * 8 + this.required, out, 0);
    let n = 0;
    for (let c = 0; c < 8; c++) n = this.genTowerMoves(this.active * 8 + c, out, n);
    return n;
  }

  /** Can the tower slide straight onto the goal row right now? (a winning move if its colour is forced) */
  canReachGoal(t: number): boolean {
    const side = t >> 3;
    const cell = this.pos[t]!;
    const row = cell >> 3;
    const col = cell & 7;
    const dr = dirOf(side);
    const steps = Math.abs(goalRow(side) - row);
    if (steps === 0 || steps > RANGE[this.rank[t]!]!) return false;
    for (let v = 0; v < 3; v++) {
      const dc = v === 0 ? 0 : v === 1 ? -1 : 1;
      let r = row;
      let c = col;
      let ok = true;
      for (let k = 1; k <= steps; k++) {
        r += dr;
        c += dc;
        if (c < 0 || c > 7 || this.occ[r * 8 + c] !== NO_TOWER) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  // ---- make / unmake --------------------------------------------------

  /**
   * Plays `m` and resolves the turn flow that follows it (colour lock, Sumo
   * extra turn, stymie passes). Returns the winning side if the round ended
   * (goal reached, or a deadlock), else -1. Always undo with `unmake()`.
   */
  make(m: number): number {
    const sp = this.sp++;
    this.uActive[sp] = this.active;
    this.uRequired[sp] = this.required;
    this.uLast[sp] = this.lastMover;
    this.uMove[sp] = m;
    this.uHashLo[sp] = this.towerHashLo;
    this.uHashHi[sp] = this.towerHashHi;

    const from = m & 63;
    const to = (m >> 6) & 63;
    const isPush = (m >> 12) & 1;
    const t = this.occ[from]!;
    const side = t >> 3;
    const dr = dirOf(side);
    let landingCell = to;

    if (isPush) {
      const col = from & 7;
      const startRow = to >> 3;
      // walk the chain to its far end
      let n = 0;
      let r = startRow;
      while (this.occ[r * 8 + col] !== NO_TOWER) {
        n++;
        r += dr;
      }
      this.uChain[sp] = n;
      // shift far -> near so every destination is already vacated
      for (let i = n; i >= 1; i--) {
        const fromCell = (startRow + (i - 1) * dr) * 8 + col;
        const toCell = (startRow + i * dr) * 8 + col;
        this.moveTower(this.occ[fromCell]!, fromCell, toCell);
      }
      landingCell = (startRow + n * dr) * 8 + col; // the cell the far piece now occupies
    } else {
      this.uChain[sp] = 0;
    }
    this.moveTower(t, from, to);
    this.lastMover = side;

    if (to >> 3 === goalRow(side)) return side;

    if (isPush) {
      // Rule S3: the pusher moves again, with the colour of the square the far pushed piece now stands on
      this.active = side;
      this.required = this.colorOf[landingCell]!;
    } else {
      this.active = 1 - side;
      this.required = this.colorOf[to]!;
    }

    // stymie passes / deadlock
    let seen = 0;
    while (true) {
      const tt = this.active * 8 + this.required;
      if (this.hasMove(tt)) return -1;
      const bit = 1 << tt;
      if (seen & bit) {
        const loser = this.lastMover >= 0 ? this.lastMover : this.active;
        return 1 - loser;
      }
      seen |= bit;
      this.required = this.colorOf[this.pos[tt]!]!;
      this.active = 1 - this.active;
    }
  }

  unmake(): void {
    const sp = --this.sp;
    const m = this.uMove[sp]!;
    const from = m & 63;
    const to = (m >> 6) & 63;
    const isPush = (m >> 12) & 1;
    const t = this.occ[to]!;
    const side = t >> 3;
    const dr = dirOf(side);
    this.moveTower(t, to, from, false);
    if (isPush) {
      const n = this.uChain[sp]!;
      const col = from & 7;
      const startRow = to >> 3;
      // near -> far: each destination was just vacated
      for (let i = 1; i <= n; i++) {
        const fromCell = (startRow + i * dr) * 8 + col;
        const toCell = (startRow + (i - 1) * dr) * 8 + col;
        this.moveTower(this.occ[fromCell]!, fromCell, toCell, false);
      }
    }
    this.active = this.uActive[sp]!;
    this.required = this.uRequired[sp]!;
    this.lastMover = this.uLast[sp]!;
    this.towerHashLo = this.uHashLo[sp]!;
    this.towerHashHi = this.uHashHi[sp]!;
  }

  private moveTower(t: number, from: number, to: number, hash = true): void {
    this.occ[from] = NO_TOWER;
    this.occ[to] = t;
    this.pos[t] = to;
    if (hash) {
      this.towerHashLo ^= Z_TOWER_LO[t * 64 + from]! ^ Z_TOWER_LO[t * 64 + to]!;
      this.towerHashHi ^= Z_TOWER_HI[t * 64 + from]! ^ Z_TOWER_HI[t * 64 + to]!;
    }
  }

  // ---- conversions ----------------------------------------------------

  /** Finds the reference engine's own `Move` object matching an encoded move. */
  toEngineMove(m: number, legal: Move[]): Move | undefined {
    const from = m & 63;
    const to = (m >> 6) & 63;
    const isPush = (m >> 12) & 1;
    return legal.find(
      (mv) =>
        mv.from.row * 8 + mv.from.col === from &&
        mv.to.row * 8 + mv.to.col === to &&
        (mv.type === MoveType.SUMO_PUSH) === (isPush === 1),
    );
  }

  /** Number of physical moves currently on the undo stack. */
  get depth(): number {
    return this.sp;
  }
}

export { SumoRank };
