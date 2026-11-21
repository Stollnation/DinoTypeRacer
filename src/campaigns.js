export const CAMPAIGN_SCHEMA_VERSION = 1;
export const CREATOR_PRICE = "$39 one-time";

const slug = (value) => String(value || "campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";
const clean = (value, max = 500) => String(value || "").trim().slice(0, max);

export function blankRace(index = 0) {
  return { id: `race-${index + 1}`, title: `Race ${index + 1}`, passageId: "", trackId: "", racerId: "", difficulty: 1, requiredAccuracy: 0.9, intro: "", victory: "", bossDialogue: "", boss: index === 4, enabled: true };
}
export function blankLevel(index = 0) {
  return { id: `level-${index + 1}`, title: `Level ${index + 1}`, rewards: { racers: [], tracks: [], trophies: [], badges: [] }, races: Array.from({ length: 5 }, (_, race) => blankRace(race)) };
}
export function createCampaign(overrides = {}) {
  const createdAt = new Date().toISOString();
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    id: overrides.id || `${slug(overrides.title || "new-campaign")}-${Date.now()}`,
    title: "New Dino Campaign", description: "Build a five-race typing adventure.", ageRange: "8+", learningGoal: "Accuracy and confident speed",
    intro: "The starting gate is open. Choose a racer and recover the lost typing stones!", victory: "The valley is safe, the signs are readable, and your keyboard is still smoking.",
    enabled: true, createdAt, updatedAt: createdAt, levels: [blankLevel(0)], ...overrides,
  };
}

export function validateCampaign(input, assets = {}) {
  if (!input || typeof input !== "object") throw new Error("Campaign file must contain an object.");
  if (input.schemaVersion !== CAMPAIGN_SCHEMA_VERSION) throw new Error(`Unsupported campaign version. Expected ${CAMPAIGN_SCHEMA_VERSION}.`);
  const title = clean(input.title, 80); if (!title) throw new Error("Campaign needs a title.");
  const levels = Array.isArray(input.levels) ? input.levels : [];
  if (!levels.length || levels.length > 10) throw new Error("Campaigns need 1 to 10 levels.");
  const ids = new Set();
  const passageIds = new Set(assets.passages || []), trackIds = new Set(assets.tracks || []), racerIds = new Set(assets.racers || []);
  const normalizedLevels = levels.map((level, levelIndex) => {
    const levelId = clean(level.id, 60) || `level-${levelIndex + 1}`; if (ids.has(levelId)) throw new Error(`Duplicate ID: ${levelId}`); ids.add(levelId);
    const races = Array.isArray(level.races) ? level.races : [];
    if (races.length !== 5) throw new Error(`Level ${levelIndex + 1} must contain exactly five races.`);
    return { ...blankLevel(levelIndex), ...level, id: levelId, title: clean(level.title, 80) || `Level ${levelIndex + 1}`, races: races.map((race, raceIndex) => {
      const id = clean(race.id, 60) || `${levelId}-race-${raceIndex + 1}`; if (ids.has(id)) throw new Error(`Duplicate ID: ${id}`); ids.add(id);
      return { ...blankRace(raceIndex), ...race, id, title: clean(race.title, 80) || `Race ${raceIndex + 1}`, difficulty: Math.max(0.5, Math.min(1.5, Number(race.difficulty) || 1)), requiredAccuracy: Math.max(0.5, Math.min(1, Number(race.requiredAccuracy) || 0.9)), passageId: passageIds.has(race.passageId) ? race.passageId : "", trackId: trackIds.has(race.trackId) ? race.trackId : "", racerId: racerIds.has(race.racerId) ? race.racerId : "" };
    }) };
  });
  return { ...createCampaign(), ...input, id: clean(input.id, 80) || slug(title), title, description: clean(input.description, 800), ageRange: clean(input.ageRange, 30), learningGoal: clean(input.learningGoal, 160), intro: clean(input.intro, 1000), victory: clean(input.victory, 1000), levels: normalizedLevels, updatedAt: new Date().toISOString() };
}

export function exportCampaign(campaign) { return JSON.stringify(campaign, null, 2); }
export function importCampaign(source, assets) { try { return validateCampaign(JSON.parse(source), assets); } catch (error) { if (error instanceof SyntaxError) throw new Error("This is not a valid .dinocamp file."); throw error; } }
export function duplicateCampaign(campaign) { const copy = structuredClone(campaign); copy.id = `${slug(campaign.title)}-${Date.now()}`; copy.title = `${campaign.title} Copy`; copy.createdAt = new Date().toISOString(); copy.updatedAt = copy.createdAt; return copy; }
export function reorderItem(items, index, direction) { const next = index + direction; if (next < 0 || next >= items.length) return [...items]; const copy = [...items]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; }
