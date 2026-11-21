import test from "node:test";
import assert from "node:assert/strict";
import { highestSelectableLevel } from "../src/championship.js";

test("Ricky Bobby can select every level in the current passage group without changing earned progression", () => {
  assert.equal(highestSelectableLevel("Ricky Bobby", 1, 10), 10);
  assert.equal(highestSelectableLevel(" rIcKy   BoBBy ", 1, 3), 3);
  for (const name of ["", "Ricky", "Ricky Bobby Jr", "Ricky-Bobby", "Moss"]) {
    assert.equal(highestSelectableLevel(name, 1, 10), 1);
  }
  assert.equal(highestSelectableLevel("Moss", 5, 10), 5);
  assert.equal(highestSelectableLevel("Moss", 5, 3), 3);
});
