import { Color, PlayerSide, SumoRank } from '@kamisado/engine';
import { COLOR_HEX, COLOR_KANJI, isDarkSquare } from '../lib/theme.js';

export interface TowerPieceProps {
  side: PlayerSide;
  color: Color;
  sumoRank: SumoRank;
  selected?: boolean;
  symbolsEnabled?: boolean;
  /** px number, or any CSS length (e.g. '86%' to fill a board slot). */
  size?: number | string;
}

const SUMO_BADGE: Record<SumoRank, string> = {
  [SumoRank.NORMAL]: '',
  [SumoRank.SINGLE]: 'I',
  [SumoRank.DOUBLE]: 'II',
  [SumoRank.TRIPLE]: 'III',
};

export function TowerPiece({
  side,
  color,
  sumoRank,
  selected = false,
  symbolsEnabled = true,
  size = 48,
}: TowerPieceProps) {
  const hex = COLOR_HEX[color];
  const isBlack = side === PlayerSide.BLACK;
  const kanji = COLOR_KANJI[color];

  // Unique IDs for SVG gradients per side & color to avoid DOM collisions
  const uid = `${side}-${color}`;
  const bodyGradId = `tower-body-${uid}`;
  const goldTrimId = `tower-trim-${uid}`;
  const gemGradId = `tower-gem-${uid}`;
  const bevelLightId = `tower-bevel-${uid}`;
  const sumoRingId = `tower-sumo-${uid}`;

  return (
    <div
      className={`relative flex items-center justify-center transition-all duration-200 select-none ${
        selected ? 'scale-110 z-20' : 'z-10'
      }`}
      style={{ width: size, height: size }}
      data-testid="tower-piece"
      data-side={side}
      data-color={color}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        className={`w-full h-full transition-transform ${
          selected
            ? 'filter drop-shadow-[0_0_12px_rgba(255,215,0,0.9)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]'
            : 'filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.55)]'
        }`}
      >
        <defs>
          {/* Metallic Gold / Brass trim gradient */}
          <linearGradient id={goldTrimId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fae6a2" />
            <stop offset="35%" stopColor="#d4af37" />
            <stop offset="70%" stopColor="#9a741e" />
            <stop offset="100%" stopColor="#f3de8a" />
          </linearGradient>

          {/* Sumo Ring metallic gradient */}
          <linearGradient id={sumoRingId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff3b0" />
            <stop offset="30%" stopColor="#e5a93b" />
            <stop offset="70%" stopColor="#875306" />
            <stop offset="100%" stopColor="#ffd875" />
          </linearGradient>

          {/* Pagoda lacquer body gradient */}
          {isBlack ? (
            <linearGradient id={bodyGradId} x1="20%" y1="10%" x2="80%" y2="90%">
              <stop offset="0%" stopColor="#3d3d43" />
              <stop offset="35%" stopColor="#222226" />
              <stop offset="75%" stopColor="#131315" />
              <stop offset="100%" stopColor="#080809" />
            </linearGradient>
          ) : (
            <linearGradient id={bodyGradId} x1="20%" y1="10%" x2="80%" y2="90%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#f7f3ea" />
              <stop offset="80%" stopColor="#e3d8c8" />
              <stop offset="100%" stopColor="#cfbeaa" />
            </linearGradient>
          )}

          {/* Bevel highlight gradient (light from top-left) */}
          <linearGradient id={bevelLightId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isBlack ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.9)'} />
            <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor={isBlack ? 'rgba(0,0,0,0.6)' : 'rgba(120,100,75,0.45)'} />
          </linearGradient>

          {/* Central jewel radial gradient */}
          <radialGradient id={gemGradId} cx="38%" cy="34%" r="68%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="25%" stopColor={hex} />
            <stop offset="85%" stopColor={hex} />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* Sumo Rings Tier (Outer gold tiers under the pagoda) */}
        {sumoRank >= SumoRank.SINGLE && (
          <polygon
            points="33,6 67,6 94,33 94,67 67,94 33,94 6,67 6,33"
            fill="none"
            stroke={`url(#${sumoRingId})`}
            strokeWidth="3.5"
            strokeLinejoin="round"
            className="animate-pulse"
          />
        )}
        {sumoRank >= SumoRank.DOUBLE && (
          <polygon
            points="31,3 69,3 97,31 97,69 69,97 31,97 3,69 3,31"
            fill="none"
            stroke={`url(#${sumoRingId})`}
            strokeWidth="2.5"
            strokeDasharray="4 2"
            strokeLinejoin="round"
          />
        )}
        {sumoRank >= SumoRank.TRIPLE && (
          <polygon
            points="29,0.5 71,0.5 99.5,29 99.5,71 71,99.5 29,99.5 0.5,71 0.5,29"
            fill="none"
            stroke="#ffeb85"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        )}

        {/* Base Pagoda Octagon (Tier 1) */}
        <polygon
          points="35.5,13 64.5,13 87,35.5 87,64.5 64.5,87 35.5,87 13,64.5 13,35.5"
          fill={`url(#${bodyGradId})`}
          stroke={`url(#${goldTrimId})`}
          strokeWidth={isBlack ? 2.5 : 2}
          strokeLinejoin="round"
        />

        {/* Pagoda Bevel Facets (Light from top-left, shadow on bottom-right) */}
        <polygon
          points="35.5,13 64.5,13 87,35.5 87,64.5 64.5,87 35.5,87 13,64.5 13,35.5"
          fill={`url(#${bevelLightId})`}
          strokeLinejoin="round"
        />

        {/* Tier 2: Recessed Pagoda Roof Level */}
        <polygon
          points="38,20 62,20 80,38 80,62 62,80 38,80 20,62 20,38"
          fill={isBlack ? '#17171a' : '#ece2d2'}
          stroke={isBlack ? 'rgba(212,175,55,0.4)' : 'rgba(160,130,90,0.5)'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Radial Facet Ridge Lines connecting Tier 1 corners to Tier 2 */}
        <g stroke={isBlack ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'} strokeWidth="1">
          <line x1="35.5" y1="13" x2="38" y2="20" />
          <line x1="64.5" y1="13" x2="62" y2="20" />
          <line x1="87" y1="35.5" x2="80" y2="38" />
          <line x1="87" y1="64.5" x2="80" y2="62" />
          <line x1="64.5" y1="87" x2="62" y2="80" />
          <line x1="35.5" y1="87" x2="38" y2="80" />
          <line x1="13" y1="64.5" x2="20" y2="62" />
          <line x1="13" y1="35.5" x2="20" y2="38" />
        </g>

        {/* Tier 3: Central Jewel Bezel Rim (Polished Gold Ring) */}
        <circle
          cx="50"
          cy="50"
          r="23"
          fill={isBlack ? '#101012' : '#f9f6ef'}
          stroke={`url(#${goldTrimId})`}
          strokeWidth="2"
        />

        {/* Central Dragon Gemstone */}
        <circle
          cx="50"
          cy="50"
          r="20.5"
          fill={`url(#${gemGradId})`}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1"
        />

        {/* Inner Gem Specular Glint */}
        <ellipse
          cx="43"
          cy="38"
          rx="7"
          ry="3.5"
          transform="rotate(-28 43 38)"
          fill="#ffffff"
          opacity={isDarkSquare(color) ? 0.35 : 0.55}
        />

        {/* Authentic Japanese Kanji Character Calligraphy */}
        {symbolsEnabled && (
          <text
            x="50"
            y="57"
            textAnchor="middle"
            fontSize="21"
            fontFamily="'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif"
            fontWeight="900"
            fill={isDarkSquare(color) ? '#fff8e7' : '#1c0f08'}
            style={{
              textShadow: isDarkSquare(color)
                ? '0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)'
                : '0 1px 1px rgba(255,255,255,0.7)',
            }}
          >
            {kanji}
          </text>
        )}
      </svg>

      {/* Sumo Rank Badge */}
      {sumoRank > SumoRank.NORMAL && (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-amber-300 shadow-md font-serif text-[10px] font-bold leading-none px-1 py-0.5"
          style={{
            background: 'linear-gradient(135deg, #d4af37, #855700)',
            color: '#fffef0',
          }}
          title={`Sumo Rank ${SUMO_BADGE[sumoRank]}`}
        >
          {SUMO_BADGE[sumoRank]}
        </span>
      )}
    </div>
  );
}
