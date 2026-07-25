export const FOCUS_KEY_THRESHOLD = 4;

export function normalizedFocusKey(value) {
  if (typeof value !== "string" || [...value].length !== 1 || /\s/u.test(value)) return null;
  return value.toLocaleLowerCase();
}

export function mistypedKeyCounts(records, playerName) {
  const counts = {};
  (records || [])
    .filter((record) => !playerName || (record.playerName || "") === playerName)
    .forEach((record) => (record.mistakes || []).forEach((mistake) => {
      const typed = typeof mistake.typed === "string" && [...mistake.typed].length === 1 ? mistake.typed.toLocaleLowerCase() : null;
      if (typed !== null) counts[typed] = (counts[typed] || 0) + 1;
    }));
  return counts;
}

function addCounts(target, records) {
  const source = mistypedKeyCounts(records);
  Object.entries(source).forEach(([key, count]) => { target[key] = (target[key] || 0) + count; });
}

export function focusKeysForRace(records, playerName, currentChampionshipId, threshold = FOCUS_KEY_THRESHOLD) {
  const playerRecords = (records || []).filter((record) => (record.playerName || "") === playerName);
  const groups = new Map();
  playerRecords.forEach((record) => {
    if (!record.championshipId) return;
    if (!groups.has(record.championshipId)) groups.set(record.championshipId, []);
    groups.get(record.championshipId).push(record);
  });
  const currentRecords = groups.get(currentChampionshipId) || [];
  const previousRecords = [...groups.entries()]
    .filter(([id]) => id !== currentChampionshipId)
    .map(([, group]) => group)
    .find((group) => new Set(group.map((record) => record.roundNumber).filter(Boolean)).size >= 5) || [];
  const rollingCounts = {};
  addCounts(rollingCounts, previousRecords);
  addCounts(rollingCounts, currentRecords);
  return Object.keys(rollingCounts)
    .filter((key) => normalizedFocusKey(key) && rollingCounts[key] >= threshold)
    .sort((a, b) => rollingCounts[b] - rollingCounts[a] || a.localeCompare(b));
}