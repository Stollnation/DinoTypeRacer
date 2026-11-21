import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareFireworksAudio, waitForFireworksAudio, startFireworksAudio } from "../src/victory-audio.js";
// Keep the GIF cache private to this test; the suite runs in a single process.
import { playFireworks, clearFireworks } from "../src/victory-fireworks.js?victory-audio-test";

test("the fireworks and achievement clips start together, only with a winning animation", async t => {
  const events = [], files = [], images = [];
  const ctx = {
    state: "suspended", currentTime: 12, destination: {},
    async resume() { this.state = "running"; },
    async decodeAudioData(bytes) { assert.ok(bytes.byteLength > 0); return { duration: 6 }; },
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; },
    createBufferSource() {
      const node = { connect(g) { return g; }, disconnect() {},
        start(at) { events.push(["start", at]); }, stop(at) { events.push(["stop", at]); } };
      return node;
    },
  };
  const saved = {window: globalThis.window, document: globalThis.document};
  let reduced = false;
  globalThis.window = { AudioContext: function () {return ctx;}, matchMedia: () => ({ matches: reduced }) };
  globalThis.document = {createElement: () => ({setAttribute() {}, getContext: () => null,
    append(...children) { this.children = children; }, remove() { this.isConnected = false; }})};
  t.after(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  });
  t.mock.method(globalThis, "fetch", async url => {
    if (url.pathname.endsWith(".gif")) return new Response("gif");
    files.push(url.pathname.split("/").pop());
    return new Response(readFileSync(url));
  });
  prepareFireworksAudio();
  await waitForFireworksAudio();
  assert.deepEqual(files, ["dragon-studio-fireworks-12-419031.mp3", "pwlpl-achievement-unlocked-361842.mp3"]);
  assert.deepEqual(events, []);
  const host = { getClientRects: () => [{}], append(stage) { stage.isConnected = true; images.push(stage.children[1]); } };
  try {
    await playFireworks(host, 2);
    assert.equal(images.length, 0);
    reduced = true;
    await playFireworks(host, 1);
    assert.equal(images.at(-1).onload, null);
    assert.deepEqual(events, []);
    reduced = false;
    for (const manual of [false, true]) {
      await playFireworks(host, 1, {manual});
      assert.deepEqual(events, []);
      images.at(-1).onload();
      const starts = events.filter(([name]) => name === "start");
      const ends = events.filter(([name]) => name === "stop");
      assert.equal(starts.length, 2);
      assert.equal(starts[0][1], starts[1][1]);
      assert.equal(ends.length, 2);
      assert.equal(ends[0][1], ends[1][1]);
      assert.ok(Math.abs(ends[0][1] - starts[0][1] - 3.8) < 0.001);
      clearFireworks(host);
      assert.deepEqual(events.slice(-2), [["stop", undefined], ["stop", undefined]]);
      events.length = 0;
    }
    ctx.state = "suspended";
    startFireworksAudio(3.8);
    assert.deepEqual(events, []);
  } finally {clearFireworks(host);}
});
