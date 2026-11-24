import { CONFIG, THEMES, STARTER_PASSAGES } from "./config.js";
import { loadState, saveState } from "./storage.js";
import { bindBrowserTransfer } from "./transfer-ui.js";
import { bindClassroom } from "./classroom.js";
import { bindHelp } from "./help.js";
import { clearFireworks, fireworksMotionReduced, playFireworks, prepareFireworksAudio } from "./victory-fireworks.js";
import { choosePassage, exportPassages, importNumberedInspiredPassages, importPassages, normalizeText, validatePassage } from "./passages.js";
import { TypingSession, ordinal } from "./typing.js";
import { CHALLENGE_PASSAGE, CHALLENGE_SECONDS, CHALLENGE_STORIES, formatChallengeAccuracy, makeChallengeTrackPicker, takeChallengeStory, TimedChallenge } from "./timed-challenge.js";
import { challengeNickname, checkChallengeNickname, fetchChallengeBoard, isChallengeToken, postChallengeScore, recordChallengePlay } from "./challenge-scores.js";
import { calculatePlace, createAiRacers, createChallengeRivals, updateAi, updateChallengeRivals, validRivalWpm } from "./ai.js";
import { GameAudio } from "./audio.js";
import { CHAMPIONSHIP_RACES, championshipStandings, highestSelectableLevel, rankRace } from "./championship.js";
import { RaceRenderer } from "./renderer.js";
import { keyLabel, summarizeMistakes } from "./mistakes.js";
import { resultQuip } from "./quips.js";
import { adjustedAiBaseline, aiPaceLabel, clampAiPace, projectedAiRange } from "./difficulty.js";
import { focusKeysForRace, normalizedFocusKey } from "./focus-keys.js";
import { blankLevel, createCampaign, duplicateCampaign, exportCampaign, importCampaign, validateCampaign } from "./campaigns.js";
import { activeNemeses, buildBossPassage, buildNemeses, typingDna, updateNemesisMastery } from "./nemesis.js";
import { CUSTOM_RACER_ANCHOR, customRacerId, customRacerManifest, deleteCustomRacerAsset, loadCustomRacerAsset, renderCustomRacer, saveCustomRacerAsset, validateRacerFile } from "./custom-racers.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const averageWpm = (records) => { const wpms = records.map((record) => Number(record.wpm)).filter(Number.isFinite); return wpms.length ? wpms.reduce((sum, wpm) => sum + wpm, 0) / wpms.length : 0; };
const screens = Object.fromEntries($$(".screen").map((node) => [node.id.replace("Screen", ""), node]));
const deviceMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

let data = loadState();
let manifest;
let renderer;
let audio;
let currentScreen = "welcome";
let calibrationSession = null;
let calibrationDeadline = null;
let calibrationPausedAt = null;
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
let displayedPodiumPlace = null;
let historicalReturnScreen = null;
let mistakeReviewResult = null;
let mistakeScope = "race";
let raceFinishTimer = null;
let latestChallengeScore = null;
const challengeBoardRequests = new Map();
const nextChallengeTrack = makeChallengeTrackPicker();
const nextChallengeRacer = makeChallengeTrackPicker({ key: "dino:challenge-racer-cycle:v1" });
let challengePreviewRacer = null;
function upcomingChallengeRacer() {
  const roster = manifest.characters.filter(c => !c.custom);
  if (!challengePreviewRacer) {
    const id = nextChallengeRacer(roster);
    challengePreviewRacer = roster.find(c => c.id === id);
  }
  return challengePreviewRacer;
}
function challengeRivalPace() {
  return validRivalWpm(data.profile.challengeRivalWpm) ? Number(data.profile.challengeRivalWpm) : 40;
}
let championship = data.activeChampionship || null;
let reviewingCompletedLevel = false;
let selectedReviewResult = null;
let replayingCompletedRace = null;
let applyingHistoryState = false;
let helpReturnScreen = null;
let previewCharacterId = data.profile.characterId;
let selectedCampaignId = data.campaigns?.[0]?.id || null;
let campaignLevelIndex = 0;
let customRacerSource = null;
let customRacerCanvas = null;
let customRacerGuideImage = null;
const customRacerObjectUrls = new Map();
const challengeOwnerTokens = new Map();

async function init() {
  const startInHelp = screenFromHash() === "help";
  const startInChallenge = screenFromHash() === "challenge";
  manifest = await fetch("assets/manifest.json").then((response) => response.json());
  await installBundledPassages();
  ensureStarterCampaign();
  renderer = new RaceRenderer($("#raceCanvas"), manifest);
  await renderer.load();
  await hydrateCustomRacer();
  audio = new GameAudio({ keyNoise: data.settings.keyNoise, musicEnabled: data.settings.musicEnabled, musicElement: $("#musicTrack") });
  const perfectAsset = manifest.ui?.perfectCelebration;
  if (perfectAsset) $("#perfectCelebration").src = perfectAsset;
  $$('[data-game-title]').forEach((node) => node.textContent = CONFIG.title);
  renderThemeOptions();
  applySettings();
  bindEvents();
  renderCharacters();
  renderPassageList();
  if (startInHelp) showHelp({ historyMode: "replace", from: null });
  else if (startInChallenge && data.profile.name) showChallengeLobby({ historyMode: "replace" });
  else showDashboard({ historyMode: "replace" });
  $("#helpButton").disabled = false;
}
async function installBundledPassages() {
  if ((data.libraryVersion || 0) >= 7) { normalizeBuiltInPassageData(); loadActiveProfileLibrary(); return; }
  const [bibleResponse, harryPotterResponse] = await Promise.all([
    fetch("assets/passages/biblical-passages.txt"),
    fetch("assets/passages/harry-potter-inspired.txt"),
  ]);
  if (!bibleResponse.ok) throw new Error("The bundled Biblical Passages could not be loaded.");
  if (!harryPotterResponse.ok) throw new Error("The bundled Harry Potter-inspired passages could not be loaded.");
  const incoming = [
    ...STARTER_PASSAGES,
    ...importPassages(await bibleResponse.text()),
    ...importNumberedInspiredPassages(await harryPotterResponse.text(), { category: "Harry Potter-Inspired", idPrefix: "harry-potter" }),
  ];
  const withoutOldMovieQuotes = (items) => (items || []).filter((item) => !["Movie Quotes", "Movie-Style Quotes"].includes(item.category));
  data.passages = withoutOldMovieQuotes(data.passages);
  Object.values(data.profileLibraries || {}).forEach((library) => {
    if (Array.isArray(library.passages)) library.passages = withoutOldMovieQuotes(library.passages);
  });
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
  data.libraryVersion = 7;
  if (!data.selectedPassageCategory) selectedPassageCategory = "Biblical Passages";
  loadActiveProfileLibrary();
  persist();
}
function normalizeBuiltInPassageData() {
  const normalize = (passage) => {
    if (!passage) return passage;
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
    if (["Movie Quotes", "Movie-Style Quotes"].includes(library.selectedPassageCategory)) library.selectedPassageCategory = "Harry Potter-Inspired";
  });
  if (["Movie Quotes", "Movie-Style Quotes"].includes(selectedPassageCategory)) selectedPassageCategory = "Harry Potter-Inspired";
  if (["Movie Quotes", "Movie-Style Quotes"].includes(data.selectedPassageCategory)) data.selectedPassageCategory = "Harry Potter-Inspired";
}
function profileKey(name = data.profile.name) {
  return String(name || "guest").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
}

function customRacerEntries(key = profileKey()) {
  const stored = data.customRacersByProfile?.[key];
  if (Array.isArray(stored)) return stored.filter((racer) => racer?.name);
  if (stored?.name) return [{ ...stored, id: "legacy", assetKey: key }];
  return [];
}

