import assert from "node:assert/strict";
import test from "node:test";
import { createChallengeRivals, updateChallengeRivals, validRivalWpm } from "../src/ai.js";

const roster = ["nova", "moss", "pixel", "bolt", "ember"].map(id => ({ id, displayName: id }));
test("each timed racer gets four different opponents, without a clone of the player", () => {
  for (const c of roster) {
    const rivals = createChallengeRivals([...roster, { id: "custom", custom: true }], c.id, 50);
    assert.equal(new Set(rivals.map(r => r.characterId)).size, 4);
    assert.ok(rivals.every(r => r.characterId !== c.id && r.characterId !== "custom" && r.targetWpm === 50));
  }
});
test("50 WPM rivals cover 25 standard words in half a minute, regardless of frame rate", () => {
  const continuous = createChallengeRivals(roster, "nova", 50);
  const skipped = createChallengeRivals(roster, "nova", 50);
  for(let t = 0; t <= 30; t += .125) updateChallengeRivals(continuous, t, 1 / 250);
  updateChallengeRivals(skipped, 30, 1 / 250);
  for (const r of [...continuous, ...skipped]) {
    assert.ok(Math.abs(r.virtualChars - 125) < 1e-8);
    assert.ok(Math.abs(r.progress - .5) < 1e-8);
  }
  updateChallengeRivals(skipped, 30, 1 / 500);
  assert.ok(Math.abs(skipped[0].progress - .5) < 1e-8);
  updateChallengeRivals(skipped, 60, 1 / 500);
  assert.ok(Math.abs(skipped[0].progress - .75) < 1e-8);
});
test("pace must be whole WPM from five through three hundred", () => {
  for (const value of ["", " ", 0, -1, 4, 301, 2.5, NaN, Infinity]) assert.equal(validRivalWpm(value), false);
  for (const value of [5, "40", 125, 300]) assert.ok(validRivalWpm(value));
});
