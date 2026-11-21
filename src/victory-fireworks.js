import { startFireworksAudio, waitForFireworksAudio } from "./victory-audio.js";
import { makeBurstField, drawBurstField, showMs } from "./victory-bursts.js";
export { prepareFireworksAudio } from "./victory-audio.js";

// A fresh object URL restarts this single-play GIF on every win, even from cache.
const asset = new URL("../assets/ui/first-place-fireworks.gif", import.meta.url);
const stillAsset = new URL("../assets/ui/first-place-fireworks-still.png", import.meta.url);
const active = new WeakMap();
let artwork;

export function fireworksMotionReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function clearFireworks(host) {
  active.get(host)?.();
}

export async function playFireworks(host, place, { manual = false } = {}) {
  clearFireworks(host);
  if (place !== 1 || !host.getClientRects().length) return;
  let url, timer, stopSound, stopDrawing, still = false;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const field = makeBurstField();
  const stage = document.createElement("figure");
  stage.className = "victory-fireworks";
  stage.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  const image = document.createElement("img");
  image.alt = "";
  image.draggable = false;
  stage.append(canvas, image);
  const releaseAnimation = () => {
    clearTimeout(timer);
    stopSound?.();
    stopSound = undefined;
    stopDrawing?.();
    stopDrawing = undefined;
    image.onload = image.onerror = null;
    if (url) URL.revokeObjectURL(url);
    url = undefined;
  };
  const stop = () => {
    stage.remove();
    releaseAnimation();
    motion.removeEventListener?.("change", onMotionChange);
    active.delete(host);
  };
  const showStill = () => {
    if (still) return;
    still = true;
    releaseAnimation();
    stage.className = "victory-fireworks is-still";
    image.src = stillAsset.href;
    if (!stage.isConnected) host.append(stage);
    stopDrawing = drawBurstField(canvas, field, false);
  };
  const onMotionChange = (event) => { if (!manual && event.matches) showStill(); };
  motion.addEventListener?.("change", onMotionChange);
  active.set(host, stop);
  if (!manual && motion.matches) {
    showStill();
    return;
  }
  try {
    artwork ??= fetch(asset).then(r => {
      if (!r.ok) throw Error("Fireworks unavailable");
      return r.blob();
    }).catch(e => { artwork = undefined; throw e; });
    const [bytes] = await Promise.all([artwork, waitForFireworksAudio()]);
    if (active.get(host) !== stop || still) return;
    if (!host.getClientRects().length) { stop(); return; }
    if (!manual && fireworksMotionReduced()) { showStill(); return; }
    url = URL.createObjectURL(bytes);
    stage.className = `victory-fireworks is-animated${manual ? " is-manual" : ""}`;
    image.onload = () => {
      if (active.get(host) !== stop) return;
      if (!host.getClientRects().length) return stop();
      image.onload = null;
      stopDrawing = drawBurstField(canvas, field, true);
      stopSound = startFireworksAudio(showMs / 1000);
      timer = setTimeout(() => {
        if (manual && fireworksMotionReduced()) showStill();
        else stop();
      }, showMs);
    };
    image.onerror = showStill;
    host.append(stage);
    image.src = url;
  } catch { if (active.get(host) === stop) showStill(); }
}
