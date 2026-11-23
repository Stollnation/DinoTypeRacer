import assert from "node:assert/strict";
import test from "node:test";
import { CHALLENGE_PASSAGE, CHALLENGE_SECONDS, formatChallengeAccuracy, TimedChallenge } from "../src/timed-challenge.js";
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
  assert.equal(run.textAccuracy, 1);
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
  assert.equal(run.textAccuracy, 0);
  run.backspace();
  assert.equal(run.textAccuracy, 0);
  assert.equal(run.type(run.text[0], 4_500), true);
  assert.equal(run.index, 1);
  assert.equal(run.accuracy, 0.5);
  assert.equal(run.textAccuracy, 1);
  assert.equal(run.type("!", 4_600), false);
  run.backspace();
  assert.equal(run.textAccuracy, 0.5);
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
  assert.equal(run.textAccuracy, 101 / 102);
  assert.equal(run.remaining(23_000), 40);
  run.startTime += 5_000; // Pausing shifts the existing race start exactly once.
  assert.equal(run.remaining(28_000), 40);
  assert.equal(new TimedChallenge().scoreWpm, 0);
});

test("the clock and wrong keys earn no strides; an idle racer still finishes without scoring", () => {
  const run = new TimedChallenge();
  run.startTime = 3_000;
  assert.equal(run.trackProgress(2_000), 0);
  const midpoint = run.trackProgress(33_000);
  assert.equal(midpoint, 0);
  run.type("!", 33_100);
  run.startTime += 5_000;
  assert.equal(run.trackProgress(38_100), midpoint);
  assert.equal(run.trackProgress(62_000), 0);
  assert.equal(run.trackProgress(65_500), 0.5);
  assert.equal(run.trackProgress(68_000), 1);
  assert.equal(run.trackProgress(69_000), 1);
  assert.equal(run.scoreWpm, 0);
  assert.equal(run.textAccuracy, 0);
});

test("one correct key earns one smooth stride; a long gap or a late restart never teleports", () => {
  const run = new TimedChallenge();
  run.startTime = 0;
  run.type("A", 1000);
  const moving = run.trackProgress(1050);
  const stopped = run.trackProgress(1400);
  assert.ok(moving > 0 && moving < stopped);
  assert.equal(run.trackProgress(50_000), stopped);
  run.type("t", 50_500);
  assert.ok(run.trackProgress(51_000) > stopped);
  assert.ok(run.trackProgress(51_000) <= stopped + 0.025);
});

test("every completed word immediately updates the projection using up to the latest four words", () => {
  const run = new TimedChallenge();
  run.startTime = 0;
  let now = 0;
  assert.equal(run.track.estimatedWpm, 40);
  const marks = [{ time: 0, count: 0 }];
  for (const [i, word] of "At half past seven, a woman in".split(" ").entries()) {
    const step = [100, 200, 400, 500, 60, 85, 60][i];
    const previousPace = run.track.estimatedWpm;
    for (const c of word) run.type(c, now += step);
    assert.equal(run.track.estimatedWpm, previousPace); // not a boundary yet
    run.type(" ", now += step);
    const base = marks[Math.max(0, marks.length - 4)];
    const expected = (run.correctKeystrokes - base.count) * 12000 / (now - base.time);
    assert.ok(Math.abs(run.track.estimatedWpm - expected) < 1e-9);
    const predictedKeys = (60000 - now) * expected / 12000;
    assert.ok(Math.abs(run.track.stride - (1 - run.track.target) / predictedKeys) < 1e-9);
    marks.push({ time: now, count: run.correctKeystrokes });
  }
});

test("a slow starter sprinting suddenly still has visible track left and finishes only at the buzzer", () => {
  const run = new TimedChallenge();
  run.startTime = 0;
  let previous = 0;
  for (let now = 10; now < 60000; now += 10) {
    if (now < 20000 ? now % 1000 === 0 : now % 40 === 0) run.type(run.text[run.index], now);
    const progress = run.trackProgress(now);
    assert.ok(progress >= previous && progress < 1);
    if (now === 30000) assert.ok(progress > 0.30 && progress <= 0.60);
    if (now === 50000) assert.ok(progress > 0.65 && progress < 0.88);
    if (now === 55000) assert.ok(progress < 0.94);
    previous = progress;
  }
  assert.equal(run.trackProgress(60000), 1);
});

test("55 seconds replans mid-word from recent correct typing without waiting for another key", () => {
  const run = new TimedChallenge();
  run.startTime = 0;
  run.type("A", 44_000); // outside the lookback
  for (const [i, c] of [..."t half pas"].entries()) run.type(c, 45_000 + i * 1000);
  run.type("!", 54_200); // Strict error is not a stride
  const position = run.trackProgress(54_999);
  const score = run.scoreWpm;
  assert.notEqual(run.track.estimatedWpm, 12);
  assert.equal(run.trackProgress(55_000), position);
  assert.equal(run.track.estimatedWpm, 12); // ten correct characters in ten seconds
  assert.ok(Math.abs(run.track.stride - (1 - position) / 5) < 1e-9);
  run.backspace();
  run.type("t", 55_500);
  assert.ok(run.trackProgress(55_800) > position);
  assert.equal(run.track.estimatedWpm, 12); // only one final replan
  assert.equal(run.trackProgress(60_000), 1);
  assert.ok(Math.abs(run.scoreWpm - score - 0.2) < 1e-9);
});

test("recent typing pace changes track speed without stepping backward or finishing early", () => {
  const steady = new TimedChallenge();
  const slowing = new TimedChallenge();
  steady.startTime = slowing.startTime = 0;
  let steadyProgress = 0;
  let slowingProgress = 0;
  let rested;
  for (let now = 100; now < 60_000; now += 100) {
    if (now % 200 === 0) {
      steady.type(steady.text[steady.index], now);
      if (now <= 25_000) slowing.type(slowing.text[slowing.index], now);
    }
    const nextSteady = steady.trackProgress(now);
    const nextSlowing = slowing.trackProgress(now);
    assert.ok(nextSteady >= steadyProgress && nextSteady < 1);
    assert.ok(nextSlowing >= slowingProgress && nextSlowing < 1);
    steadyProgress = nextSteady;
    slowingProgress = nextSlowing;
    if (now === 45_000) assert.ok(steadyProgress > slowingProgress + 0.025);
    if (now === 26_000) rested = slowingProgress;
    if (now > 26_000 && now <= 54_000) assert.equal(slowingProgress, rested);
  }
  assert.equal(steady.trackProgress(60_000), 1);
  assert.equal(slowing.trackProgress(60_000), 1);
});

test("Challenge accuracy distinguishes near-perfect, perfect, and empty runs", () => {
  assert.equal(formatChallengeAccuracy(null), "—");
  assert.equal(formatChallengeAccuracy(0), "0%");
  assert.equal(formatChallengeAccuracy(1), "100%");
  assert.equal(formatChallengeAccuracy(0.9996), "99.9%");
  assert.equal(formatChallengeAccuracy(0.952), "95.2%");
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
