const CAST = [
  ["confusion", "Switchclaw", "A smug little raptor who swaps nearby letters, then insists the keyboard did it."],
  ["vowel", "Vowelociraptor", "This speedy trickster scrambles vowels and celebrates every accidental e where an i belongs."],
  ["capital", "Lowercaseaurus", "Too lazy to reach Shift, this sleepy giant believes every proper name should whisper."],
  ["caps", "Caps-Lockjaw", "EVERYTHING IS IMPORTANT to this roaring tyrant—even words like the."],
  ["punctuation", "Comma Chomper", "It gobbles punctuation and leaves sentences gasping for breath."],
  ["period", "Periodactyl", "It swoops away with periods, causing sentences to wander far beyond bedtime."],
  ["word", "Spellosaurus Wrecks", "It confidently misspells difficult words and awards itself a gold star anyway."],
  ["double", "Double-Letter Dilo", "It steals one letter from necessary, adds three to tomorrow, and calls that balance."],
  ["combination", "Digraphadon", "It lurks around th, sh, ch, and qu, making nimble fingers feel prehistoric."],
  ["slow", "Stumblehorn", "It turns awkward combinations into speed bumps—and wears a traffic cone on each horn."],
];
const vowels = new Set(["a", "e", "i", "o", "u"]);
const punctuation = /[.,;:!?"']/;
export function nemesisKey(mistake) {
  const expected = String(mistake.expected || ""), typed = String(mistake.typed || "");
  if (expected && expected.toUpperCase() === expected && expected.toLowerCase() !== expected) return `capital:${expected.toLowerCase()}`;
  if (punctuation.test(expected)) return `punctuation:${expected}`;
  if (vowels.has(expected.toLowerCase()) && vowels.has(typed.toLowerCase())) return `vowel:${expected.toLowerCase()}>${typed.toLowerCase()}`;
  return `confusion:${expected.toLowerCase()}>${typed.toLowerCase()}`;
}
function castFor(key) { const type = key.split(":")[0]; return CAST.find(([kind]) => kind === type) || CAST[0]; }
export function buildNemeses(records = [], previous = {}) {
  const encounters = new Map();
  records.forEach((record) => (record.mistakes || []).forEach((mistake) => { const key = nemesisKey(mistake); encounters.set(key, (encounters.get(key) || 0) + 1); }));
  const cleanRaces = records.filter((record) => Number(record.errors || 0) === 0).length;
  const result = {};
  encounters.forEach((misses, key) => { const [, name, personality] = castFor(key); const old = previous[key] || {}; const cleanWins = Math.max(Number(old.cleanWins) || 0, Math.min(3, cleanRaces)); result[key] = { key, name, personality, misses, cleanWins, strength: Math.max(0, Math.min(100, misses * 12 - cleanWins * 18)), mastered: cleanWins >= 3 }; });
  return result;
}
export function updateNemesisMastery(nemeses, result) {
  const next = structuredClone(nemeses || {}); const missed = new Set((result.mistakes || []).map(nemesisKey));
  Object.values(next).forEach((nemesis) => { if (missed.has(nemesis.key)) { nemesis.misses += 1; nemesis.cleanWins = 0; } else { nemesis.cleanWins = Math.min(3, (nemesis.cleanWins || 0) + 1); } nemesis.strength = Math.max(0, Math.min(100, nemesis.misses * 12 - nemesis.cleanWins * 18)); nemesis.mastered = nemesis.cleanWins >= 3; });
  return next;
}
export function activeNemeses(nemeses, limit = 5) { return Object.values(nemeses || {}).filter((item) => !item.mastered).sort((a,b) => b.strength - a.strength || b.misses - a.misses).slice(0, limit); }
export function buildBossPassage(baseText, nemeses) { const targets = activeNemeses(nemeses, 3).map((item) => item.key.split(":")[1]).filter(Boolean); return targets.length ? `${baseText} The final trail tests ${targets.join(", ")} more than once, but calm hands can turn every old stumble into a clean finish.` : baseText; }
export function typingDna(records = [], nemeses = {}) { const wpms = records.map(r=>Number(r.wpm)).filter(Number.isFinite), accuracies = records.map(r=>Number(r.accuracy)).filter(Number.isFinite); return { races: records.length, averageWpm: wpms.length ? wpms.reduce((a,b)=>a+b,0)/wpms.length : 0, averageAccuracy: accuracies.length ? accuracies.reduce((a,b)=>a+b,0)/accuracies.length : 1, active: activeNemeses(nemeses), mastered: Object.values(nemeses).filter(n=>n.mastered), corrections: records.reduce((sum,r)=>sum+(r.errors||0),0) }; }