function customRacerAssetKey(key, racerId) {
  return racerId === "legacy" ? key : `${key}:${racerId}`;
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

function setActiveProfileName(name) {
  const key = profileKey(name);
  if (key !== profileKey()) {
    data.profile.challengeTypingMode = data.playerProfiles?.[key]?.profile?.challengeTypingMode === "flow" ? "flow" : "strict";
    const saved = data.playerProfiles?.[key]?.profile;
    data.profile.challengeLobbySeen = saved?.challengeLobbySeen === true;
    data.profile.challengeRivalWpm = validRivalWpm(saved?.challengeRivalWpm) ? Number(saved.challengeRivalWpm) : 40;
    data.profile.rotateChallengeStories = saved?.rotateChallengeStories === true;
    data.profile.challengeStoryCycle = [...(Array.isArray(saved?.challengeStoryCycle) ? saved.challengeStoryCycle : [])];
  }
  data.profile.name = name;
}

function profileSnapshot(name = data.profile.name) {
  return {
    profile: { ...data.profile, name },
    records: structuredClone(data.records || []),
    bestReplay: data.bestReplay ? structuredClone(data.bestReplay) : null,
    activeChampionship: data.activeChampionship ? structuredClone(data.activeChampionship) : null,
    progression: data.progression ? structuredClone(data.progression) : null,
    progressionByCategory: structuredClone(data.progressionByCategory || {}),
    selectedPassageId,
    selectedPassageCategory,
  };
}

function saveActivePlayerProfile(name = data.profile.name) {
  if (!String(name || "").trim()) return;
  data.playerProfiles ||= {};
  data.playerProfiles[profileKey(name)] = profileSnapshot(name);
}

function loadPlayerProfile(name) {
  const requestedName = String(name || "").trim();
  if (!requestedName) return false;
  data.playerProfiles ||= {};
  if (data.profile.name) saveActivePlayerProfile(data.profile.name);
  const saved = data.playerProfiles[profileKey(requestedName)];
  if (!saved) return false;
  data.profile = { characterId: "nova", calibration: null, challengeTypingMode: "strict", ...(saved.profile || {}), name: requestedName };
  data.records = Array.isArray(saved.records) ? structuredClone(saved.records) : [];
  data.bestReplay = saved.bestReplay ? structuredClone(saved.bestReplay) : null;
  data.progressionByCategory = saved.progressionByCategory ? structuredClone(saved.progressionByCategory) : {};
  data.progression = saved.progression ? structuredClone(saved.progression) : undefined;
  data.activeChampionship = saved.activeChampionship ? structuredClone(saved.activeChampionship) : null;
  championship = data.activeChampionship;
  selectedPassageId = saved.selectedPassageId || data.selectedPassageId || data.passages[0]?.id;
  selectedPassageCategory = saved.selectedPassageCategory || data.selectedPassageCategory || "Biblical Passages";
  loadActiveProfileLibrary(requestedName);
  lastRaceResult = data.records[0] || null;
  reviewingCompletedLevel = false;
  selectedReviewResult = null;
  replayingCompletedRace = null;
  return true;
}

function persist() {
  data.selectedPassageId = selectedPassageId;
  data.selectedPassageCategory = selectedPassageCategory;
  saveActiveProfileLibrary();
  saveActivePlayerProfile();
  saveState(data);
}

function campaignAssets() {
  return { passages: data.passages.map((item) => item.id), tracks: manifest.tracks.map((item) => item.id), racers: manifest.characters.map((item) => item.id) };
}
function ensureStarterCampaign() {
  data.campaigns ||= [];
  if (!data.campaigns.length) {
    const passages = data.passages.filter((item) => item.enabled).slice(0, 5);
    const campaign = createCampaign({
      id: "lost-keys-thunder-valley", title: "The Lost Keys of Thunder Valley", ageRange: "8+",
      learningGoal: "Turn recurring mistakes into mastered typing skills",
      description: "Thunder Valley's typing stones were scattered by mischievous Nemesis dinosaurs. Race across wild tracks, master troublesome keys, and recover every stone before Spellosaurus Wrecks rewrites the signs with spectacularly bad spelling.",
      intro: "A tremendous crash shakes the Typing Lodge. Glowing letters tumble across the valley while dinosaurs sprint away with pieces of the Golden Keyboard.",
      victory: "Thunder Valley is typing clearly again! Your speed reached the finish, and your accuracy turned every Nemesis into an ally.",
      levels: [{ ...blankLevel(0), title: "The Stolen Home Row", rewards: { racers: [], tracks: [], trophies: ["Golden Keyboard Stone"], badges: ["Nemesis Tamer"] }, races: blankLevel(0).races.map((race, index) => ({ ...race, id: `thunder-race-${index + 1}`, title: index === 4 ? "Boss: Spellosaurus Wrecks" : `Trail Race ${index + 1}`, passageId: passages[index]?.id || passages[0]?.id || "", trackId: manifest.tracks[index % manifest.tracks.length]?.id || "", racerId: manifest.characters[(index + 1) % manifest.characters.length]?.id || "", bossDialogue: index === 4 ? "Welcome to the final spelling bee! I ate the bee, misplaced the dictionary, and declared myself champeen!" : "", boss: index === 4 })) }],
    });
    data.campaigns.push(campaign); selectedCampaignId = campaign.id; persist();
  }
  selectedCampaignId ||= data.campaigns[0]?.id;
}
function selectedCampaign() { return data.campaigns.find((item) => item.id === selectedCampaignId) || data.campaigns[0] || null; }
function showCreator() { renderCreator(); showScreen("creator"); }
function renderCreator() {
  const unlocked = Boolean(data.entitlements?.creator);
  $("#creatorLocked").classList.toggle("hidden", unlocked); $("#creatorWorkspace").classList.toggle("hidden", !unlocked);
  if (!unlocked) return;
  const campaign = selectedCampaign();
  $("#campaignList").innerHTML = data.campaigns.map((item) => `<button type="button" class="campaign-list-item ${item.id === campaign?.id ? "selected" : ""}" data-campaign-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><small>${item.levels.length} level${item.levels.length === 1 ? "" : "s"} · ${item.enabled === false ? "Disabled" : "Enabled"}</small></button>`).join("");
  if (!campaign) return;
  campaignLevelIndex = Math.max(0, Math.min(campaignLevelIndex, campaign.levels.length - 1));
  const level = campaign.levels[campaignLevelIndex];
  $("#campaignId").value = campaign.id; $("#campaignTitle").value = campaign.title; $("#campaignAge").value = campaign.ageRange || ""; $("#campaignDescription").value = campaign.description || ""; $("#campaignGoal").value = campaign.learningGoal || ""; $("#campaignIntro").value = campaign.intro || ""; $("#campaignVictory").value = campaign.victory || "";
  $("#campaignLevelLabel").textContent = `Level ${campaignLevelIndex + 1} of ${campaign.levels.length}`; $("#campaignLevelTitle").value = level.title || ""; $("#campaignRewards").value = [...(level.rewards?.trophies || []), ...(level.rewards?.badges || [])].join(", ");
  const passageOptions = data.passages.filter(item => item.enabled).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
  const trackOptions = manifest.tracks.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.displayName)}</option>`).join("");
  const racerOptions = manifest.characters.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.displayName)}</option>`).join("");
  $("#campaignRaceEditor").innerHTML = level.races.map((race, index) => `<section class="campaign-race-card ${race.boss ? "is-boss" : ""}" data-campaign-race="${index}"><strong>${race.boss ? "Boss " : ""}Race ${index + 1}</strong><label>Title<input data-race-field="title" value="${escapeHtml(race.title)}"></label><label>Passage<select data-race-field="passageId"><option value="">Fallback passage</option>${passageOptions}</select></label><label>Track<select data-race-field="trackId"><option value="">Automatic track</option>${trackOptions}</select></label><label>Rival<select data-race-field="racerId"><option value="">Automatic rival</option>${racerOptions}</select></label><label>Rival pace<input data-race-field="difficulty" type="number" min="0.5" max="1.5" step="0.05" value="${escapeHtml(race.difficulty)}"></label><label>Accuracy goal<input data-race-field="requiredAccuracy" type="number" min="50" max="100" value="${Math.round(race.requiredAccuracy * 100)}"></label><label>Intro<input data-race-field="intro" value="${escapeHtml(race.intro || "")}"></label><label>Victory<input data-race-field="victory" value="${escapeHtml(race.victory || "")}"></label><label>Boss dialogue<textarea data-race-field="bossDialogue" rows="2">${escapeHtml(race.bossDialogue || "")}</textarea></label><label class="check-label"><input data-race-field="enabled" type="checkbox" ${race.enabled === false ? "" : "checked"}> Enabled</label></section>`).join("");
  level.races.forEach((race,index) => { const card = $(`[data-campaign-race="${index}"]`); card.querySelector('[data-race-field="passageId"]').value = race.passageId || ""; card.querySelector('[data-race-field="trackId"]').value = race.trackId || ""; card.querySelector('[data-race-field="racerId"]').value = race.racerId || ""; });
}
function readCampaignEditor() {
  const campaign = structuredClone(selectedCampaign()); if (!campaign) return null; const level = campaign.levels[campaignLevelIndex];
  campaign.title = $("#campaignTitle").value; campaign.ageRange = $("#campaignAge").value; campaign.description = $("#campaignDescription").value; campaign.learningGoal = $("#campaignGoal").value; campaign.intro = $("#campaignIntro").value; campaign.victory = $("#campaignVictory").value; level.title = $("#campaignLevelTitle").value;
  const rewards = $("#campaignRewards").value.split(",").map(item=>item.trim()).filter(Boolean); level.rewards = { ...level.rewards, trophies: rewards };
  $$('[data-campaign-race]').forEach(card => { const race = level.races[Number(card.dataset.campaignRace)]; $$('[data-race-field]', card).forEach(field => { const key = field.dataset.raceField; race[key] = key === "enabled" ? field.checked : key === "difficulty" ? Number(field.value) : key === "requiredAccuracy" ? Number(field.value)/100 : field.value; }); });
  return validateCampaign(campaign, campaignAssets());
}
function saveCampaignEditor(event) { event?.preventDefault(); try { const campaign = readCampaignEditor(); const index = data.campaigns.findIndex(item=>item.id===campaign.id); data.campaigns[index] = campaign; $("#campaignError").textContent = ""; persist(); renderCreator(); toast("Campaign saved locally."); return campaign; } catch(error) { $("#campaignError").textContent = error.message; return null; } }
function campaignPassage(id) { return championship?.campaignPassages?.[id] || data.passages.find(item=>item.id===id); }
function testCampaign(campaignToPlay = null) {
  const campaign = campaignToPlay || saveCampaignEditor(); if (!campaign) return; const level = campaign.levels[campaignLevelIndex]; const nemeses = data.nemesesByProfile?.[profileKey()] || buildNemeses(data.records.filter(r=>r.playerName===data.profile.name)); const campaignPassages = {};
  const races = level.races.filter(r=>r.enabled !== false); if (races.length !== 5) { toast("Test play needs all five races enabled."); return; }
  races.forEach((race,index) => { const base = data.passages.find(item=>item.id===race.passageId) || data.passages.find(item=>item.enabled); const id = `${campaign.id}-${level.id}-${race.id}`; campaignPassages[id] = { ...base, id, title: race.title, text: race.boss ? buildBossPassage(base.text, nemeses) : base.text, source: campaign.title }; });
  championship = { id:`campaign-${campaign.id}-${Date.now()}`, campaignId:campaign.id, campaignLevelId:level.id, level:campaignLevelIndex+1, totalLevels:campaign.levels.length, totalRaces:5, mode:"adaptive", difficulty:"normal", passageIds:Object.keys(campaignPassages), campaignPassages, trackIds:races.map((race,index)=>race.trackId || manifest.tracks[index%manifest.tracks.length].id), aiBaselineWpm:data.profile.calibration?.wpm || 35, rounds:[] };
  data.activeChampionship = championship; persist(); startRace();
}
function playActiveCampaign() {
  const key = profileKey(); selectedCampaignId = data.activeCampaignIdByProfile?.[key] || selectedCampaignId;
  const campaign = selectedCampaign(); if (!campaign) { toast("Create a campaign first."); return; }
  campaignLevelIndex = Math.max(0, Math.min(campaignLevelIndex, campaign.levels.length - 1)); testCampaign(campaign);
}
async function hydrateCustomRacer() {
  const key = profileKey();
  manifest.characters = manifest.characters.filter((item) => !item.custom);
  customRacerObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  customRacerObjectUrls.clear();
  for (const metadata of customRacerEntries(key)) {
    try {
      const assetKey = metadata.assetKey || customRacerAssetKey(key, metadata.id);
      const blob = await loadCustomRacerAsset(assetKey);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      const racerKey = metadata.id === "legacy" ? "" : metadata.id;
      customRacerObjectUrls.set(assetKey, url);
      manifest.characters.push(customRacerManifest(key, metadata.name, url, racerKey));
      await renderer?.loadImage(url);
    } catch { /* Private sessions may block IndexedDB. */ }
  }
}
function drawWorkshopGuides(canvas) {
  const context = canvas.getContext("2d");
  context.save();
  if (customRacerGuideImage?.complete && customRacerGuideImage.naturalWidth) {
    context.globalAlpha = .16;
    context.drawImage(customRacerGuideImage, 0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
  }
  context.strokeStyle = "rgba(249,87,56,.9)"; context.lineWidth = 5; context.setLineDash([18,12]); context.beginPath(); context.moveTo(CUSTOM_RACER_ANCHOR.x-60,CUSTOM_RACER_ANCHOR.y); context.lineTo(CUSTOM_RACER_ANCHOR.x+60,CUSTOM_RACER_ANCHOR.y); context.moveTo(CUSTOM_RACER_ANCHOR.x,CUSTOM_RACER_ANCHOR.y-60); context.lineTo(CUSTOM_RACER_ANCHOR.x,CUSTOM_RACER_ANCHOR.y+60); context.stroke(); context.restore();
}
async function prepareCustomRacerGuide() {
  const guide = manifest.characters.find((item) => !item.custom && /raptor|nova|moss/i.test(`${item.id} ${item.displayName}`)) || manifest.characters.find((item) => !item.custom);
  if (!guide?.portrait) return;
  $("#defaultRacerGuide").src = guide.portrait;
  if (customRacerGuideImage?.src === new URL(guide.portrait, location.href).href && customRacerGuideImage.complete) return;
  customRacerGuideImage = new Image();
  await new Promise((resolve) => { customRacerGuideImage.onload = resolve; customRacerGuideImage.onerror = resolve; customRacerGuideImage.src = guide.portrait; });
}
function resetCustomRacerWorkshop() {
  customRacerSource = null; customRacerCanvas = null;
  $("#customRacerFile").value = "";
  $("#customRacerName").value = `${data.profile.name || "My"}'s Racer ${customRacerEntries().length + 1}`;
  $("#customRacerMode").value = "alpha"; $("#customRacerTolerance").value = 70; $("#customRacerScale").value = 100; $("#customRacerOffsetX").value = 0; $("#customRacerOffsetY").value = 0;
  const canvas = $("#customRacerCanvas"), context = canvas.getContext("2d"); context.clearRect(0,0,canvas.width,canvas.height); drawWorkshopGuides(canvas);
  $("#customRacerTrackPreview").removeAttribute("src"); $("#customRacerError").textContent = "";
}
async function renderRacerWorkshopPreview() {
  if (!customRacerSource) return;
  customRacerCanvas = await renderCustomRacer({ image:customRacerSource, mode:$("#customRacerMode").value, tolerance:$("#customRacerTolerance").value, scale:Number($("#customRacerScale").value)/100, offsetX:$("#customRacerOffsetX").value, offsetY:$("#customRacerOffsetY").value });
  const visible=$("#customRacerCanvas"), context=visible.getContext("2d"); context.clearRect(0,0,1024,1024); context.drawImage(customRacerCanvas,0,0); drawWorkshopGuides(visible); $("#customRacerTrackPreview").src=customRacerCanvas.toDataURL("image/png");
}
async function showRacerWorkshop() {
  if (!data.entitlements?.creator) { data.entitlements ||= {}; data.entitlements.creator=true; persist(); toast("Creator preview enabled on this browser."); }
  await prepareCustomRacerGuide(); resetCustomRacerWorkshop(); renderSavedCustomRacers(); showScreen("racerWorkshop");
}
async function loadRacerArtwork(file) {
  const error=validateRacerFile(file); $("#customRacerError").textContent=error; if(error)return;
  const url=URL.createObjectURL(file), image=new Image(); image.onload=async()=>{customRacerSource=image;await renderRacerWorkshopPreview();URL.revokeObjectURL(url);}; image.onerror=()=>{$("#customRacerError").textContent="That image could not be opened.";URL.revokeObjectURL(url);}; image.src=url;
}
async function saveCustomRacer({ addAnother = false } = {}) {
  if(!customRacerCanvas){toast("Choose artwork before saving your Racer.");return;}
  const blob=await new Promise(resolve=>customRacerCanvas.toBlob(resolve,"image/png")), key=profileKey(), id=`racer-${Date.now().toString(36)}`, assetKey=customRacerAssetKey(key,id); await saveCustomRacerAsset(assetKey,blob);
  const racers=customRacerEntries(key).map((racer)=>({ ...racer, assetKey:racer.assetKey || customRacerAssetKey(key,racer.id) }));
  const metadata={id,assetKey,name:$("#customRacerName").value.trim()||"My Racer",width:1024,height:1024,anchor:CUSTOM_RACER_ANCHOR,updatedAt:new Date().toISOString()};
  racers.push(metadata); data.customRacersByProfile ||= {}; data.customRacersByProfile[key]=racers; data.profile.characterId=customRacerId(key,id); persist(); await hydrateCustomRacer(); renderCharacters(); renderCreatorStudio(); renderSavedCustomRacers();
  if(addAnother){toast(`${metadata.name} saved. Add the next Racer.`);resetCustomRacerWorkshop();return;}
  toast(`${metadata.name} saved and selected.`); showDashboard();
}
function renderSavedCustomRacers() {
  const key=profileKey(), racers=customRacerEntries(key);
  $("#savedCustomRacerList").innerHTML=racers.length?racers.map((racer)=>{
    const racerKey=racer.id==="legacy"?"":racer.id, characterId=customRacerId(key,racerKey), character=manifest.characters.find((item)=>item.id===characterId), selected=data.profile.characterId===characterId;
    return `<article class="saved-racer-card"><img src="${escapeHtml(character?.portrait||"")}" alt=""><div><strong>${escapeHtml(racer.name)}</strong><small>${selected?"Currently selected":"Saved on this browser"}</small></div><button class="danger compact" type="button" data-action="delete-custom-racer" data-racer-id="${escapeHtml(racer.id)}">Delete</button></article>`;
  }).join(""):`<p class="saved-racer-empty">No custom Racers saved yet.</p>`;
}
async function deleteSavedCustomRacer(racerId) {
  const key=profileKey(), racers=customRacerEntries(key), racer=racers.find((item)=>item.id===racerId); if(!racer)return;
  if(!window.confirm(`Delete ${racer.name}? This removes the Racer artwork from this browser.`))return;
  const racerKey=racer.id==="legacy"?"":racer.id, characterId=customRacerId(key,racerKey), assetKey=racer.assetKey||customRacerAssetKey(key,racer.id);
  try{await deleteCustomRacerAsset(assetKey);}catch{/* Metadata still needs to be removable when IndexedDB is unavailable. */}
  data.customRacersByProfile[key]=racers.filter((item)=>item.id!==racerId);
  if(data.profile.characterId===characterId)data.profile.characterId="nova";
  persist(); await hydrateCustomRacer(); renderCharacters(); renderCreatorStudio(); renderSavedCustomRacers(); toast(`${racer.name} deleted.`);
}
function renderCreatorStudio() {
  const key=profileKey(), activeId=data.activeCampaignIdByProfile?.[key], campaign=data.campaigns.find(item=>item.id===activeId)||data.campaigns[0];
  $("#activeCampaignSummary").textContent=campaign?`${campaign.title} · ${campaign.levels.length} level${campaign.levels.length===1?"":"s"}`:"Build a 50-race adventure";
  const customRacers=customRacerEntries(key); $("#customRacerSummary").textContent=customRacers.length?`${customRacers.length} custom Racer${customRacers.length===1?"":"s"} ready`:"Upload family artwork";
  const nemeses=activeNemeses(data.nemesesByProfile?.[key]||[]); $("#nemesisSummary").textContent=nemeses.length?`${nemeses.length} active Nemesis challenge${nemeses.length===1?"":"s"}`:"See strengths and Nemeses";
  const profiles=savedPlayerProfiles(); $("#familyProfileSummary").textContent=profiles.length?`${profiles.length} learner profile${profiles.length===1?"":"s"} on this browser`:"Switch local learners";
}
function renderTypingDna() {
  const records = data.records.filter(record => (record.playerName || data.profile.name) === data.profile.name); const key = profileKey(); data.nemesesByProfile ||= {}; data.nemesesByProfile[key] ||= buildNemeses(records); const dna = typingDna(records, data.nemesesByProfile[key]);
  $("#typingDnaReport").innerHTML = `<div class="dna-overview"><div class="dna-stat"><strong>${dna.races}</strong><span>races analyzed</span></div><div class="dna-stat"><strong>${Math.round(dna.averageWpm)}</strong><span>average WPM</span></div><div class="dna-stat"><strong>${Math.round(dna.averageAccuracy*100)}%</strong><span>accuracy</span></div></div><h4>Current Nemeses</h4><div class="dna-grid">${dna.active.length ? dna.active.map(n=>`<article class="nemesis-card"><strong>${escapeHtml(n.name)}</strong><p>${escapeHtml(n.personality)}</p><div class="nemesis-meter"><span style="width:${Math.min(100, Math.max(0, Number(n.strength) || 0))}%"></span></div><small>${escapeHtml(n.cleanWins)}/3 clean encounters · ${escapeHtml(n.misses)} misses</small></article>`).join("") : "<p>No active Nemeses. Clean keyboard, clever racer!</p>"}</div><h4>Mastered allies</h4><p>${dna.mastered.map(n=>escapeHtml(n.name)).join(", ") || "Master a Nemesis with three clean encounters to recruit it."}</p><h4>Correction timeline</h4><div class="dna-grid">${records.slice(0,12).map(r=>`<div class="dna-stat"><strong>${Math.round(r.wpm)} WPM</strong><span>${escapeHtml(r.passageTitle || "Race")} · ${escapeHtml(r.errors||0)} corrections</span></div>`).join("")}</div>`;
  persist(); $("#typingDnaDialog").showModal();
}

function renderThemeOptions() {
  $("#themeSelect").innerHTML = THEMES.map((theme) => `<option value="${theme.id}">${theme.name}</option>`).join("");
}

function screenHash(name) {
  return name === "dashboard" ? "ready" : name;
}

function screenFromHash() {
  const value = window.location.hash.replace(/^#/, "");
  if (value === "ready") return "dashboard";
  return screens[value] ? value : null;
}

function pushScreenHistory(name, mode = "push") {
  if (applyingHistoryState || mode === "none") return;
  const url = new URL(window.location.href);
  url.hash = screenHash(name);
  const state = { screen: name };
  if (name === "help" && helpReturnScreen) state.helpFrom = helpReturnScreen;
  if (mode === "replace" || !history.state?.screen) history.replaceState(state, "", url);
  else history.pushState(state, "", url);
}

function renderGlobalNavigation() {
  const hasFinish = Boolean(lastRaceResult || data.records[0]);
  $$('[data-action="finish-screen"]').forEach((button) => {
    button.disabled = !hasFinish;
    button.title = hasFinish ? "Open the latest finish screen" : "Finish a race to unlock this";
  });
}

function screenTitle(name) {
  if (name === "dashboard") return `${CONFIG.title} — Free Dinosaur Typing Race Game`;
  return `${CONFIG.title} - ${name[0].toUpperCase()}${name.slice(1)}`;
}

function showScreen(name, { historyMode = "push" } = {}) {
  const enteringPodium = name === "podium" && currentScreen !== name;
  if (currentScreen !== name) {
    if (currentScreen === "podium") clearFireworks($("#podiumStage"));
    if (currentScreen === "race") {
      clearFireworks($("#finishOverlay"));
      clearFireworks($("#quickResultOverlay"));
    }
  }
  if (currentScreen === "calibration" && name !== "calibration" && calibrationSession?.endTime === null) calibrationPausedAt ??= performance.now();
  if (name === "calibration" && calibrationPausedAt !== null) {
    const pausedFor = performance.now() - calibrationPausedAt;
    if (calibrationDeadline !== null) calibrationDeadline += pausedFor;
    if (calibrationSession?.startTime != null) calibrationSession.startTime += pausedFor;
    calibrationPausedAt = null;
  }
  currentScreen = name;
  document.body.dataset.screen = name;
  if (name === "help") $("#helpButton").setAttribute("aria-current", "page");
  else $("#helpButton").removeAttribute("aria-current");
  Object.entries(screens).forEach(([key, node]) => node.classList.toggle("active", key === name));
  renderGlobalNavigation();
  pushScreenHistory(name, historyMode);
  document.title = screenTitle(name);
  if (audio) {
    if (name === "calibration" || (name === "race" && raceActive && racePausedAt === null)) audio.playMusic();
    else audio.pauseMusic();
  }
  window.scrollTo({ top: 0, behavior: ["results", "podium", "help"].includes(name) || deviceMotionPreference.matches ? "instant" : "smooth" });
  if (enteringPodium) refreshVictoryMotion();
  if (name === "results") setTimeout(() => { const button = $("#nextRaceButton"); if (currentScreen === "results" && button && !button.disabled && !button.classList.contains("hidden")) button.focus({ preventScroll: true }); }, 0);
}

function showHelp({ historyMode = "push", from = currentScreen } = {}) {
  if (currentScreen === "help") { $("#helpTitle").focus(); return; }
  helpReturnScreen = from && from !== "welcome" && from !== "help" ? from : null;
  $("#helpBackButton").textContent = helpReturnScreen ? "← Back to game" : "← Back to race setup";
  if (currentScreen === "race" && raceActive) {
    pauseRace(true);
    cancelAnimationFrame(raceFrame);
  }
  if (currentScreen === "calibration") cancelAnimationFrame(calibrationFrame);
  showScreen("help", { historyMode });
  $("#helpTitle").focus({ preventScroll: true });
}

function closeHelp() {
  if (history.state?.helpFrom && helpReturnScreen) history.back();
  else showDashboard({ historyMode: "replace" });
}

function returnFromHelp(screen) {
  // The underlying view is still rendered. Keep its form fields and race session intact.
  showScreen(screen);
  if (screen === "race") {
    if (raceActive) raceFrame = requestAnimationFrame(updateRace);
    else if (!$("#finishOverlay").classList.contains("hidden")) {
      clearTimeout(raceFinishTimer);
      raceFinishTimer = setTimeout(() => presentRaceResults(lastRaceResult), 350);
    }
  } else if (screen === "calibration" && calibrationSession?.endTime === null) {
    calibrationFrame = requestAnimationFrame(updateCalibration);
    $("#calibrationTyping").focus({ preventScroll: true });
  } else if (screen !== "results") {
    $("#helpButton").focus({ preventScroll: true });
  }
}

function home({ historyMode = "push" } = {}) { clearTimeout(raceFinishTimer); if (raceActive) pauseRace(true); audio?.pauseMusic({ reset: true }); showDashboard({ historyMode }); }

function openRaceControls({ historyMode = "push" } = {}) {
  clearTimeout(raceFinishTimer);
  if (raceActive && raceSession && !raceSession.finished && racePausedAt === null) pauseRace(true);
  showDashboard({ preserveRace: Boolean(raceActive && raceSession && !raceSession.finished), historyMode });
}

function showFinishScreen({ historyMode = "push" } = {}) {
  const result = data.records[0] || lastRaceResult;
  if (!result) { toast("Finish a race to unlock the finish screen."); renderGlobalNavigation(); return; }
  lastRaceResult = result;
  if (currentScreen === "race") {
    if (raceActive && performance.now() < raceCountdownEnd) { toast("The race is about to start."); return; }
    if (raceActive && racePausedAt === null) pauseRace(true);
    cancelAnimationFrame(raceFrame);
    historicalReturnScreen = "race";
  } else {
    historicalReturnScreen = "dashboard";
  }
  renderResults(result, { historical: true });
  showScreen("results", { historyMode });
}

function restoreScreenFromHistory(screen) {
  applyingHistoryState = true;
  try {
    if (screen === "help") {
      showHelp({ historyMode: "none", from: history.state?.helpFrom || null });
      return;
    }
    if (currentScreen === "help" && screen === helpReturnScreen) {
      returnFromHelp(screen);
      return;
    }
    if (currentScreen === "race" && screen !== "race" && raceActive) pauseRace(true);
    if (screen === "dashboard") showDashboard({ preserveRace: raceActive });
    else if (screen === "challenge") showChallengeLobby();
    else if (screen === "library") showLibrary();
    else if (screen === "results") showFinishScreen();
    else if (screen === "podium" && championship?.rounds?.length) renderPodium();
    else if (screen === "race" && raceSession) {
      showScreen("race");
      cancelAnimationFrame(raceFrame);
      if (raceActive) raceFrame = requestAnimationFrame(updateRace);
    }
    else if (screen === "calibration" && calibrationSession?.endTime === null) {
      showScreen("calibration");
      cancelAnimationFrame(calibrationFrame);
      calibrationFrame = requestAnimationFrame(updateCalibration);
      $("#calibrationTyping").focus();
    }
    else showDashboard({ historyMode: "replace" });
  } finally {
    applyingHistoryState = false;
  }
}

function discardTimedChallenge() {
  if (!raceActive || !raceSetup?.timedChallenge) return false;
  cancelAnimationFrame(raceFrame);
  raceActive = false;
  raceSession = null;
  return true;
}

function showDashboard({ preserveRace = false, historyMode = "push" } = {}) {
  cancelAnimationFrame(calibrationFrame);
  clearTimeout(raceFinishTimer);
  if (discardTimedChallenge()) preserveRace = false;
  if (!preserveRace) raceActive = false;
  $("#dashboardName").textContent = data.profile.name || "Racer";
  $("#dashboardPlayerName").value = data.profile.name || "";
  lastRaceResult = data.records[0] || lastRaceResult;
  $("#lastResultsReadyButton").classList.toggle("hidden", !lastRaceResult);
  $("#baselineWpm").textContent = Math.round(data.profile.calibration?.wpm || 0);
  $("#baselineAccuracy").textContent = `${Math.round((data.profile.calibration?.accuracy || 0) * 100)}% accuracy`;
  $("#startingPaceMetrics").classList.toggle("hidden", !data.profile.calibration);
  const needsPlayerName = !String(data.profile.name || "").trim();
  const needsStartingPace = !needsPlayerName && !data.profile.calibration;
  const needsSettingsConfirmation = !needsPlayerName && Boolean(data.profile.calibration) && data.profile.setupSettingsConfirmed !== true;
  $("#dashboardScreen").classList.toggle("awaiting-player-name", needsPlayerName);
  $("#dashboardScreen").classList.remove("nickname-entered");
  $("#nicknameStepHint").classList.toggle("hidden", !needsPlayerName);
  $("#nicknameAvailability").classList.add("hidden");
  $("#dashboardPlayerName").removeAttribute("aria-invalid");
  $("#dashboardPlayerName").removeAttribute("aria-describedby");
  $("#dashboardScreen").classList.toggle("awaiting-starting-pace", needsStartingPace);
  $("#dashboardScreen").classList.toggle("awaiting-settings-confirmation", needsSettingsConfirmation);
  $("#startingPaceButton").textContent = needsStartingPace ? "Set starting pace" : "Change pace";
  $("#challengeButton").classList.toggle("daily-challenge-cue", !needsPlayerName && data.profile.challengeLobbySeen !== true);
  $$(".calibration-complete-only").forEach((button) => button.classList.toggle("hidden", !data.profile.calibration));
  $("#settingsConfirmRow").classList.toggle("hidden", !needsSettingsConfirmation);
  $("#confirmGameSettingsButton").classList.toggle("attention-blink", needsSettingsConfirmation);
  const gameSettingsPanel = $("#aiPaceSlider").closest(".setup-panel");
  const calibrationControls = $("#startingPaceButton").closest(".calibration-card-content");
  $$("#dashboardScreen button, #dashboardScreen select, #dashboardScreen input, #dashboardScreen textarea").forEach((control) => {
    const inProfile = Boolean(control.closest("#dashboardProfileForm"));
    const inCalibration = Boolean(control.closest(".calibration-card"));
    const inSettings = Boolean(control.closest(".setup-panel") === gameSettingsPanel);
    let allowed = true;
    if (needsPlayerName) allowed = inProfile;
    else if (needsStartingPace) allowed = inProfile || inCalibration;
    else if (needsSettingsConfirmation) allowed = inProfile || inCalibration || inSettings;
    control.disabled = !allowed && !control.closest(".browser-transfer") && control.id !== "joinDailyRace";
  });
  calibrationControls.setAttribute("aria-disabled", String(needsPlayerName));
  $("#startChampionshipButton").classList.toggle("attention-blink", Boolean(data.profile.calibration) && data.profile.setupSettingsConfirmed === true && data.profile.startHintSeen !== true);
  const challengePassages = activeChallengePassages();
  const levels = Math.max(1, Math.ceil(challengePassages.length / CHAMPIONSHIP_RACES));
  renderPassageGroupControl();
  renderChampionshipMap(levels);
  $("#returnToRacesButton").classList.toggle("hidden", !raceActive && !championship?.rounds?.length);
  $("#returnToRacesButton").textContent = raceActive && raceSession && !raceSession.finished ? "Resume race" : "Continue level";
  renderAiPaceControl();
  renderCharacters();
  renderCreatorStudio();
  showScreen("dashboard", { historyMode });
}

function startCalibration() {
  calibrationSession = new TypingSession(nextCalibrationText(), { ignoreMistakes: calibrationMode === "flow" });
  calibrationDeadline = null;
  calibrationPausedAt = null;
  $("#calibrationTimer").textContent = CONFIG.calibrationSeconds;
  $("#calibrationWpm").textContent = "0";
  $("#manualPaceWpm").value = Math.round(data.profile.calibration?.wpm || 40);
  $("#calibrationHint").textContent = `${calibrationMode === "flow" ? "Mistakes are counted but do not stop you" : "Mistakes must be corrected"} - Starts on your first keystroke`;
  renderTyping($("#calibrationTyping"), calibrationSession);
  showScreen("calibration");
  $("#calibrationTyping").focus();
  audio.playMusic({ restart: true });
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
  if (data.profile.startHintSeen !== true) data.profile.startHintSeen = false;
  persist();
  audio.pauseMusic({ reset: true });
  toast(`Pace saved: ${Math.round(data.profile.calibration.wpm)} WPM`);
  showDashboard();
}

function saveManualPace(event) {
  event.preventDefault();
  const wpm = Math.round(Number($("#manualPaceWpm").value));
  if (!Number.isFinite(wpm) || wpm < 5 || wpm > 250) { toast("Enter a starting pace from 5 to 250 WPM."); return; }
  cancelAnimationFrame(calibrationFrame);
  data.profile.calibration = { playerName: data.profile.name, wpm, accuracy: 1, date: new Date().toISOString(), method: "manual" };
  data.profile.startHintSeen = false;
  persist();
  audio.pauseMusic({ reset: true });
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

function raceTypingModeHint() {
  return raceSession.ignoreMistakes ? "Flow mode: keep typing or use Backspace to correct a letter." : "Strict mode: use Backspace to fix mistakes.";
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
  const incremental = card.id === "raceTyping" && raceSetup?.timedChallenge && copy._typingSession === session;
  const from = incremental ? Math.min(copy._typingIndex, session.index) : 0;
  const to = incremental ? Math.min(characters.length, Math.max(copy._typingIndex, session.index) + 1) : characters.length;
  for (let index = from; index < to; ++index) {
    const node = characters[index];
    node.className = `typing-char ${index < session.index ? "typed" : "remaining"}`;
    if (session.missedIndices?.has(index)) node.classList.add("missed");
    if (index >= session.index && focusKeys.has(normalizedFocusKey(node.textContent))) node.classList.add("focus-key");
    if (index === session.index && !session.finished) node.classList.add("current");
    if (index === session.index && session.errorChar) node.classList.add("error");
  }
  copy._typingIndex = session.index;
  copy._typingSession = session;
  cancelAnimationFrame(copy._typingFrame);
  copy._typingFrame = requestAnimationFrame(() => {
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
  calibrationSession = new TypingSession(nextCalibrationText(), { ignoreMistakes: mode === "flow" });
  renderTyping($("#calibrationTyping"), calibrationSession);
  $("#calibrationHint").textContent = `${mode === "flow" ? "Mistakes are counted but do not stop you" : "Mistakes must be corrected"} - Starts on your first keystroke`;
  $("#calibrationTyping").focus();
}

function syncRaceTypingModeButtons() {
  $$("[data-race-mode]").forEach((button) => {
    const active = button.dataset.raceMode === (data.settings.raceTypingMode || "strict");
    button.classList.toggle("selected", active);
    button.setAttribute("aria-checked", String(active));
  });
}

function selectRaceTypingMode(mode) {
  if (!["strict", "flow"].includes(mode)) return;
  data.settings.raceTypingMode = mode;
  persist();
  syncRaceTypingModeButtons();
  toast(`${mode === "flow" ? "Flow" : "Strict"} race mode selected.`);
}

function challengeTypingMode() {
  return data.profile.challengeTypingMode === "flow" ? "flow" : "strict";
}

function syncChallengeStoryChoice() {
  const rotate = data.profile.rotateChallengeStories === true;
  $("#rotateChallengeStories").checked = rotate;
  $("#challengeStoryTitle").textContent = rotate ? "Sherlock’s shuffled casebook" : CHALLENGE_PASSAGE.title;
  $("#challengeStoryTeaser").textContent = rotate
    ? `One of ${CHALLENGE_STORIES.length} mysteries per race. No repeats until you’ve played them all.`
    : "Holmes has a suspect. Watson has crumbs. You have 60 seconds.";
}

function syncChallengeTypingMode() {
  const mode = challengeTypingMode();
  $$("[data-challenge-mode]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.challengeMode === mode));
  });
  $("#challengeModeHint").textContent = mode === "flow"
    ? "Wrong letters turn red. You can keep typing or use Backspace to fix them."
    : "Fix a wrong letter with Backspace before moving on.";
}

function selectChallengeTypingMode(mode) {
  if (!data.profile.name || !["strict", "flow"].includes(mode)) return;
  data.profile.challengeTypingMode = mode;
  persist();
  syncChallengeTypingMode();
}

function renderCharacters() {
  if (!manifest) return;
  const selected = manifest.characters.find((character) => character.id === data.profile.characterId) || manifest.characters[0];
  if (selected && data.profile.characterId !== selected.id) data.profile.characterId = selected.id;
  if (!manifest.characters.some((character) => character.id === previewCharacterId)) previewCharacterId = selected?.id;
  const preview = manifest.characters.find((character) => character.id === previewCharacterId) || selected;
  $("#selectedRunnerPreview").innerHTML = selected ? `<img src="${selected.portrait}" alt=""><div><span>Selected racer</span><strong>${escapeHtml(selected.displayName)}</strong><small>${manifest.characters.length} racer${manifest.characters.length === 1 ? "" : "s"} available</small><button class="secondary compact runner-more-button" data-action="open-runners">More racers</button></div>` : "";
  $("#runnerPickerPreview").innerHTML = preview ? `<img src="${preview.portrait}" alt=""><div><span>Previewing</span><strong>${escapeHtml(preview.displayName)}</strong><small>${preview.id === data.profile.characterId ? "Current racer" : "Ready to accept"}</small></div>` : "";
  $("#characterGrid").innerHTML = manifest.characters.map((character) => `<button class="character-card ${preview?.id === character.id ? "selected" : ""}" data-character="${character.id}" role="radio" aria-checked="${preview?.id === character.id}"><img src="${character.portrait}" alt="${escapeHtml(character.displayName)}"><span>${escapeHtml(character.displayName)}</span></button>`).join("");
}

function aiPaceBaseWpm() {
  const progress = progressionState();
  return Number(progress.aiBaselineWpm) || data.profile.calibration?.wpm || 35;
}

function renderAiPaceControl(offset = data.settings.aiPaceOffset) {
  const helper = $("#focusKeyHelperSelect");
  if (helper) helper.value = data.settings.focusKeyHelper === false ? "disabled" : "enabled";
  const keyNoise = $("#keyNoiseSelect");
  if (keyNoise) keyNoise.value = data.settings.keyNoise === false ? "disabled" : "enabled";
  const pace = clampAiPace(offset);
  const range = projectedAiRange(aiPaceBaseWpm(), pace, CONFIG.adaptiveRatios);
  $("#aiPaceSlider").value = pace;
  $("#aiPaceValue").textContent = `${pace > 0 ? "+" : ""}${pace}%`;
  $("#aiPaceDescription").textContent = aiPaceLabel(pace);
  $("#aiPaceRange").textContent = `Projected rivals: ${range.low}-${range.high} WPM`;
  syncRaceTypingModeButtons();
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
    const preferred = { "Biblical Passages": 0, "Typing Basics": 1, "Typing Intermediate": 2, "Typing Advanced": 3, General: 4, "Harry Potter-Inspired": 5, Books: 6, "Lord of the Rings Quotes": 7 };
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
  const defaults = { level: 1, unlockedLevel: 1, order: "random", lastFiveAverage: null, aiBaselineWpm: null, randomPassageIds: [], replayLimit: 2, replayScope: "level", replayUsedTotal: 0, replayUsedByLevel: {}, levelHistory: {} };
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
  const highestLevel = highestSelectableLevel(data.profile.name, progress.unlockedLevel, totalLevels);
  progress.level = Math.max(1, Math.min(highestLevel, progress.level || 1));
  const challengePassages = activeChallengePassages();
  if (progress.order === "random" && !progress.randomPassageIds.length && !data.activeChampionship) {
    progress.randomPassageIds = shufflePassageIds(challengePassages);
    persist();
  }
  const completed = Object.values(progress.levelHistory).filter((attempts) => attempts?.length).length;
  $("#championshipCompletion").textContent = `${completed} of ${totalLevels} levels completed`;
  $("#levelButtons").innerHTML = Array.from({ length: totalLevels }, (_, index) => {
    const level = index + 1;
    const attempts = levelAttempts(level);
    const unlocked = level <= highestLevel || attempts.length > 0;
    const best = attempts.length ? Math.max(...attempts.map((attempt) => attempt.playerPoints || 0)) : null;
    return `<button type="button" class="level-button ${attempts.length ? "completed" : ""}" data-level="${level}" ${unlocked ? "" : "disabled"}><span>Level ${level}</span><small>${attempts.length ? `${attempts.length} attempt${attempts.length === 1 ? "" : "s"} - best ${best} pts` : unlocked ? "Ready" : "Locked"}</small></button>`;
  }).join("");
  $("#replayLimit").value = progress.replayLimit;
  $("#replayGlobal").checked = progress.replayScope === "game";
  renderChampionshipSelection();
}

function renderChampionshipSelection() {
  const { level, replayScope } = progressionState();
  const buttons = $$("#levelButtons [data-level]");
  for (const button of buttons) {
    const selected = Number(button.dataset.level) === level;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  $("#selectedPassageTitle").textContent = `Level ${level} of ${buttons.length} - five ${selectedPassageCategory} races`;
  const remaining = replayRemaining(level);
  $("#replayAllowanceStatus").textContent = `${remaining} replay${remaining === 1 ? "" : "s"} left for ${replayScope === "game" ? "the whole game" : `Level ${level}`}`;
  const isReplay = levelAttempts(level).length > 0;
  const start = $("#startChampionshipButton");
  start.textContent = isReplay ? `Replay Level ${level}` : `Start Level ${level}`;
  start.disabled = isReplay && remaining <= 0;
}

function selectChampionshipLevel(level) {
  const progress = progressionState();
  const totalLevels = Math.max(1, Math.ceil(activeChallengePassages().length / CHAMPIONSHIP_RACES));
  if (level < 1 || level > totalLevels) return;
  if (level > highestSelectableLevel(data.profile.name, progress.unlockedLevel, totalLevels) && !levelAttempts(level).length) return;
  if (level === progress.level) return;
  progress.level = level;
  persist();
  // Selecting a level is an in-place change, not navigation to a new screen.
  renderChampionshipSelection();
}

function saveReplayRules() {
  const progress = progressionState();
  progress.replayLimit = Math.max(0, Math.min(20, Number($("#replayLimit").value) || 0));
  progress.replayScope = $("#replayGlobal").checked ? "game" : "level";
  persist();
  $("#replayLimit").value = progress.replayLimit;
  renderChampionshipSelection();
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

function racePassageIdsForCategory(category = selectedPassageCategory) {
  return new Set(data.passages.filter((item) => item.enabled && (item.category || "General") === category).map((item) => item.id));
}

function resetCurrentCategoryRaces() {
  const category = selectedPassageCategory || "Biblical Passages";
  const passageIds = racePassageIdsForCategory(category);
  data.records = (data.records || []).filter((record) => !passageIds.has(record.passageId));
  data.playerProfiles ||= {};
  Object.values(data.playerProfiles).forEach((profile) => {
    if (Array.isArray(profile.records)) profile.records = profile.records.filter((record) => !passageIds.has(record.passageId));
  });
  if (data.bestReplay && passageIds.has(data.bestReplay.passageId)) data.bestReplay = null;
  if (lastRaceResult && passageIds.has(lastRaceResult.passageId)) lastRaceResult = data.records[0] || null;
  if (mistakeReviewResult && passageIds.has(mistakeReviewResult.passageId)) mistakeReviewResult = null;
  if (selectedReviewResult && passageIds.has(selectedReviewResult.passageId)) selectedReviewResult = null;
  if (championship && (!championship.passageIds || championship.passageIds.some((id) => passageIds.has(id)))) championship = null;
  reviewingCompletedLevel = false;
  replayingCompletedRace = null;
  raceActive = false;
  racePausedAt = null;
  clearTimeout(raceFinishTimer);
  data.activeChampionship = null;
  if (data.progressionByCategory) delete data.progressionByCategory[category];
  data.progression = null;
  persist();
  showDashboard();
  toast(`Reset races for ${category}.`);
}

function shufflePassageIds(passages) {
  const ids = passages.map((item) => item.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
  }
  return ids;
}


function randomChoice(items) {
  return items?.length ? items[Math.floor(Math.random() * items.length)] : null;
}

function shuffleIndices(length) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swap]] = [indices[swap], indices[index]];
  }
  return indices;
}

function nextCalibrationText() {
  data.calibrationQueue ||= [];
  if (!data.calibrationQueue.length) data.calibrationQueue = shuffleIndices(CONFIG.calibrationTexts?.length || 0);
  const index = data.calibrationQueue.shift();
  return CONFIG.calibrationTexts?.[index] || CONFIG.calibrationText;
}

function quickIntroPassage() {
  data.quickIntroQueue ||= [];
  if (!data.quickIntroQueue.length) data.quickIntroQueue = shuffleIndices(CONFIG.quickRaceParagraphs.length);
  const index = data.quickIntroQueue.shift();
  const paragraph = CONFIG.quickRaceParagraphs[index] || randomChoice(CONFIG.quickRaceParagraphs) || CONFIG.calibrationText;
  return {
    id: `quick-intro-passage-${index}`,
    title: "Quick Dino Dash",
    source: "Intro Race",
    category: "Quick Race",
    enabled: true,
    text: paragraph,
  };
}

function startIntroRace(name) {
  const requestedName = String(name || "").trim();
  if (!requestedName) return;
  clearTimeout(raceFinishTimer);
  cancelAnimationFrame(calibrationFrame);
  if (data.profile.name && profileKey(data.profile.name) !== profileKey(requestedName)) saveActiveProfileLibrary(data.profile.name);
  if (data.profile.name) saveActivePlayerProfile(data.profile.name);
  setActiveProfileName(requestedName);
  loadActiveProfileLibrary(requestedName);
  persist();
  startCalibration();
}

function renderQuickRaceResult(result) {
  $("#finishOverlay").classList.add("hidden");
  $("#quickResultTitle").textContent = result.perfect ? "Perfect quick dash!" : `${ordinal(result.place)} place!`;
  $("#quickResultSummary").textContent = `${result.playerName || "Racer"}, your quick race pace is now saved as your starting pace.`;
  $("#quickResultWpm").textContent = Math.round(result.wpm);
  $("#quickResultAccuracy").textContent = `${Math.round(result.accuracy * 100)}%`;
  $("#quickResultPlace").textContent = ordinal(result.place);
  $("#quickResultOverlay").classList.remove("hidden");
  void playFireworks($("#quickResultOverlay"), result.place);
  setTimeout(() => $("#quickResultOverlay [data-action='continue-after-quick-race']")?.focus(), 0);
}

function finishQuickIntroRace(result, now, time) {
  data.profile.calibration = { playerName: result.playerName, wpm: Math.max(5, result.wpm), accuracy: result.accuracy, date: new Date().toISOString(), method: "quick-race" };
  data.activeChampionship = null;
  championship = null;
  data.records.unshift(result);
  data.records = data.records.slice(0, 5000);
  if (!data.bestReplay || time < data.bestReplay.time) data.bestReplay = { playerName: result.playerName, time, wpm: result.wpm, passageId: result.passageId, samples: raceSession.samples.map((sample) => ({ t: sample.t, p: sample.p })) };
  persist();
  lastRaceResult = result;
  renderer.draw({ racers: raceRacers, player: racePlayer, time: now, countdown: false });
  renderQuickRaceResult(result);
}

function continueAfterQuickRace() {
  $("#quickResultOverlay").classList.add("hidden");
  showDashboard();
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
    aiBaselineWpm: Number(progress.aiBaselineWpm) || data.profile.calibration?.wpm || 35,
    rounds: [],
  };
  data.profile.startHintSeen = true;
  data.activeChampionship = championship;
  persist();
  startRace();
}

function registerPlayerKeyHit(now) {
  if (!racePlayer) return;
  const previous = racePlayer.keyHitAt || 0;
  racePlayer.keyHitInterval = previous ? now - previous : 260;
  racePlayer.keyHitAt = now;
}

function startRace({ roundNumberOverride = null, timedChallenge = false } = {}) {
  if (timedChallenge && !data.profile.name) { showDashboard(); $("#dashboardPlayerName").focus(); return; }
  if (timedChallenge && raceActive && !raceSetup?.timedChallenge) {
    toast("Finish your paused race before starting the Challenge.");
    return;
  }
  if (timedChallenge && currentScreen === "challenge" && !$("#challengeRivalWpm").reportValidity()) return;
  clearTimeout(raceFinishTimer);
  if (!timedChallenge && !championship) { startChampionship(); return; }
  const roundNumber = timedChallenge ? 1 : (roundNumberOverride || championship.rounds.length + 1);
  const story = timedChallenge ? takeChallengeStory(data.profile) : null;
  if (timedChallenge && data.profile.rotateChallengeStories === true) persist();
  const passageId = timedChallenge ? story.id : championship.passageIds[roundNumber - 1];
  const quickIntro = !timedChallenge && Boolean(championship.quickIntro);
  const passage = timedChallenge ? story : quickIntro ? championship.quickPassage : (campaignPassage(passageId) || choosePassage(data.passages, selectedPassageId));
  if (!passage) { toast("Enable at least one passage before racing."); return; }
  if (!timedChallenge && !quickIntro) selectedPassageId = passage.id;
  const baseline = adjustedAiBaseline(data.profile.calibration?.wpm || 35, data.settings.aiPaceOffset);
  const { mode, difficulty } = timedChallenge ? { mode: "challenge", difficulty: "normal" } : championship;
  const fallbackTrackIndex = timedChallenge ? 0 : (((championship.level || 1) - 1) * CHAMPIONSHIP_RACES + roundNumber - 1) % manifest.tracks.length;
  const requestedTrack = timedChallenge ? nextChallengeTrack(manifest.tracks) : championship.trackIds?.[roundNumber - 1];
  const track = manifest.tracks.find((item) => item.id === requestedTrack) || manifest.tracks[fallbackTrackIndex];
  const playerCharacterId = timedChallenge ? upcomingChallengeRacer().id : manifest.characters.some((item) => item.id === data.profile.characterId) ? data.profile.characterId : (manifest.characters.find((item) => item.id === "nova") || manifest.characters[0]).id;
  if (timedChallenge) challengePreviewRacer = null;
  renderer.setTrack(track.id);
  raceSetup = { mode, difficulty, passage, roundNumber, trackId: track.id, focusKeys: timedChallenge ? [] : activeFocusKeys(), quickIntro, timedChallenge, attemptId: timedChallenge ? globalThis.crypto?.randomUUID?.() : null };
  raceSession = timedChallenge
    ? new TimedChallenge(challengeTypingMode(), { passage })
    : new TypingSession(passage.text, { ignoreMistakes: data.settings.raceTypingMode === "flow" });
  raceRacers = timedChallenge ? createChallengeRivals(manifest.characters, playerCharacterId, challengeRivalPace()) : createAiRacers({ mode, baselineWpm: baseline, ratios: CONFIG.adaptiveRatios, fixedRatio: CONFIG.fixedRatios[difficulty], passageId: passage.id, bestReplay: data.bestReplay, characters: manifest.characters, playerCharacterId });
  racePlayer = { id: "player", name: (timedChallenge ? data.profile.name : championship.playerName || data.profile.name) || "Racer", characterId: playerCharacterId, progress: 0, finishTime: null };
  const modeName = mode === "adaptive" ? "Adaptive" : mode === "ghost" ? "Personal Best" : `${difficulty[0].toUpperCase() + difficulty.slice(1)} Fixed`;
  $("#raceModeLabel").textContent = timedChallenge ? `One-minute Challenge - ${track.displayName} · You: ${renderer.character(playerCharacterId).displayName} · Rivals: ${challengeRivalPace()} WPM` : quickIntro ? `Quick Dino Dash - ${track.displayName}` : `Level ${championship.level} - Race ${roundNumber} of ${CHAMPIONSHIP_RACES} - ${modeName} - ${track.displayName}`;
  $("#raceTitle").textContent = !timedChallenge && passage.source ? `${passage.title} - ${passage.source}` : passage.title;
  $("#raceScreen").toggleAttribute("data-challenge", timedChallenge);
  $("#raceWpm").textContent = "0"; $("#raceAccuracy").textContent = timedChallenge ? "—" : "100%"; $("#raceProgress").textContent = "0";
  $("#raceAccuracyLabel").textContent = timedChallenge ? "Keystroke accuracy" : "Accuracy";
  $("#challengeTextAccuracy").textContent = "—";
  $("#challengeTextAccuracyStat").classList.toggle("hidden", !timedChallenge);
  const typingModeHint = raceTypingModeHint();
  $("#raceHint").textContent = raceSetup.focusKeys.length ? `The race starts after the countdown - ${typingModeHint} ${raceTypingInstruction()}` : `The race starts after the countdown - ${typingModeHint}`;
  $("#raceLastResultsButton").classList.toggle("hidden", timedChallenge || !lastRaceResult);
  $("#raceCanvas").setAttribute("aria-label", timedChallenge ? `Your dinosaur in the bottom lane and four rivals pacing at ${challengeRivalPace()} WPM` : "Five runners racing across a dinosaur track");
  $("#racePlaceStat").classList.toggle("hidden", timedChallenge);
  $("#challengeClockStat").classList.toggle("hidden", !timedChallenge);
  $("#raceProgressStat").classList.toggle("hidden", timedChallenge);
  $("#challengeClock").textContent = formatTime(CHALLENGE_SECONDS);
  $("#racePauseButton").disabled = false;
  $("#challengeResultOverlay").classList.add("hidden");
  if (timedChallenge) latestChallengeScore = null;
  renderTyping($("#raceTyping"), raceSession);
  $("#raceTyping").classList.add("typing-locked");
  $("#raceTyping").setAttribute("aria-disabled", "true");
  showScreen("race");
  raceActive = true; racePausedAt = null;
  audio.playMusic({ restart: true });
  raceCountdownEnd = performance.now() + 3000;
  if (!timedChallenge && roundNumber === 1 && !data.profile.firstRaceHelpSeen && !quickIntro) {
    raceCountdownEnd = performance.now() + 600000;
    document.getElementById("firstRaceHelpDialog")?.showModal();
  }
  raceStartTime = raceCountdownEnd;
  raceSession.startTime = raceStartTime;
  $("#countdown").classList.remove("hidden");
  $("#finishOverlay").classList.add("hidden");
  $("#quickResultOverlay")?.classList.add("hidden");
  $("#finishOverlay").classList.remove("is-perfect");
  $("#perfectCelebration").classList.add("hidden");
  $("#pauseOverlay").classList.add("hidden");
  cancelAnimationFrame(raceFrame);
  raceFrame = requestAnimationFrame(updateRace);
}

function beginStartingPace() {
  const name = $("#dashboardPlayerName").value.trim();
  if (!name) { toast("Enter your racer nickname first."); $("#dashboardPlayerName").focus(); return; }
  if (profileKey(name) !== profileKey(data.profile.name)) {
    const previousName = data.profile.name;
    if (previousName) saveActivePlayerProfile(previousName);
    setActiveProfileName(name);
    loadActiveProfileLibrary(name);
    persist();
  }
  startCalibration();
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
  if (!$("#countdown").classList.contains("hidden")) { $("#countdown").classList.add("hidden"); $("#raceTyping").classList.remove("typing-locked"); $("#raceTyping").setAttribute("aria-disabled", "false"); $("#raceHint").textContent = `${raceTypingModeHint()} ${raceTypingInstruction()}`; audio.play("start"); $("#raceTyping").focus({ preventScroll: raceSetup.timedChallenge }); }
  if (raceSetup.timedChallenge) {
    const remaining = raceSession.remaining(now);
    if (remaining <= 0) { finishTimedChallenge(now); return; }
    $("#challengeClock").textContent = formatTime(Math.ceil(remaining));
    $("#raceWpm").textContent = Math.round(raceSession.wpm(now));
    renderChallengeAccuracy();
    racePlayer.progress = raceSession.trackProgress(now);
    updateChallengeRivals(raceRacers, CHALLENGE_SECONDS - remaining, raceSession.track.stride);
    renderer.draw({ racers: raceRacers, player: racePlayer, time: now, countdown: false });
    raceFrame = requestAnimationFrame(updateRace);
    return;
  }
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
    audio.pauseMusic();
  } else if (!force) resumeRace();
}

