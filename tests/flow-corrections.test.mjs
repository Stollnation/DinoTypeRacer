import test from "node:test";
import assert from "node:assert/strict";
import { TypingSession } from "../src/typing.js";
import { TimedChallenge } from "../src/timed-challenge.js";
import { challengeScore, challengeScoreKey, challengeRankings, postChallengeScore } from "../src/challenge-scores.js";

test("Flow can erase red and correct letters across a word boundary without erasing mistake history", () => {
  const run = new TypingSession("a b!", { ignoreMistakes: true });
  run.backspace(0);
  run.type("x", 0);
  run.type(" ", 100);
  run.type("b", 200);
  for (let i = 0; i < 4; i++) run.backspace(300);
  assert.equal(run.index, 0);
  assert.equal(run.missedIndices.size, 0);
  assert.equal(run.correctCharacters, 0);
  assert.equal(run.mistakes.length, 1);
  run.type("a", 1000);
  assert.equal(run.wpm(12_000), 1);
  assert.equal(run.accuracy, 3 / 4);
});

test("edited Challenge text determines WPM; the board keeps the actual keystroke accuracy", () => {
  const run = new TimedChallenge("flow");
  run.startTime = 0;
  run.type("!", 1);
  run.backspace(2);
  assert.equal(run.textAccuracy, null);
  run.type(run.text[0], 3);
  run.backspace(4);
  run.type(run.text[0], 5);
  run.backspace(60_000); // buzzer freezes the result
  assert.equal(run.scoreWpm, 0.2);
  assert.equal(run.textAccuracy, 1);
  assert.equal(run.accuracy, 2 / 3);
  const score = { nickname: "Pixel", correct: run.correctCharacters, correctHits: run.correctKeystrokes, attempts: run.totalKeystrokes };
  assert.deepEqual(challengeRankings([{ key: challengeScoreKey(score) }]), [{ nickname: "Pixel", wpm: 0.2, accuracy: 0.6667 }]);
  for (const invalid of [0, 4, 1.5]) assert.equal(challengeScore({ ...score, correctHits: invalid }), null);
});

test("posting never reports success for a static preview or an unconfirmed server response", async () => {
  const score = { nickname: "Pixel", correct: 4, correctHits: 5, attempts: 6 };
  for (const body of ["<html></html>", "{}", '{"saved":false}']) {
    await assert.rejects(postChallengeScore(score, async () => new Response(body)), /confirm/);
  }
});
