const ENDPOINT = "/.netlify/functions/leaderboard";

export function onlineLeaderboardAvailable(location = globalThis.location) {
  return Boolean(location?.protocol?.startsWith("http"));
}

export function publicLeaderboardRecord(record) {
  return {
    id: record.id,
    playerName: record.playerName || "Racer",
    date: record.date,
    level: record.level || 1,
    roundNumber: record.roundNumber || 1,
    passageTitle: record.passageTitle || "Race",
    wpm: record.wpm,
    accuracy: record.accuracy,
    time: record.time,
    place: record.place,
    perfect: Boolean(record.perfect),
  };
}

export async function fetchOnlineLeaderboard(fetcher = fetch) {
  if (!onlineLeaderboardAvailable()) return [];
  const response = await fetcher(ENDPOINT, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function submitOnlineLeaderboard(record, fetcher = fetch) {
  if (!onlineLeaderboardAvailable()) return [];
  const response = await fetcher(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ record: publicLeaderboardRecord(record) }),
  });
  if (!response.ok) throw new Error(`Leaderboard submit failed: ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.records) ? payload.records : [];
}