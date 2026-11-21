import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_RACER_ANCHOR, CUSTOM_RACER_SIZE, customRacerId, customRacerManifest, removePinkPixels, validateRacerFile } from "../src/custom-racers.js";

test("custom racers use the documented 1024 square and center-foot anchor", () => {
  assert.equal(CUSTOM_RACER_SIZE, 1024);
  assert.deepEqual(CUSTOM_RACER_ANCHOR, { x: 512, y: 856 });
  const racer = customRacerManifest("teddy", "Rocket Rex", "blob:test");
  assert.equal(racer.id, customRacerId("teddy"));
  const secondRacer = customRacerManifest("teddy", "Trail Triceratops", "blob:second", "racer-two");
  assert.equal(secondRacer.id, customRacerId("teddy", "racer-two"));
  assert.notEqual(secondRacer.id, racer.id);
  assert.equal(racer.footAnchorY, 856);
  assert.equal(racer.animations.run.file, "blob:test");
  assert.equal(racer.animations.win.frames, 1);
});

test("pink-screen removal clears hot pink without erasing ordinary artwork", () => {
  const imageData = { data: new Uint8ClampedArray([255, 0, 255, 255, 25, 80, 120, 255]) };
  removePinkPixels(imageData, 70);
  assert.equal(imageData.data[3], 0);
  assert.equal(imageData.data[7], 255);
});

test("custom racer upload validation accepts web images and rejects oversized files", () => {
  assert.equal(validateRacerFile({ type: "image/png", size: 5000 }), "");
  assert.match(validateRacerFile({ type: "image/svg+xml", size: 5000 }), /PNG/);
  assert.match(validateRacerFile({ type: "image/jpeg", size: 13 * 1024 * 1024 }), /12 MB/);
});

test("Ready screen integrates all three Creator Studio tools", async () => {
  const html = await (await import("node:fs/promises")).readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Campaign Forge/);
  assert.match(html, /Custom Racer/);
  assert.match(html, /Typing DNA/);
  assert.match(html, /Use in Race Controls/);
  assert.match(html, /Feet: X 512, Y 856/);
  assert.match(html, /Faint default racer alignment guide/);
  assert.match(html, /Save &amp; add another Racer/);
  assert.match(html, /Saved custom Racers/);
  assert.match(html, /data-action="delete-custom-racer"|savedCustomRacerList/);
});
