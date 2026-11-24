import { TypingSession } from "./typing.js";
import { bakerStories } from "./challenge-stories-baker.js";
import { railwayStories } from "./challenge-stories-railway.js";
import { curiosityStories } from "./challenge-stories-curiosity.js";

export const CHALLENGE_SECONDS = 60;
const FINAL_CHECK = CHALLENGE_SECONDS - 5;
const SAMPLE_SECONDS = 10;
// Keep enough visible course ahead of even a very sudden sprint. This is
// a ceiling, not a clock-driven position: before the last five seconds an
// idle racer doesn't move at all.
const finishCeiling = elapsed => 1 - 0.8 * Math.max(0, 1 - elapsed / CHALLENGE_SECONDS);
export const CHALLENGE_PASSAGE = {
  id: "challenge-missing-biscuit-v1",
  title: "The Case of the Missing Biscuit",
  source: "An original Holmes-inspired mystery",
  text: [
    'At half past seven, a woman in a green coat burst into Baker Street and announced that her biscuit had been stolen. Holmes asked whether it was buttered. She said it was not. Then, he said, we may proceed without the fire brigade. I had known him to be brisk with nervous visitors, but this was the first time I had seen him rule out a public emergency on the strength of a dry biscuit.',
    'Our visitor ran the Goose and Lantern, a tea shop distinguished by excellent jam and a floor that sloped toward the till. Every morning she put a single biscuit on a blue plate in the front window. Every morning at precisely seven, it vanished. She had blamed a delivery boy, a pigeon, and the man who sold umbrellas across the road. The man had been in Brighton for a week, which she considered a suspiciously elaborate alibi.',
    "Holmes examined the plate and found a narrow band of flour across its rim. There was flour on Mrs. Patterson's sleeves, flour on the windowsill, and a surprising amount of flour on my left shoe. I remarked that surely the thief was a baker. Holmes asked me whether I had stepped on the windowsill. I said I had not. Excellent, he replied. We have reduced our suspects by one and our supply of useful observations by two.",
    'The following morning we waited behind a curtain. A clock struck seven. The plate tilted, the biscuit slid quietly through a crack in the window frame, and a small copper bell rang outside. In the alley, a retired racing pigeon caught the biscuit, dropped it into a flowerpot, and looked around with the air of a gentleman waiting for his carriage. Across the road, a baker opened his back door and exchanged the biscuit for a piece of toast.',
    'The baker explained that he had trained the pigeon to ring the bell whenever the shop opened. The bird had since discovered that the bell worked twice as well when attached to a robbery. Mrs. Patterson considered the matter for a moment, then put up a sign announcing a daily performance at seven. By Friday she had doubled her breakfast trade. The pigeon received a small pension in toast, and Holmes complimented it on being the first criminal of his acquaintance to insist on a fair exchange.',
    'On the way home I asked how he had known there was no danger. Elementary, Watson, he said. The plate was blue, the window was cracked, and Mrs. Patterson had left a spare biscuit on the mantelpiece. I asked what the spare had to do with anything. Nothing whatsoever, he replied, handing me half of it. But it was rather good with tea.',
  ].join(" "),
};

export const CHALLENGE_STORIES = [CHALLENGE_PASSAGE, ...[...bakerStories, ...railwayStories, ...curiosityStories].map(story => ({
  ...story, source: CHALLENGE_PASSAGE.source, text: story.text.trim().replace(/\s+/g, " "),
}))];

function drawFromCycle(items, history, random, avoidFirst) {
  const ids = [...new Set(items.map(item => item.id))];
  if (!ids.length) return { id: null, history: [] };
  let used = [...new Set((Array.isArray(history) ? history : []).filter(id => ids.includes(id)))];
  let options = ids.filter(id => !used.includes(id));
  if (!options.length) {
    options = ids.length === 1 ? ids : ids.filter(id => id !== used.at(-1));
    used = [];
  } else if (!used.length && options.length > 1 && avoidFirst) {
    options = options.filter(id => id !== avoidFirst);
  }
  const id = options[Math.floor(random() * options.length)];
  return { id, history: [...used, id] };
}

export function takeChallengeStory(profile, random = Math.random) {
  if (profile.rotateChallengeStories !== true) return CHALLENGE_PASSAGE;
  const pick = drawFromCycle(CHALLENGE_STORIES, profile.challengeStoryCycle, random, CHALLENGE_PASSAGE.id);
  profile.challengeStoryCycle = pick.history;
  return CHALLENGE_STORIES.find(story => story.id === pick.id);
}

// A browser-wide scenery rotation, independent of nicknames, scores and championships.
export function makeChallengeTrackPicker({ storage = () => globalThis.localStorage, random = Math.random, key = "dino:challenge-track-cycle:v1" } = {}) {
  let visited = [];
  let store;
  try { store = storage(); } catch { /* Storage is optional. */ }
  return tracks => {
    if (!tracks.length) return null;
    if (store) {
      try {
        const saved = JSON.parse(store.getItem(key));
        if (Array.isArray(saved)) visited = saved;
      } catch { /* Keep the in-memory cycle when storage is unreadable. */ }
    }
    const { id, history } = drawFromCycle(tracks, visited, random);
    visited = history;
    try { store?.setItem(key, JSON.stringify(visited)); } catch { store = null; }
    return id;
  };
}

