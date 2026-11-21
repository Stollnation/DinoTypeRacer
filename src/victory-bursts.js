// Jitter one shell inside each region, then shuffle launch order. An unlucky roll
// can't send every shell to the same corner, even on a very wide or narrow stage.
const hues = ["#ffd569", "#ff9a63", "#ffb5dc", "#79edd6", "#a8dfff", "#cab2ff"];
export const showMs = 3800;

export function makeBurstField(random = Math.random) {
  const bursts = Array.from({ length: 15 }, (_, i) => ({
    x: (i % 5 + .24 + .52 * random()) / 5,
    y: (Math.floor(i / 5) + .25 + .5 * random()) / 3,
    scale: .64 + random() * .52,
    color: hues[Math.floor(random() * hues.length)],
    rays: Array.from({ length: 32 }, (_, j) => {
      const angle = 2 * Math.PI * (j + random() * .6) / 32;
      const reach = .6 + .4 * random();
      return [Math.cos(angle) * reach, Math.sin(angle) * reach];
    })
  }));
  for (let i = bursts.length - 1; i > 0; --i) {
    const j = Math.floor(random() * (i + 1));
    [bursts[i], bursts[j]] = [bursts[j], bursts[i]];
  }
  return bursts.map((burst, i) => ({
    ...burst, start: i * 165 - 150 + random() * 70, duration: 1050 + random() * 400
  }));
}

// The original artist's GIF is still the featured artwork. A single transparent
// drawing surface adds individually timed shells without decoding more GIFs.
export function drawBurstField(canvas, bursts, animated) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let frame, observer;
  const began = performance.now();
  function paint(now) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2400000 / (w * h)));
    const pixelsX = Math.round(w * dpr), pixelsY = Math.round(h * dpr);
    if (canvas.width !== pixelsX || canvas.height !== pixelsY) {
      canvas.width = pixelsX; canvas.height = pixelsY;
    }
    ctx.setTransform(pixelsX / w, 0, 0, pixelsY / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    for (const [i, burst] of bursts.entries()) {
      const age = animated ? (now - began - burst.start) / burst.duration : .26 + (i % 4) * .085;
      if (age < 0 || age > 1) continue;
      const x = w * burst.x, y = h * burst.y;
      const radius = Math.min(w * .107, h * .245, 155) * burst.scale;
      ctx.strokeStyle = burst.color;
      if (age < .16) {
        const fly = 1 - age / .16;
        ctx.globalAlpha = .8;
        ctx.lineWidth = Math.max(1.2, radius * .026);
        ctx.beginPath();
        ctx.moveTo(x, y + fly * radius);
        ctx.lineTo(x, y + fly * radius + radius * .12);
        ctx.stroke();
        continue;
      }
      const t = (age - .16) / .84;
      const head = 1 - (1 - t) ** 3, tail = 1 - (1 - Math.max(0, t - .17)) ** 3;
      const fall = t * t * radius * .49, oldFall = Math.max(0, t - .17) ** 2 * radius * .49;
      ctx.globalAlpha = Math.min(1, t * 19) * (1 - t * t);
      ctx.lineWidth = Math.max(1.2, radius * .023);
      ctx.beginPath();
      for (const [dx, dy] of burst.rays) {
        ctx.moveTo(x + dx * radius * tail, y + dy * radius * tail + oldFall);
        ctx.lineTo(x + dx * radius * head, y + dy * radius * head + fall);
      }
      ctx.stroke();
      ctx.fillStyle = "#fff4cf";
      const spark = Math.max(1, radius * .023);
      for (let j = 0; j < burst.rays.length; j += 3) {
        const [dx, dy] = burst.rays[j];
        ctx.fillRect(x + dx * radius * head, y + dy * radius * head + fall, spark, spark);
      }
    }
    ctx.globalAlpha = 1;
  }
  function tick(now) {
    paint(now);
    if (now - began < showMs) frame = window.requestAnimationFrame(tick);
  }
  if (animated) tick(began);
  else {
    paint(began);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => paint(began));
      observer.observe(canvas);
    }
  }
  return () => { if (frame != null) window.cancelAnimationFrame(frame); observer?.disconnect(); };
}