function renderChallengeAccuracy() {
  const keystroke = formatChallengeAccuracy(raceSession.totalKeystrokes ? raceSession.accuracy : null);
  const text = formatChallengeAccuracy(raceSession.textAccuracy);
  $("#raceAccuracy").textContent = keystroke;
  $("#challengeTextAccuracy").textContent = text;
  return { keystroke, text };
}

function finishTimedChallenge(now) {
  raceActive = false;
  cancelAnimationFrame(raceFrame);
  audio.pauseMusic({ reset: true });
  audio.play("finish");
  const accuracy = renderChallengeAccuracy();
  latestChallengeScore = raceSession.correctCharacters ? {
    correct: raceSession.correctCharacters, correctHits: raceSession.correctKeystrokes, attempts: raceSession.totalKeystrokes,
    passageId: raceSetup.passage.id, nickname: racePlayer.name, ownerId: challengeOwnerForProfile(racePlayer.name),
    profile: profileKey(racePlayer.name), posted: false,
  } : null;
  $("#useChallengePace").disabled = !latestChallengeScore || raceSession.scoreWpm < 5;
  $("#challengeClock").textContent = "0:00";
  $("#raceWpm").textContent = $("#challengeResultWpm").textContent = Number(raceSession.scoreWpm.toFixed(1));
  $("#challengeResultAccuracy").textContent = accuracy.keystroke;
  $("#challengeResultTextAccuracy").textContent = accuracy.text;
  $("#raceHint").textContent = "Challenge complete";
  $("#raceTyping").setAttribute("aria-disabled", "true");
  $("#racePauseButton").disabled = true;
  racePlayer.progress = raceSession.trackProgress(now);
  updateChallengeRivals(raceRacers, CHALLENGE_SECONDS, raceSession.track.stride);
  renderer.draw({ racers: raceRacers, player: racePlayer, time: now, countdown: false });
  $("#challengeResultOverlay").classList.remove("hidden");
  $("#retryChallengePost").hidden = true;
  $("#challengePostStatus").textContent = latestChallengeScore ? "" : "No score to post: finish with at least one correct character.";
  if (latestChallengeScore) void publishChallengeResult(latestChallengeScore);
  $("#challengePlayAgain").focus({ preventScroll: true });
  if (raceSession.totalKeystrokes && raceSetup.attemptId) {
    void recordChallengePlay(raceSetup.attemptId).then(saved => {
      if (saved && currentScreen === "challenge") void refreshChallengeScores("lobby");
    }).catch(() => { /* The online board never substitutes a browser-only count. */ });
  }
}

