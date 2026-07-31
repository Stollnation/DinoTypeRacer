import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TypingSession, ordinal } from "../src/typing.js";
import { createAiRacers, updateAi } from "../src/ai.js";
import { exportPassages, importPassages, normalizeText, validatePassage } from "../src/passages.js";
import { defaultState, loadState, saveState } from "../src/storage.js";
import { CHAMPIONSHIP_RACES, championshipStandings, rankRace } from "../src/championship.js";
import { CONFIG, THEMES, STARTER_PASSAGES } from "../src/config.js";
import { keyLabel, summarizeMistakes } from "../src/mistakes.js";
import { FINISH_QUIPS, WINNER_QUIPS, resultQuip } from "../src/quips.js";
import { adjustedAiBaseline, aiPaceLabel, clampAiPace, projectedAiRange } from "../src/difficulty.js";
import { focusKeysForRace, mistypedKeyCounts, normalizedFocusKey } from "../src/focus-keys.js";
import { publicLeaderboardRecord } from "../src/online-leaderboard.js";

test("online leaderboard records only expose public race fields", () => { const record = publicLeaderboardRecord({ id: "race-1", playerName: "Ada", date: "2026-07-29T00:00:00.000Z", level: 2, roundNumber: 4, passageTitle: "Practice", wpm: 61.2, accuracy: 0.98, time: 42, place: 1, perfect: true, mistakes: [{ expected: "a", typed: "s" }], finishOrder: [{ name: "Bot" }] }); assert.deepEqual(Object.keys(record), ["id", "playerName", "date", "level", "roundNumber", "passageTitle", "wpm", "accuracy", "time", "place", "perfect"]); assert.equal(record.playerName, "Ada"); assert.equal(record.perfect, true); });
test("typing uses training-style Backspace without rewinding correct progress", () => { const session = new TypingSession("abc"); session.type("a", 0); session.backspace(); assert.equal(session.index, 1); session.type("x", 1000); session.type("b", 2000); assert.equal(session.index, 1); assert.equal(session.errorChar, "b"); session.backspace(); assert.equal(session.errorChar, ""); session.backspace(); assert.equal(session.index, 1); session.type("b", 3000); assert.equal(session.index, 2); assert.equal(session.errors, 2); });
test("typing records expected and pressed keys for mistake review", () => { const session = new TypingSession("a j"); session.type("a", 0); session.type("x", 100); session.backspace(); session.type(" ", 200); session.type(" ", 300); assert.deepEqual(session.mistakes.map(({ expected, typed, index }) => ({ expected, typed, index })), [{ expected: " ", typed: "x", index: 1 }, { expected: "j", typed: " ", index: 2 }]); const summary = summarizeMistakes(session.mistakes); assert.deepEqual(summary.expected, [{ label: "j", count: 1 }, { label: "Space", count: 1 }]); assert.equal(keyLabel(" "), "Space"); });
test("mistake records preserve readable passage context", () => { const session = new TypingSession("hello world"); session.type("x", 1250); assert.equal(session.mistakes[0].context, "[h]ello world"); assert.equal(session.mistakes[0].time, 0); });
test("race completion quips have broad deterministic variety", () => { assert.ok(WINNER_QUIPS.length >= 30); assert.equal(new Set(WINNER_QUIPS).size, WINNER_QUIPS.length); assert.ok(FINISH_QUIPS.length >= 10); const result = { id: "race-1", passageId: "verse-1", place: 1 }; assert.equal(resultQuip(result), resultQuip(result)); assert.ok(WINNER_QUIPS.includes(resultQuip(result))); });
test("the typing layout and results controls expose stable wrapping and saved-player review", () => { const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8"); const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"); const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8"); assert.match(app, /typing-word/); assert.match(css, /\.typing-word \{ display: inline-block; white-space: pre;/); assert.match(html, /dashboardPlayerName/); assert.match(html, /data-mistake-scope="series"/); assert.match(html, /data-action="last-results"/); assert.match(html, /resultAverageWpm/); assert.match(app, /averageWpm/); assert.match(app, /typing-locked/); assert.match(css, /typing-locked/); });
test("screen navigation exposes home, finish, and browser history controls", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.equal((html.match(/data-action="finish-screen"/g) || []).length, 6);
  assert.equal((html.match(/global-screen-nav/g) || []).length, 6);
  assert.match(app, /history\.pushState/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /window\.addEventListener\("popstate"/);
  assert.match(app, /function restoreScreenFromHistory/);
  assert.match(css, /\.screen-nav/);
});
test("flow mode counts mistakes without blocking progress", () => { const session = new TypingSession("abc", { ignoreMistakes: true }); session.type("x", 0); assert.equal(session.index, 1); assert.equal(session.errorChar, ""); assert.equal(session.errors, 1); session.type("b", 1000); assert.equal(session.index, 2); assert.equal(session.correctKeystrokes, 1); });
test("WPM and accuracy follow the specification", () => { const session = new TypingSession("hello"); "hello".split("").forEach((char, i) => session.type(char, i * 12000)); assert.equal(Math.round(session.wpm()), 1); assert.equal(session.accuracy, 1); });
test("normalization handles smart punctuation and whitespace", () => assert.equal(normalizeText("  \u201cHello\u201d\n\u2014 friend\u2026  "), '"Hello" - friend...'));
test("TXT passage import/export preserves sections and settings", () => { const passage = validatePassage({ id: "test", title: "Test", category: "Biblical Passages", source: "Test Source", text: "A valid passage needs enough useful characters to race.", enabled: false }); assert.deepEqual(importPassages(exportPassages([passage]))[0], passage); assert.throws(() => importPassages("{}")); });

test("starter library includes full General and movie-style challenge groups", () => {
  assert.equal(STARTER_PASSAGES.filter((item) => item.category === "Typing Basics").length, 50);
  assert.equal(STARTER_PASSAGES.filter((item) => item.category === "Typing Intermediate").length, 50);
  assert.equal(STARTER_PASSAGES.filter((item) => item.category === "Typing Advanced").length, 50);
  assert.equal(STARTER_PASSAGES.filter((item) => item.category === "General").length, 50);
  assert.equal(STARTER_PASSAGES.filter((item) => item.category === "Movie Quotes").length, 50);
  assert.equal(STARTER_PASSAGES.filter((item) => item.category === "Books").length, 50);
  assert.equal(STARTER_PASSAGES.filter((item) => item.category === "Lord of the Rings Quotes").length, 50);
  assert.ok(STARTER_PASSAGES.filter((item) => item.category !== "General").every((item) => item.source));
  const beginner = STARTER_PASSAGES.filter((item) => item.category === "Typing Basics");
  assert.match(beginner[0].text, /fff jjj/);
  assert.match(beginner[2].text, /jkl;/);
  assert.match(beginner.at(-1).title, /Beginner Graduation/);
  assert.match(STARTER_PASSAGES.find((item) => item.id === "typing-intermediate-01").text, /Clean speed/);
  assert.match(STARTER_PASSAGES.find((item) => item.id === "typing-advanced-01").text, /Accuracy under pressure/);
  assert.ok(STARTER_PASSAGES.every((item) => item.text.length >= 30));
});

test("plain TXT import uses the first line as a section and each following line as a passage", () => {
  const imported = importPassages(`Custom Drills
This first imported line is long enough to become its own typing challenge.
This second imported line also becomes a separate challenge in the same section.`);
  assert.equal(imported.length, 2);
  assert.ok(imported.every((item) => item.category === "Custom Drills"));
  assert.deepEqual(imported.map((item) => item.title), ["Custom Drills 1", "Custom Drills 2"]);
});test("bundled biblical library contains every supplied verse", () => { const passages = importPassages(readFileSync(new URL("../assets/passages/biblical-passages.txt", import.meta.url), "utf8")); assert.equal(passages.length, 50); assert.equal(passages[0].title, "Isaiah 9:6"); assert.equal(passages.at(-1).title, "Ephesians 6:12"); assert.ok(passages.every((item) => item.category === "Biblical Passages")); });
test("seeded AI progress is deterministic", () => { const args = { mode: "adaptive", baselineWpm: 50, ratios: CONFIG.adaptiveRatios, fixedRatio: 1, passageId: "x", bestReplay: null, characters: [{ id: "nova" }, { id: "bolt" }, { id: "moss" }, { id: "ember" }, { id: "pixel" }] }; const a = createAiRacers(args); const b = createAiRacers(args); updateAi(a[0], 12.5, 300); updateAi(b[0], 12.5, 300); assert.equal(a[0].progress, b[0].progress); assert.ok(a[0].targetWpm > 40 && a[0].targetWpm < 50); });
test("local state round-trips and malformed state falls back", () => { const memory = new Map(); const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) }; const state = defaultState(); state.profile.name = "Ada"; saveState(state, storage); assert.equal(loadState(storage).profile.name, "Ada"); memory.set(CONFIG.storageKey, "bad"); assert.equal(loadState(storage).profile.name, ""); });
test("championship ranks racers and awards five-to-one points", () => { const player = { id: "player", name: "Ada", characterId: "nova" }; const racers = [{ id: "ai-0", name: "Bolt", characterId: "bolt", finishTime: 9, progress: 1 }, { id: "ai-1", name: "Moss", characterId: "moss", finishTime: null, progress: .9 }, { id: "ai-2", name: "Ember", characterId: "ember", finishTime: null, progress: .8 }, { id: "ai-3", name: "Pixel", characterId: "pixel", finishTime: null, progress: .7 }]; const order = rankRace(player, racers, 10); assert.equal(order.length, 5); assert.equal(order[0].id, "ai-0"); assert.equal(order[1].id, "player"); const standings = championshipStandings(Array.from({ length: CHAMPIONSHIP_RACES }, () => ({ finishOrder: order }))); assert.equal(standings[0].points, 25); assert.equal(standings[1].points, 20); });

