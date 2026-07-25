import { CONFIG, THEMES, STARTER_PASSAGES } from "./config.js";
import { loadState, saveState } from "./storage.js";
import { choosePassage, exportPassages, importPassages, normalizeText, validatePassage } from "./passages.js";
import { TypingSession, ordinal } from "./typing.js";
import { calculatePlace, createAiRacers, updateAi } from "./ai.js";
import { GameAudio } from "./audio.js";
import { CHAMPIONSHIP_RACES, championshipStandings, rankRace } from "./championship.js";
import { RaceRenderer } from "./renderer.js";
import { keyLabel, summarizeMistakes } from "./mistakes.js";
import { resultQuip } from "./quips.js";
import { adjustedAiBaseline, aiPaceLabel, clampAiPace, projectedAiRange } from "./difficulty.js";
import { focusKeysForRace, normalizedFocusKey } from "./focus-keys.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const screens = Object.fromEntries($$(".screen").map((node) => [node.id.replace("Screen", ""), node]));

let data = loadState();
let manifest;
let renderer;
let audio;
let currentScreen = "welcome";
let calibrationSession = null;
let calibrationDeadline = null;
let calibrationFrame = null;
let calibrationMode = "strict";
let selectedPassageId = data.selectedPassageId || data.passages[0]?.id;
let editorPassageId = selectedPassageId;
let selectedPassageCategory = data.selectedPassageCategory || "Biblical Passages";
let raceSession = null;
let raceRacers = [];
let racePlayer = null;
let raceSetup = null;
let raceStartTime = 0;
let raceCountdownEnd = 0;
let racePausedAt = null;
let raceFrame = null;
let raceActive = false;
let lastRaceResult = data.records[0] || null;
let historicalReturnScreen = null;
let mistakeReviewResult = null;
let mistakeScope = "race";
let raceFinishTimer = null;
let championship = data.activeChampionship || null;
let reviewingCompletedLevel = false;
let selectedReviewResult = null;
let replayingCompletedRace = null;

