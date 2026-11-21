import { getGameAudioContext } from "./audio.js";

const clips = [
  { url: new URL("../assets/audio/dragon-studio-fireworks-12-419031.mp3", import.meta.url), gain: 0.38 },
  { url: new URL("../assets/audio/pwlpl-achievement-unlocked-361842.mp3", import.meta.url), gain: 0.60 },
];
let context;
let loading;

// A real click or key press allows audio before an automatically shown finish or podium.
export function prepareFireworksAudio() {
  try {
    context = getGameAudioContext();
    if (!context) return;
    if (context.state !== "running") void context.resume().catch(() => {});
    if (loading || clips.every(clip => clip.buffer)) return;
    loading = Promise.all(clips.map(async clip => {
      if (clip.buffer) return;
      try {
        const response = await fetch(clip.url);
        if (response.ok) clip.buffer = await context.decodeAudioData(await response.arrayBuffer());
      } catch { /* A missing sound must not prevent a win or silence the other cue. */ }
    })).finally(() => { loading = undefined; });
  } catch { /* Audio is optional when the browser or device cannot play it. */ }
}

// For a cold-cache podium, give the clips a brief head start, but never hold up the art.
export async function waitForFireworksAudio() {
  if (!loading) return;
  let timeout;
  try {
    await Promise.race([loading, new Promise(resolve => { timeout = setTimeout(resolve, 300); })]);
  } finally { clearTimeout(timeout); }
}

export function startFireworksAudio(durationSeconds) {
  if (context?.state !== "running") return;
  const sources = [];
  const when = context.currentTime + 0.015;
  for (const clip of clips) {
    if (!clip.buffer) continue;
    const source = context.createBufferSource();
    const envelope = context.createGain();
    source.buffer = clip.buffer;
    source.connect(envelope).connect(context.destination);
    const end = when + Math.min(clip.buffer.duration, durationSeconds);
    envelope.gain.setValueAtTime(clip.gain, when);
    envelope.gain.setValueAtTime(clip.gain, Math.max(when, end - 0.4));
    envelope.gain.linearRampToValueAtTime(0, end);
    source.onended = () => { source.disconnect(); envelope.disconnect(); };
    source.start(when);
    source.stop(end);
    sources.push(source);
  }
  return () => { for (const source of sources) source.stop(); };
}
