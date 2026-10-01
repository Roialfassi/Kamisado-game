import { MATCH_FORMAT_POINTS, MatchFormat } from '@kamisado/engine';

export const FORMAT_LABELS: Record<MatchFormat, string> = {
  [MatchFormat.SINGLE_ROUND]: 'Single round',
  [MatchFormat.STANDARD]: 'Standard',
  [MatchFormat.LONG]: 'Long',
  [MatchFormat.MARATHON]: 'Marathon',
};

export function formatSummary(format: MatchFormat): string {
  const points = MATCH_FORMAT_POINTS[format];
  return `First to ${points} point${points === 1 ? '' : 's'}`;
}
