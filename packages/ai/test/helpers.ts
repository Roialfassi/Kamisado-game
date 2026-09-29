import {
  ALL_COLORS,
  Color,
  GameState,
  GameStatus,
  MatchFormat,
  Move,
  PlayerSide,
  SumoRank,
  applyMove,
  createGame,
  getLegalMoves,
  handlePassOrDeadlock,
  towerId,
} from '@kamisado/engine';

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reference-engine legal moves for whoever is to move. */
export function refMoves(state: GameState): Move[] {
  const colors = state.requiredColor ? [state.requiredColor] : ALL_COLORS;
  return colors.flatMap((c) => getLegalMoves(state, c));
}

/** Reference-engine `step`: apply a move, then resolve stymies/deadlock. */
export function refStep(state: GameState, move: Move): GameState {
  const applied = applyMove(state, move);
  if (!applied.success || !applied.state) throw new Error('reference rejected ' + JSON.stringify(move) + ': ' + applied.error);
  if (applied.state.status !== GameStatus.IN_PROGRESS) return applied.state;
  const resolved = handlePassOrDeadlock(applied.state);
  return resolved.state ?? applied.state;
}

/** A random mid-round position: random tower placement, random Sumo ranks, random forced colour. */
export function randomPosition(rng: () => number, opts: { sumo?: boolean } = {}): GameState {
  let state = createGame(MatchFormat.STANDARD);
  const used = new Set<string>();
  const towers = { ...state.towers };
  for (const id of Object.keys(towers)) {
    const t = towers[id]!;
    if (rng() < 0.55) {
      for (let tries = 0; tries < 30; tries++) {
        const row = 1 + Math.floor(rng() * 6);
        const col = Math.floor(rng() * 8);
        const key = `${row},${col}`;
        if (used.has(key)) continue;
        used.add(key);
        towers[id] = { ...t, position: { row, col } };
        break;
      }
    }
    if (opts.sumo && rng() < 0.25) towers[id] = { ...towers[id]!, sumoRank: Math.floor(rng() * 4) as SumoRank };
  }
  // avoid two towers sharing a home square with a relocated tower: relocated ones only used interior cells
  state = { ...state, towers };
  const active = rng() < 0.5 ? PlayerSide.BLACK : PlayerSide.GOLD;
  const free = rng() < 0.1;
  const required: Color | null = free ? null : ALL_COLORS[Math.floor(rng() * 8)]!;
  state = { ...state, activePlayer: active, requiredColor: required, lastPhysicalMover: rng() < 0.7 ? (active === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK) : null };
  return state;
}

export { towerId };

/** A position built around a Sumo push: a ranked tower with a chain of opponents in front of it. */
export function pushPosition(rng: () => number): GameState {
  const state = createGame(MatchFormat.STANDARD);
  const towers = { ...state.towers };
  const side = rng() < 0.5 ? PlayerSide.BLACK : PlayerSide.GOLD;
  const other = side === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK;
  const dr = side === PlayerSide.BLACK ? 1 : -1;
  const rank = 1 + Math.floor(rng() * 3);
  const col = Math.floor(rng() * 8);
  const chainLen = 1 + Math.floor(rng() * 3);
  const startRow = dr === 1 ? 1 + Math.floor(rng() * (5 - chainLen)) : 6 - Math.floor(rng() * (5 - chainLen));
  const pusherColor = ALL_COLORS[Math.floor(rng() * 8)]!;
  const pusherId = towerId(side, pusherColor);
  towers[pusherId] = { ...towers[pusherId]!, sumoRank: rank as SumoRank, position: { row: startRow, col } };
  const victims = ALL_COLORS.slice().sort(() => rng() - 0.5).slice(0, chainLen);
  victims.forEach((color, i) => {
    const id = towerId(other, color);
    const vRank = rng() < 0.8 ? Math.floor(rng() * rank) : Math.floor(rng() * 4);
    towers[id] = { ...towers[id]!, sumoRank: vRank as SumoRank, position: { row: startRow + dr * (i + 1), col } };
  });
  // sometimes a friendly tower directly behind the chain
  if (rng() < 0.2) {
    const friendlyColor = ALL_COLORS.find((c) => c !== pusherColor)!;
    const id = towerId(side, friendlyColor);
    const row = startRow + dr * (chainLen + 1);
    if (row >= 0 && row <= 7) towers[id] = { ...towers[id]!, position: { row, col } };
  }
  return { ...state, towers, activePlayer: side, requiredColor: pusherColor, lastPhysicalMover: other };
}

/** Towers packed into a few central rows: lots of stymies, pass chains and deadlocks. */
export function densePosition(rng: () => number): GameState {
  const state = createGame(MatchFormat.STANDARD);
  const towers = { ...state.towers };
  const cells: string[] = [];
  for (let r = 2; r <= 5; r++) for (let c = 0; c < 8; c++) cells.push(`${r},${c}`);
  cells.sort(() => rng() - 0.5);
  const ids = Object.keys(towers).sort(() => rng() - 0.5).slice(0, 8 + Math.floor(rng() * 6));
  ids.forEach((id, i) => {
    const [row, col] = cells[i]!.split(',').map(Number) as [number, number];
    towers[id] = { ...towers[id]!, position: { row, col } };
  });
  const active = rng() < 0.5 ? PlayerSide.BLACK : PlayerSide.GOLD;
  return {
    ...state,
    towers,
    activePlayer: active,
    requiredColor: ALL_COLORS[Math.floor(rng() * 8)]!,
    lastPhysicalMover: rng() < 0.85 ? (active === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK) : null,
  };
}
