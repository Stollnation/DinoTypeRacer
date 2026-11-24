import assert from "node:assert/strict";
import test from "node:test";
import { CHALLENGE_PASSAGE, CHALLENGE_STORIES, takeChallengeStory, TimedChallenge } from "../src/timed-challenge.js";
import { challengeScore, challengeScoreKey, challengeRankings, postChallengeScore } from "../src/challenge-scores.js";

test("all twenty mysteries are distinct, playable for a full minute at 300 WPM, and keyboard friendly", () => {
  assert.equal(CHALLENGE_STORIES.length, 20);
  for (const key of ["id", "title", "text"]) assert.equal(new Set(CHALLENGE_STORIES.map(s => s[key])).size, 20);
  for (const story of CHALLENGE_STORIES) {
    assert.ok(story.text.length > 1500 && story.text.split(" ").length >= 300, story.title);
    assert.match(story.text, /^[\x20-\x7E]+$/);
    const run = new TimedChallenge("flow", { passage: story });
    assert.equal(run.text, story.text);
    assert.ok(run.type(story.text[0], 0));
  }
});

test("original by default; shuffled casebook survives reloads and switching off doesn't consume a story", () => {
  let profile = {};
  assert.equal(takeChallengeStory(profile), CHALLENGE_PASSAGE);
  assert.deepEqual(profile, {});
  const seen = [];
  for (let i = 0; i < 40; i++) {
    profile.rotateChallengeStories = true;
    const story = takeChallengeStory(profile, () => 0);
    if (i === 0) assert.notEqual(story, CHALLENGE_PASSAGE);
    if (i) assert.notEqual(story.id, seen.at(-1));
    seen.push(story.id);
    profile = JSON.parse(JSON.stringify(profile));
    profile.rotateChallengeStories = false;
    const before = [...profile.challengeStoryCycle];
    assert.equal(takeChallengeStory(profile), CHALLENGE_PASSAGE);
    assert.deepEqual(profile.challengeStoryCycle, before);
  }
  assert.equal(new Set(seen.slice(0, 20)).size, 20);
  assert.equal(new Set(seen.slice(20)).size, 20);
});

test("each story's score is validated against its own length and old scores stay on the shared board", () => {
  const old = { correct: 210, attempts: 230, nickname: "Biscuit" };
  const story = CHALLENGE_STORIES[1];
  const rotated = { correct: story.text.length, attempts: story.text.length, nickname: "Watson", passageId: story.id };
  assert.ok(challengeScore(rotated));
  assert.equal(challengeScore({ ...rotated, correct: story.text.length + 1, attempts: story.text.length + 1 }), null);
  assert.equal(challengeScore({ ...rotated, passageId: "not-a-story" }), null);
  assert.equal(challengeScoreKey(old), challengeScoreKey({ ...old, passageId: CHALLENGE_PASSAGE.id }));
  assert.deepEqual(challengeRankings([old, rotated].map(s => ({ key: challengeScoreKey(s) }))).map(s => s.nickname), ["Watson", "Biscuit"]);
});

test("posting a rotated run sends its story ID but never the typed passage or local profile", async () => {
  const passage = CHALLENGE_STORIES[3];
  const ownerId = "a768bf75-ab69-4f39-8f4a-f443a7371721";
  await postChallengeScore({ nickname: "Moss", correct: 200, attempts: 206, ownerId, passageId: passage.id, profile: "local-only", text: passage.text }, async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { nickname: "Moss", correct: 200, attempts: 206, passageId: passage.id, ownerId });
    return Response.json({ saved: true });
  });
});
