import { CONFIG, STARTER_PASSAGES } from "./config.js";

export function defaultState() {
  return {
    version: 1,
    profile: { name: "", characterId: "nova", calibration: null, challengeTypingMode: "strict" },
    playerProfiles: {},
    profileLibraries: {},
    entitlements: { creator: false },
    campaigns: [],
    campaignProgress: {},
    nemesesByProfile: {},
    customRacersByProfile: {},
    activeCampaignIdByProfile: {},
    settings: { musicEnabled: true, keyNoise: true, reducedMotion: false, highContrast: false, aiPaceOffset: 0, theme: "pumpkin-coast", focusKeyHelper: true, raceTypingMode: "strict" },
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
    const settings = { ...fallback.settings, ...(saved.settings || {}) };
    const savedPassages = (Array.isArray(saved.passages) ? saved.passages : [])
      .filter((passage) => passage.category !== "Public Domain Songs" && !String(passage.id || "").startsWith("public-song-"));
    saved.passages = savedPassages.length ? savedPassages : fallback.passages;
    if (saved.selectedPassageCategory === "Public Domain Songs") saved.selectedPassageCategory = "Biblical Passages";
    const cleanedProfileLibraries = Object.fromEntries(Object.entries(saved.profileLibraries || {}).map(([key, library]) => {
      const passages = (Array.isArray(library?.passages) ? library.passages : [])
        .filter((passage) => passage.category !== "Public Domain Songs" && !String(passage.id || "").startsWith("public-song-"));
      return [key, {
        ...library,
        passages: passages.length ? passages : structuredClone(fallback.passages),
        selectedPassageCategory: library?.selectedPassageCategory === "Public Domain Songs" ? "Biblical Passages" : library?.selectedPassageCategory,
      }];
    }));
    if (saved.settings?.musicEnabled === undefined && saved.settings?.muted !== undefined) settings.musicEnabled = !saved.settings.muted;
    if (saved.settings?.keyNoise === undefined && saved.settings?.muted !== undefined) settings.keyNoise = !saved.settings.muted;
    delete settings.muted;
    return {
      ...fallback,
      ...saved,
      profile: { ...fallback.profile, ...(saved.profile || {}) },
      playerProfiles: saved.playerProfiles && typeof saved.playerProfiles === "object" ? saved.playerProfiles : {},
      profileLibraries: cleanedProfileLibraries,
      entitlements: { ...fallback.entitlements, ...(saved.entitlements || {}) },
      campaigns: Array.isArray(saved.campaigns) ? saved.campaigns : [],
      campaignProgress: saved.campaignProgress && typeof saved.campaignProgress === "object" ? saved.campaignProgress : {},
      nemesesByProfile: saved.nemesesByProfile && typeof saved.nemesesByProfile === "object" ? saved.nemesesByProfile : {},
      customRacersByProfile: saved.customRacersByProfile && typeof saved.customRacersByProfile === "object" ? saved.customRacersByProfile : {},
      activeCampaignIdByProfile: saved.activeCampaignIdByProfile && typeof saved.activeCampaignIdByProfile === "object" ? saved.activeCampaignIdByProfile : {},
      settings,
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