function showChallengeLobby({ historyMode = "push" } = {}) {
  if (!data.profile.name) {
    showDashboard({ historyMode });
    $("#dashboardPlayerName").focus({ preventScroll: true });
    return;
  }
  if (raceActive && !raceSetup?.timedChallenge) {
    toast("Finish your paused race before opening the Challenge.");
    return;
  }
  discardTimedChallenge();
  const racer = upcomingChallengeRacer();
  $("#challengeRacerPortrait").src = racer.portrait || racer.animations.idle.file;
  $("#challengeRacerBadge").textContent = `Your racer: ${racer.displayName}`;
  $("#challengeRivalWpm").value = challengeRivalPace();
  $("#challengePostingNotice").textContent = challengeNickname(data.profile.name)
    ? `Finishing posts your score publicly as ${data.profile.name}. Use a game nickname, not your real name.`
    : "You can practice with this nickname. To post scores, save a nickname with 2–24 letters, numbers, spaces, hyphens, or underscores in Race Setup.";
  syncChallengeStoryChoice();
  syncChallengeTypingMode();
  showScreen("challenge", { historyMode });
  if (!data.profile.challengeLobbySeen) {
    data.profile.challengeLobbySeen = true;
    persist();
  }
  $("#challengeLobbyTitle").focus({ preventScroll: true });
  void refreshChallengeScores("lobby");
}

