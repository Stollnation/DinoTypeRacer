import { getStore } from "@netlify/blobs";
import { handleChallengeScores } from "../../src/challenge-score-service.js";

export default async function challengeLeaderboard(request) {
  const result = await handleChallengeScores({
    httpMethod: request.method,
    body: request.method === "POST" ? await request.text() : undefined,
  }, () => getStore({ name: "dino-type-racer-challenge", consistency: "strong" }));
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
}