test("AI racers use every non-player character before duplicating the player", () => {
  const characters = [
    { id: "nova", displayName: "Nova" },
    { id: "bolt", displayName: "Bolt" },
    { id: "moss", displayName: "Moss" },
    { id: "ember", displayName: "Ember" },
    { id: "pixel", displayName: "Pixel" },
  ];
  const racers = createAiRacers({ mode: "adaptive", baselineWpm: 50, ratios: CONFIG.adaptiveRatios, fixedRatio: 1, passageId: "x", bestReplay: null, characters, playerCharacterId: "pixel" });
  assert.deepEqual(racers.map((racer) => racer.characterId), ["nova", "bolt", "moss", "ember"]);
  assert.ok(racers.every((racer) => racer.characterId !== "pixel"));
  assert.deepEqual(racers.map((racer) => racer.name), ["Nova", "Bolt", "Moss", "Ember"]);
});
test("personal best mode keeps a five-racer championship field", () => { const racers = createAiRacers({ mode: "ghost", baselineWpm: 50, ratios: CONFIG.adaptiveRatios, fixedRatio: 1, passageId: "x", bestReplay: { samples: [] }, characters: [{ id: "nova" }, { id: "bolt" }, { id: "moss" }, { id: "ember" }, { id: "pixel" }] }); assert.equal(racers.length, 4); assert.equal(racers[0].id, "ghost"); });
test("ordinal suffixes handle teens", () => { assert.equal(ordinal(1), "1st"); assert.equal(ordinal(12), "12th"); assert.equal(ordinal(23), "23rd"); });