function useChallengePace() {
  const score = latestChallengeScore;
  if (!score || score.correct < 25 || score.profile !== profileKey() || !data.profile.name) return;
  const wpm = score.correct / 5;
  data.profile.calibration = { playerName: data.profile.name, wpm, accuracy: score.correctHits / score.attempts, date: new Date().toISOString(), method: "challenge" };
  persist();
  showDashboard();
  toast(`Starting pace saved: ${Number(wpm.toFixed(1))} WPM`);
}

async function refreshChallengeScores(view = "dialog") {
  const lobby = view === "lobby";
  const combined = view === "combined";
  const status = lobby ? $("#challengeLobbyScoresStatus") : combined ? $("#globalLeaderboardStatus") : $("#challengeScoresStatus");
  const list = lobby ? $("#challengeLobbyScoresList") : combined ? $("#globalLeaderboardList") : $("#challengeScoresList");
  const request = (challengeBoardRequests.get(view) || 0) + 1;
  challengeBoardRequests.set(view, request);
  if (lobby) $("#challengePlayCount").textContent = "—";
  status.textContent = "Loading shared scores…";
  list.replaceChildren();
  try {
    const { records, plays } = await fetchChallengeBoard();
    if (request !== challengeBoardRequests.get(view)) return;
    if (lobby) $("#challengePlayCount").textContent = plays.toLocaleString();
    status.textContent = records.length ? "" : "No scores posted yet.";
    for (const { nickname, wpm, accuracy } of records.slice(0, lobby ? 8 : 50)) {
      const row = document.createElement("li");
      const layout = document.createElement("span");
      const name = document.createElement("strong");
      const score = document.createElement("span");
      name.textContent = nickname;
      score.textContent = `${wpm} WPM · ${Number((accuracy * 100).toFixed(1))}% accuracy`;
      layout.append(name, score);
      row.append(layout);
      list.append(row);
    }
  } catch {
    if (request === challengeBoardRequests.get(view)) status.textContent = combined
      ? "Global scores are unavailable right now."
      : "Online Challenge scores are unavailable here. You can still race.";
  }
}