async function init() {
  manifest = await fetch("assets/manifest.json").then((response) => response.json());
  await installBundledPassages();
  renderer = new RaceRenderer($("#raceCanvas"), manifest);
  await renderer.load();
  audio = new GameAudio(data.settings.muted);
  const perfectAsset = manifest.ui?.perfectCelebration;
  if (perfectAsset) $("#perfectCelebration").src = perfectAsset;
  $$('[data-game-title]').forEach((node) => node.textContent = CONFIG.title);
  renderThemeOptions();
  applySettings();
  bindEvents();
  renderCharacters();
  renderPassageList();
  if (data.profile.calibration) showDashboard(); else showScreen("welcome");
}
async function installBundledPassages() {
  if ((data.libraryVersion || 0) >= 5) { normalizeBuiltInPassageData(); loadActiveProfileLibrary(); return; }
  const response = await fetch("assets/passages/biblical-passages.txt");
  if (!response.ok) throw new Error("The bundled Biblical Passages could not be loaded.");
  const incoming = [...STARTER_PASSAGES, ...importPassages(await response.text())];
  const existing = new Set(data.passages.map((item) => `${item.category || "General"}|${item.title}`.toLowerCase()));
  incoming.forEach((item) => {
    const key = `${item.category}|${item.title}`.toLowerCase();
    if (!existing.has(key)) { data.passages.push({ ...item }); existing.add(key); }
  });
  Object.values(data.profileLibraries || {}).forEach((library) => {
    if (!Array.isArray(library.passages)) return;
    const libraryExisting = new Set(library.passages.map((item) => `${item.category || "General"}|${item.title}`.toLowerCase()));
    incoming.forEach((item) => {
      const key = `${item.category}|${item.title}`.toLowerCase();
      if (!libraryExisting.has(key)) { library.passages.push({ ...item }); libraryExisting.add(key); }
    });
  });
  normalizeBuiltInPassageData();
  data.libraryVersion = 5;
  if (!data.selectedPassageCategory) selectedPassageCategory = "Biblical Passages";
  loadActiveProfileLibrary();
  persist();
}
function normalizeBuiltInPassageData() {
  const normalize = (passage) => {
    if (!passage) return passage;
    if (passage.category === "Movie-Style Quotes") {
      passage.category = "Movie Quotes";
      passage.title = passage.title.replace("Movie-Style Challenge", "Movie Quote");
      passage.source ||= "Original Movie Quote";
    }
    if (passage.category === "Movie Quotes") passage.source ||= "Original Movie Quote";
    return passage;
  };
  const dedupe = (items) => {
    const seen = new Set();
    return (items || []).map(normalize).filter((item) => {
      const key = `${item.category || "General"}|${item.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  data.passages = dedupe(data.passages);
  Object.values(data.profileLibraries || {}).forEach((library) => {
    if (Array.isArray(library.passages)) library.passages = dedupe(library.passages);
    if (library.selectedPassageCategory === "Movie-Style Quotes") library.selectedPassageCategory = "Movie Quotes";
  });
  if (selectedPassageCategory === "Movie-Style Quotes") selectedPassageCategory = "Movie Quotes";
  if (data.selectedPassageCategory === "Movie-Style Quotes") data.selectedPassageCategory = "Movie Quotes";
}
function profileKey(name = data.profile.name) {
  return String(name || "guest").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
}

function saveActiveProfileLibrary(name = data.profile.name) {
  data.profileLibraries ||= {};
  data.profileLibraries[profileKey(name)] = {
    passages: structuredClone(data.passages),
    selectedPassageId,
    selectedPassageCategory,
    collapsedPassageSections: { ...(data.collapsedPassageSections || {}) },
  };
}

function loadActiveProfileLibrary(name = data.profile.name) {
  data.profileLibraries ||= {};
  const key = profileKey(name);
  const library = data.profileLibraries[key];
  if (library?.passages?.length) {
    data.passages = library.passages.map((passage) => ({ ...passage, category: passage.category || "General" }));
    selectedPassageId = library.selectedPassageId || data.passages[0]?.id;
    selectedPassageCategory = library.selectedPassageCategory || "Biblical Passages";
    data.collapsedPassageSections = { ...(library.collapsedPassageSections || {}) };
  } else {
    selectedPassageId = data.selectedPassageId || data.passages[0]?.id;
    selectedPassageCategory = data.selectedPassageCategory || "Biblical Passages";
    saveActiveProfileLibrary(name);
  }
}

function persist() {
  data.selectedPassageId = selectedPassageId;
  data.selectedPassageCategory = selectedPassageCategory;
  saveActiveProfileLibrary();
  saveState(data);
}

function renderThemeOptions() {
  $("#themeSelect").innerHTML = THEMES.map((theme) => `<option value="${theme.id}">${theme.name}</option>`).join("");
}

function showScreen(name) {
  currentScreen = name;
  document.body.dataset.screen = name;
  Object.entries(screens).forEach(([key, node]) => node.classList.toggle("active", key === name));
  window.scrollTo({ top: 0, behavior: data.settings.reducedMotion ? "auto" : "smooth" });
}

function home() { clearTimeout(raceFinishTimer); if (raceActive) pauseRace(true); data.profile.calibration ? showDashboard({ preserveRace: raceActive }) : showScreen("welcome"); }

function showDashboard({ preserveRace = false } = {}) {
  cancelAnimationFrame(calibrationFrame);
  clearTimeout(raceFinishTimer);
  if (!preserveRace) raceActive = false;
  $("#dashboardName").textContent = data.profile.name || "Racer";
  $("#dashboardPlayerName").value = data.profile.name || "";
  lastRaceResult = data.records[0] || lastRaceResult;
  $("#lastResultsReadyButton").classList.toggle("hidden", !lastRaceResult);
  $("#baselineWpm").textContent = Math.round(data.profile.calibration?.wpm || 0);
  $("#baselineAccuracy").textContent = `${Math.round((data.profile.calibration?.accuracy || 0) * 100)}% accuracy`;
  const challengePassages = activeChallengePassages();
  const progress = progressionState();
  const levels = Math.max(1, Math.ceil(challengePassages.length / CHAMPIONSHIP_RACES));
  renderPassageGroupControl();
  renderChampionshipMap(levels);
  $("#selectedPassageTitle").textContent = `Level ${progress.level} of ${levels} - five ${selectedPassageCategory} races`;
  $("#returnToRacesButton").classList.toggle("hidden", !raceActive && !championship?.rounds?.length);
  renderAiPaceControl();
  renderCharacters();
  showScreen("dashboard");
}

function startCalibration() {
  calibrationSession = new TypingSession(CONFIG.calibrationText, { ignoreMistakes: calibrationMode === "flow" });
  calibrationDeadline = null;
  $("#calibrationTimer").textContent = CONFIG.calibrationSeconds;
  $("#calibrationWpm").textContent = "0";
  $("#manualPaceWpm").value = Math.round(data.profile.calibration?.wpm || 40);
  $("#calibrationHint").textContent = `${calibrationMode === "flow" ? "Mistakes are counted but do not stop you" : "Mistakes must be corrected"} Â· Starts on your first keystroke`;
  renderTyping($("#calibrationTyping"), calibrationSession);
  showScreen("calibration");
  $("#calibrationTyping").focus();
  cancelAnimationFrame(calibrationFrame);
  calibrationFrame = requestAnimationFrame(updateCalibration);
}

function updateCalibration(now) {
  if (currentScreen !== "calibration") return;
  if (calibrationDeadline) {
    const remaining = Math.max(0, (calibrationDeadline - now) / 1000);
    $("#calibrationTimer").textContent = Math.ceil(remaining);
    $("#calibrationWpm").textContent = Math.round(calibrationSession.wpm(now));
    if (remaining <= 0 || calibrationSession.finished) { finishCalibration(now); return; }
  }
  calibrationFrame = requestAnimationFrame(updateCalibration);
}

function finishCalibration(now) {
  calibrationSession.endTime = now;
  data.profile.calibration = { playerName: data.profile.name, wpm: Math.max(5, calibrationSession.wpm(now)), accuracy: calibrationSession.accuracy, date: new Date().toISOString() };
  persist();
  toast(`Pace saved: ${Math.round(data.profile.calibration.wpm)} WPM`);
  showDashboard();
}

function saveManualPace(event) {
  event.preventDefault();
  const wpm = Math.round(Number($("#manualPaceWpm").value));
  if (!Number.isFinite(wpm) || wpm < 5 || wpm > 250) { toast("Enter a starting pace from 5 to 250 WPM."); return; }
  cancelAnimationFrame(calibrationFrame);
  data.profile.calibration = { playerName: data.profile.name, wpm, accuracy: 1, date: new Date().toISOString(), method: "manual" };
  persist();
  audio.play("save");
  toast(`Starting pace saved: ${wpm} WPM`);
  showDashboard();
}

function activeFocusKeys() {
  if (data.settings.focusKeyHelper === false) return [];
  return focusKeysForRace(data.records, data.profile.name, championship?.id);
}

function raceTypingInstruction() {
  const keys = raceSetup?.focusKeys || activeFocusKeys();
  return keys.length ? `Practice keys in bold: ${keys.map((key) => key.toLocaleUpperCase()).join(", ")}` : "Type the highlighted text";
}

function renderTyping(card, session) {
  const copy = $(".typing-copy", card);
  if (copy._typingText !== session.text) {
    copy._typingText = session.text;
    copy.replaceChildren();
    const fragment = document.createDocumentFragment();
    const characters = [];
    const tokens = session.text.match(/\S+\s*|\s+/g) || [];
    let charIndex = 0;
    tokens.forEach((token) => {
      const word = document.createElement("span");
      word.className = "typing-word";
      [...token].forEach((char) => {
        const node = document.createElement("span");
        node.className = "typing-char remaining";
        node.dataset.charIndex = charIndex;
        node.textContent = char;
        word.append(node);
        characters.push(node);
        charIndex += 1;
      });
      fragment.append(word);
    });
    copy.append(fragment);
    copy._typingCharacters = characters;
  }
  const characters = copy._typingCharacters || [];
  const focusKeys = card.id === "raceTyping" ? new Set(raceSetup?.focusKeys || activeFocusKeys()) : new Set();
  characters.forEach((node, index) => {
    node.className = `typing-char ${index < session.index ? "typed" : "remaining"}`;
    if (index >= session.index && focusKeys.has(normalizedFocusKey(node.textContent))) node.classList.add("focus-key");
    if (index === session.index && !session.finished) node.classList.add("current");
    if (index === session.index && session.errorChar) node.classList.add("error");
  });
  requestAnimationFrame(() => {
    const viewport = $(".typing-viewport", card);
    const current = characters[Math.min(session.index, Math.max(0, characters.length - 1))];
    const target = current ? Math.max(0, current.offsetTop - viewport.clientHeight * .42) : 0;
    copy.style.setProperty("--typing-shift", `${-target}px`);
  });
}
function selectCalibrationMode(mode) {
  if (calibrationDeadline) { toast("Retake the test to change mistake mode."); return; }
  calibrationMode = mode;
  $$("[data-calibration-mode]").forEach((button) => {
    const active = button.dataset.calibrationMode === mode;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-checked", String(active));
  });
  calibrationSession = new TypingSession(CONFIG.calibrationText, { ignoreMistakes: mode === "flow" });
  renderTyping($("#calibrationTyping"), calibrationSession);
  $("#calibrationHint").textContent = `${mode === "flow" ? "Mistakes are counted but do not stop you" : "Mistakes must be corrected"} Â· Starts on your first keystroke`;
  $("#calibrationTyping").focus();
}

function renderCharacters() {
  if (!manifest) return;
  const selected = manifest.characters.find((character) => character.id === data.profile.characterId) || manifest.characters[0];
  if (selected && data.profile.characterId !== selected.id) data.profile.characterId = selected.id;
  $("#selectedRunnerPreview").innerHTML = selected ? `<img src="${selected.portrait}" alt=""><div><span>Selected runner</span><strong>${escapeHtml(selected.displayName)}</strong><small>${manifest.characters.length} runner${manifest.characters.length === 1 ? "" : "s"} available</small></div>` : "";
  $("#characterGrid").innerHTML = manifest.characters.map((character) => `<button class="character-card ${data.profile.characterId === character.id ? "selected" : ""}" data-character="${character.id}" role="radio" aria-checked="${data.profile.characterId === character.id}"><img src="${character.portrait}" alt="${escapeHtml(character.displayName)}"><span>${escapeHtml(character.displayName)}</span></button>`).join("");
}

function aiPaceBaseWpm() {
  return data.profile.calibration?.wpm || 35;
}

function renderAiPaceControl(offset = data.settings.aiPaceOffset) {
  const helper = $("#focusKeyHelperSelect");
  if (helper) helper.value = data.settings.focusKeyHelper === false ? "disabled" : "enabled";
  const pace = clampAiPace(offset);
  const range = projectedAiRange(aiPaceBaseWpm(), pace, CONFIG.adaptiveRatios);
  $("#aiPaceSlider").value = pace;
  $("#aiPaceValue").textContent = `${pace > 0 ? "+" : ""}${pace}%`;
  $("#aiPaceDescription").textContent = aiPaceLabel(pace);
  $("#aiPaceRange").textContent = `Projected rivals: ${range.low}-${range.high} WPM`;
}

function setAiPace(offset, save = false) {
  data.settings.aiPaceOffset = clampAiPace(offset);
  renderAiPaceControl(data.settings.aiPaceOffset);
  if (save) {
    persist();
    toast(`Computer pace set to ${data.settings.aiPaceOffset > 0 ? "+" : ""}${data.settings.aiPaceOffset}%.`);
  }
}

function returnToRaces() {
  if (raceActive && raceSession && !raceSession.finished) {
    showScreen("race");
    resumeRace();
    cancelAnimationFrame(raceFrame);
    raceFrame = requestAnimationFrame(updateRace);
    return;
  }
  const result = lastRaceResult || data.records[0];
  if (result && championship?.rounds?.length) {
    renderResults(result);
    showScreen("results");
    return;
  }
  toast("Start a five-race championship first.");
}

function passageCategories() {
  return [...new Set(data.passages.map((item) => item.category || "General"))].sort((a, b) => {
    const preferred = { "Biblical Passages": 0, "Typing Basics": 1, "Typing Intermediate": 2, "Typing Advanced": 3, General: 4, "Movie Quotes": 5, Books: 6, "Lord of the Rings Quotes": 7 };
    return (preferred[a] ?? 10) - (preferred[b] ?? 10) || a.localeCompare(b);
  });
}

function activeChallengePassages() {
  const categories = passageCategories();
  if (!categories.includes(selectedPassageCategory)) selectedPassageCategory = categories.includes("Biblical Passages") ? "Biblical Passages" : (categories[0] || "General");
  const selected = data.passages.filter((item) => item.enabled && (item.category || "General") === selectedPassageCategory);
  return selected.length ? selected : data.passages.filter((item) => item.enabled);
}

function renderPassageGroupControl() {
  const categories = passageCategories();
  if (!categories.includes(selectedPassageCategory)) selectedPassageCategory = categories.includes("Biblical Passages") ? "Biblical Passages" : (categories[0] || "General");
  const select = $("#passageGroupSelect");
  if (!select) return;
  select.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  select.value = selectedPassageCategory;
}

function selectPassageCategory(category) {
  if (!passageCategories().includes(category)) return;
  if (selectedPassageCategory !== category) {
    selectedPassageCategory = category;
    const progress = progressionState();
    progress.level = 1;
    progress.unlockedLevel = 1;
    progress.randomPassageIds = [];
    championship = null;
    data.activeChampionship = null;
    persist();
  }
  showDashboard();
}
function progressionState() {
  data.progressionByCategory ||= {};
  const key = selectedPassageCategory || "Biblical Passages";
  if (!data.progressionByCategory[key]) data.progressionByCategory[key] = key === "Biblical Passages" && data.progression ? data.progression : {};
  const progress = data.progressionByCategory[key];
  const defaults = { level: 1, unlockedLevel: 1, order: "straight", lastFiveAverage: null, randomPassageIds: [], replayLimit: 2, replayScope: "level", replayUsedTotal: 0, replayUsedByLevel: {}, levelHistory: {} };
  Object.entries(defaults).forEach(([name, value]) => { if (progress[name] === undefined) progress[name] = structuredClone(value); });
  data.progression = progress;
  return progress;
}
function levelAttempts(level) {
  return progressionState().levelHistory[String(level)] || [];
}

function replayRemaining(level = progressionState().level) {
  const progress = progressionState();
  const limit = Math.max(0, Math.min(20, Number(progress.replayLimit) || 0));
  const used = progress.replayScope === "game" ? progress.replayUsedTotal : (progress.replayUsedByLevel[String(level)] || 0);
  return Math.max(0, limit - used);
}

function renderChampionshipMap(totalLevels) {
  const progress = progressionState();
  progress.unlockedLevel = Math.max(1, Math.min(totalLevels, progress.unlockedLevel || 1));
  progress.level = Math.max(1, Math.min(progress.unlockedLevel, progress.level || 1));
  const completed = Object.values(progress.levelHistory).filter((attempts) => attempts?.length).length;
  $("#championshipCompletion").textContent = `${completed} of ${totalLevels} levels completed`;
  $("#levelButtons").innerHTML = Array.from({ length: totalLevels }, (_, index) => {
    const level = index + 1;
    const attempts = levelAttempts(level);
    const unlocked = level <= progress.unlockedLevel || attempts.length > 0;
    const best = attempts.length ? Math.max(...attempts.map((attempt) => attempt.playerPoints || 0)) : null;
    return `<button class="level-button ${level === progress.level ? "selected" : ""} ${attempts.length ? "completed" : ""}" data-level="${level}" ${unlocked ? "" : "disabled"} aria-pressed="${level === progress.level}"><span>Level ${level}</span><small>${attempts.length ? `${attempts.length} attempt${attempts.length === 1 ? "" : "s"} - best ${best} pts` : unlocked ? "Ready" : "Locked"}</small></button>`;
  }).join("");
  $("#replayLimit").value = progress.replayLimit;
  $("#replayGlobal").checked = progress.replayScope === "game";
  const remaining = replayRemaining(progress.level);
  $("#replayAllowanceStatus").textContent = progress.replayScope === "game" ? `${remaining} replay${remaining === 1 ? "" : "s"} left for the whole game` : `${remaining} replay${remaining === 1 ? "" : "s"} left for Level ${progress.level}`;
  const isReplay = levelAttempts(progress.level).length > 0;
  $("#startChampionshipButton").textContent = isReplay ? `Replay Level ${progress.level}` : `Start Level ${progress.level}`;
  $("#startChampionshipButton").disabled = isReplay && remaining <= 0;
}

function selectChampionshipLevel(level) {
  const progress = progressionState();
  if (level > progress.unlockedLevel && !levelAttempts(level).length) return;
  progress.level = level;
  persist();
  showDashboard();
}

function saveReplayRules() {
  const progress = progressionState();
  progress.replayLimit = Math.max(0, Math.min(20, Number($("#replayLimit").value) || 0));
  progress.replayScope = $("#replayGlobal").checked ? "game" : "level";
  persist();
  renderChampionshipMap(Math.max(1, Math.ceil(activeChallengePassages().length / CHAMPIONSHIP_RACES)));
}

function consumeReplay(level) {
  const progress = progressionState();
  if (replayRemaining(level) <= 0) { toast(`No replays remain for ${progress.replayScope === "game" ? "this game" : `Level ${level}`}.`); return false; }
  if (progress.replayScope === "game") progress.replayUsedTotal += 1;
  else progress.replayUsedByLevel[String(level)] = (progress.replayUsedByLevel[String(level)] || 0) + 1;
  return true;
}

function useReplay(level) {
  if (!levelAttempts(level).length) return true;
  return consumeReplay(level);
}

function replayUsage(level = championship?.level || progressionState().level) {
  const progress = progressionState();
  const allowed = Math.max(0, Math.min(20, Number(progress.replayLimit) || 0));
  const used = progress.replayScope === "game" ? progress.replayUsedTotal : (progress.replayUsedByLevel[String(level)] || 0);
  return { allowed, used, remaining: Math.max(0, allowed - used), scope: progress.replayScope === "game" ? "whole game" : `Level ${level}` };
}

function syncPassageOrder() {
  const order = progressionState().order;
  $$("[data-passage-order]").forEach((button) => {
    const active = button.dataset.passageOrder === order;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-checked", String(active));
  });
}

function selectPassageOrder(order) {
  const progress = progressionState();
  if (!["straight", "random"].includes(order)) return;
  if (progress.order !== order) progress.randomPassageIds = [];
  progress.order = order;
  persist();
  showDashboard();
}

function shufflePassageIds(passages) {
  const ids = passages.map((item) => item.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
  }
  return ids;
}


function latestLevelAttempt(level) {
  return levelAttempts(level).at(-1) || null;
}

function recordsForAttempt(attempt) {
  if (!attempt?.championshipId) return [];
  return data.records
    .filter((record) => record.championshipId === attempt.championshipId)
    .sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
}

function reconstructedRounds(records) {
  const previousPoints = new Map();
  return records.map((record) => {
    let finishOrder = Array.isArray(record.finishOrder) ? record.finishOrder.map((racer) => ({ ...racer })) : null;
    if (!finishOrder?.length) {
      const fieldSize = record.fieldSize || 5;
      finishOrder = (record.seriesStandings || []).map((racer) => {
        const points = racer.points - (previousPoints.get(racer.id) || 0);
        return { id: racer.id, name: racer.name, characterId: racer.characterId, place: Math.max(1, fieldSize - points + 1) };
      }).sort((a, b) => a.place - b.place);
    }
    (record.seriesStandings || []).forEach((racer) => previousPoints.set(racer.id, racer.points));
    return { raceId: record.id, passageId: record.passageId, playerName: record.playerName, mistakes: record.mistakes || [], finishOrder, playerWpm: record.wpm, playerPlace: record.place };
  });
}

function showCompletedLevel(level) {
  const attempt = latestLevelAttempt(level);
  const records = recordsForAttempt(attempt);
  if (records.length < CHAMPIONSHIP_RACES) { toast(`Level ${level} does not have five saved race results yet.`); return; }
  const totalLevels = Math.max(1, Math.ceil(activeChallengePassages().length / CHAMPIONSHIP_RACES));
  championship = {
    id: attempt.championshipId,
    playerName: records.at(-1).playerName || data.profile.name,
    totalRaces: CHAMPIONSHIP_RACES,
    level,
    totalLevels,
    mode: records.at(-1).mode || "adaptive",
    difficulty: records.at(-1).difficulty || "normal",
    passageIds: records.map((record) => record.passageId),
    trackIds: records.map((record) => record.trackId),
    aiBaselineWpm: data.profile.calibration?.wpm || 35,
    rounds: reconstructedRounds(records),
    completionRecorded: true,
  };
  reviewingCompletedLevel = true;
  replayingCompletedRace = null;
  selectedReviewResult = records.at(-1);
  renderResults(selectedReviewResult, { levelReview: true });
  showScreen("results");
}

function startChampionship({ skipReplayCharge = false } = {}) {
  const challengePassages = activeChallengePassages();
  if (!challengePassages.length) { toast("Enable at least one passage in this section before racing."); return; }
  const progress = progressionState();
  const totalLevels = Math.max(1, Math.ceil(challengePassages.length / CHAMPIONSHIP_RACES));
  progress.level = Math.min(Math.max(1, progress.level), totalLevels);
  if (!skipReplayCharge && levelAttempts(progress.level).length) { showCompletedLevel(progress.level); return; }
  if (!skipReplayCharge && !useReplay(progress.level)) return;
  const validIds = new Set(challengePassages.map((item) => item.id));
  if (progress.order === "random" && (progress.randomPassageIds.length !== challengePassages.length || progress.randomPassageIds.some((id) => !validIds.has(id)))) {
    progress.randomPassageIds = shufflePassageIds(challengePassages);
  }
  const orderedIds = progress.order === "random" ? progress.randomPassageIds : challengePassages.map((item) => item.id);
  const start = (progress.level - 1) * CHAMPIONSHIP_RACES;
  const passageIds = orderedIds.slice(start, start + CHAMPIONSHIP_RACES);
  while (passageIds.length < CHAMPIONSHIP_RACES) passageIds.push(orderedIds[passageIds.length % orderedIds.length]);
  championship = {
    id: `championship-${Date.now()}`,
    playerName: data.profile.name,
    totalRaces: CHAMPIONSHIP_RACES,
    level: progress.level,
    totalLevels,
    order: progress.order,
    mode: "adaptive",
    difficulty: "normal",
    passageIds,
    trackIds: passageIds.map((_, index) => manifest.tracks[(start + index) % manifest.tracks.length].id),
    aiBaselineWpm: data.profile.calibration?.wpm || 35,
    rounds: [],
  };
  data.activeChampionship = championship;
  persist();
  startRace();
}

function startRace({ roundNumberOverride = null } = {}) {
  clearTimeout(raceFinishTimer);
  if (!championship) { startChampionship(); return; }
  const roundNumber = roundNumberOverride || championship.rounds.length + 1;
  const passageId = championship.passageIds[roundNumber - 1];
  const passage = data.passages.find((item) => item.id === passageId) || choosePassage(data.passages, selectedPassageId);
  if (!passage) { toast("Enable at least one passage before racing."); return; }
  selectedPassageId = passage.id;
  const baseline = adjustedAiBaseline(data.profile.calibration?.wpm || 35, data.settings.aiPaceOffset);
  const { mode, difficulty } = championship;
  const fallbackTrackIndex = (((championship.level || 1) - 1) * CHAMPIONSHIP_RACES + roundNumber - 1) % manifest.tracks.length;
  const track = manifest.tracks.find((item) => item.id === championship.trackIds?.[roundNumber - 1]) || manifest.tracks[fallbackTrackIndex];
  renderer.setTrack(track.id);
  raceSetup = { mode, difficulty, passage, roundNumber, trackId: track.id, focusKeys: activeFocusKeys() };
  raceSession = new TypingSession(passage.text);
  raceRacers = createAiRacers({ mode, baselineWpm: baseline, ratios: CONFIG.adaptiveRatios, fixedRatio: CONFIG.fixedRatios[difficulty], passageId: passage.id, bestReplay: data.bestReplay, characters: manifest.characters, playerCharacterId: data.profile.characterId });
  racePlayer = { id: "player", name: championship.playerName || data.profile.name, characterId: data.profile.characterId, progress: 0, finishTime: null };
  const modeName = mode === "adaptive" ? "Adaptive" : mode === "ghost" ? "Personal Best" : `${difficulty[0].toUpperCase() + difficulty.slice(1)} Fixed`;
  $("#raceModeLabel").textContent = `Level ${championship.level} Â· Race ${roundNumber} of ${CHAMPIONSHIP_RACES} Â· ${modeName} Â· ${track.displayName}`;
  $("#raceTitle").textContent = passage.source ? `${passage.title} - ${passage.source}` : passage.title;
  $("#raceWpm").textContent = "0"; $("#raceAccuracy").textContent = "100%"; $("#raceProgress").textContent = "0";
  $("#raceHint").textContent = raceSetup.focusKeys.length ? `The race starts after the countdown - ${raceTypingInstruction()}` : "The race starts after the countdown";
  $("#raceLastResultsButton").classList.toggle("hidden", !lastRaceResult);
  renderTyping($("#raceTyping"), raceSession);
  showScreen("race");
  raceActive = true; racePausedAt = null;
  raceCountdownEnd = performance.now() + 3000;
  raceStartTime = raceCountdownEnd;
  raceSession.startTime = raceStartTime;
  $("#countdown").classList.remove("hidden");
  $("#finishOverlay").classList.add("hidden");
  $("#finishOverlay").classList.remove("is-perfect");
  $("#perfectCelebration").classList.add("hidden");
  $("#pauseOverlay").classList.add("hidden");
  cancelAnimationFrame(raceFrame);
  raceFrame = requestAnimationFrame(updateRace);
}

function updateRace(now) {
  if (!raceActive || currentScreen !== "race") return;
  if (racePausedAt !== null) { renderer.draw({ racers: raceRacers, player: racePlayer, time: now, countdown: false }); raceFrame = requestAnimationFrame(updateRace); return; }
  if (now < raceCountdownEnd) {
    const number = Math.ceil((raceCountdownEnd - now) / 1000);
    $("#countdown").textContent = number;
    renderer.draw({ racers: raceRacers, player: racePlayer, time: now, countdown: true });
    raceFrame = requestAnimationFrame(updateRace); return;
  }
  if (!$("#countdown").classList.contains("hidden")) { $("#countdown").classList.add("hidden"); $("#raceHint").textContent = raceTypingInstruction(); audio.play("start"); $("#raceTyping").focus(); }
  const elapsed = Math.max(0, (now - raceStartTime) / 1000);
  raceRacers.forEach((racer) => updateAi(racer, elapsed, raceSession.text.length));
  racePlayer.progress = raceSession.progress;
  const place = calculatePlace(racePlayer.progress, raceRacers);
  $("#raceWpm").textContent = Math.round(raceSession.wpm(now));
  $("#raceAccuracy").textContent = `${Math.round(raceSession.accuracy * 100)}%`;
  $("#raceProgress").textContent = Math.floor(raceSession.progress * 100);
  $("#racePlace").textContent = `${place} / ${raceRacers.length + 1}`;
  renderer.draw({ racers: raceRacers, player: racePlayer, time: now, countdown: false });
  if (raceSession.finished) { finishRace(now); return; }
  raceFrame = requestAnimationFrame(updateRace);
}

function pauseRace(force = false) {
  if (!raceActive || currentScreen !== "race") return;
  if (racePausedAt === null) {
    racePausedAt = performance.now(); $("#pauseOverlay").classList.remove("hidden"); $("#raceHint").textContent = "Race paused";
  } else if (!force) resumeRace();
}

function resumeRace() {
  if (racePausedAt === null) return;
  const pausedFor = performance.now() - racePausedAt;
  raceStartTime += pausedFor; raceCountdownEnd += pausedFor; raceSession.startTime += pausedFor;
  racePausedAt = null; $("#pauseOverlay").classList.add("hidden"); $("#raceHint").textContent = raceTypingInstruction(); $("#raceTyping").focus();
}

function debugFinishRaceFirst() {
  if (!raceActive || currentScreen !== "race" || !raceSession) return;
  const now = performance.now();
  const targetWpm = Math.max(5, data.profile.calibration?.wpm || 35);
  const simulatedSeconds = Math.max(8, (raceSession.text.length / 5) / targetWpm * 60);
  const simulatedStart = now - simulatedSeconds * 1000;
  raceStartTime = simulatedStart;
  raceCountdownEnd = Math.min(raceCountdownEnd, simulatedStart);
  raceSession.startTime = simulatedStart;
  raceSession.endTime = now;
  raceSession.index = raceSession.text.length;
  raceSession.errorChar = "";
  raceSession.correctKeystrokes = raceSession.text.length;
  raceSession.totalKeystrokes = Math.max(raceSession.totalKeystrokes, raceSession.correctKeystrokes + raceSession.errors);
  raceSession.sample(now);
  racePlayer.progress = 1;
  raceRacers.forEach((racer, index) => {
    racer.progress = Math.max(0.68, 0.94 - index * 0.045);
    racer.finishTime = null;
  });
  $("#pauseOverlay").classList.add("hidden");
  $("#countdown").classList.add("hidden");
  finishRace(now, { forcePlayerFirst: true });
}

function finishRace(now, { forcePlayerFirst = false } = {}) {
  raceActive = false; cancelAnimationFrame(raceFrame); audio.play("finish");
  const time = raceSession.elapsed(now);
  if (!forcePlayerFirst) raceRacers.forEach((racer) => updateAi(racer, time, raceSession.text.length));
  const finishOrder = rankRace(racePlayer, raceRacers, time);
  const place = finishOrder.find((racer) => racer.id === "player").place;
  const result = { id: `race-${Date.now()}`, championshipId: championship.id, playerName: racePlayer.name, date: new Date().toISOString(), mode: raceSetup.mode, difficulty: raceSetup.difficulty, level: championship.level, passageId: raceSetup.passage.id, passageTitle: raceSetup.passage.title, roundNumber: raceSetup.roundNumber, time, wpm: raceSession.wpm(now), peakWpm: raceSession.peakWpm(), accuracy: raceSession.accuracy, errors: raceSession.errors, perfect: raceSession.errors === 0, trackId: raceSetup.trackId, mistakes: raceSession.mistakes.map((mistake) => ({ ...mistake })), place, fieldSize: finishOrder.length, finishOrder: finishOrder.map((racer) => ({ ...racer })) };
  const roundResult = { raceId: result.id, passageId: result.passageId, playerName: result.playerName, mistakes: result.mistakes, finishOrder, playerWpm: result.wpm, playerPlace: place };
  const replacedRace = replayingCompletedRace && replayingCompletedRace.roundNumber === result.roundNumber ? replayingCompletedRace : null;
  if (replacedRace) {
    championship.rounds[result.roundNumber - 1] = roundResult;
    data.records = data.records.filter((record) => record.id !== replacedRace.oldRaceId);
  } else {
    championship.rounds.push(roundResult);
  }
  result.seriesStandings = championshipStandings(championship.rounds);
  if (replacedRace) updateRecordedLevelAttempt();
  updateChampionshipBaseline();
  data.activeChampionship = championship;
  data.records.unshift(result); data.records = data.records.slice(0, 100);
  if (!data.bestReplay || time < data.bestReplay.time) data.bestReplay = { playerName: result.playerName, time, wpm: result.wpm, passageId: raceSetup.passage.id, samples: raceSession.samples.map((sample) => ({ t: sample.t, p: sample.p })) };
  persist(); lastRaceResult = result;
  selectedReviewResult = reviewingCompletedLevel ? result : selectedReviewResult;
  replayingCompletedRace = null;
  renderer.draw({ racers: raceRacers, player: racePlayer, time: now, countdown: false });
  $("#finishPlaceNumber").textContent = result.place;
  $("#finishPlaceLabel").textContent = `You placed ${ordinal(result.place)}`;
  $("#finishOverlay").classList.toggle("is-perfect", result.perfect);
  $("#perfectCelebration").classList.toggle("hidden", !result.perfect);
  $("#finishOverlay").classList.remove("hidden");
  $("#raceHint").textContent = `Finished ${ordinal(result.place)} â€” race results in 4 seconds`;
  raceFinishTimer = setTimeout(() => {
    $("#finishOverlay").classList.add("hidden");
  $("#finishOverlay").classList.remove("is-perfect");
  $("#perfectCelebration").classList.add("hidden"); renderResults(result, { levelReview: reviewingCompletedLevel }); showScreen("results");
  }, 4000);
}

function renderResults(result, { historical = false, levelReview = false } = {}) {
  const roundNumber = result.roundNumber || championship?.rounds?.length || 1;
  const totalRaces = championship?.totalRaces || CHAMPIONSHIP_RACES;
  const standings = championship?.rounds?.length ? championshipStandings(championship.rounds) : (result.seriesStandings || []);
  const playerName = result.playerName || data.profile.name || "Racer";
  const level = result.level || championship?.level || progressionState().level;
  if (!historical) historicalReturnScreen = null;
  if (levelReview) { reviewingCompletedLevel = true; selectedReviewResult = result; }
  $("#resultRaceLabel").textContent = `Level ${level} - Race ${roundNumber} of ${totalRaces} complete`;
  $("#resultsTitle").textContent = `${ordinal(result.place)} Place`;
  $("#resultsSummary").textContent = `${playerName} finished this race at ${Math.round(result.wpm)} WPM with ${Math.round(result.accuracy * 100)}% accuracy.`;
  $("#perfectResultBadge").classList.toggle("hidden", !result.perfect);
  $("#resultsQuip").textContent = resultQuip(result);
  const nextPassageId = championship?.passageIds?.[roundNumber];
  const nextPassage = data.passages.find((passage) => passage.id === nextPassageId);
  const seriesComplete = levelReview || roundNumber >= totalRaces;
  const finalLevel = level >= (championship?.totalLevels || 10);
  $("#nextRaceName").textContent = seriesComplete ? (finalLevel ? "All levels are ready to review" : `Level ${level + 1} is unlocked`) : `Race ${roundNumber + 1} of 5 - ${nextPassage?.title || "Next passage"}`;
  $("#nextRaceCallout span").textContent = seriesComplete ? "Level complete" : "Up next";
  $("#nextRaceCallout").classList.toggle("podium-next", seriesComplete);
  const championshipRecords = data.records.filter((record) => record.championshipId === result.championshipId);
  $("#seriesRaceNav").innerHTML = Array.from({ length: totalRaces }, (_, index) => {
    const raceNumber = index + 1;
    const saved = championshipRecords.find((record) => record.roundNumber === raceNumber);
    return `<button class="series-race-button ${raceNumber === roundNumber ? "selected" : ""} ${saved ? "completed" : ""}" ${saved ? `data-series-result="${saved.id}"` : "disabled"}><span>Race ${raceNumber}</span><small>${saved ? ordinal(saved.place) : "Upcoming"}</small></button>`;
  }).join("");
  $("#seriesStandings").innerHTML = standings.length ? standings.map((racer, index) => `<div class="${racer.id === "player" ? "is-player" : ""}"><span>${index + 1}</span><strong>${escapeHtml(racer.name)}</strong><small>${racer.points}</small></div>`).join("") : "";
  $("#nextRaceButton").textContent = seriesComplete ? (finalLevel ? "Return to Levels" : `Go to Level ${level + 1}`) : `Start Race ${roundNumber + 1}`;
  $("#resultTime").textContent = formatTime(result.time);
  $("#resultWpm").textContent = Math.round(result.wpm); $("#resultPeak").textContent = Math.round(result.peakWpm); $("#resultAccuracy").textContent = `${Math.round(result.accuracy * 100)}%`; $("#resultErrors").textContent = result.errors;
  $("#returnFromResultsButton").classList.toggle("hidden", !historical);
  $("#returnFromResultsButton").textContent = historicalReturnScreen === "race" ? "Return to current race" : historicalReturnScreen === "results" ? "Return to latest result" : "Return to Races";
  const replay = replayUsage(level);
  $("#replayUsage").textContent = `Replays for ${replay.scope}: ${replay.used} used of ${replay.allowed} - ${replay.remaining} remaining`;
  $("#retryRaceButton").textContent = replay.remaining ? "Use 1 Replay - Retry Race" : "No Replays Remaining";
  $("#retryRaceButton").disabled = replay.remaining <= 0;
  $("#replayUsage").classList.toggle("hidden", historical);
  $("#retryRaceButton").classList.toggle("hidden", historical);
  $("#nextRaceButton").classList.toggle("hidden", historical);
  $("#viewPodiumButton").classList.toggle("hidden", historical || !seriesComplete);
  $("#resultsDashboardButton").classList.toggle("hidden", historical);
  mistakeReviewResult = result;
  mistakeScope = "race";
  renderMistakeStats(result, mistakeScope);
}

function showSeriesResult(recordId) {
  const result = data.records.find((record) => record.id === recordId);
  if (!result) return;
  if (reviewingCompletedLevel) { renderResults(result, { levelReview: true }); return; }
  if (result.id === lastRaceResult?.id) return;
  historicalReturnScreen = "results";
  renderResults(result, { historical: true });
}

function mistakesForReview(result, scope) {
  const playerName = result.playerName || data.profile.name || "Racer";
  if (scope !== "series" || !result.championshipId) return (result.mistakes || []).map((mistake) => ({ ...mistake, passageTitle: result.passageTitle, roundNumber: result.roundNumber }));
  return data.records
    .filter((record) => record.championshipId === result.championshipId && (record.playerName || playerName) === playerName)
    .sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0))
    .flatMap((record) => (record.mistakes || []).map((mistake) => ({ ...mistake, passageTitle: record.passageTitle, roundNumber: record.roundNumber })));
}

function mistakeContext(mistake, result) {
  if (mistake.context) return mistake.context;
  const passage = data.passages.find((item) => item.id === result.passageId);
  const text = passage?.text || raceSetup?.passage?.text || "";
  const start = Math.max(0, mistake.index - 18);
  const end = Math.min(text.length, mistake.index + 19);
  return `${start ? "â€¦" : ""}${text.slice(start, mistake.index)}[${mistake.expected}]${text.slice(mistake.index + 1, end)}${end < text.length ? "â€¦" : ""}`;
}

function renderMistakeStats(result, scope = "race") {
  if (!result) return;
  const playerName = result.playerName || data.profile.name || "Racer";
  const mistakes = mistakesForReview(result, scope);
  const summary = summarizeMistakes(mistakes);
  const rangeLabel = scope === "series" ? "five-race series" : "race";
  $("#mistakeStatsButton").textContent = (result.mistakes || []).length ? `Mistake Stats (${result.mistakes.length})` : "Mistake Stats (Perfect)";
  $("#mistakeSummary").textContent = mistakes.length ? `${playerName} made ${mistakes.length} incorrect keypress${mistakes.length === 1 ? "" : "es"} in this ${rangeLabel}.` : `${playerName} had a perfect ${rangeLabel} â€” every keypress matched.`;
  $$('[data-mistake-scope]').forEach((button) => button.classList.toggle("selected", button.dataset.mistakeScope === scope));
  const maxCount = summary.expected[0]?.count || 1;
  $("#mistakeChart").innerHTML = summary.expected.length ? summary.expected.slice(0, 8).map((item) => `<div class="mistake-bar"><span class="key-cap">${escapeHtml(item.label)}</span><div><i style="width:${Math.max(8, (item.count / maxCount) * 100)}%"></i></div><strong>${item.count}</strong></div>`).join("") : `<p class="mistake-empty">No missed keys to chart.</p>`;
  $("#mistakeConfusions").innerHTML = summary.confusions.length ? summary.confusions.slice(0, 10).map((item) => `<div><span>Expected <kbd>${escapeHtml(item.expected)}</kbd></span><span>Pressed <kbd>${escapeHtml(item.typed)}</kbd></span><strong>Ã—${item.count}</strong></div>`).join("") : `<p class="mistake-empty">No key confusions in this ${rangeLabel}.</p>`;
  $("#mistakeContexts").innerHTML = mistakes.length ? mistakes.slice(0, 20).map((mistake) => `<div><code>${escapeHtml(mistakeContext(mistake, result))}</code><span>Race ${mistake.roundNumber || result.roundNumber || 1} Â· ${escapeHtml(mistake.passageTitle || result.passageTitle || "Passage")} Â· pressed <kbd>${escapeHtml(keyLabel(mistake.typed))}</kbd> at ${mistake.time.toFixed(1)}s</span></div>`).join("") + (mistakes.length > 20 ? `<small>Showing the first 20 of ${mistakes.length} mistakes.</small>` : "") : `<p class="mistake-empty">Nothing to review â€” excellent accuracy.</p>`;
}

function saveDashboardProfile(event) {
  event.preventDefault();
  const name = $("#dashboardPlayerName").value.trim();
  if (!name) return;
  const previousName = data.profile.name;
  if (previousName && profileKey(previousName) !== profileKey(name)) saveActiveProfileLibrary(previousName);
  data.profile.name = name;
  if (data.profile.calibration) data.profile.calibration.playerName = name;
  loadActiveProfileLibrary(name);
  $("#dashboardName").textContent = name;
  persist();
  showDashboard();
  toast(`Player saved: ${name}`);
}
function showLastResults() {
  const result = data.records[0] || lastRaceResult;
  if (!result) { toast("Finish a race to unlock results."); return; }
  if (currentScreen === "race") {
    if (raceActive && performance.now() < raceCountdownEnd) { toast("The race is about to start."); return; }
    if (raceActive && racePausedAt === null) pauseRace(true);
    cancelAnimationFrame(raceFrame);
    historicalReturnScreen = "race";
  } else {
    historicalReturnScreen = "dashboard";
  }
  renderResults(result, { historical: true });
  showScreen("results");
}

function returnFromResults() {
  const destination = historicalReturnScreen;
  historicalReturnScreen = null;
  if (destination === "race" && raceActive) {
    showScreen("race");
    resumeRace();
    cancelAnimationFrame(raceFrame);
    raceFrame = requestAnimationFrame(updateRace);
    return;
  }
  if (destination === "results" && lastRaceResult) {
    renderResults(lastRaceResult);
    showScreen("results");
    return;
  }
  showDashboard();
}
function updateChampionshipBaseline() {
  championship.aiBaselineWpm = data.profile.calibration?.wpm || 35;
  data.activeChampionship = championship;
}

function retryRace() {
  if (!championship?.rounds.length) return;
  if (!consumeReplay(championship.level)) return;
  if (reviewingCompletedLevel && selectedReviewResult) {
    replayingCompletedRace = { roundNumber: selectedReviewResult.roundNumber, oldRaceId: selectedReviewResult.id };
    data.activeChampionship = championship;
    persist();
    startRace({ roundNumberOverride: selectedReviewResult.roundNumber });
    return;
  }
  if (championship.rounds.at(-1).raceId === lastRaceResult?.id) {
    const retriedRaceId = lastRaceResult.id;
    championship.rounds.pop();
    data.records = data.records.filter((record) => record.id !== retriedRaceId);
    lastRaceResult = data.records[0] || null;
    updateChampionshipBaseline();
  }
  data.activeChampionship = championship;
  persist();
  startRace();
}

function nextRace() {
  if (!championship) { startChampionship(); return; }
  if (championship.rounds.length >= championship.totalRaces) { continueChampionship(); return; }
  startRace();
}


function updateRecordedLevelAttempt() {
  if (!championship?.completionRecorded) return;
  const progress = progressionState();
  const attempts = progress.levelHistory[String(championship.level)] || [];
  const attempt = attempts.find((item) => item.championshipId === championship.id);
  if (!attempt) return;
  const standings = championshipStandings(championship.rounds);
  const player = standings.find((racer) => racer.id === "player");
  const playerRounds = championship.rounds.filter((round) => Number.isFinite(round.playerWpm));
  attempt.date = new Date().toISOString();
  attempt.playerPlace = standings.findIndex((racer) => racer.id === "player") + 1;
  attempt.playerPoints = player?.points || 0;
  attempt.averageWpm = playerRounds.reduce((sum, round) => sum + round.playerWpm, 0) / Math.max(1, playerRounds.length);
  progress.lastFiveAverage = attempt.averageWpm;
}

function recordLevelAttempt() {
  if (!championship || championship.completionRecorded || championship.rounds.length < championship.totalRaces) return;
  const progress = progressionState();
  const standings = championshipStandings(championship.rounds);
  const player = standings.find((racer) => racer.id === "player");
  const playerRounds = championship.rounds.filter((round) => Number.isFinite(round.playerWpm));
  const averageWpm = playerRounds.reduce((sum, round) => sum + round.playerWpm, 0) / Math.max(1, playerRounds.length);
  const key = String(championship.level);
  progress.levelHistory[key] ||= [];
  progress.levelHistory[key].push({ championshipId: championship.id, date: new Date().toISOString(), playerPlace: standings.findIndex((racer) => racer.id === "player") + 1, playerPoints: player?.points || 0, averageWpm });
  progress.lastFiveAverage = averageWpm;
  progress.unlockedLevel = Math.min(championship.totalLevels, Math.max(progress.unlockedLevel || 1, championship.level + 1));
  championship.completionRecorded = true;
  data.activeChampionship = championship;
  persist();
}

function renderPodium() {
  recordLevelAttempt();
  const standings = championshipStandings(championship?.rounds || []);
  const playerPlace = standings.findIndex((racer) => racer.id === "player") + 1;
  $("#podiumTitle").textContent = `Level ${championship.level} complete - ${ordinal(playerPlace)} overall.`;
  $(".podium-summary").textContent = championship.level >= championship.totalLevels ? "All ten five-race levels are now available from Race Control. Replay any completed level to improve its score." : `Level ${championship.level + 1} is unlocked and ready. You can continue now or return to the ten-level map.`;
  $("#podiumContinueButton").textContent = championship.level >= championship.totalLevels ? "View All Levels" : `Go to Level ${championship.level + 1}`;
  const remaining = replayRemaining(championship.level);
  $("#podiumRetryButton").textContent = `Replay Level ${championship.level} (${remaining} left)`;
  $("#podiumRetryButton").disabled = remaining <= 0;
  [1, 2, 3].forEach((place) => {
    const racer = standings[place - 1];
    const node = `[data-podium-place="${place}"]`;
    const target = $(node);
    if (!racer) { target.innerHTML = ""; return; }
    const character = renderer.character(racer.characterId);
    const image = character.animations.win?.file || character.portrait;
    target.classList.toggle("is-player", racer.id === "player");
    target.innerHTML = `<img src="${image}" alt=""><div><span>${ordinal(place)}</span><strong>${escapeHtml(racer.name)}</strong><small>${racer.points} points</small></div>`;
  });
  const podiumArt = manifest.ui?.podiumBackground;
  $("#podiumStage").style.backgroundImage = podiumArt ? `url("${podiumArt}")` : "";
  $("#podiumStage").classList.toggle("has-custom-art", Boolean(podiumArt));
  showScreen("podium");
}

function retryLevel() {
  if (!championship) return;
  const progress = progressionState();
  progress.level = championship.level;
  persist();
  showCompletedLevel(championship.level);
}

function continueChampionship() {
  if (!championship) { showDashboard(); return; }
  recordLevelAttempt();
  const progress = progressionState();
  if (championship.level >= championship.totalLevels) {
    progress.level = championship.totalLevels;
    championship = null;
    data.activeChampionship = null;
    persist();
    showDashboard();
    return;
  }
  progress.level = championship.level + 1;
  progress.unlockedLevel = Math.max(progress.unlockedLevel, progress.level);
  const nextWasCompleted = levelAttempts(progress.level).length > 0;
  championship = null;
  data.activeChampionship = null;
  persist();
  if (nextWasCompleted) showDashboard(); else startChampionship({ skipReplayCharge: true });
}
function showLibrary() { renderPassageList(); editPassage(editorPassageId || data.passages[0]?.id); showScreen("library"); }

function renderPassageList() {
  const groups = new Map();
  data.passages.forEach((item) => {
    const category = item.category || "General";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  const order = [...groups.keys()].sort((a, b) => {
    const preferred = { "Biblical Passages": 0, "Typing Basics": 1, "Typing Intermediate": 2, "Typing Advanced": 3, General: 4, "Movie Quotes": 5, Books: 6, "Lord of the Rings Quotes": 7 };
    return (preferred[a] ?? 10) - (preferred[b] ?? 10) || a.localeCompare(b);
  });
  $("#passageCategoryOptions").innerHTML = order.map((category) => `<option value="${escapeHtml(category)}"></option>`).join("");
  data.collapsedPassageSections ||= {};
  $("#passageList").innerHTML = order.map((category) => {
    const items = groups.get(category);
    const collapsed = data.collapsedPassageSections[category] === true;
    return `<section class="passage-section ${collapsed ? "collapsed" : ""}"><button class="passage-section-title" data-toggle-section="${escapeHtml(category)}" aria-expanded="${!collapsed}"><span class="section-caret">&gt;</span><span>${escapeHtml(category)}</span><span class="passage-section-count">${items.length}</span></button><div class="passage-section-items">${items.map((item) => `<div class="passage-row ${editorPassageId === item.id ? "selected" : ""}" data-edit-passage="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><small>${item.source ? `${escapeHtml(item.source)} · ` : ""}${item.text.length} chars · ${item.enabled ? "Enabled" : "Disabled"}</small><div class="row-actions"><button class="mini-button" data-use-passage="${escapeHtml(item.id)}">Use</button><button class="mini-button" data-duplicate-passage="${escapeHtml(item.id)}">Copy</button></div></div>`).join("")}</div></section>`;
  }).join("");
}

function togglePassageSection(category) {
  data.collapsedPassageSections ||= {};
  data.collapsedPassageSections[category] = !data.collapsedPassageSections[category];
  persist();
  renderPassageList();
}
function editPassage(id) {
  const passage = data.passages.find((item) => item.id === id) || { id: "", title: "", text: "", category: "General", enabled: true };
  editorPassageId = passage.id;
  $("#passageId").value = passage.id; $("#passageCategory").value = passage.category || "General"; $("#passageTitle").value = passage.title; $("#passageSource").value = passage.source || ""; $("#passageText").value = passage.text; $("#passageEnabled").checked = passage.enabled; $("#passageLength").textContent = `${passage.text.length} characters`; $("#passageError").textContent = "";
  renderPassageList();
}

function savePassage(event) {
  event.preventDefault();
  try {
    const passage = validatePassage({ id: $("#passageId").value || undefined, category: $("#passageCategory").value, title: $("#passageTitle").value, source: $("#passageSource").value, text: $("#passageText").value, enabled: $("#passageEnabled").checked });
    const index = data.passages.findIndex((item) => item.id === passage.id);
    if (index >= 0) data.passages[index] = passage; else data.passages.push(passage);
    editorPassageId = passage.id; selectedPassageId ||= passage.id; persist(); renderPassageList(); editPassage(passage.id); audio.play("save"); toast("Passage saved.");
  } catch (error) { $("#passageError").textContent = error.message; }
}

function deletePassage() {
  const id = $("#passageId").value;
  if (!id) { editPassage(data.passages[0]?.id); return; }
  if (data.passages.length === 1) { toast("Keep at least one passage in the library."); return; }
  data.passages = data.passages.filter((item) => item.id !== id);
  if (selectedPassageId === id) selectedPassageId = data.passages[0].id;
  editorPassageId = data.passages[0].id; persist(); editPassage(editorPassageId); toast("Passage deleted.");
}

function exportLibrary() {
  const blob = new Blob([exportPassages(data.passages)], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "dino-type-racer-passages.txt"; link.click(); URL.revokeObjectURL(url);
}

function applySettings() {
  const theme = THEMES.find((item) => item.id === data.settings.theme) || THEMES[0];
  data.settings.theme = theme.id;
  document.body.dataset.theme = theme.id;
  $("#themeSelect").value = theme.id;
  $("meta[name='theme-color']").content = theme.themeColor;
  document.body.classList.toggle("high-contrast", data.settings.highContrast);
  document.body.classList.toggle("reduced-motion", data.settings.reducedMotion);
  $("#contrastButton").setAttribute("aria-pressed", String(data.settings.highContrast)); $("#motionButton").setAttribute("aria-pressed", String(data.settings.reducedMotion)); $("#soundButton").setAttribute("aria-pressed", String(data.settings.muted));
  if (renderer) renderer.reducedMotion = data.settings.reducedMotion;
  if (audio) audio.setMuted(data.settings.muted);
}

function toggleSetting(key) { data.settings[key] = !data.settings[key]; persist(); applySettings(); }
function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 1800); }

function handleTypingKey(event) {
  if (!["calibration", "race"].includes(currentScreen) || event.ctrlKey || event.metaKey || event.altKey || event.target.matches("input, textarea, select")) return;
  if (event.key === "Escape" && currentScreen === "race") { event.preventDefault(); pauseRace(); return; }
  if (event.key === "Backspace") {
    event.preventDefault();
    if (currentScreen === "calibration") { calibrationSession.backspace(); renderTyping($("#calibrationTyping"), calibrationSession); }
    else if (raceActive && racePausedAt === null && performance.now() >= raceCountdownEnd) { raceSession.backspace(); renderTyping($("#raceTyping"), raceSession); }
    return;
  }
  if (event.key.length !== 1) return;
  event.preventDefault(); const now = performance.now();
  if (currentScreen === "calibration") {
    if (!calibrationDeadline) { calibrationDeadline = now + CONFIG.calibrationSeconds * 1000; $("#calibrationHint").textContent = "Stay accurate and keep moving"; }
    const correct = calibrationSession.type(event.key, now); audio.play(correct ? "key" : "error"); renderTyping($("#calibrationTyping"), calibrationSession);
  } else if (raceActive && racePausedAt === null && now >= raceCountdownEnd) {
    const correct = raceSession.type(event.key, now); audio.play(correct ? "key" : "error"); renderTyping($("#raceTyping"), raceSession);
  }
}

function bindEvents() {
  $("#profileForm").addEventListener("submit", (event) => { event.preventDefault(); const name = $("#playerName").value.trim(); if (!name) return; if (data.profile.name && profileKey(data.profile.name) !== profileKey(name)) saveActiveProfileLibrary(data.profile.name); data.profile.name = name; loadActiveProfileLibrary(name); persist(); startCalibration(); });
  $("#dashboardProfileForm").addEventListener("submit", saveDashboardProfile);
  $("#manualPaceForm").addEventListener("submit", saveManualPace);
  $("#passageForm").addEventListener("submit", savePassage);
  $("#passageText").addEventListener("input", () => $("#passageLength").textContent = `${normalizeText($("#passageText").value).length} characters`);
  $("#importFile").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { const incoming = importPassages(await file.text()); const map = new Map(data.passages.map((item) => [item.id, item])); incoming.forEach((item) => map.set(item.id, item)); data.passages = [...map.values()]; selectedPassageCategory = incoming[0].category || selectedPassageCategory; selectedPassageId = incoming[0].id; persist(); renderPassageGroupControl(); editPassage(incoming[0].id); toast(`Imported ${incoming.length} passage${incoming.length === 1 ? "" : "s"} into ${selectedPassageCategory}.`); } catch (error) { toast(error.message); } event.target.value = ""; });
  document.addEventListener("keydown", handleTypingKey);
  window.addEventListener("blur", () => { if (raceActive && racePausedAt === null) pauseRace(true); });
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "home") home();
    if (action === "library") showLibrary();
    if (action === "cancel-test") data.profile.calibration ? showDashboard() : showScreen("welcome");
    if (action === "retest") startCalibration();
    if (action === "start-race") startChampionship();
    if (action === "return-to-races") returnToRaces();
    if (action === "open-runners") $("#runnerDialog").showModal();
    if (action === "close-runners") $("#runnerDialog").close();
    if (action === "pause") pauseRace();
    if (action === "resume") resumeRace();
    if (action === "restart-race") startRace();
    if (action === "debug-finish-first") debugFinishRaceFirst();
    if (action === "dashboard") showDashboard();
    if (action === "retry-race") retryRace();
    if (action === "next-race") nextRace();
    if (action === "view-podium") renderPodium();
    if (action === "last-results") showLastResults();
    if (action === "return-from-results") returnFromResults();
    if (action === "open-mistakes") { renderMistakeStats(mistakeReviewResult || lastRaceResult, mistakeScope); $("#mistakeDialog").showModal(); }
    if (action === "close-mistakes") $("#mistakeDialog").close();
    if (action === "continue-championship") continueChampionship();
    if (action === "retry-level") retryLevel();
    if (action === "new-passage") editPassage("");
    if (action === "export-passages") exportLibrary();
    if (action === "delete-passage") deletePassage();
    if (action === "preview-passage") { $("#previewTitle").textContent = $("#passageTitle").value || "Untitled passage"; $("#previewText").textContent = normalizeText($("#passageText").value) || "Nothing to preview yet."; $("#previewDialog").showModal(); }
    if (action === "close-preview") $("#previewDialog").close();
    const level = Number(event.target.closest("[data-level]")?.dataset.level); if (level) selectChampionshipLevel(level);
    const seriesResult = event.target.closest("[data-series-result]")?.dataset.seriesResult; if (seriesResult) showSeriesResult(seriesResult);
    const character = event.target.closest("[data-character]")?.dataset.character; if (character) { data.profile.characterId = character; persist(); renderCharacters(); if ($("#runnerDialog").open) $("#runnerDialog").close(); toast(`Runner selected: ${manifest.characters.find((item) => item.id === character)?.displayName || character}.`); }
    const passageOrder = event.target.closest("[data-passage-order]")?.dataset.passageOrder; if (passageOrder) selectPassageOrder(passageOrder);
    const toggleSection = event.target.closest("[data-toggle-section]")?.dataset.toggleSection; if (toggleSection) togglePassageSection(toggleSection);
    const edit = event.target.closest("[data-edit-passage]")?.dataset.editPassage; if (edit && !event.target.closest("button")) editPassage(edit);
    const calibrationChoice = event.target.closest("[data-calibration-mode]")?.dataset.calibrationMode; if (calibrationChoice) selectCalibrationMode(calibrationChoice);
    const scope = event.target.closest("[data-mistake-scope]")?.dataset.mistakeScope; if (scope) { mistakeScope = scope; renderMistakeStats(mistakeReviewResult, mistakeScope); }
    const use = event.target.closest("[data-use-passage]")?.dataset.usePassage; if (use) { const passage = data.passages.find((item) => item.id === use); selectedPassageId = use; if (passage?.category) selectedPassageCategory = passage.category; persist(); toast("Race passage selected."); renderPassageList(); }
    const duplicate = event.target.closest("[data-duplicate-passage]")?.dataset.duplicatePassage; if (duplicate) { const source = data.passages.find((item) => item.id === duplicate); const copy = { ...source, id: `passage-${Date.now()}`, title: `${source.title} Copy` }; data.passages.push(copy); persist(); editPassage(copy.id); toast("Passage duplicated."); }
  });
  $("#replayLimit").addEventListener("change", saveReplayRules);
  $("#replayGlobal").addEventListener("change", saveReplayRules);
  $("#aiPaceSlider").addEventListener("input", (event) => setAiPace(event.target.value));
  $("#aiPaceSlider").addEventListener("change", (event) => setAiPace(event.target.value, true));
  $("#contrastButton").addEventListener("click", () => toggleSetting("highContrast"));
  $("#motionButton").addEventListener("click", () => toggleSetting("reducedMotion"));
  $("#soundButton").addEventListener("click", () => toggleSetting("muted"));
  $("#passageGroupSelect").addEventListener("change", (event) => selectPassageCategory(event.target.value));
  $("#focusKeyHelperSelect").addEventListener("change", (event) => { data.settings.focusKeyHelper = event.target.value !== "disabled"; persist(); renderAiPaceControl(); toast(`Missed-key helper ${data.settings.focusKeyHelper ? "enabled" : "disabled"}.`); });
  $("#themeSelect").addEventListener("change", (event) => {
    data.settings.theme = event.target.value;
    persist();
    applySettings();
    toast(`Color scheme: ${THEMES.find((theme) => theme.id === data.settings.theme)?.name || "Default"}.`);
  });
}

init().catch((error) => { console.error(error); document.body.innerHTML = `<main class="fatal"><h1>Dino Type Racer could not start.</h1><p>${escapeHtml(error.message)}</p></main>`; });
