import { CONFIG, STARTER_PASSAGES } from "./config.js";

export function defaultState() {
  return {
    version: 1,
    profile: { name: "", characterId: "nova", calibration: null },
    profileLibraries: {},
    settings: { muted: false, reducedMotion: false, highContrast: false, aiPaceOffset: 0, theme: "sunset-sprint", focusKeyHelper: true },
    passages: structuredClone(STARTER_PASSAGES),
    selectedPassageCategory: "Biblical Passages",
    collapsedPassageSections: {},
    records: [],
    bestReplay: null,
  };
}

export function loadState(storage = localStorage) {
  const fallback = defaultState();
  try {
    const saved = JSON.parse(storage.getItem(CONFIG.storageKey));
    if (!saved || saved.version !== 1) return fallback;
    return {
      ...fallback,
      ...saved,
      profile: { ...fallback.profile, ...(saved.profile || {}) },
      profileLibraries: saved.profileLibraries && typeof saved.profileLibraries === "object" ? saved.profileLibraries : {},
      settings: { ...fallback.settings, ...(saved.settings || {}) },
      passages: (Array.isArray(saved.passages) && saved.passages.length ? saved.passages : fallback.passages).map((passage) => ({ ...passage, category: passage.category || "General" })),
      selectedPassageCategory: saved.selectedPassageCategory || fallback.selectedPassageCategory,
      collapsedPassageSections: saved.collapsedPassageSections && typeof saved.collapsedPassageSections === "object" ? saved.collapsedPassageSections : {},
      records: Array.isArray(saved.records) ? saved.records : [],
    };
  } catch {
    return fallback;
  }
}

export function saveState(state, storage = localStorage) {
  storage.setItem(CONFIG.storageKey, JSON.stringify(state));
}