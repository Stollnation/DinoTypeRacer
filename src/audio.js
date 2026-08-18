export class GameAudio {
  constructor({ keyNoise = true, musicEnabled = true, musicElement = null } = {}) {
    this.keyNoise = keyNoise;
    this.musicEnabled = musicEnabled;
    this.music = musicElement;
    this.context = null;
    if (this.music) { this.music.loop = true; this.music.volume = 0.28; }
  }
  setKeyNoise(value) { this.keyNoise = value; }
  setMusicEnabled(value) { this.musicEnabled = value; if (!value) this.pauseMusic(); }
  playMusic({ restart = false } = {}) {
    if (!this.music || !this.musicEnabled) return;
    if (restart) this.music.currentTime = 0;
    const playback = this.music.play();
    if (playback?.catch) playback.catch(() => {});
  }
  pauseMusic({ reset = false } = {}) {
    if (!this.music) return;
    this.music.pause();
    if (reset) this.music.currentTime = 0;
  }
  play(kind) {
    if ((kind === "key" || kind === "error") && !this.keyNoise) return;
    this.context ||= new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.context; const osc = ctx.createOscillator(); const gain = ctx.createGain(); const now = ctx.currentTime;
    const frequencies = { key: 420, error: 145, start: 650, finish: 880, save: 520 };
    osc.type = kind === "error" ? "sawtooth" : "sine";
    osc.frequency.setValueAtTime(frequencies[kind] || 420, now);
    if (kind === "finish") osc.frequency.exponentialRampToValueAtTime(1320, now + 0.22);
    gain.gain.setValueAtTime(kind === "key" ? 0.018 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now + 0.18);
  }
}
