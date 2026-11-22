import { createHash } from "node:crypto";
import { CHALLENGE_PLAY_PREFIX, CHALLENGE_SCORE_PREFIX, challengeNickname, challengeRankings, challengeScoreKey, isChallengeToken } from "./challenge-scores.js";

const ownerKey = nickname => `nicknames/${encodeURIComponent(nickname.toLowerCase())}`;
const ownerHash = token => createHash("sha256").update(token).digest("hex");

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

export async function handleChallengeScores(event, openStore) {
  if (!["GET", "POST"].includes(event.httpMethod)) return json(405, { error: "Method not allowed" });
  if (event.httpMethod === "GET") {
    try {
      const { blobs } = await openStore().list({ prefix: CHALLENGE_SCORE_PREFIX });
      const plays = blobs.filter(({ key }) => key.startsWith(CHALLENGE_PLAY_PREFIX)).length;
      return json(200, { records: challengeRankings(blobs), plays });
    } catch {
      return json(503, { error: "Online scores are temporarily unavailable" });
    }
  }
  const body = event.body;
  if (typeof body !== "string" || body.length > 1024 || event.isBase64Encoded) return json(400, { error: "Invalid score" });
  let payload;
  try { payload = JSON.parse(body); } catch { return json(400, { error: "Invalid score" }); }
  const attempt = payload?.attemptId;
  try {
    if (isChallengeToken(attempt)) {
      await openStore().setJSON(CHALLENGE_PLAY_PREFIX + attempt, { completed: true });
      return json(200, { saved: true });
    }
    const checking = typeof payload?.checkNickname === "string";
    const nickname = challengeNickname(checking ? payload.checkNickname : payload?.nickname);
    const scoreKey = checking ? null : challengeScoreKey(payload);
    if (!nickname || !isChallengeToken(payload?.ownerId) || (!checking && !scoreKey)) return json(400, { error: "Invalid score or nickname" });
    const store = openStore();
    const key = ownerKey(nickname);
    const owner = ownerHash(payload.ownerId);
    let existing = await store.get(key);
    if (checking) return json(200, { available: !existing || existing === owner });
    if (!existing) {
      const { modified } = await store.set(key, owner, { onlyIfNew: true });
      existing = modified ? owner : await store.get(key);
    }
    if (existing !== owner) return json(409, { error: "Name already taken" });
    await store.setJSON(scoreKey, { accepted: true });
    return json(200, { saved: true });
  } catch {
    return json(503, { error: "Online scores are temporarily unavailable" });
  }
}
