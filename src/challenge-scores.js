import { CHALLENGE_PASSAGE, CHALLENGE_SECONDS, CHALLENGE_STORIES } from "./timed-challenge.js";

const ENDPOINT = "/.netlify/functions/challenge-leaderboard";
const storyLengths = new Map(CHALLENGE_STORIES.map(story => [story.id, story.text.length]));
const maxStoryLength = Math.max(...storyLengths.values());
// Keep the existing shared ranking namespace and legacy clients' original passage.
export const CHALLENGE_SCORE_PREFIX = `${CHALLENGE_PASSAGE.id}/`;
export const CHALLENGE_PLAY_PREFIX = `${CHALLENGE_SCORE_PREFIX}plays/`;
export const isChallengeToken = token => typeof token === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token);

export function challengeNickname(input) {
  if (typeof input !== "string" || input.length > 64) return null;
  const nickname = input.normalize("NFC").trim().replace(/ +/g, " ");
  return /^[\p{L}\p{N}][\p{L}\p{N}\p{M} _-]{1,23}$/u.test(nickname) ? nickname : null;
}

export function challengeScore(submission) {
  const nickname = challengeNickname(submission?.nickname);
  const { correct, attempts, passageId = CHALLENGE_PASSAGE.id } = submission || {};
  const length = storyLengths.get(passageId);
  if (!nickname || !length || !Number.isInteger(correct) || !Number.isInteger(attempts)
    || correct < 1 || correct > length || correct > attempts || attempts > length * 3) return null;
  return {
    nickname,
    wpm: (correct / 5) / (CHALLENGE_SECONDS / 60),
    accuracy: Math.round(10_000 * correct / attempts) / 10_000,
  };
}

// Independent, deterministic blobs avoid sharing a mutable score table.
export function challengeScoreKey(submission) {
  const score = challengeScore(submission);
  if (!score) return null;
  return `${CHALLENGE_SCORE_PREFIX}${submission.correct}:${Math.round(score.accuracy * 10_000)}:${encodeURIComponent(score.nickname)}`;
}

export function challengeRankings(blobs) {
  const best = new Map();
  for (const { key } of blobs) {
    if (!key.startsWith(CHALLENGE_SCORE_PREFIX)) continue;
    const fields = key.slice(CHALLENGE_SCORE_PREFIX.length).match(/^(\d{1,4}):(\d{1,5}):([^:]+)$/);
    if (!fields) continue;
    const correct = Number(fields[1]);
    const accuracy = Number(fields[2]) / 10_000;
    let nickname;
    try { nickname = challengeNickname(decodeURIComponent(fields[3])); } catch { continue; }
    if (!nickname || correct < 1 || correct > maxStoryLength || accuracy <= 0 || accuracy > 1) continue;
    const row = { nickname, wpm: (correct / 5) / (CHALLENGE_SECONDS / 60), accuracy };
    const alias = nickname.toLowerCase();
    const prev = best.get(alias);
    if (!prev || row.wpm > prev.wpm || (row.wpm === prev.wpm && row.accuracy > prev.accuracy)) best.set(alias, row);
  }
  return [...best.values()].sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || a.nickname.localeCompare(b.nickname)).slice(0, 50);
}

export async function fetchChallengeBoard(fetcher = fetch) {
  const response = await fetcher(ENDPOINT, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Online Challenge scores are unavailable right now.");
  const payload = await response.json();
  if (!Array.isArray(payload.records) || !Number.isSafeInteger(payload.plays)) throw new Error("Online Challenge scores are unavailable right now.");
  return { records: payload.records, plays: payload.plays };
}

export async function fetchChallengeScores(fetcher = fetch) { return (await fetchChallengeBoard(fetcher)).records; }

export async function recordChallengePlay(attemptId, fetcher = fetch) {
  const response = await fetcher(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ attemptId }),
  });
  return response.ok;
}

export async function checkChallengeNickname(nickname, ownerId, fetcher = fetch) {
  if (!challengeNickname(nickname) || !isChallengeToken(ownerId)) return null;
  const response = await fetcher(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ checkNickname: nickname, ownerId }),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return typeof payload.available === "boolean" ? payload.available : null;
}

export async function postChallengeScore(submission, fetcher = fetch) {
  if (!challengeScore(submission)) throw new Error("Enter a nickname with 2 to 24 letters, numbers, spaces, hyphens, or underscores.");
  const { nickname, correct, attempts, ownerId, passageId } = submission;
  const response = await fetcher(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ nickname, correct, attempts, ownerId, passageId }),
  });
  if (response.status === 409) throw new Error("Name already taken. Try a different public nickname.");
  if (!response.ok) throw new Error("Could not post your score online. Try again in a moment.");
}
