import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { helpSearchWords } from "../src/help.js";

test("help search ignores case, accents, punctuation, and extra spaces", () => {
  assert.deepEqual(helpSearchWords("  RÉPLAY — fireWORKS! "), ["replay", "fireworks"]);
  assert.deepEqual(helpSearchWords("  …?? "), []);
  assert.deepEqual(helpSearchWords(".dinobackup 1024×1024"), ["dinobackup", "1024", "1024"]);
});

test("every help topic has an in-page target and FAQ entries use native disclosures", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="helpButton"[^>]*aria-label="Game help"/);
  const topics = [...html.matchAll(/data-help-topic="([^"]+)"/g)].map(([, id]) => id);
  const sections = [...html.matchAll(/class="help-section[^"]*" aria-labelledby="([^"]+)"/g)].map(([, id]) => id);
  assert.equal(topics.length, new Set(topics).size);
  assert.deepEqual(topics, sections);
  for (const id of topics) assert(html.includes(`id="${id}" tabindex="-1"`));
  assert.match(html, /<details data-help-entry><summary>Why didn't I see fireworks/);
});
