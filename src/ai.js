export class SeededRandom {
  constructor(seed = 1) { this.seed = seed >>> 0; }
  next() { let t = this.seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
}

function hashSeed(text) { let hash = 2166136261; for (const char of text) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }

export function createAiRacers({ mode, baselineWpm, ratios, fixedRatio, passageId, bestReplay, characters, playerCharacterId = "nova" }) {
  const seed = hashSeed(`${mode}:${passageId}:${Math.round(baselineWpm * 10)}`);
  const botCharacters = characters.filter((character) => character.id !== playerCharacterId);
  const roster = botCharacters.length ? botCharacters : characters;
  const selectedRatios = mode === "fixed" ? [0.94, 0.98, 1.02, 1.06].map((n) => n * fixedRatio) : ratios;
  const makeRacer = (ratio, index) => {
    const rng = new SeededRandom(seed + index * 9973);
    const segments = Array.from({ length: 500 }, (_, segment) => ({
      factor: 0.94 + rng.next() * 0.12,
      pause: rng.next() < 0.09 ? 0.16 + rng.next() * 0.42 : 0,
      segment,
    }));
    const character = roster[index % roster.length];
    return { id: `ai-${index}`, name: character.displayName || character.id, characterId: character.id, targetWpm: Math.max(5, baselineWpm * ratio), segments, progress: 0, finishTime: null };
  };
  const standard = selectedRatios.map(makeRacer);
  if (mode === "ghost" && bestReplay) {
    return [{ id: "ghost", name: "Your Best", characterId: playerCharacterId, isGhost: true, replay: bestReplay.samples, progress: 0, finishTime: null }, ...standard.slice(1)];
  }
  return standard;
}
export function updateAi(racer, elapsed, textLength) {
  if (racer.finishTime !== null) return racer.progress;
  if (racer.isGhost) {
    const replay = racer.replay || [];
    let point = replay[0] || { p: 0 };
    for (const sample of replay) { if (sample.t <= elapsed) point = sample; else break; }
    racer.progress = Math.min(1, point.p || 0);
  } else {
    const cps = racer.targetWpm * 5 / 60;
    const segmentLength = 0.75;
    const whole = Math.floor(elapsed / segmentLength);
    let chars = 0;
    for (let i = 0; i < whole; i += 1) { const segment = racer.segments[i] || racer.segments.at(-1); chars += cps * Math.max(0, segmentLength - segment.pause) * segment.factor; }
    const current = racer.segments[whole] || racer.segments.at(-1);
    const partial = elapsed - whole * segmentLength;
    chars += cps * Math.max(0, partial - current.pause) * current.factor;
    racer.progress = Math.min(1, chars / textLength);
  }
  if (racer.progress >= 1 && racer.finishTime === null) racer.finishTime = elapsed;
  return racer.progress;
}

export function calculatePlace(playerProgress, racers) {
  return 1 + racers.filter((racer) => racer.progress > playerProgress + 0.0001).length;
}