function openChallengeScores() {
  $("#challengeScoresDialog").showModal();
  void refreshChallengeScores();
}

async function publishChallengeResult(score) {
  if (!score || score.posting || score.posted) return;
  const status = $("#challengePostStatus");
  const retry = $("#retryChallengePost");
  retry.hidden = true;
  status.textContent = `Posting your score as ${score.nickname}…`;
  score.posting = true;
  try {
    await postChallengeScore(score);
    score.posted = true;
    if ($("#challengeScoresDialog").open) void refreshChallengeScores();
    if ($("#leaderboardDialog").open) void refreshChallengeScores("combined");
    if (currentScreen === "challenge") void refreshChallengeScores("lobby");
    if (latestChallengeScore !== score) return;
    status.textContent = `Score posted online as ${score.nickname}. The board shows your personal best.`;
  } catch (error) {
    if (latestChallengeScore !== score) return;
    retry.hidden = error.retryable === false;
    status.textContent = retry.hidden ? error.message : "Score not posted. Check your connection and retry.";
  } finally {
    score.posting = false;
  }
}

function resumeRace() {
  if (racePausedAt === null) return;
  const pausedFor = performance.now() - racePausedAt;
  raceStartTime += pausedFor; raceCountdownEnd += pausedFor; raceSession.startTime += pausedFor;
  racePausedAt = null; $("#pauseOverlay").classList.add("hidden"); $("#raceHint").textContent = `${raceTypingModeHint()} ${raceTypingInstruction()}`; $("#raceTyping").focus({ preventScroll: raceSetup.timedChallenge });
  audio.playMusic();
}

function debugFinishRaceFirst() {
  if (!raceActive || currentScreen !== "race" || !raceSession || raceSetup?.timedChallenge) return;
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
  $("#raceTyping").classList.remove("typing-locked");
  $("#raceTyping").setAttribute("aria-disabled", "false");
  finishRace(now, { forcePlayerFirst: true });
}

function finishRace(now, { forcePlayerFirst = false } = {}) {
  raceActive = false; cancelAnimationFrame(raceFrame); audio.pauseMusic({ reset: true }); audio.play("finish");
  const time = raceSession.elapsed(now);
  if (!forcePlayerFirst) raceRacers.forEach((racer) => updateAi(racer, time, raceSession.text.length));
  const finishOrder = rankRace(racePlayer, raceRacers, time);
  const place = finishOrder.find((racer) => racer.id === "player").place;
  $("#racePlace").textContent = `${place} / ${finishOrder.length}`;
  const result = { id: `${raceSetup.quickIntro ? "quick" : "race"}-${Date.now()}`, championshipId: championship.id, playerName: racePlayer.name, date: new Date().toISOString(), mode: raceSetup.quickIntro ? "quick-test" : raceSetup.mode, difficulty: raceSetup.difficulty, level: championship.level, passageId: raceSetup.passage.id, passageTitle: raceSetup.passage.title, roundNumber: raceSetup.roundNumber, time, wpm: raceSession.wpm(now), peakWpm: raceSession.peakWpm(), accuracy: raceSession.accuracy, errors: raceSession.errors, perfect: raceSession.errors === 0, trackId: raceSetup.trackId, mistakes: raceSession.mistakes.map((mistake) => ({ ...mistake })), place, fieldSize: finishOrder.length, finishOrder: finishOrder.map((racer) => ({ ...racer })) };
  if (raceSetup.quickIntro) { finishQuickIntroRace(result, now, time); return; }
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
  data.records.unshift(result); data.records = data.records.slice(0, 5000);
  data.nemesesByProfile ||= {};
  const nemesisProfileKey = profileKey(result.playerName);
  data.nemesesByProfile[nemesisProfileKey] = updateNemesisMastery(data.nemesesByProfile[nemesisProfileKey] || buildNemeses(data.records.slice(1)), result);
  if (championship.campaignId) {
    data.campaignProgress ||= {};
    const progressKey = `${nemesisProfileKey}:${championship.campaignId}:${championship.campaignLevelId}`;
    data.campaignProgress[progressKey] = { racesCompleted: championship.rounds.length, lastPlayed: result.date, averageWpm: averageWpm(data.records.filter(record=>record.championshipId===championship.id)), accuracy: result.accuracy };
  }
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
  void playFireworks($("#finishOverlay"), result.place);
  $("#raceHint").textContent = `Finished ${ordinal(result.place)} - race results in 4 seconds`;
  raceFinishTimer = setTimeout(() => presentRaceResults(result), 4000);
}

function presentRaceResults(result) {
  if (!result || currentScreen !== "race") return;
  $("#finishOverlay").classList.add("hidden");
  $("#quickResultOverlay")?.classList.add("hidden");
  $("#finishOverlay").classList.remove("is-perfect");
  $("#perfectCelebration").classList.add("hidden");
  renderResults(result, { levelReview: reviewingCompletedLevel });
  showScreen("results");
}

function renderResults(result, { historical = false, levelReview = false } = {}) {
  document.body.dataset.resultPlace = String(result.place);
  const roundNumber = result.roundNumber || championship?.rounds?.length || 1;
  const totalRaces = championship?.totalRaces || CHAMPIONSHIP_RACES;
  const standings = championship?.rounds?.length ? championshipStandings(championship.rounds) : (result.seriesStandings || []);
  const playerName = result.playerName || data.profile.name || "Racer";
  const level = result.level || championship?.level || progressionState().level;
  const championshipRecords = data.records.filter((record) => record.championshipId === result.championshipId);
  const averageRecords = result.championshipId ? [...new Map([result, ...championshipRecords].map((record) => [record.id, record])).values()] : [result];
  const raceAverageWpm = averageWpm(averageRecords);
  if (!historical) historicalReturnScreen = null;
  if (levelReview) { reviewingCompletedLevel = true; selectedReviewResult = result; }
  $("#resultRaceLabel").textContent = `Level ${level} - Race ${roundNumber} of ${totalRaces} complete`;
  $("#resultsTitle").textContent = `${ordinal(result.place)} Place`;
  $("#resultsSummary").textContent = `${playerName} finished this race at ${Math.round(result.wpm)} WPM with ${Math.round(result.accuracy * 100)}% accuracy.`;
  $("#perfectResultBadge").classList.toggle("hidden", !result.perfect);
  $("#resultsQuip").textContent = resultQuip(result);
  const nextPassageId = championship?.passageIds?.[roundNumber];
  const nextPassage = campaignPassage(nextPassageId);
  const seriesComplete = levelReview || roundNumber >= totalRaces;
  const finalLevel = level >= (championship?.totalLevels || 10);
  $("#nextRaceName").textContent = seriesComplete ? (finalLevel ? "All levels are ready to review" : `Level ${level + 1} is unlocked`) : `Race ${roundNumber + 1} of 5 - ${nextPassage?.title || "Next passage"}`;
  $("#nextRaceCallout span").textContent = seriesComplete ? "Level complete" : "Up next";
  $("#nextRaceCallout").classList.toggle("podium-next", seriesComplete);
  $("#seriesRaceNav").innerHTML = Array.from({ length: totalRaces }, (_, index) => {
    const raceNumber = index + 1;
    const saved = championshipRecords.find((record) => record.roundNumber === raceNumber);
    return `<button class="series-race-button ${raceNumber === roundNumber ? "selected" : ""} ${saved ? "completed" : ""}" ${saved ? `data-series-result="${escapeHtml(saved.id)}"` : "disabled"}><span>Race ${raceNumber}</span><small>${saved ? ordinal(saved.place) : "Upcoming"}</small></button>`;
  }).join("");
  $("#seriesStandings").innerHTML = standings.length ? standings.map((racer, index) => `<div class="${racer.id === "player" ? "is-player" : ""}"><span>${index + 1}</span><strong>${escapeHtml(racer.name)}</strong><small>${escapeHtml(racer.points)}</small></div>`).join("") : "";
  $("#nextRaceButton").textContent = seriesComplete ? (finalLevel ? "Return to Levels" : `Go to Level ${level + 1}`) : `Start Race ${roundNumber + 1}`;
  $("#resultTime").textContent = formatTime(result.time);
  $("#resultWpm").textContent = Math.round(result.wpm); $("#resultAverageWpm").textContent = Math.round(raceAverageWpm); $("#resultPeak").textContent = Math.round(result.peakWpm); $("#resultAccuracy").textContent = `${Math.round(result.accuracy * 100)}%`; $("#resultErrors").textContent = result.errors;
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
  mistakeReviewResult = result;
  mistakeScope = "race";
  renderMistakeStats(result, mistakeScope);
}

function leaderboardRows() {
  const records = new Map();
  Object.values(data.playerProfiles || {}).forEach((profile) => {
    (profile.records || []).forEach((record) => records.set(record.id, record));
  });
  (data.records || []).forEach((record) => records.set(record.id, record));
  return [...records.values()]
    .filter((record) => Number.isFinite(record.wpm) && Number.isFinite(record.accuracy))
    .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || a.time - b.time)
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

function renderLeaderboardRows(rows) {
  $("#leaderboardTable").innerHTML = rows.length ? rows.slice(0, 100).map((record) => `<div class="${record.playerName === data.profile.name ? "is-player" : ""}"><span>${escapeHtml(record.rank)}</span><strong>${escapeHtml(record.playerName || "Racer")}</strong><b>${Math.round(record.wpm)} WPM</b><small>Level ${escapeHtml(record.level || 1)} - Race ${escapeHtml(record.roundNumber || 1)} - ${Math.round(record.accuracy * 100)}% - ${escapeHtml(record.passageTitle || "Race")}</small></div>`).join("") : `<p class="leaderboard-empty">No races yet.</p>`;
}

function openLeaderboard() {
  renderLeaderboardRows(leaderboardRows());
  $("#leaderboardDialog").showModal();
  void refreshChallengeScores("combined");
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
  return `${start ? "..." : ""}${text.slice(start, mistake.index)}[${mistake.expected}]${text.slice(mistake.index + 1, end)}${end < text.length ? "..." : ""}`;
}

function renderMistakeStats(result, scope = "race") {
  if (!result) return;
  const playerName = result.playerName || data.profile.name || "Racer";
  const mistakes = mistakesForReview(result, scope);
  const summary = summarizeMistakes(mistakes);
  const rangeLabel = scope === "series" ? "five-race series" : "race";
  $("#mistakeStatsButton").textContent = (result.mistakes || []).length ? `Mistake Stats (${result.mistakes.length})` : "Mistake Stats (Perfect)";
  $("#mistakeSummary").textContent = mistakes.length ? `${playerName} made ${mistakes.length} incorrect keypress${mistakes.length === 1 ? "" : "es"} in this ${rangeLabel}.` : `${playerName} had a perfect ${rangeLabel} - every keypress matched.`;
  $$('[data-mistake-scope]').forEach((button) => button.classList.toggle("selected", button.dataset.mistakeScope === scope));
  const maxCount = summary.expected[0]?.count || 1;
  $("#mistakeChart").innerHTML = summary.expected.length ? summary.expected.slice(0, 8).map((item) => `<div class="mistake-bar"><span class="key-cap">${escapeHtml(item.label)}</span><div><i style="width:${Math.max(8, (item.count / maxCount) * 100)}%"></i></div><strong>${item.count}</strong></div>`).join("") : `<p class="mistake-empty">No missed keys to chart.</p>`;
  $("#mistakeConfusions").innerHTML = summary.confusions.length ? summary.confusions.slice(0, 10).map((item) => `<div><span>Expected <kbd>${escapeHtml(item.expected)}</kbd></span><span>Pressed <kbd>${escapeHtml(item.typed)}</kbd></span><strong>x${item.count}</strong></div>`).join("") : `<p class="mistake-empty">No key confusions in this ${rangeLabel}.</p>`;
  $("#mistakeContexts").innerHTML = mistakes.length ? mistakes.slice(0, 20).map((mistake) => `<div><code>${escapeHtml(mistakeContext(mistake, result))}</code><span>Race ${escapeHtml(mistake.roundNumber || result.roundNumber || 1)} - ${escapeHtml(mistake.passageTitle || result.passageTitle || "Passage")} - pressed <kbd>${escapeHtml(keyLabel(mistake.typed))}</kbd> at ${mistake.time.toFixed(1)}s</span></div>`).join("") + (mistakes.length > 20 ? `<small>Showing the first 20 of ${mistakes.length} mistakes.</small>` : "") : `<p class="mistake-empty">Nothing to review - excellent accuracy.</p>`;
}

