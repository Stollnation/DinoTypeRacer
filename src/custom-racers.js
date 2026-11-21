const DB_NAME = "dino-type-racer-assets";
const STORE_NAME = "custom-racers";
export const CUSTOM_RACER_SIZE = 1024;
export const CUSTOM_RACER_ANCHOR = { x: 512, y: 856 };

export function customRacerId(profileKey, racerKey = "") {
  const suffix = String(racerKey || "").trim().replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "");
  return `custom-racer-${profileKey}${suffix ? `-${suffix}` : ""}`;
}

export function validateRacerFile(file) {
  if (!file) return "Choose an image first.";
  if (!["image/png", "image/webp", "image/jpeg"].includes(file.type)) return "Use a PNG, WebP, or JPEG image.";
  if (file.size > 12 * 1024 * 1024) return "Keep the source image under 12 MB.";
  return "";
}

export function removePinkPixels(imageData, tolerance = 70) {
  const pixels = imageData.data;
  const limit = Math.max(0, Math.min(220, Number(tolerance) || 0));
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
    const distance = Math.hypot(255 - red, green, 255 - blue);
    if (distance <= limit) {
      const edge = Math.max(0, Math.min(1, (distance - limit * .55) / Math.max(1, limit * .45)));
      pixels[index + 3] = Math.round(pixels[index + 3] * edge);
    }
  }
  return imageData;
}

export async function renderCustomRacer({ image, mode = "alpha", tolerance = 70, scale = 1, offsetX = 0, offsetY = 0 }) {
  const scratch = document.createElement("canvas");
  scratch.width = Math.min(2048, image.naturalWidth); scratch.height = Math.min(2048, image.naturalHeight);
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  scratchContext.drawImage(image, 0, 0, scratch.width, scratch.height);
  let sourceData = scratchContext.getImageData(0, 0, scratch.width, scratch.height);
  if (mode === "pink") { sourceData = removePinkPixels(sourceData, tolerance); scratchContext.putImageData(sourceData, 0, 0); }
  let minX = scratch.width, minY = scratch.height, maxX = 0, maxY = 0;
  for (let y = 0; y < scratch.height; y += 2) for (let x = 0; x < scratch.width; x += 2) {
    if (sourceData.data[(y * scratch.width + x) * 4 + 3] > 16) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX <= minX || maxY <= minY) { minX = minY = 0; maxX = scratch.width; maxY = scratch.height; }
  const sourceWidth = maxX - minX, sourceHeight = maxY - minY;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = CUSTOM_RACER_SIZE;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const fit = Math.min(760 / sourceWidth, 760 / sourceHeight) * Math.max(.35, Math.min(1.8, Number(scale) || 1));
  const width = sourceWidth * fit, height = sourceHeight * fit;
  const x = CUSTOM_RACER_ANCHOR.x - width / 2 + Number(offsetX || 0);
  const y = CUSTOM_RACER_ANCHOR.y - height + Number(offsetY || 0);
  context.drawImage(scratch, minX, minY, sourceWidth, sourceHeight, x, y, width, height);
  return canvas;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomRacerAsset(profileKey, blob) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, profileKey);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadCustomRacerAsset(profileKey) {
  const database = await openDatabase();
  const result = await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(profileKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

export async function deleteCustomRacerAsset(assetKey) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(assetKey);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export function customRacerManifest(profileKey, name, url, racerKey = "") {
  const animation = { file: url, frames: 1, fps: 1 };
  return {
    id: customRacerId(profileKey, racerKey), displayName: name || "My Racer", portrait: url,
    renderSize: 122, raceScale: 2, playerScale: 1.14, footAnchorY: CUSTOM_RACER_ANCHOR.y,
    animations: { idle: animation, run: animation, boost: animation, win: animation, lose: animation },
    custom: true,
  };
}