test("manifest stages preserve valid lane geometry and scale past twenty tracks", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.tracks.length, 3);
  assert.ok(manifest.tracks.every((track) => track.id && track.displayName));
  assert.ok(manifest.characters.every((character) => character.id && character.displayName));
  assert.deepEqual(manifest.tracks.map((track) => track.id), ["prehistoric-winter", "prehistoric-wilds", "prehistoric-canyon"]);
  assert.deepEqual(manifest.tracks.map((track) => track.displayName), ["Prehistoric Winter", "Prehistoric Wilds", "Prehistoric Canyon"]);
  const sharedLaneBaselines = [443.25, 415.5, 387.75, 360, 471];
  const sharedRaceLine = { startX: 114, finishX: 1977 };
  assert.ok(manifest.tracks.every((track) => JSON.stringify(track.laneBaselines) === JSON.stringify(sharedLaneBaselines)));
  assert.ok(manifest.tracks.every((track) => track.laneBaselines.length === 5));
  assert.ok(manifest.tracks.every((track) => track.laneBaselines[4] > Math.max(...track.laneBaselines.slice(0, 4))));
  assert.ok(manifest.tracks.every((track) => JSON.stringify(track.raceLine) === JSON.stringify(sharedRaceLine)));
  assert.ok(manifest.tracks.every((track) => track.laneBaselines[4] === 471));
  assert.ok(manifest.tracks.every((track) => track.lanePaths.length === 5));
  assert.ok(manifest.tracks.every((track) => track.racerAnchor === "center"));
  assert.ok(manifest.tracks.every((track) => JSON.stringify(track.lanePaths[0]) === JSON.stringify({ start: { x: 136.75, y: 443.25 }, finish: { x: 1957.75, y: 443.25 } })));
  assert.ok(manifest.tracks.every((track) => JSON.stringify(track.lanePaths[3]) === JSON.stringify({ start: { x: 205, y: 360 }, finish: { x: 1900, y: 360 } })));
  assert.ok(manifest.tracks.every((track) => JSON.stringify(track.lanePaths[4]) === JSON.stringify({ start: { x: 114, y: 471 }, finish: { x: 1977, y: 471 } })));
  manifest.tracks.forEach((track) => {
    const background = readFileSync(new URL(`../${track.layers.background}`, import.meta.url));
    assert.equal(background.readUInt32BE(16), track.worldSize.width, `${track.id} background width must match worldSize`);
    assert.equal(background.readUInt32BE(20), track.worldSize.height, `${track.id} background height must match worldSize`);
    assert.deepEqual(track.viewportSize, { width: 1530, height: 724 });
    assert.deepEqual(track.worldSize, { width: 2172, height: 724 });
    assert.deepEqual(track.camera.startCenter, { x: 762, y: 362 });
    assert.deepEqual(track.camera.endCenter, { x: 1408, y: 362 });
  });
  const renderer = readFileSync(new URL("../src/renderer.js", import.meta.url), "utf8");
  assert.match(renderer, /manifest\.tracks\.flatMap/);
  assert.match(renderer, /setTrack\(id\)/);
});
test("paused races can restart and perfect races expose replaceable celebration art", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-action="restart-race"/);
  assert.match(html, /id="perfectCelebration"/);
  assert.match(html, /id="perfectResultBadge"/);
  assert.match(app, /perfect: raceSession\.errors === 0/);
  assert.match(app, /perfectResultBadge/);
  assert.match(app, /manifest\.ui\?\.perfectCelebration/);
});
test("asset filenames include their manifest IDs", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/manifest.json", import.meta.url), "utf8"));
  manifest.characters.forEach((character) => {
    assert.match(character.portrait, new RegExp(`/${character.id}-${"portrait"}\\.png(?:\\?v=\\d+)?$`));
    Object.entries(character.animations).forEach(([state, animation]) => assert.match(animation.file, new RegExp(`/${character.id}-${state}\\.png(?:\\?v=\\d+)?$`)));
  });
  manifest.tracks.forEach((track) => assert.match(track.layers.background, new RegExp(`/${track.id}-(?:panning-)?background\\.png$`)));
});
test("rival pace adjustment is bounded, understandable, and preserves field variation", () => {
  assert.equal(clampAiPace(-99), -20);
  assert.equal(clampAiPace(99), 20);
  assert.equal(Math.round(adjustedAiBaseline(50, 10)), 55);
  assert.deepEqual(projectedAiRange(50, 10, CONFIG.adaptiveRatios), { low: 52, high: 58 });
  assert.equal(aiPaceLabel(0), "Matched");
  assert.equal(defaultState().settings.aiPaceOffset, 0);
  assert.equal(defaultState().settings.focusKeyHelper, true);
});

