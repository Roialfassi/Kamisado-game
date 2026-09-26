import { Color, PlayerSide, SumoRank } from '@kamisado/engine';
import { COLOR_HEX, COLOR_SYMBOL, isDarkSquare } from '../lib/theme.js';

export interface TowerPieceProps {
  side: PlayerSide;
  color: Color;
  sumoRank: SumoRank;
  selected?: boolean;
  symbolsEnabled?: boolean;
  size?: number;
}

const RING_LABEL: Record<SumoRank, string> = {
  [SumoRank.NORMAL]: '',
  [SumoRank.SINGLE]: 'I',
  [SumoRank.DOUBLE]: 'II',
  [SumoRank.TRIPLE]: 'III',
};

export function TowerPiece({ side, color, sumoRank, selected, symbolsEnabled, size = 44 }: TowerPieceProps) {
  const hex = COLOR_HEX[color];
  const isBlack = side === PlayerSide.BLACK;
  const ringCount = sumoRank;

  return (
    <div
      className={`relative flex items-center justify-center transition-transform duration-150 ${selected ? 'scale-110' : ''}`}
      style={{ width: size, height: size }}
      data-testid="tower-piece"
      data-side={side}
      data-color={color}
    >
      {Array.from({ length: ringCount }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full border-2"
          style={{
            width: size + 8 + i * 8,
            height: size + 8 + i * 8,
            borderColor: isBlack ? '#f5e6c8' : '#1a1a1a',
            opacity: 0.85 - i * 0.15,
          }}
        />
      ))}
      <svg viewBox="0 0 100 100" width={size} height={size} className={`drop-shadow-lg ${selected ? 'drop-shadow-[0_0_10px_rgba(255,230,150,0.9)]' : ''}`}>
        <polygon
          points="50,4 79,17 96,44 96,71 79,88 50,97 21,88 4,71 4,44 21,17"
          fill={hex}
          stroke={isBlack ? '#0d0d0d' : '#fdf6e3'}
          strokeWidth={isBlack ? 5 : 4}
        />
        <polygon
          points="50,20 68,29 78,46 78,64 68,80 50,88 32,80 22,64 22,46 32,29"
          fill="none"
          stroke={isBlack ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
          strokeWidth={2}
        />
        {symbolsEnabled && (
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontSize="34"
            fill={isDarkSquare(color) ? '#f5e6c8' : '#1a1208'}
            fontWeight="bold"
          >
            {COLOR_SYMBOL[color]}
          </text>
        )}
      </svg>
      {ringCount > 0 && (
        <span
          className="absolute -bottom-1 -right-1 rounded-full bg-black/70 text-[9px] px-1 leading-tight font-bold"
          style={{ color: '#f5e6c8' }}
        >
          {RING_LABEL[sumoRank]}
        </span>
      )}
    </div>
  );
}
