import { getStore } from "@netlify/blobs";

const STORE_NAME = "dino-type-racer";
const LEADERBOARD_KEY = "leaderboard-v1";
const MAX_ROWS = 500;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
  body: JSON.stringify(body),
});

const allowedRecord = (record) => {
  const wpm = Number(record?.wpm);
  const accuracy = Number(record?.accuracy);
  if (!Number.isFinite(wpm) || !Number.isFinite(accuracy)) return null;
  return {
    id: String(record.id || `online-${Date.now()}`).slice(0, 80),
    playerName: String(record.playerName || "Racer").slice(0, 40),
    date: String(record.date || new Date().toISOString()).slice(0, 40),
    level: Number.isFinite(Number(record.level)) ? Number(record.level) : 1,
    roundNumber: Number.isFinite(Number(record.roundNumber)) ? Number(record.roundNumber) : 1,
    passageTitle: String(record.passageTitle || "Race").slice(0, 100),
    wpm: Math.max(0, Math.min(400, wpm)),
    accuracy: Math.max(0, Math.min(1, accuracy)),
    time: Math.max(0, Math.min(3600, Number(record.time) || 0)),
    place: Math.max(1, Math.min(99, Number(record.place) || 1)),
    perfect: Boolean(record.perfect),
  };
};

const sorted = (records) => records
  .filter(Boolean)
  .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || a.time - b.time || String(a.date).localeCompare(String(b.date)))
  .slice(0, MAX_ROWS);

export async function handler(event) {
  const store = getStore(STORE_NAME);
  const existing = sorted((await store.get(LEADERBOARD_KEY, { type: "json" })) || []);

  if (event.httpMethod === "GET") {
    return json(200, { records: existing.slice(0, 100) });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const record = allowedRecord(payload.record);
  if (!record) return json(400, { error: "Invalid leaderboard record" });

  const byId = new Map(existing.map((item) => [item.id, item]));
  byId.set(record.id, record);
  const records = sorted([...byId.values()]);
  await store.setJSON(LEADERBOARD_KEY, records);
  return json(200, { records: records.slice(0, 100) });
}