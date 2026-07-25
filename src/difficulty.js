export const AI_PACE_MIN = -20;
export const AI_PACE_MAX = 20;

export function clampAiPace(offsetPercent = 0) {
  return Math.max(AI_PACE_MIN, Math.min(AI_PACE_MAX, Number(offsetPercent) || 0));
}

export function adjustedAiBaseline(baseWpm, offsetPercent = 0) {
  return Math.max(5, (Number(baseWpm) || 35) * (1 + clampAiPace(offsetPercent) / 100));
}

export function projectedAiRange(baseWpm, offsetPercent, ratios) {
  const adjusted = adjustedAiBaseline(baseWpm, offsetPercent);
  return {
    low: Math.round(adjusted * Math.min(...ratios)),
    high: Math.round(adjusted * Math.max(...ratios)),
  };
}

export function aiPaceLabel(offsetPercent = 0) {
  const offset = clampAiPace(offsetPercent);
  if (offset <= -13) return "Comfortable";
  if (offset <= -5) return "Steady";
  if (offset <= 4) return "Matched";
  if (offset <= 12) return "Push";
  return "Fierce";
}