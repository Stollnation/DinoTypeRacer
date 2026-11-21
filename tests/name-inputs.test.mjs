import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

// Check markup rather than simulating Chrome's private autofill heuristics.
// These hints classify game aliases; browser/extension suppression is not guaranteed.
for (const [id, section, name] of [
  ["dashboardPlayerName", "ready", "gameAliasReady"],
  ["playerPickerInput", "picker", "gameAliasPicker"],
  ["customRacerName", "workshop", "gameAliasWorkshop"],
]) {
  test(`${id} identifies a game nickname, not a payment or credential field`, () => {
    const tag = html.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `Missing input ${id}`);
    assert.match(tag, new RegExp(`\\bname="${name}"`));
    assert.match(tag, new RegExp(`\\bautocomplete="section-game-${section} nickname"`));
    assert.match(tag, /\bdata-lpignore="true"/);
    assert.match(tag, /\bdata-1p-ignore="true"/);
    assert.match(tag, /\bdata-form-type="other"/);
    assert.doesNotMatch(tag, /\b(?:readonly|disabled)(?:\s|=|\/?>)/);
  });
}

test("profile forms disable unrelated automatic form completion", () => {
  for (const id of ["dashboardProfileForm"]) {
    const tag = html.match(new RegExp(`<form\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `Missing form ${id}`);
    assert.match(tag, /\bautocomplete="off"/);
  }
});