function commitDashboardProfile(name, { toastMessage = true } = {}) {
  if (!name) return;
  const previousName = data.profile.name;
  if (previousName && profileKey(previousName) !== profileKey(name)) saveActiveProfileLibrary(previousName);
  if (previousName) saveActivePlayerProfile(previousName);
  setActiveProfileName(name);
  if (data.profile.calibration) data.profile.calibration.playerName = name;
  loadActiveProfileLibrary(name);
  $("#dashboardName").textContent = name;
  persist();
  showDashboard();
  if (toastMessage) toast(`Player saved: ${name}`);
}

function challengeOwnerForProfile(name) {
  const key = `dino-challenge-owner:${profileKey(name)}`;
  if (challengeOwnerTokens.has(key)) return challengeOwnerTokens.get(key);
  let token;
  try { token = localStorage.getItem(key); } catch { /* Private browsing can block storage. */ }
  if (!isChallengeToken(token)) token = globalThis.crypto?.randomUUID?.();
  if (token) {
    challengeOwnerTokens.set(key, token);
    try { localStorage.setItem(key, token); } catch { /* The current page still works. */ }
  }
  return token;
}

async function saveDashboardProfile(event) {
  event.preventDefault();
  const input = $("#dashboardPlayerName");
  const button = $("#saveDashboardPlayer");
  const status = $("#nicknameAvailability");
  const name = input.value.trim();
  if (!name || button.disabled) return;
  button.disabled = true;
  button.textContent = "Checking…";
  const newPlayer = !data.profile.name;
  const available = await checkChallengeNickname(name, challengeOwnerForProfile(name)).catch(() => null);
  button.disabled = false;
  button.textContent = "Save player";
  if (currentScreen !== "dashboard" || input.value.trim() !== name) return;
  if (available === false) {
    status.textContent = "Name already taken on the Challenge leaderboard. Try another nickname.";
    status.classList.remove("hidden");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", "nicknameAvailability");
    input.focus({ preventScroll: true });
    return;
  }
  commitDashboardProfile(name);
  if (newPlayer && data.profile.name) $("#challengeButton").focus({ preventScroll: true });
}

function confirmGameSettings() {
  if (!data.profile.calibration) { toast("Set your starting pace first."); return; }
  data.profile.setupSettingsConfirmed = true;
  data.profile.startHintSeen = false;
  persist();
  showDashboard();
  toast("Game settings saved. Choose your Racer and start Level 1.");
}

function loadDashboardProfile() { openProfilePicker(); }

