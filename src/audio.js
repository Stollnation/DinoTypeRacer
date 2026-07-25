export class GameAudio {
  constructor(muted = false) { this.muted = muted; this.context = null; }
  setMuted(value) { this.muted = value; }
  play(kind) {
    if (this.muted) return;
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