export class TimedChallenge extends TypingSession {
  constructor(mode = "strict", { startingWpm = 40, passage = CHALLENGE_PASSAGE } = {}) {
    super(passage.text, { ignoreMistakes: mode === "flow" });
    this.attemptedCharacters = 0;
    this.startingWpm = Number.isFinite(startingWpm) ? Math.max(5, startingWpm) : 40;
    this.track = {
      from: 0, target: 0, lastHit: null, glide: 0.18, estimatedWpm: this.startingWpm,
      stride: 1 / (this.startingWpm * 5), wordMarks: [{ time: 0, correct: 0 }],
      recentCorrect: 0, finishFrom: null,
    };
  }

  remaining(now) {
    return this.startTime === null ? CHALLENGE_SECONDS : Math.max(0, Math.min(CHALLENGE_SECONDS, CHALLENGE_SECONDS - (now - this.startTime) / 1000));
  }

  type(char, now = performance.now()) {
    if (this.remaining(now) <= 0) return false;
    const position = this.index;
    const before = this.totalKeystrokes;
    const correct = super.type(char, now);
    // A pending Strict miss still counts as attempted, even after pressing Backspace.
    if (this.totalKeystrokes !== before) this.attemptedCharacters = position + 1;
    const elapsed = CHALLENGE_SECONDS - this.remaining(now);
    if (correct) {
      if (elapsed >= FINAL_CHECK - SAMPLE_SECONDS && elapsed < FINAL_CHECK) this.track.recentCorrect++;
      this.earnStride(now, elapsed);
    }
    if (this.index > position && (this.text[position] === " " || this.finished)) this.updateWordPace(now, elapsed);
    return correct;
  }

  backspace(now = performance.now()) {
    if (this.remaining(now) > 0) super.backspace(now);
  }

  get scoreWpm() { return (this.correctCharacters / 5) / (CHALLENGE_SECONDS / 60); }

  get textAccuracy() {
    const attempted = this.ignoreMistakes ? this.index : this.attemptedCharacters;
    return attempted ? this.correctCharacters / attempted : null;
  }

  updateWordPace(now, elapsed) {
    const track = this.track;
    // Replan at every word boundary, using at most four actual passage words
    // so a short word (or a pause) doesn't jerk the next stride around.
    const first = track.wordMarks[0];
    const seconds = elapsed - first.time;
    const visible = this.trackProgress(now);
    if (seconds > 0) {
      track.estimatedWpm = Math.max(5, Math.min(360, (this.correctKeystrokes - first.correct) * 12 / seconds));
      const keysLeft = Math.max(1, this.remaining(now) * track.estimatedWpm / 12);
      const distanceLeft = 1 - Math.max(track.target, visible);
      track.stride = Math.min(0.06, distanceLeft / keysLeft);
    }
    track.wordMarks.push({ time: elapsed, correct: this.correctKeystrokes });
    if (track.wordMarks.length > 4) track.wordMarks.shift();
  }

  earnStride(now, elapsed) {
    const track = this.track;
    const visible = this.trackProgress(now);
    const earned = Math.max(visible, track.target);
    track.from = visible;
    const headroom = Math.max(0, finishCeiling(elapsed) - earned);
    track.target = earned + Math.min(track.stride, headroom * 0.3);
    track.lastHit = elapsed;
    track.glide = Math.max(0.10, Math.min(0.28, 12 / track.estimatedWpm));
  }

  trackProgress(now) {
    const { from, target, lastHit, glide } = this.track;
    const elapsed = CHALLENGE_SECONDS - this.remaining(now);
    const strideAt = time => {
      if (lastHit === null) return 0;
      const t = Math.min(1, Math.max(0, (time - lastHit) / glide));
      return from + (target - from) * (1 - (1 - t) ** 2);
    };
    const visible = strideAt(elapsed);
    // Only the final approach has an automatic assist; it never earns WPM.
    if (elapsed < FINAL_CHECK) return visible;
    if (this.track.finishFrom === null) {
      this.track.finishFrom = strideAt(FINAL_CHECK);
      // Use recent correct typing, including partial words. A quiet sample has
      // no usable speed: keep the last stride for a restart and let the glide finish.
      const recentWpm = this.track.recentCorrect * 12 / SAMPLE_SECONDS;
      if (recentWpm > 0) {
        this.track.estimatedWpm = recentWpm;
        const keysLeft = Math.max(1, recentWpm * (CHALLENGE_SECONDS - FINAL_CHECK) / 12);
        this.track.stride = (1 - Math.max(target, this.track.finishFrom)) / keysLeft;
      }
    }
    if (elapsed >= CHALLENGE_SECONDS) return 1;
    const t = (elapsed - FINAL_CHECK) / (CHALLENGE_SECONDS - FINAL_CHECK);
    const assist = this.track.finishFrom + (1 - this.track.finishFrom) * t * t * (3 - 2 * t);
    return Math.min(finishCeiling(elapsed), Math.max(visible, assist));
  }
}

export function formatChallengeAccuracy(accuracy) {
  if (accuracy === null) return "—";
  if (accuracy === 1) return "100%";
  // A rounded 100% would hide a real mistake on a fast run.
  return `${Math.min(99.9, Math.round(accuracy * 1_000) / 10)}%`;
}
