import assert from "node:assert/strict";
import test from "node:test";
import { CHALLENGE_PASSAGE, CHALLENGE_SECONDS, TimedChallenge } from "../src/timed-challenge.js";
import { CHALLENGE_SCORE_PREFIX, challengeScore, checkChallengeNickname, fetchChallengeBoard, fetchChallengeScores, postChallengeScore, recordChallengePlay } from "../src/challenge-scores.js";
import { handleChallengeScores } from "../src/challenge-score-service.js";
import challengeLeaderboard from "../netlify/functions/challenge-leaderboard.mjs";

test("the Netlify entry point uses the native Request and Response API", async () => {
  const response = await challengeLeaderboard(new Request("https://example.test/.netlify/functions/challenge-leaderboard", {
    method: "POST", body: "{}",
  }));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Invalid score or nickname" });
});

test("the fixed story comfortably covers a full minute at 300 WPM", () => {
  assert.equal(CHALLENGE_SECONDS, 60);
  assert.ok(CHALLENGE_PASSAGE.text.split(" ").length > 300);
  assert.ok(CHALLENGE_PASSAGE.text.length >= 2000);
  assert.match(CHALLENGE_PASSAGE.text, /^[\x20-\x7E]+$/);
  const run = new TimedChallenge();
  run.startTime = 3_000;
  for (let i = 0; i < 1500; i += 1) assert.equal(run.type(run.text[i], 3_000 + i * 39.9), true);
  assert.equal(run.finished, false);
  assert.equal(run.scoreWpm, 300);
  assert.equal(run.type(run.text[1500], 63_000), false);
  assert.equal(run.remaining(63_001), 0);
});

test("Strict is the Challenge default and only counts the first miss until Backspace", () => {
  const run = new TimedChallenge();
  run.startTime = 3_000;
  assert.equal(run.type("!", 4_000), false);
  assert.equal(run.errorChar, "!");
  assert.equal(run.index, 0);
  assert.equal(run.type(run.text[0], 4_200), false);
  assert.equal(run.totalKeystrokes, 1);
  assert.equal(run.errors, 1);
  run.backspace();
  assert.equal(run.type(run.text[0], 4_500), true);
  assert.equal(run.index, 1);
  assert.equal(run.accuracy, 0.5);
});

test("Flow advances past a miss and the timed score includes the entire minute", () => {
  const run = new TimedChallenge("flow");
  run.startTime = 3_000;
  assert.equal(run.remaining(2_000), 60);
  for (let i = 0; i < 100; i += 1) run.type(run.text[i], 13_000);
  assert.equal(run.type("!", 14_000), false);
  assert.equal(run.missedIndices.has(100), true);
  assert.equal(run.type(run.text[101], 14_500), true);
  assert.equal(run.scoreWpm, 20.2);
  assert.ok(run.trackProgress > 0);
  assert.equal(run.remaining(23_000), 40);
  run.startTime += 5_000; // Pausing shifts the existing race start exactly once.
  assert.equal(run.remaining(28_000), 40);
  assert.equal(new TimedChallenge().scoreWpm, 0);
});

test("shared scores accept optional nicknames and derive scores from bounded counts", () => {
  assert.deepEqual(challengeScore({ nickname: " Nova  Dash ", correct: 1500, attempts: 1600, wpm: 900 }), {
    nickname: "Nova Dash", wpm: 300, accuracy: 0.9375,
  });
  for (const nickname of ["", "x", "<script>", "guest@mail.test", "line\nbreak"]) {
    assert.equal(challengeScore({ nickname, correct: 200, attempts: 200 }), null);
  }
  assert.equal(challengeScore({ nickname: "Raptor", correct: 201, attempts: 200 }), null);
  const length = CHALLENGE_PASSAGE.text.length;
  assert.ok(challengeScore({ nickname: "Raptor", correct: 1800, attempts: length + 1 }));
  assert.equal(challengeScore({ nickname: "Raptor", correct: length + 1, attempts: length + 1 }), null);
  assert.equal(challengeScore({ nickname: "Raptor", correct: 1, attempts: 9999 }), null);
});

test("independent clients see the same leaderboard and lower runs do not replace a nickname's best", async () => {
  const storage = new Map([["leaderboard-v1", { protected: true }]]);
  const openStore = () => ({
    list: async ({ prefix }) => ({ blobs: [...storage.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }),
    setJSON: async (key, row) => storage.set(key, row),
    get: async (key) => storage.get(key) ?? null,
    set: async (key, row, { onlyIfNew }) => {
      if (onlyIfNew && storage.has(key)) return { modified: false };
      storage.set(key, row);
      return { modified: true };
    },
  });
  const makeClient = () => async (url, options) => {
    assert.equal(url, "/.netlify/functions/challenge-leaderboard");
    const result = await handleChallengeScores({ httpMethod: options?.method || "GET", body: options?.body }, openStore);
    return new Response(result.body, { status: result.statusCode, headers: result.headers });
  };
  const player = makeClient(), viewer = makeClient();
  const ownerId = "a768bf75-ab69-4f39-8f4a-f443a7371721";
  const otherOwner = "4b6d760d-0d5a-4355-88c9-d73341b752aa";
  const attemptId = "1fbbd046-60fd-4fa1-8d94-6b3d47ac679c";
  assert.deepEqual(await fetchChallengeScores(viewer), []);
  assert.equal(await recordChallengePlay(attemptId, player), true);
  assert.equal(await recordChallengePlay(attemptId, player), true);
  assert.deepEqual(await fetchChallengeBoard(viewer), { records: [], plays: 1 });
  assert.equal(await checkChallengeNickname("Moss", ownerId, player), true);
  await Promise.all([
    postChallengeScore({ nickname: "T-Rexcels", correct: 420, attempts: 425, ownerId }, player),
    postChallengeScore({ nickname: "Moss", correct: 510, attempts: 565, ownerId: otherOwner }, viewer),
    postChallengeScore({ nickname: "moss", correct: 300, attempts: 309, ownerId: otherOwner }, player),
  ]);
  assert.equal(await checkChallengeNickname("MOSS", ownerId, player), false);
  assert.equal(await checkChallengeNickname("MOSS", otherOwner, viewer), true);
  await assert.rejects(postChallengeScore({ nickname: "Moss", correct: 900, attempts: 900, ownerId }, player), /already taken/);
  const rows = await fetchChallengeScores(viewer);
  assert.deepEqual(rows.map(row => [row.nickname, row.wpm]), [["Moss", 102], ["T-Rexcels", 84]]);
  assert.equal([...storage.keys()].filter(key => key.startsWith(CHALLENGE_SCORE_PREFIX)).length, 4);
  const sameName = { nickname: "Same Name", correct: 550, attempts: 560 };
  const competingClaims = await Promise.allSettled([postChallengeScore({ ...sameName, ownerId }, player), postChallengeScore({ ...sameName, ownerId: otherOwner }, viewer)]);
  assert.equal(competingClaims.filter(result => result.status === "fulfilled").length, 1);
  assert.deepEqual(storage.get("leaderboard-v1"), { protected: true });
  const unavailable = await handleChallengeScores({ httpMethod: "GET" }, () => { throw new Error("offline"); });
  assert.equal(unavailable.statusCode, 503);
  const malformed = await handleChallengeScores({ httpMethod: "POST", body: "{" }, openStore);
  assert.equal(malformed.statusCode, 400);
});