function savedPlayerProfiles() {
  return Object.values(data.playerProfiles || {})
    .filter((profile) => String(profile?.profile?.name || "").trim())
    .map((profile) => ({
      name: String(profile.profile.name).trim(),
      key: profileKey(profile.profile.name),
      calibration: profile.profile.calibration || null,
      updatedAt: profile.profile.calibration?.date || profile.progression?.updatedAt || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderProfilePicker() {
  const names = savedPlayerProfiles();
  $("#playerPickerSummary").textContent = names.length ? `Choose a saved player below, or type a new name to create one.` : `No saved players yet. Type a name below to create the first one.`;
  $("#playerPickerList").innerHTML = names.length ? names.map((player) => {
    const calibration = player.calibration ? `${Math.round(player.calibration.wpm || 0)} WPM` : "No calibration yet";
    return `<div class="player-picker-row"><div><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(calibration)}</small></div><div class="player-picker-row-actions"><button class="secondary compact" data-action="select-profile" data-profile-name="${escapeHtml(player.name)}">Load</button><button class="danger compact" data-action="delete-profile" data-profile-name="${escapeHtml(player.name)}">Delete</button></div></div>`;
  }).join("") : `<p class="player-picker-empty">Enter a player name above, then save it to create a local profile.</p>`;
}

function openProfilePicker() {
  $("#playerPickerInput").value = $("#dashboardPlayerName").value.trim() || data.profile.name || "";
  renderProfilePicker();
  $("#playerPickerDialog").showModal();
  setTimeout(() => $("#playerPickerInput").focus(), 0);
}

function closeProfilePicker() {
  $("#playerPickerDialog").close();
}

function saveProfileFromPicker() {
  const name = $("#playerPickerInput").value.trim();
  if (!name) { toast("Enter a player name first."); return; }
  $("#dashboardPlayerName").value = name;
  commitDashboardProfile(name);
  closeProfilePicker();
}

async function selectProfileFromPicker(name) {
  if (!loadPlayerProfile(name)) { toast(`No saved profile named ${name}.`); return; }
  await hydrateCustomRacer();
  persist();
  showDashboard();
  closeProfilePicker();
  toast(`Loaded ${name}'s profile.`);
}

function deleteProfileFromPicker(name) {
  const requestedName = String(name || "").trim();
  if (!requestedName) return;
  const key = profileKey(requestedName);
  delete data.playerProfiles?.[key];
  delete data.profileLibraries?.[key];
  if (profileKey(data.profile.name) === key) {
    data.profile.name = "";
    data.profile.calibration = null;
    data.profile.challengeLobbySeen = false;
    data.profile.challengeTypingMode = "strict";
    data.profile.challengeRivalWpm = 40;
    data.profile.rotateChallengeStories = false;
    data.profile.challengeStoryCycle = [];
  }
  persist();
  renderProfilePicker();
  renderGlobalNavigation();
  renderCharacters();
  renderPassageList();
  toast(`Deleted ${requestedName}.`);
}

function showLastResults({ historyMode = "push" } = {}) {
  showFinishScreen({ historyMode });
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
  const progress = progressionState();
  championship.aiBaselineWpm = Number(progress.aiBaselineWpm) || data.profile.calibration?.wpm || 35;
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
  const averageWpm = playerRounds.reduce((sum, round) => sum + round.playerWpm, 0) / Math.max(1, playerRounds.length);
  attempt.date = new Date().toISOString();
  attempt.playerPlace = standings.findIndex((racer) => racer.id === "player") + 1;
  attempt.playerPoints = player?.points || 0;
  attempt.averageWpm = averageWpm;
  progress.lastFiveAverage = averageWpm;
  const currentBaseline = Number(progress.aiBaselineWpm) || data.profile.calibration?.wpm || 35;
  if (averageWpm >= currentBaseline + 3) progress.aiBaselineWpm = averageWpm + 3;
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
  const currentBaseline = Number(progress.aiBaselineWpm) || data.profile.calibration?.wpm || 35;
  if (averageWpm >= currentBaseline + 3) progress.aiBaselineWpm = averageWpm + 3;
  progress.unlockedLevel = Math.min(championship.totalLevels, Math.max(progress.unlockedLevel || 1, championship.level + 1));
  championship.completionRecorded = true;
  data.activeChampionship = championship;
  persist();
}

function renderPodium({ historyMode = "push" } = {}) {
  recordLevelAttempt();
  const standings = championshipStandings(championship?.rounds || []);
  const playerPlace = standings.findIndex((racer) => racer.id === "player") + 1;
  displayedPodiumPlace = playerPlace;
  document.body.dataset.overallPlace = String(playerPlace);
  $("#podiumTitle").textContent = `Level ${championship.level} complete - ${ordinal(playerPlace)} overall.`;
  $(".podium-summary").textContent = championship.level >= championship.totalLevels ? "All ten five-race levels are now available from Race Control. Replay any completed level to improve its score." : `Level ${championship.level + 1} is unlocked and ready. You can continue now or return to the ten-level map.`;
  $("#podiumContinueButton").textContent = championship.level >= championship.totalLevels ? "View All Levels" : `Go to Level ${championship.level + 1}`;
  const remaining = replayRemaining(championship.level);
  $("#podiumRetryButton").textContent = `Replay Level ${championship.level} (${remaining} left)`;
  $("#podiumRetryButton").disabled = remaining <= 0;
  [1, 2, 3].forEach((place) => {
    const racer = standings[place - 1];
    const node = `[data-podium-place="${place}"]`;
    const target = $(node, $("#podiumStage"));
    if (!racer) { target.innerHTML = ""; return; }
    const character = renderer.character(racer.characterId);
    const image = character.animations.win?.file || character.portrait;
    target.classList.toggle("is-player", racer.id === "player");
    target.innerHTML = `<img src="${image}" alt=""><div><span>${ordinal(place)}</span><strong>${escapeHtml(racer.name)}</strong><small>${escapeHtml(racer.points)} points</small></div>`;
  });
  const podiumArt = manifest.ui?.podiumBackground;
  $("#podiumStage").style.backgroundImage = podiumArt ? `url("${podiumArt}")` : "";
  $("#podiumStage").classList.toggle("has-custom-art", Boolean(podiumArt));
  showScreen("podium", { historyMode });
}

function openResetRacesDialog() {
  $("#resetRacesDialog")?.showModal();
}

function closeResetRacesDialog() {
  $("#resetRacesDialog")?.close();
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
function showLibrary({ historyMode = "push" } = {}) {
  if (raceActive && racePausedAt === null) pauseRace(true);
  renderPassageList();
  editPassage(editorPassageId || data.passages[0]?.id);
  showScreen("library", { historyMode });
}

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
    return `<section class="passage-section ${collapsed ? "collapsed" : ""}"><button class="passage-section-title" data-toggle-section="${escapeHtml(category)}" aria-expanded="${!collapsed}"><span class="section-caret">&gt;</span><span>${escapeHtml(category)}</span><span class="passage-section-count">${items.length}</span></button><div class="passage-section-items">${items.map((item) => `<div class="passage-row ${editorPassageId === item.id ? "selected" : ""}" data-edit-passage="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><small>${item.source ? `${escapeHtml(item.source)} - ` : ""}${item.text.length} chars - ${item.enabled ? "Enabled" : "Disabled"}</small><div class="row-actions"><button class="mini-button" data-use-passage="${escapeHtml(item.id)}">Use</button><button class="mini-button" data-duplicate-passage="${escapeHtml(item.id)}">Copy</button></div></div>`).join("")}</div></section>`;
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

function applyRacerMotion() {
  // Keep the saved preference, but apply it only to the racers.
  const reduced = Boolean(data.settings.reducedMotion);
  $("#motionButton").setAttribute("aria-pressed", String(reduced));
  $("#dailyRoom").classList.toggle("reduced-racer-motion", reduced);
  if (renderer) renderer.reducedMotion = reduced || deviceMotionPreference.matches;
}

function applySettings() {
  const theme = THEMES.find((item) => item.id === data.settings.theme) || THEMES[0];
  data.settings.theme = theme.id;
  document.body.dataset.theme = theme.id;
  $("#themeSelect").value = theme.id;
  $("meta[name='theme-color']").content = theme.themeColor;
  document.body.classList.toggle("high-contrast", data.settings.highContrast);
  $("#contrastButton").setAttribute("aria-pressed", String(data.settings.highContrast));
  applyRacerMotion();
  $("#soundButton").setAttribute("aria-pressed", String(data.settings.musicEnabled));
  $("#soundButton").setAttribute("aria-label", data.settings.musicEnabled ? "Turn race music off" : "Turn race music on");
  $("#soundButton").title = data.settings.musicEnabled ? "Turn race music off" : "Turn race music on";
  $("#keyNoiseSelect").value = data.settings.keyNoise === false ? "disabled" : "enabled";
  if (audio) { audio.setKeyNoise(data.settings.keyNoise !== false); audio.setMusicEnabled(data.settings.musicEnabled !== false); }
}

function refreshVictoryMotion() {
  if (currentScreen !== "podium") return;
  const reduced = fireworksMotionReduced();
  $("#victoryControls").hidden = displayedPodiumPlace !== 1;
  $("#replayFireworksButton").textContent = reduced ? "Play fireworks once" : "Replay fireworks";
  $("[data-victory-motion-note]").hidden = !reduced;
  void playFireworks($("#podiumStage"), displayedPodiumPlace);
}

function toggleSetting(key) {
  data.settings[key] = !data.settings[key];
  persist();
  applySettings();
}
function toggleMusic() {
  data.settings.musicEnabled = !data.settings.musicEnabled;
  persist(); applySettings();
  if (data.settings.musicEnabled && (currentScreen === "calibration" || (currentScreen === "race" && raceActive && racePausedAt === null))) audio.playMusic();
  else audio.pauseMusic();
  toast(`Music ${data.settings.musicEnabled ? "on" : "off"}.`);
}
function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 1800); }

function handleTypingKey(event) {
  if ($("#challengeScoresDialog").open || $("#leaderboardDialog").open) return;
  if (currentScreen === "results" && event.key === "Enter" && event.target === $("#nextRaceButton") && !$("#nextRaceButton").classList.contains("hidden") && !$("#nextRaceButton").disabled) { event.preventDefault(); nextRace(); return; }
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
    const correct = raceSession.type(event.key, now); registerPlayerKeyHit(now); audio.play(correct ? "key" : "error"); renderTyping($("#raceTyping"), raceSession);
  }
}

function bindEvents() {
  $("#challengeRivalWpm").addEventListener("change", event => {
    if (!validRivalWpm(event.target.value)) return;
    data.profile.challengeRivalWpm = Number(event.target.value);
    persist();
  });
  $("#rotateChallengeStories").addEventListener("change", event => {
    data.profile.rotateChallengeStories = event.target.checked;
    persist();
    syncChallengeStoryChoice();
  });
  for (const event of ["click", "keydown"]) {
    document.addEventListener(event, prepareFireworksAudio, { capture: true, once: true });
  }
  bindHelp($("#helpScreen"));
  bindClassroom({ passages: () => data.passages.filter(p => p.enabled !== false), racers: () => manifest.characters, nickname: () => $("#dashboardPlayerName").value.trim() || data.profile.name });
  bindBrowserTransfer({ getState: () => structuredClone(data), readAsset: loadCustomRacerAsset, writeAsset: saveCustomRacerAsset, removeAsset: deleteCustomRacerAsset, commit: saveState });
  $("#dashboardProfileForm").addEventListener("submit", saveDashboardProfile);
  $("#dashboardPlayerName").addEventListener("input", event => {
    $("#dashboardScreen").classList.toggle("nickname-entered", Boolean(event.target.value.trim()));
    $("#nicknameAvailability").classList.add("hidden");
    event.target.removeAttribute("aria-invalid");
    event.target.removeAttribute("aria-describedby");
  });
  $("#retryChallengePost").addEventListener("click", () => void publishChallengeResult(latestChallengeScore));
  window.addEventListener("online", () => {
    if (currentScreen === "race" && raceSetup?.timedChallenge && !$("#retryChallengePost").hidden)
      void publishChallengeResult(latestChallengeScore);
  });
  $("#manualPaceForm").addEventListener("submit", saveManualPace);
  $("#passageForm").addEventListener("submit", savePassage);
  $("#campaignForm").addEventListener("submit", saveCampaignEditor);
  $("#customRacerFile").addEventListener("change", (event) => { const file=event.target.files?.[0]; if(file) void loadRacerArtwork(file); });
  ["customRacerMode","customRacerTolerance","customRacerScale","customRacerOffsetX","customRacerOffsetY"].forEach(id=>$("#"+id).addEventListener("input",()=>void renderRacerWorkshopPreview()));
  $("#passageText").addEventListener("input", () => $("#passageLength").textContent = `${normalizeText($("#passageText").value).length} characters`);
  $("#importFile").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { const incoming = importPassages(await file.text()); const map = new Map(data.passages.map((item) => [item.id, item])); incoming.forEach((item) => map.set(item.id, item)); data.passages = [...map.values()]; selectedPassageCategory = incoming[0].category || selectedPassageCategory; selectedPassageId = incoming[0].id; persist(); renderPassageGroupControl(); editPassage(incoming[0].id); toast(`Imported ${incoming.length} passage${incoming.length === 1 ? "" : "s"} into ${selectedPassageCategory}.`); } catch (error) { toast(error.message); } event.target.value = ""; });
  document.addEventListener("keydown", handleTypingKey);
  window.addEventListener("blur", () => { audio?.pauseMusic(); if (raceActive && racePausedAt === null) pauseRace(true); });
  window.addEventListener("focus", () => { if (currentScreen === "calibration" || (currentScreen === "race" && raceActive && racePausedAt === null)) audio?.playMusic(); });
  window.addEventListener("popstate", (event) => restoreScreenFromHistory(event.state?.screen || screenFromHash() || (data.profile.calibration ? "dashboard" : "welcome")));
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "help") showHelp();
    if (action === "back-from-help") closeHelp();
    if (action === "home") home();
    if (action === "race-controls") openRaceControls();
    if (action === "welcome") showDashboard();
    if (action === "finish-screen") showFinishScreen();
    if (action === "library") showLibrary();
    if (action === "creator") showCreator();
    if (action === "racer-workshop") void showRacerWorkshop();
    if (action === "save-custom-racer") void saveCustomRacer();
    if (action === "add-another-racer") void saveCustomRacer({ addAnother: true });
    if (action === "delete-custom-racer") { const racerId=event.target.closest("[data-racer-id]")?.dataset.racerId; if(racerId)void deleteSavedCustomRacer(racerId); }
    if (action === "play-active-campaign") playActiveCampaign();
    if (action === "use-campaign") { const campaign=saveCampaignEditor()||selectedCampaign(); if(campaign){ data.activeCampaignIdByProfile ||= {}; data.activeCampaignIdByProfile[profileKey()]=campaign.id; persist(); toast(`${campaign.title} is ready on the Race Controls screen.`); showDashboard(); } }
    if (action === "enable-creator") { data.entitlements ||= {}; data.entitlements.creator = true; persist(); renderCreator(); toast("Creator preview enabled on this browser."); }
    if (action === "new-campaign") { const campaign = createCampaign(); data.campaigns.push(campaign); selectedCampaignId = campaign.id; campaignLevelIndex = 0; persist(); renderCreator(); }
    if (action === "previous-level") { campaignLevelIndex = Math.max(0, campaignLevelIndex - 1); renderCreator(); }
    if (action === "next-level") { campaignLevelIndex = Math.min((selectedCampaign()?.levels.length || 1) - 1, campaignLevelIndex + 1); renderCreator(); }
    if (action === "add-level") { const campaign = saveCampaignEditor() || selectedCampaign(); if (campaign && campaign.levels.length < 10) { campaign.levels.push(blankLevel(campaign.levels.length)); data.campaigns[data.campaigns.findIndex(item=>item.id===campaign.id)] = campaign; campaignLevelIndex = campaign.levels.length - 1; persist(); renderCreator(); } else if (campaign) toast("Campaigns can contain up to ten levels."); }
    if (action === "remove-level") { const campaign = selectedCampaign(); if (campaign?.levels.length > 1) { campaign.levels.splice(campaignLevelIndex,1); campaignLevelIndex = Math.max(0,campaignLevelIndex-1); persist(); renderCreator(); } else toast("Keep at least one level."); }
    if (action === "test-campaign") testCampaign();
    if (action === "duplicate-campaign") { const campaign = saveCampaignEditor() || selectedCampaign(); if (campaign) { const copy = duplicateCampaign(campaign); data.campaigns.push(copy); selectedCampaignId = copy.id; campaignLevelIndex = 0; persist(); renderCreator(); } }
    if (action === "export-campaign") { const campaign = saveCampaignEditor() || selectedCampaign(); if (campaign) { const blob = new Blob([exportCampaign(campaign)], {type:"application/json"}); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download=`${campaign.id}.dinocamp`; link.click(); URL.revokeObjectURL(url); } }
    if (action === "delete-campaign") { if (data.campaigns.length <= 1) toast("Keep at least one campaign."); else { data.campaigns = data.campaigns.filter(item=>item.id!==selectedCampaignId); selectedCampaignId=data.campaigns[0].id; campaignLevelIndex=0; persist(); renderCreator(); } }
    if (action === "typing-dna") renderTypingDna();
    if (action === "close-typing-dna") $("#typingDnaDialog").close();
    if (action === "print-typing-dna") window.print();
    if (action === "cancel-test") showDashboard();
    if (action === "set-starting-pace") beginStartingPace();
    if (action === "confirm-game-settings") confirmGameSettings();
    if (action === "retest") startCalibration();
    if (action === "start-race") startChampionship();
    if (action === "return-to-races") returnToRaces();
    if (action === "reset-all-races") openResetRacesDialog();
    if (action === "close-reset-races") closeResetRacesDialog();
    if (action === "confirm-reset-races") { closeResetRacesDialog(); resetCurrentCategoryRaces(); }
    if (action === "confirm-first-race-help") {
      data.profile.firstRaceHelpSeen = true; persist();
      document.getElementById("firstRaceHelpDialog")?.close();
      raceCountdownEnd = performance.now() + 3000; raceStartTime = raceCountdownEnd;
      if (raceSession) raceSession.startTime = raceStartTime;
    }
    if (action === "open-runners") { previewCharacterId = data.profile.characterId; renderCharacters(); $("#runnerDialog").showModal(); }
    if (action === "close-runners") $("#runnerDialog").close();
    if (action === "accept-runner") { data.profile.characterId = previewCharacterId; persist(); renderCharacters(); $("#runnerDialog").close(); toast(`Racer selected: ${manifest.characters.find((item) => item.id === previewCharacterId)?.displayName || previewCharacterId}.`); }
    if (action === "pause") pauseRace();
    if (action === "resume") resumeRace();
    if (action === "restart-race") startRace({ timedChallenge: raceSetup?.timedChallenge });
    if (action === "start-timed-challenge") startRace({ timedChallenge: true });
    if (action === "challenge-lobby") showChallengeLobby();
    if (action === "use-challenge-pace") useChallengePace();
    if (action === "challenge-back") { showDashboard(); $("#challengeButton").focus({ preventScroll: true }); }
    if (action === "open-challenge-scores") openChallengeScores();
    if (action === "close-challenge-scores") $("#challengeScoresDialog").close();
    if (action === "debug-finish-first") debugFinishRaceFirst();
    if (action === "continue-after-quick-race") continueAfterQuickRace();
    if (action === "dashboard") openRaceControls();
    if (action === "retry-race") retryRace();
    if (action === "next-race") nextRace();
    if (action === "replay-fireworks" && currentScreen === "podium") void playFireworks($("#podiumStage"), displayedPodiumPlace, { manual: true });
    if (action === "view-podium") renderPodium();
    if (action === "last-results") showLastResults();
    if (action === "return-from-results") returnFromResults();
    if (action === "load-profile") loadDashboardProfile();
    if (action === "close-profile-picker") closeProfilePicker();
    if (action === "save-profile-from-picker") saveProfileFromPicker();
    if (action === "open-leaderboard") openLeaderboard();
    if (action === "close-leaderboard") $("#leaderboardDialog").close();
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
    const character = event.target.closest("[data-character]")?.dataset.character; if (character) { previewCharacterId = character; renderCharacters(); }
    const profileName = event.target.closest("[data-profile-name]")?.dataset.profileName; if (profileName && action === "select-profile") void selectProfileFromPicker(profileName);
    if (profileName && action === "delete-profile") deleteProfileFromPicker(profileName);
    const passageOrder = event.target.closest("[data-passage-order]")?.dataset.passageOrder; if (passageOrder) selectPassageOrder(passageOrder);
    const toggleSection = event.target.closest("[data-toggle-section]")?.dataset.toggleSection; if (toggleSection) togglePassageSection(toggleSection);
    const edit = event.target.closest("[data-edit-passage]")?.dataset.editPassage; if (edit && !event.target.closest("button")) editPassage(edit);
    const calibrationChoice = event.target.closest("[data-calibration-mode]")?.dataset.calibrationMode; if (calibrationChoice) selectCalibrationMode(calibrationChoice);
    const raceMode = event.target.closest("[data-race-mode]")?.dataset.raceMode; if (raceMode) selectRaceTypingMode(raceMode);
    const challengeMode = event.target.closest("[data-challenge-mode]")?.dataset.challengeMode; if (challengeMode) selectChallengeTypingMode(challengeMode);
    const scope = event.target.closest("[data-mistake-scope]")?.dataset.mistakeScope; if (scope) { mistakeScope = scope; renderMistakeStats(mistakeReviewResult, mistakeScope); }
    const use = event.target.closest("[data-use-passage]")?.dataset.usePassage; if (use) { const passage = data.passages.find((item) => item.id === use); selectedPassageId = use; if (passage?.category) selectedPassageCategory = passage.category; persist(); toast("Race passage selected."); renderPassageList(); }
    const duplicate = event.target.closest("[data-duplicate-passage]")?.dataset.duplicatePassage; if (duplicate) { const source = data.passages.find((item) => item.id === duplicate); const copy = { ...source, id: `passage-${Date.now()}`, title: `${source.title} Copy` }; data.passages.push(copy); persist(); editPassage(copy.id); toast("Passage duplicated."); }
    const campaignId = event.target.closest("[data-campaign-id]")?.dataset.campaignId; if (campaignId) { selectedCampaignId = campaignId; campaignLevelIndex = 0; renderCreator(); }
  });
  $("#replayLimit").addEventListener("change", saveReplayRules);
  $("#replayGlobal").addEventListener("change", saveReplayRules);
  $("#aiPaceSlider").addEventListener("input", (event) => setAiPace(event.target.value));
  $("#aiPaceSlider").addEventListener("change", (event) => setAiPace(event.target.value, true));
  $("#contrastButton").addEventListener("click", () => toggleSetting("highContrast"));
  $("#motionButton").addEventListener("click", () => toggleSetting("reducedMotion"));
  deviceMotionPreference.addEventListener("change", () => {
    applyRacerMotion();
    refreshVictoryMotion();
  });
  $("#soundButton").addEventListener("click", toggleMusic);
  $("#passageGroupSelect").addEventListener("change", (event) => selectPassageCategory(event.target.value));
  $("#focusKeyHelperSelect").addEventListener("change", (event) => { data.settings.focusKeyHelper = event.target.value !== "disabled"; persist(); renderAiPaceControl(); toast(`Missed-key helper ${data.settings.focusKeyHelper ? "enabled" : "disabled"}.`); });
  $("#keyNoiseSelect").addEventListener("change", (event) => { data.settings.keyNoise = event.target.value !== "disabled"; audio.setKeyNoise(data.settings.keyNoise); persist(); toast(`Key noise ${data.settings.keyNoise ? "on" : "off"}.`); });
  $("#themeSelect").addEventListener("change", (event) => {
    data.settings.theme = event.target.value;
    persist();
    applySettings();
    toast(`Color scheme: ${THEMES.find((theme) => theme.id === data.settings.theme)?.name || "Default"}.`);
  });
  $("#campaignImportFile").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { const campaign = importCampaign(await file.text(), campaignAssets()); if (data.campaigns.some(item=>item.id===campaign.id)) campaign.id = `${campaign.id}-${Date.now()}`; data.campaigns.push(campaign); selectedCampaignId=campaign.id; campaignLevelIndex=0; persist(); renderCreator(); toast("Campaign imported and checked."); } catch(error) { toast(error.message); } event.target.value=""; });
}

init().catch((error) => { console.error(error); document.body.innerHTML = `<main class="fatal"><h1>Dino Type Racer could not start.</h1><p>${escapeHtml(error.message)}</p></main>`; });