test("race controls expose only difficulty and the scalable runner picker", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="aiPaceSlider"/);
  assert.match(html, /id="focusKeyHelperSelect"/);
  assert.match(html, /data-action="return-to-races"/);
  assert.match(app, /data-action="open-runners"/);
  assert.match(html, /id="runnerDialog"/);
  assert.doesNotMatch(html, /data-mode=/);
  assert.doesNotMatch(html, /id="difficultySelect"/);
  assert.doesNotMatch(html, /data-passage-order=/);
  assert.match(app, /adjustedAiBaseline/);
  assert.match(app, /function aiPaceBaseWpm\(\) \{[\s\S]*data\.profile\.calibration/);
  assert.doesNotMatch(app, /const winningSpeeds/);
  assert.doesNotMatch(app, /progress\.lastFiveAverage \|\| data\.profile\.calibration/);
  assert.match(app, /manifest\.characters\.map/);
});
test("ten-level championship controls and result hierarchy are exposed", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /id="levelButtons"/);
  assert.match(html, /id="replayLimit"/);
  assert.match(html, /id="replayGlobal"/);
  assert.match(html, /data-action="retry-level"/);
  assert.match(html, />Return to Races<\/button>/);
  assert.match(app, /resultsTitle"\)\.textContent = `\$\{ordinal\(result\.place\)\} Place`/);
  assert.match(app, /Go to Level \$\{championship\.level \+ 1\}/);
  assert.match(html, /id="viewPodiumButton"/);
  assert.doesNotMatch(html, /Vs calibration/);
  assert.doesNotMatch(html, /id="resultDelta"/);
  assert.doesNotMatch(html, /podium-art-placeholder/);
  assert.match(css, /podium-stage \{[^}]*height: clamp\(350px, 46dvh, 430px\)/);
  assert.match(app, /if \(championship\.rounds\.length >= championship\.totalRaces\) \{ continueChampionship\(\)/);
  assert.match(app, /levelHistory/);
  assert.match(css, /#resultsTitle.*font-size: clamp\(5rem/);
});

test("results HTML has unique control IDs", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
test("race canvas preserves the native stage and runner aspect ratio", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const guide = readFileSync(new URL("../ASSET_GUIDE.md", import.meta.url), "utf8");
  assert.match(html, /id="raceCanvas" width="1823" height="863"/);
  assert.match(css, /aspect-ratio: 1823 \/ 863/);
  assert.match(css, /race-canvas-wrap canvas \{ width: 100%; height: auto;/);
  assert.match(guide, /nova-runner-source\.png/);
  assert.match(guide, /prehistoric-Winter-stage-source\.png/);
});
test("frequent wrong keys are bold for one recovery level while spaces remain stats-only", () => {
  const levelOne = Array.from({ length: 5 }, (_, index) => ({
    championshipId: "level-1", playerName: "Jon", roundNumber: index + 1,
    mistakes: index === 0 ? [
      { typed: "e", expected: "a" }, { typed: "E", expected: "a" },
      { typed: "e", expected: "a" }, { typed: "e", expected: "a" },
      { typed: " ", expected: "j" }, { typed: " ", expected: "j" },
      { typed: " ", expected: "j" }, { typed: " ", expected: "j" },
    ] : [],
  }));
  const levelTwoPartial = [{ championshipId: "level-2", playerName: "Jon", roundNumber: 1, mistakes: [] }];
  const counts = mistypedKeyCounts(levelOne, "Jon");
  assert.equal(counts.e, 4);
  assert.equal(counts[" "], 4);
  assert.deepEqual(focusKeysForRace([...levelTwoPartial, ...levelOne], "Jon", "level-2"), ["e"]);
  assert.equal(normalizedFocusKey(" "), null);
  const levelTwoClean = Array.from({ length: 5 }, (_, index) => ({ championshipId: "level-2", playerName: "Jon", roundNumber: index + 1, mistakes: [] }));
  assert.deepEqual(focusKeysForRace([...levelTwoClean, ...levelOne], "Jon", "level-3"), []);
});

test("HD-to-4K layout uses fluid sizing and high-DPI canvas rendering", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../src/renderer.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(renderer, /devicePixelRatio/);
  assert.match(renderer, /syncResolution\(track\)/);
  assert.match(css, /width: min\(2560px/);
  assert.match(css, /width: min\(100%, 140vh\)/);
  assert.match(css, /typing-char\.focus-key \{ color: inherit; background: transparent/);
  assert.match(css, /body\[data-screen="race"\] \.topbar/);
  assert.match(css, /grid-template-rows: minmax\(0, 1fr\) var\(--race-typing-height\)/);
  assert.match(css, /body\[data-screen="dashboard"\] \{ overflow: hidden; \}/);
  assert.match(css, /dashboard-screen\.active \.launch-bar/);
  assert.match(app, /focusKeys: activeFocusKeys\(\)/);
});
test("runner assets are ready for square 1024 frames without display stretching", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/manifest.json", import.meta.url), "utf8"));
  const renderer = readFileSync(new URL("../src/renderer.js", import.meta.url), "utf8");
  assert.ok(manifest.characters.every((character) => character.frameWidth === 1024 && character.frameHeight === 1024));
  assert.ok(manifest.characters.every((character) => character.playerScale > 1));
  assert.ok(manifest.characters.every((character) => Number.isFinite(character.footAnchorY)));
  assert.ok(manifest.characters.every((character) => character.raceScale >= 2));
  assert.match(renderer, /const frameWidth = image\.width \/ frames/);
  assert.match(renderer, /canvas\.height \/ world\.viewportHeight/);
  assert.match(renderer, /character\.playerScale/);
  assert.match(renderer, /character\.raceScale/);
  assert.match(renderer, /character\.footAnchorY \?\? frameHeight/);
  assert.match(renderer, /track\.racerAnchor === "center"/);
  assert.match(renderer, /x - width \* 0\.5/);
  assert.match(renderer, /laneY - height \* 0\.5/);
  assert.doesNotMatch(renderer, /Math\.min\(character\.renderSize/);
});

test("wide tracks use a world camera so racers stay attached to the panning stage", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/manifest.json", import.meta.url), "utf8"));
  const prehistoric = manifest.tracks.find((track) => track.id === "prehistoric-wilds");
  const renderer = readFileSync(new URL("../src/renderer.js", import.meta.url), "utf8");
  const guide = readFileSync(new URL("../ASSET_GUIDE.md", import.meta.url), "utf8");
  assert.equal(manifest.tracks[0].layers.background, "assets/tracks/prehistoric-winter/prehistoric-winter-panning-background.png");
  assert.equal(prehistoric.layers.background, "assets/tracks/prehistoric-wilds/prehistoric-wilds-panning-background.png");
  assert.deepEqual(prehistoric.viewportSize, { width: 1530, height: 724 });
  assert.deepEqual(prehistoric.worldSize, { width: 2172, height: 724 });
  assert.equal(prehistoric.camera.followAfter, "midpoint");
  assert.equal(prehistoric.camera.ease, "smootherstep");
  assert.deepEqual(prehistoric.camera.startCenter, { x: 762, y: 362 });
  assert.deepEqual(prehistoric.camera.endCenter, { x: 1408, y: 362 });
  assert.equal(prehistoric.camera.durationMs, 2200);
  assert.match(renderer, /cameraFor\(track, playerProgress = 0, time = 0\)/);
  assert.match(renderer, /raceLine\(track, world\)/);
  assert.match(renderer, /const midpointX = line\.startX \+ \(line\.finishX - line\.startX\) \* 0\.5/);
  assert.match(renderer, /const startCenterX = track\.camera\?\.startCenter\?\.x/);
  assert.match(renderer, /const endCenterX = track\.camera\?\.endCenter\?\.x/);
  assert.match(renderer, /this\.cameraState/);
  assert.match(renderer, /elapsed \/ duration/);
  assert.match(renderer, /const worldX = startX \+ progress/);
  assert.match(renderer, /const x = worldX - camera\.x \* stageScale/);
  assert.match(renderer, /track\.lanePaths\?\.\[laneIndex\]/);
  assert.match(renderer, /renderLayer: 4 - laneIndex/);
  assert.match(renderer, /racer: player, laneIndex: 4, renderLayer: 5/);
  assert.match(renderer, /sort\(\(a, b\) => a\.renderLayer - b\.renderLayer\)/);
  assert.match(renderer, /drawLayer\(url, camera = \{ x: 0 \}, parallax = 1, world = null\)/);
  assert.match(guide, /Wide panning tracks/);
  assert.match(guide, /prehistoric-wilds-panning-background\.png/);
  assert.match(guide, /1242 x 586/);
  assert.match(guide, /imageWidth \/ imageHeight/);
  assert.match(guide, /Shared stage alignment contract/);
  assert.match(guide, /Prehistoric Canyon/);
  assert.match(guide, /start stripe, finish\/checker stripe, lane separators/);
});
test("all racers keep full scale and the Ready screen uses the supplied palette", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/manifest.json", import.meta.url), "utf8"));
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.ok(manifest.tracks.every((track) => track.laneScales.every((scale) => scale === 1)));
  assert.match(css, /--regal-navy: #0d3b66/);
  assert.match(css, /--lemon-chiffon: #faf0ca/);
  assert.match(css, /--royal-gold: #f4d35e/);
  assert.match(css, /--sandy-brown: #ee964b/);
  assert.match(css, /--tomato: #f95738/);
  assert.match(css, /runner-summary img[\s\S]*width: clamp\(170px, 15vw, 270px\)/);
  assert.match(css, /ready-profile[\s\S]*grid-template-columns: minmax\(250px, 370px\) auto/);
});


test("Pixel uses the current generated source and never the Old folder", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/manifest.json", import.meta.url), "utf8"));
  const pixel = manifest.characters.find((character) => character.id === "pixel");
  assert.equal(pixel.footAnchorY, 827);
  assert.ok(Object.values(pixel.animations).every((animation) => animation.file.startsWith("assets/characters/pixel/")));
  assert.ok(Object.values(pixel.animations).every((animation) => /\?v=\d+$/.test(animation.file)));
  assert.doesNotMatch(JSON.stringify(pixel), /Old/i);
  const png = readFileSync(new URL("../assets/characters/pixel/pixel-run.png", import.meta.url));
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
});
test("Ready page exposes saved configuration-driven color schemes", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.equal(defaultState().settings.theme, "sunset-sprint");
  assert.ok(THEMES.some((theme) => theme.id === "stormy-teal"));
  assert.match(html, /id="themeSelect"/);
  assert.match(css, /--graphite: #353535/);
  assert.match(css, /--stormy-teal: #3c6e71/);
  assert.match(css, /--alabaster-grey: #d9d9d9/);
  assert.match(css, /--yale-blue: #284b63/);
  assert.ok(THEMES.some((theme) => theme.id === "coral-slate"));
  assert.match(css, /--jet-black: #2d3142/);
  assert.match(css, /--silver: #bfc0c0/);
  assert.match(css, /--coral-glow: #ef8354/);
  assert.match(css, /--blue-slate: #4f5d75/);
  assert.ok(THEMES.some((theme) => theme.id === "solar-rally"));
  assert.match(css, /--deep-space-blue: #003049/);
  assert.match(css, /--flag-red: #d62828/);
  assert.match(css, /--vivid-tangerine: #f77f00/);
  assert.match(css, /--sunflower-gold: #fcbf49/);
  assert.match(css, /--vanilla-custard: #eae2b7/);
  assert.ok(THEMES.some((theme) => theme.id === "pumpkin-coast"));
  assert.match(css, /--pumpkin-spice: #ff6700/);
  assert.match(css, /--platinum: #ebebeb/);
  assert.match(css, /--cornflower-ocean: #3a6ea5/);
  assert.match(css, /--steel-azure: #004e98/);
  assert.ok(THEMES.some((theme) => theme.id === "forest-trail"));
  assert.match(css, /--dust-grey: #dad7cd/);
  assert.match(css, /--dry-sage: #a3b18a/);
  assert.match(css, /--fern: #588157/);
  assert.match(css, /--hunter-green: #3a5a40/);
  assert.match(css, /--pine-teal: #344e41/);
});


test("manual starting pace can skip calibration and race retries consume visible replay allowance", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /id="manualPaceForm"/);
  assert.match(html, /id="manualPaceWpm"[^>]*min="5"[^>]*max="250"/);
  assert.match(app, /function saveManualPace/);
  assert.match(app, /method: "manual"/);
  assert.match(app, /event\.target\.matches\("input, textarea, select"\)/);
  assert.match(html, /id="replayUsage"/);
  assert.match(app, /function consumeReplay/);
  assert.match(app, /if \(!consumeReplay\(championship\.level\)\) return/);
  assert.match(app, /used of \$\{replay\.allowed\}/);
  assert.match(css, /\.manual-pace-form/);
  assert.match(css, /\.replay-usage/);
});


test("completed levels reopen all five saved races and runner cards show complete art", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /function showCompletedLevel/);
  assert.match(app, /levelAttempts\(progress\.level\)\.length\) \{ showCompletedLevel/);
  assert.match(app, /roundNumberOverride/);
  assert.match(app, /championship\.rounds\[result\.roundNumber - 1\] = roundResult/);
  assert.match(app, /function updateRecordedLevelAttempt/);
  assert.match(app, /renderResults\(result, \{ levelReview: true \}\)/);
  assert.match(css, /\.character-card img \{[^}]*object-fit: contain; transform: none;/);
  assert.match(css, /\.runner-summary \{[^}]*overflow: hidden;/);
  assert.match(css, /dashboard-screen\.active \.runner-summary img \{[^}]*transform: none;/);
});






