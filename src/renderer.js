export class RaceRenderer {
  constructor(canvas, manifest) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.manifest = manifest;
    this.images = new Map();
    this.reducedMotion = false;
    this.currentTrackId = manifest.tracks[0]?.id;
    this.cameraState = null;
  }

  async load() {
    const trackUrls = this.manifest.tracks.flatMap((track) => Object.values(track.layers || {}).filter(Boolean));
    const characterUrls = this.manifest.characters.flatMap((character) => Object.values(character.animations).map((animation) => animation.file));
    await Promise.all([...new Set([...trackUrls, ...characterUrls])].map((url) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { this.images.set(url, image); resolve(); };
      image.onerror = resolve;
      image.src = url;
    })));
  }

  character(id) { return this.manifest.characters.find((item) => item.id === id) || this.manifest.characters[0]; }
  track(id = this.currentTrackId) { return this.manifest.tracks.find((item) => item.id === id) || this.manifest.tracks[0]; }
  setTrack(id) { this.currentTrackId = this.track(id)?.id; this.cameraState = null; }

  syncResolution(track) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const sourceWidth = track.viewportSize?.width || track.sourceSize?.width || 1823;
    const sourceHeight = track.viewportSize?.height || track.sourceSize?.height || 863;
    const width = Math.max(1, Math.round(rect.width * pixelRatio));
    const height = Math.max(1, Math.round(width * sourceHeight / sourceWidth));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  drawLayer(url, camera = { x: 0 }, parallax = 1, world = null) {
    if (!url) return false;
    const image = this.images.get(url);
    if (!image) return false;
    const viewportWidth = world?.viewportWidth || image.width;
    const viewportHeight = world?.viewportHeight || image.height;
    const worldWidth = world?.width || image.width;
    const sourceScaleX = image.width / Math.max(1, worldWidth);
    const sourceScaleY = image.height / Math.max(1, world?.height || image.height);
    const sx = Math.max(0, Math.min(image.width - viewportWidth * sourceScaleX, camera.x * parallax * sourceScaleX));
    const sy = 0;
    const sw = Math.min(image.width - sx, viewportWidth * sourceScaleX);
    const sh = Math.min(image.height, viewportHeight * sourceScaleY);
    this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, this.canvas.width, this.canvas.height);
    return true;
  }

  trackWorld(track) {
    const background = this.images.get(track.layers?.background);
    const viewportWidth = track.viewportSize?.width || track.sourceSize?.width || 1823;
    const viewportHeight = track.viewportSize?.height || track.sourceSize?.height || 863;
    const width = Math.max(viewportWidth, track.worldSize?.width || background?.width || track.sourceSize?.width || viewportWidth);
    const height = track.worldSize?.height || background?.height || track.sourceSize?.height || viewportHeight;
    return { width, height, viewportWidth, viewportHeight };
  }

  raceLine(track, world) {
    return {
      startX: track.raceLine?.startX ?? 115,
      finishX: track.raceLine?.finishX ?? (world.width - 175),
    };
  }

  smoothCameraStep(value, mode = "smootherstep") {
    const t = Math.max(0, Math.min(1, value));
    if (mode === "smoothstep") return t * t * (3 - 2 * t);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  cameraStops(track, world) {
    const maxX = Math.max(0, world.width - world.viewportWidth);
    const startCenterX = track.camera?.startCenter?.x ?? (world.viewportWidth / 2);
    const endCenterX = track.camera?.endCenter?.x ?? (world.width - world.viewportWidth / 2);
    return {
      startX: Math.max(0, Math.min(maxX, startCenterX - world.viewportWidth / 2)),
      endX: Math.max(0, Math.min(maxX, endCenterX - world.viewportWidth / 2)),
    };
  }

  cameraFor(track, playerProgress = 0, time = 0) {
    const world = this.trackWorld(track);
    const maxX = Math.max(0, world.width - world.viewportWidth);
    if (!maxX) return { x: 0, world };
    const line = this.raceLine(track, world);
    const progress = Math.max(0, Math.min(1, playerProgress || 0));
    const playerWorldX = line.startX + progress * (line.finishX - line.startX);
    const midpointX = line.startX + (line.finishX - line.startX) * 0.5;
    const stops = this.cameraStops(track, world);
    const targetX = playerWorldX >= midpointX ? stops.endX : stops.startX;
    const duration = track.camera?.durationMs ?? 2200;

    if (!this.cameraState || this.cameraState.trackId !== track.id || (progress < 0.02 && this.cameraState.progress > 0.2)) {
      this.cameraState = { trackId: track.id, x: stops.startX, fromX: stops.startX, toX: stops.startX, targetX: stops.startX, startTime: time, progress };
    }

    if (this.cameraState.targetX !== targetX) {
      this.cameraState.fromX = this.cameraState.x;
      this.cameraState.toX = targetX;
      this.cameraState.targetX = targetX;
      this.cameraState.startTime = time;
    }

    const elapsed = Math.max(0, time - this.cameraState.startTime);
    const cameraT = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
    const ease = this.smoothCameraStep(cameraT, track.camera?.ease);
    this.cameraState.x = this.cameraState.fromX + (this.cameraState.toX - this.cameraState.fromX) * ease;
    this.cameraState.progress = progress;
    return { x: this.cameraState.x, world };
  }

  draw({ racers, player, time = 0, countdown = false }) {
    const { ctx, canvas } = this;
    const track = this.track();
    this.syncResolution(track);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const camera = this.cameraFor(track, player?.progress || 0, time);
    const world = camera.world;
    if (!this.drawLayer(track.layers.background, camera, track.parallax?.background ?? 1, world)) {
      ctx.fillStyle = "#ffd9a8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    this.drawLayer(track.layers.middle, camera, track.parallax?.middle ?? 1, world);
    this.drawLayer(track.layers.track, camera, track.parallax?.track ?? 1, world);
    this.drawLayer(track.layers.startLine, camera, 1, world);
    this.drawLayer(track.layers.finishLine, camera, 1, world);

    const layeredRacers = [
      ...racers.map((racer, laneIndex) => ({ racer, laneIndex, renderLayer: 4 - laneIndex })),
      { racer: player, laneIndex: 4, renderLayer: 5 },
    ].sort((a, b) => a.renderLayer - b.renderLayer);
    layeredRacers.forEach(({ racer, laneIndex }) => {
      const isPlayer = racer.id === "player";
      const line = this.raceLine(track, world);
      const lanePath = track.lanePaths?.[laneIndex];
      const startBaseline = lanePath?.start?.y ?? track.laneBaselines?.[laneIndex] ?? (518 + laneIndex * 41);
      const finishBaseline = lanePath?.finish?.y ?? startBaseline;
      const progress = Math.max(0, Math.min(1, racer.progress || 0));
      const baseline = startBaseline + (finishBaseline - startBaseline) * progress;
      const laneY = baseline * canvas.height / world.viewportHeight;
      const stageScale = canvas.height / world.viewportHeight;
      const startX = (lanePath?.start?.x ?? line.startX) * stageScale;
      const finishX = (lanePath?.finish?.x ?? line.finishX) * stageScale;
      const worldX = startX + progress * (finishX - startX);
      const x = worldX - camera.x * stageScale;
      const character = this.character(racer.characterId);
      const state = racer.progress >= 1 ? "win" : countdown ? "idle" : "run";
      const animation = character.animations[state] || character.animations.run;
      const image = this.images.get(animation.file);
      ctx.save();
      ctx.globalAlpha = racer.isGhost ? 0.46 : 1;
      if (image) {
        const frames = Math.max(1, animation.frames || 1);
        const frameWidth = image.width / frames;
        const frameHeight = image.height;
        const frameIndex = this.reducedMotion ? 0 : Math.floor((time / 1000) * (animation.fps || 1)) % frames;
        const perspectiveScale = track.laneScales?.[laneIndex] ?? 1;
        const playerScale = isPlayer ? (character.playerScale || 1.14) : 1;
        const height = (character.renderSize || 132) * (character.raceScale || 1) * stageScale * perspectiveScale * playerScale;
        const width = height * (frameWidth / frameHeight);
        const offsetX = (character.offset?.x || 0) * stageScale * perspectiveScale;
        const offsetY = (character.offset?.y || 0) * stageScale * perspectiveScale;
        const useCenterAnchor = track.racerAnchor === "center";
        const footAnchorY = character.footAnchorY ?? frameHeight;
        const drawX = (useCenterAnchor ? x - width * 0.5 : x - width * 0.38) + offsetX;
        const drawY = (useCenterAnchor ? laneY - height * 0.5 : laneY - height * (footAnchorY / frameHeight)) + offsetY;
        ctx.drawImage(image, frameIndex * frameWidth, 0, frameWidth, frameHeight, drawX, drawY, width, height);
      } else {
        const radius = 24 * (track.laneScales?.[laneIndex] ?? 1);
        ctx.fillStyle = character.color;
        ctx.beginPath();
        ctx.arc(x, track.racerAnchor === "center" ? laneY : laneY - radius, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    this.drawLayer(track.layers.foreground, camera, track.parallax?.foreground ?? 1, world);
  }
}





