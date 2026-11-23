import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { makeChallengeTrackPicker } from "../src/timed-challenge.js";

const { tracks } = JSON.parse(await readFile(new URL("../assets/manifest.json", import.meta.url)));

test("plays every Challenge track once per cycle, even across reloads and cycle boundaries", () => {
  const entries = new Map();
  const storage = () => ({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) });
  const attempts = Array.from({ length: tracks.length * 3 }, (_, i) =>
    makeChallengeTrackPicker({ storage, random: () => i % 2 ? 0.99 : 0 })(tracks));
  for (let i = 1; i < attempts.length; i++) assert.notEqual(attempts[i], attempts[i - 1]);
  for (let i = 0; i < attempts.length; i += tracks.length) {
    assert.deepEqual(new Set(attempts.slice(i, i + tracks.length)), new Set(tracks.map(t => t.id)));
  }
});

test("a browser that refuses storage still rotates tracks for this visit", () => {
  for (const storage of [
    () => { throw Error("private mode"); },
    () => ({ getItem: () => '["nonexistent"]', setItem: () => { throw Error("quota"); } }),
  ]) {
    const pick = makeChallengeTrackPicker({ storage, random: () => 0 });
    assert.equal(new Set(tracks.map(() => pick(tracks))).size, tracks.length);
  }
});

test("handles malformed history, removed tracks, and one or no available tracks", () => {
  let saved = "{not json";
  const pick = makeChallengeTrackPicker({ storage: () => ({ getItem: () => saved, setItem: (_, value) => { saved = value; } }), random: () => 0 });
  assert.equal(pick([]), null);
  assert.equal(pick(tracks), tracks[0].id);
  saved = JSON.stringify(["removed", tracks[1].id, tracks[1].id]);
  assert.notEqual(pick(tracks), tracks[1].id);
  assert.equal(pick([tracks[0]]), tracks[0].id);
});
